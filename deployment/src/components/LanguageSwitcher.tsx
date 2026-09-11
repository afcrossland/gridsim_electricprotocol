import { useState } from "react";
import { Box, Menu, MenuItem } from "@mui/material";
import LanguageIcon from "@mui/icons-material/Language";
import { useTranslation } from "react-i18next";

import { LANGUAGE_KEY, SUPPORTED_LANGUAGES } from "../i18n";

// Human-readable names shown in the picker, each in its own language - same
// convention as ep_policymap's own LanguageSwitcher.tsx.
const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
};

/**
 * Real i18next switcher, added 2026-09-11 - this used to be a single-item
 * stub (see git history) since no i18n existed yet. No persisted store in
 * this app, so the choice is written straight to localStorage (see
 * main.tsx, which reads it back on the next load) rather than through a
 * store action the way ep_policymap's own switcher does.
 */
export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  const currentLabel = LANGUAGE_LABELS[i18n.language] ?? i18n.language.toUpperCase();

  const handleSelect = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem(LANGUAGE_KEY, lng);
    setAnchor(null);
  };

  return (
    <>
      <Box
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 0.5,
          borderRadius: 1,
          cursor: "pointer",
          color: "text.secondary",
          fontSize: "0.8125rem",
          fontWeight: 500,
          userSelect: "none",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <LanguageIcon sx={{ fontSize: 16, flexShrink: 0 }} />
        {currentLabel}
      </Box>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        {SUPPORTED_LANGUAGES.map((lng) => (
          <MenuItem
            key={lng}
            selected={lng === i18n.language}
            onClick={() => handleSelect(lng)}
            sx={{ fontSize: "0.8125rem", minWidth: 140 }}
          >
            {LANGUAGE_LABELS[lng] ?? lng}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
