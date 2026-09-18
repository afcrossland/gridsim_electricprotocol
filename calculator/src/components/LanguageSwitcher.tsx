import { useState } from "react";
import { Box, Menu, MenuItem } from "@mui/material";
import LanguageIcon from "@mui/icons-material/Language";

/**
 * Same visual shape as the sibling apps' own LanguageSwitcher.tsx, but not
 * wired to i18next yet - this app is English-only for v1 (see README.md
 * and the standing "translate new text immediately" rule's explicit
 * exception for this build). The sibling apps are in the same state today
 * (`SUPPORTED_LANGUAGES = ["en"]`, es/fr built but not offered), so a menu
 * with only "English" in it is the same real state they're in, not a fake
 * placeholder - this just doesn't yet have the i18next scaffolding or any
 * other language's strings behind it to extend later.
 */
export default function LanguageSwitcher() {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

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
        English
      </Box>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <MenuItem selected sx={{ fontSize: "0.8125rem", minWidth: 140 }}>
          English
        </MenuItem>
      </Menu>
    </>
  );
}
