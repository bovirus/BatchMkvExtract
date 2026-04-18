/*
 *   Copyright (c) 2026. caoccao.com Sam Cao
 *   All rights reserved.

 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at

 *   http://www.apache.org/licenses/LICENSE-2.0

 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

use anyhow::Result;
use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};

use crate::mkvtoolnix;
use crate::protocol::{ExtractEntry, ExtractSnapshot};

enum TaskStatus {
    Queued,
    Extracting,
}

struct TaskState {
    status: TaskStatus,
    progress: u32,
    args: Vec<String>,
    cancel_requested: bool,
}

#[derive(Default)]
struct DriveState {
    extracting: Option<String>,
    queued: Vec<String>,
}

struct ExtractState {
    tasks: HashMap<String, TaskState>,
    drives: HashMap<String, DriveState>,
    children: HashMap<String, Arc<Mutex<std::process::Child>>>,
}

impl ExtractState {
    fn new() -> Self {
        Self {
            tasks: HashMap::new(),
            drives: HashMap::new(),
            children: HashMap::new(),
        }
    }
}

static STATE: OnceLock<Mutex<ExtractState>> = OnceLock::new();

fn state() -> &'static Mutex<ExtractState> {
    STATE.get_or_init(|| Mutex::new(ExtractState::new()))
}

fn get_drive_key(file: &str) -> String {
    #[cfg(target_os = "windows")]
    {
        let path = std::path::Path::new(file);
        if let Some(first) = path.components().next() {
            if let std::path::Component::Prefix(prefix) = first {
                return prefix
                    .as_os_str()
                    .to_string_lossy()
                    .to_ascii_uppercase();
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = file;
    }
    "default".to_string()
}

pub fn enqueue(file: String, args: Vec<String>) -> Result<()> {
    let drive_key = get_drive_key(&file);
    let should_start;
    {
        let mut st = state().lock().unwrap();
        if st.tasks.contains_key(&file) {
            return Ok(());
        }
        st.tasks.insert(
            file.clone(),
            TaskState {
                status: TaskStatus::Queued,
                progress: 0,
                args,
                cancel_requested: false,
            },
        );
        let drive = st.drives.entry(drive_key.clone()).or_default();
        if drive.extracting.is_none() {
            drive.extracting = Some(file.clone());
            if let Some(t) = st.tasks.get_mut(&file) {
                t.status = TaskStatus::Extracting;
            }
            should_start = true;
        } else {
            drive.queued.push(file.clone());
            should_start = false;
        }
    }
    if should_start {
        spawn_worker(file);
    }
    Ok(())
}

pub fn cancel(file: String) -> Result<()> {
    let child_to_kill: Option<Arc<Mutex<std::process::Child>>>;
    {
        let mut st = state().lock().unwrap();
        let is_extracting = match st.tasks.get(&file) {
            Some(t) => matches!(t.status, TaskStatus::Extracting),
            None => return Ok(()),
        };
        if !is_extracting {
            st.tasks.remove(&file);
            let drive_key = get_drive_key(&file);
            if let Some(drive) = st.drives.get_mut(&drive_key) {
                drive.queued.retain(|f| f != &file);
            }
            return Ok(());
        }
        if let Some(t) = st.tasks.get_mut(&file) {
            t.cancel_requested = true;
        }
        child_to_kill = st.children.get(&file).cloned();
    }
    if let Some(child) = child_to_kill {
        if let Ok(mut guard) = child.lock() {
            let _ = guard.kill();
        }
    }
    Ok(())
}

pub fn snapshot() -> ExtractSnapshot {
    let st = state().lock().unwrap();
    let entries: Vec<ExtractEntry> = st
        .tasks
        .iter()
        .map(|(file, task)| ExtractEntry {
            file: file.clone(),
            status: match task.status {
                TaskStatus::Queued => "queued".to_owned(),
                TaskStatus::Extracting => "extracting".to_owned(),
            },
            progress: task.progress,
        })
        .collect();
    ExtractSnapshot { entries }
}

fn spawn_worker(file: String) {
    std::thread::spawn(move || {
        run_worker(file);
    });
}

fn run_worker(file: String) {
    let args: Option<Vec<String>> = {
        let st = state().lock().unwrap();
        st.tasks.get(&file).map(|t| t.args.clone())
    };
    let args = match args {
        Some(a) => a,
        None => {
            on_worker_finished(&file);
            return;
        }
    };

    match mkvtoolnix::spawn_mkvextract(&file, &args) {
        Err(err) => {
            log::error!("spawn_mkvextract failed for {}: {}", file, err);
        }
        Ok(mut child) => {
            let stdout = child.stdout.take();
            let child_arc = Arc::new(Mutex::new(child));
            {
                let mut st = state().lock().unwrap();
                st.children.insert(file.clone(), child_arc.clone());
            }
            if let Some(stdout) = stdout {
                let file_for_cb = file.clone();
                mkvtoolnix::read_mkvextract_output(stdout, |line| {
                    if let Some(percent) = mkvtoolnix::parse_mkvextract_progress(line) {
                        let mut st = state().lock().unwrap();
                        if let Some(t) = st.tasks.get_mut(&file_for_cb) {
                            t.progress = percent;
                        }
                    }
                });
            }
            if let Ok(mut guard) = child_arc.lock() {
                let _ = guard.wait();
            }
        }
    }

    on_worker_finished(&file);
}

fn on_worker_finished(file: &str) {
    let next_file = {
        let mut st = state().lock().unwrap();
        st.children.remove(file);
        st.tasks.remove(file);
        let drive_key = get_drive_key(file);
        let drive = st.drives.entry(drive_key).or_default();
        if drive.extracting.as_deref() == Some(file) {
            drive.extracting = None;
        }
        drive.queued.retain(|f| f != file);
        if drive.extracting.is_none() && !drive.queued.is_empty() {
            let next = drive.queued.remove(0);
            drive.extracting = Some(next.clone());
            if let Some(t) = st.tasks.get_mut(&next) {
                t.status = TaskStatus::Extracting;
                t.progress = 0;
            }
            Some(next)
        } else {
            None
        }
    };
    if let Some(next) = next_file {
        spawn_worker(next);
    }
}
