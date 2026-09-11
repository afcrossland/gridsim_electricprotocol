import { useMemo } from "react";
import { Autocomplete, Box, Paper, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useTranslation } from "react-i18next";

import FlagImg from "./FlagImg";
import { jurisdictionName, jurisdictions } from "../lib/jurisdictions";
import { EMBER_SOLAR } from "../lib/emberSolar";
import { EMBER_GENERATION } from "../lib/emberGeneration";

interface Option {
  code: string;
  label: string;
  group: string;
  hasData: boolean;
}

interface Props {
  selected: string | null;
  onSelect: (code: string) => void;
}

/**
 * Adapted from ep_policymap/src/components/map/JurisdictionSearch.tsx -
 * same "search everything drawable, not just what has data" reasoning, same
 * footer placement. No score to show alongside a result here, just whether
 * either real Ember dataset actually covers it.
 */
export default function CountrySearch({ selected, onSelect }: Props) {
  const { t, i18n } = useTranslation();
  const options = useMemo<Option[]>(
    () =>
      jurisdictions
        .filter((j) => j.mappable)
        .map((j) => ({
          code: j.code,
          label: jurisdictionName(j.code, i18n.language),
          // `region` is still English-only (a UN sub-region or the parent
          // country's own build-time name) - no client-side API covers UN
          // M49 sub-region names the way Intl.DisplayNames covers
          // countries, so this grouping header is a known, smaller gap.
          group: j.region ?? "Other",
          hasData: j.code in EMBER_SOLAR || j.code in EMBER_GENERATION,
        }))
        .sort(
          (a, b) =>
            a.group.localeCompare(b.group) || Number(b.hasData) - Number(a.hasData) || a.label.localeCompare(b.label),
        ),
    [i18n.language],
  );

  const value = options.find((o) => o.code === selected) ?? null;

  return (
    <Paper
      elevation={0}
      sx={{
        px: 1,
        py: 0.5,
        width: 280,
        maxWidth: "60%",
        position: "relative",
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Autocomplete
        size="small"
        options={options}
        value={value}
        groupBy={(o) => o.group}
        getOptionLabel={(o) => o.label}
        isOptionEqualToValue={(a, b) => a.code === b.code}
        onChange={(_, option) => option && onSelect(option.code)}
        renderOption={(props, option) => {
          const { key, ...liProps } = props as typeof props & { key: string };
          return (
            <Box component="li" key={key} {...liProps} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <FlagImg code={option.code} />
              <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
                {option.label}
              </Typography>
              {!option.hasData && (
                <Typography variant="caption" color="text.disabled">
                  no data
                </Typography>
              )}
            </Box>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={t("footer.searchPlaceholder")}
            variant="standard"
            slotProps={{
              input: {
                ...params.InputProps,
                disableUnderline: true,
                startAdornment: (
                  <>
                    {selected ? (
                      <Box sx={{ mr: 0.75, display: "flex" }}>
                        <FlagImg code={selected} />
                      </Box>
                    ) : (
                      <SearchIcon sx={{ fontSize: 18, color: "text.disabled", mr: 0.75, flexShrink: 0 }} />
                    )}
                    {params.InputProps.startAdornment}
                  </>
                ),
              },
            }}
          />
        )}
      />
    </Paper>
  );
}
