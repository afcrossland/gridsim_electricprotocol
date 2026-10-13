import { useMemo, useState } from "react";
import { Box, Button, Divider, ListItemButton, ListItemIcon, ListItemText, Popover, TextField, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import { useTranslation } from "react-i18next";

import FlagImg from "../../../shared/components/FlagImg";
import { jurisdictionName } from "../lib/jurisdictions";
import { codesForMetric } from "../lib/metrics";

interface Props {
  /** The panel already open (primary country) plus every comparator already added - both excluded from the candidate list, same reasoning as policy's own `ComparePicker`'s `comparedCodes`. */
  excludeCodes: string[];
  maxCount: number;
  /**
   * Whether the comparator cap is already reached - passed by the caller
   * rather than derived from `excludeCodes.length >= maxCount` here, since
   * `excludeCodes` always includes the primary country on top of the
   * actual comparators (it exists to filter the candidate list, not to
   * count against the cap) - comparing its length directly to `maxCount`
   * disabled the button one comparator early. Fixed 2026-10-14 ("if we
   * get to 5 countries and then remove one, compare does not appear").
   */
  atMax: boolean;
  onAdd: (code: string) => void;
}

/**
 * The "+" entry point for Compare mode - adapted from policy's own
 * `src/components/layout/ComparePicker.tsx` (duplicated, not imported -
 * this round only touches `deployment/`), simplified to add-only: there's
 * no checklist/uncheck here, since removing a comparator already lives on
 * its own `ComparePanel`'s own "✕" - picking a country here just adds it
 * and drops it from this list, so there's nothing left to toggle off from
 * this side. Stays open after a pick (not closing) so adding several in a
 * row is a run of clicks in one place, same convenience as policy's own.
 */
export default function ComparePicker({ excludeCodes, maxCount, atMax, onAdd }: Props) {
  const { t, i18n } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [query, setQuery] = useState("");

  const excluded = useMemo(() => new Set(excludeCodes), [excludeCodes]);
  const candidates = useMemo(
    () =>
      codesForMetric("capacity")
        .filter((code) => !excluded.has(code))
        .map((code) => ({ code, name: jurisdictionName(code, i18n.language) }))
        .filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [excluded, query, i18n.language],
  );

  const close = () => {
    setAnchor(null);
    setQuery("");
  };

  return (
    <>
      <Tooltip title={atMax ? t("comparePicker.maxReached", { maxCount }) : ""}>
        <span>
          <Button
            size="small"
            startIcon={<AddIcon fontSize="small" />}
            disabled={atMax}
            onClick={(e) => setAnchor(e.currentTarget)}
          >
            {t("comparePicker.addCountry")}
          </Button>
        </span>
      </Tooltip>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        <Box sx={{ width: 300, maxWidth: "calc(100vw - 32px)", maxHeight: 400, display: "flex", flexDirection: "column" }}>
          <Box sx={{ p: 1.5, pb: 1 }}>
            <TextField
              size="small"
              variant="standard"
              fullWidth
              autoFocus
              placeholder={t("footer.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              slotProps={{
                input: {
                  disableUnderline: true,
                  startAdornment: <SearchIcon sx={{ fontSize: 18, color: "text.disabled", mr: 0.75 }} />,
                },
              }}
            />
          </Box>
          <Divider />

          <Box sx={{ overflowY: "auto", flex: 1 }}>
            {candidates.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                {t("comparePicker.noMatches")}
              </Typography>
            ) : (
              candidates.map((c) => (
                <ListItemButton key={c.code} dense onClick={() => onAdd(c.code)}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <FlagImg code={c.code} size={16} />
                  </ListItemIcon>
                  <ListItemText primary={c.name} />
                </ListItemButton>
              ))
            )}
          </Box>
        </Box>
      </Popover>
    </>
  );
}
