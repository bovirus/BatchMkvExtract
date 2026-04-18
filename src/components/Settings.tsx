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

import {
  Box,
  FormControl,
  MenuItem,
  Paper,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import BrightnessAutoIcon from "@mui/icons-material/BrightnessAuto";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import PaletteIcon from "@mui/icons-material/Palette";
import { useTranslation } from "react-i18next";
import * as Protocol from "../protocol";
import { useMkvStore } from "../store";

function SectionHeader({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
      <Box sx={{ color: "primary.main", display: "flex" }}>{icon}</Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
    </Box>
  );
}

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        py: 1,
        "&:not(:last-child)": { borderBottom: 1, borderColor: "divider" },
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Box>{children}</Box>
    </Box>
  );
}

export default function Settings() {
  const { t } = useTranslation();
  const config = useMkvStore((s) => s.config);
  const updateConfig = useMkvStore((s) => s.updateConfig);

  if (!config) {
    return null;
  }

  return (
    <Box sx={{ width: "100%", maxWidth: 640, mx: "auto", py: 2, px: 1 }}>
      <Stack spacing={2}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <SectionHeader
            icon={<PaletteIcon fontSize="small" />}
            title={t("settings.appearance")}
          />
          <SettingRow label={t("settings.displayMode")}>
            <ToggleButtonGroup
              value={config.displayMode}
              exclusive
              size="small"
              onChange={(_e, value) => {
                if (value !== null) {
                  updateConfig({ displayMode: value as Protocol.DisplayMode });
                }
              }}
            >
              <ToggleButton
                value={Protocol.DisplayMode.Auto}
                sx={{ px: 1.5, gap: 0.5 }}
              >
                <BrightnessAutoIcon sx={{ fontSize: 16 }} />
                <Typography variant="caption">
                  {t("settings.autoMode")}
                </Typography>
              </ToggleButton>
              <ToggleButton
                value={Protocol.DisplayMode.Light}
                sx={{ px: 1.5, gap: 0.5 }}
              >
                <LightModeIcon sx={{ fontSize: 16 }} />
                <Typography variant="caption">
                  {t("settings.lightMode")}
                </Typography>
              </ToggleButton>
              <ToggleButton
                value={Protocol.DisplayMode.Dark}
                sx={{ px: 1.5, gap: 0.5 }}
              >
                <DarkModeIcon sx={{ fontSize: 16 }} />
                <Typography variant="caption">
                  {t("settings.darkMode")}
                </Typography>
              </ToggleButton>
            </ToggleButtonGroup>
          </SettingRow>
          <SettingRow label={t("settings.theme")}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <Select
                value={config.theme}
                onChange={(e) =>
                  updateConfig({ theme: e.target.value as Protocol.Theme })
                }
              >
                {Protocol.getThemes().map((theme) => (
                  <MenuItem key={theme} value={theme}>
                    {theme}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </SettingRow>
          <SettingRow label={t("settings.language")}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <Select
                value={config.language}
                onChange={(e) =>
                  updateConfig({
                    language: e.target.value as Protocol.Language,
                  })
                }
              >
                {Protocol.getLanguages().map((lang) => (
                  <MenuItem key={lang} value={lang}>
                    {Protocol.getLanguageLabel(lang)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </SettingRow>
        </Paper>
      </Stack>
    </Box>
  );
}
