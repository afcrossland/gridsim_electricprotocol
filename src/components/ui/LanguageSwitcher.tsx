import { useState } from "react";
import { Box, Menu, MenuItem } from "@mui/material";
import LanguageIcon from "@mui/icons-material/Language";

// TODO: this app has no i18n yet - only English exists, so picking it is a
// no-op. Wiring up react-i18next (locale files, a translation function for
// component copy) is a separate, much larger piece of work; this stub just
// gives the bottom bar the same shape as the sibling gridsim-frontend
// project's language switcher, ready to grow into the real thing later.
const LANGUAGES = [{ code: "en", label: "English" }] as const;

export default function LanguageSwitcher() {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const current = LANGUAGES[0];

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
          "&:hover": { bgcolor: "grey.200" },
        }}
      >
        <LanguageIcon sx={{ fontSize: 16, flexShrink: 0 }} />
        {current.label}
      </Box>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        {LANGUAGES.map((lng) => (
          <MenuItem
            key={lng.code}
            selected={lng.code === current.code}
            onClick={() => setAnchor(null)}
            sx={{ fontSize: "0.8125rem", minWidth: 140 }}
          >
            {lng.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
