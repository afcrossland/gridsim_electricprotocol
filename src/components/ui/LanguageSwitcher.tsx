import { useState } from "react";
import { Box, Menu, MenuItem } from "@mui/material";
import LanguageIcon from "@mui/icons-material/Language";

import { SUPPORTED_LANGUAGES } from "../../i18n";
import { useProtocolStore } from "../../stores/protocolStore";

// Human-readable names shown in the picker, each in its own language - same
// convention as the sibling gridsim-frontend project's own LanguageSwitcher.
const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
};

/**
 * Real i18next switcher, added 2026-09-11 - this used to be a single-item
 * stub (see git history) since no i18n existed yet. `setLanguage` (in
 * protocolStore.ts) both calls `i18n.changeLanguage` and persists the
 * choice, matching how `mode` is handled.
 */
export default function LanguageSwitcher() {
  const language = useProtocolStore((s) => s.language);
  const setLanguage = useProtocolStore((s) => s.setLanguage);
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  const currentLabel = LANGUAGE_LABELS[language] ?? language.toUpperCase();

  const handleSelect = (lng: string) => {
    setLanguage(lng);
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
            selected={lng === language}
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
