import { useState } from "react";
import { Box, Menu, MenuItem } from "@mui/material";
import LanguageIcon from "@mui/icons-material/Language";

/** Human-readable names shown in the picker, each in its own language - the same set every app's own copy of this component already used. */
export const DEFAULT_LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
};

interface Props {
  current: string;
  /** The language codes to offer, in order - deployment's/policy's own `SUPPORTED_LANGUAGES`, or just `["en"]` for an app with no i18n system (calculator, today). */
  languages: string[];
  onSelect: (code: string) => void;
  /** Override/extend the default en/es/fr labels - omit to use `DEFAULT_LANGUAGE_LABELS`. */
  labels?: Record<string, string>;
}

/**
 * The language-picker menu shell - confirmed byte-identical in shape
 * (just not in *behaviour*) across all three apps' own `LanguageSwitcher.tsx`
 * before this shared copy was written 2026-09-19: policy's own reads/writes
 * a Zustand store field, deployment's own calls `i18n.changeLanguage` plus
 * a plain localStorage write, and calculator's own was a hardcoded,
 * English-only stub (no i18n system exists there at all). All three are
 * now this one presentational component - each app still owns its own
 * "where does the current language live, and what happens when it
 * changes" wiring, passed in as `current`/`languages`/`onSelect`.
 */
export default function LanguageSwitcher({ current, languages, onSelect, labels = DEFAULT_LANGUAGE_LABELS }: Props) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const currentLabel = labels[current] ?? current.toUpperCase();

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
        {languages.map((lng) => (
          <MenuItem
            key={lng}
            selected={lng === current}
            onClick={() => {
              onSelect(lng);
              setAnchor(null);
            }}
            sx={{ fontSize: "0.8125rem", minWidth: 140 }}
          >
            {labels[lng] ?? lng}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
