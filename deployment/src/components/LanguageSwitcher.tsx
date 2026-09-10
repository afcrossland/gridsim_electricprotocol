import { useState } from "react";
import { Box, Menu, MenuItem } from "@mui/material";
import LanguageIcon from "@mui/icons-material/Language";

// Copied from ep_policymap/src/components/ui/LanguageSwitcher.tsx - same
// stub-only reasoning: no i18n exists yet, this just gives the footer the
// same shape as the sibling apps' language switcher, ready to grow later.
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
          "&:hover": { bgcolor: "action.hover" },
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
