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

import type { ConfigProfile } from "./protocol";

export interface TemplateContext {
  fileName: string;
  trackId: number;
  trackNumber: number;
  language: string;
  codecName: string;
  trackName: string;
}

function sanitizeFileNamePart(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, "_");
}

function buildTokenValues(context: TemplateContext): Record<string, string> {
  return {
    file_name: context.fileName,
    track_id: String(context.trackId),
    track_number: String(context.trackNumber),
    language: context.language,
    codec_name: sanitizeFileNamePart(context.codecName),
    track_name: sanitizeFileNamePart(context.trackName),
  };
}

export function renderTemplate(
  template: string,
  context: TemplateContext,
): string {
  const values = buildTokenValues(context);
  const len = template.length;
  let out = "";
  let i = 0;
  while (i < len) {
    const ch = template[i];
    if (ch === "{") {
      if (i + 1 < len && template[i + 1] === "{") {
        out += "{";
        i += 2;
        continue;
      }
      let j = i + 1;
      while (j < len && template[j] !== "}" && template[j] !== "{") {
        j += 1;
      }
      if (j < len && template[j] === "}") {
        const name = template.slice(i + 1, j);
        if (Object.prototype.hasOwnProperty.call(values, name)) {
          out += values[name];
        } else {
          out += template.slice(i, j + 1);
        }
        i = j + 1;
      } else {
        out += template.slice(i, j);
        i = j;
      }
      continue;
    }
    if (ch === "}") {
      if (i + 1 < len && template[i + 1] === "}") {
        out += "}";
        i += 2;
        continue;
      }
      out += ch;
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

export function pickTemplateForTrackType(
  profile: ConfigProfile,
  trackType: string,
): string {
  switch (trackType) {
    case "video":
      return profile.videoTemplate;
    case "audio":
      return profile.audioTemplate;
    case "subtitles":
      return profile.subtitleTemplate;
    default:
      return profile.videoTemplate;
  }
}

export function shouldSelectTrackType(
  profile: ConfigProfile,
  trackType: string,
): boolean {
  switch (trackType) {
    case "video":
      return profile.selectVideo;
    case "audio":
      return profile.selectAudio;
    case "subtitles":
      return profile.selectSubtitle;
    default:
      return false;
  }
}

export function getDriveKey(path: string): string {
  const driveLetter = path.match(/^([a-zA-Z]):/);
  if (driveLetter) return `${driveLetter[1].toUpperCase()}:`;
  const unc = path.match(/^(\\\\[^\\/]+[\\/][^\\/]+)/);
  if (unc) return unc[1].toUpperCase();
  return "default";
}

export function formatHMS(ms: number): string {
  if (ms < 0 || !Number.isFinite(ms)) return "--:--:--";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
