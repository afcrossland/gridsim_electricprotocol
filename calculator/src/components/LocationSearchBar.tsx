import { useState } from "react";
import { Autocomplete, Box, CircularProgress, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

import FlagImg from "../../../shared/components/FlagImg";
import type { Location } from "../lib/types";

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: { country_code?: string };
}

/**
 * Compact place-name search for the footer bar - same Nominatim search as
 * the old full-page LocationPicker step used to be, just without its own
 * heading/intro copy, since it now lives alongside the map rather than as
 * a standalone first step (see App.tsx's restructure 2026-09-15, matching
 * Deployment Explorer's own map+search footer layout). Flags per result
 * (and in the input once something's picked) mirror CountrySearch.tsx's
 * own FlagImg treatment there - added 2026-09-15 per Andrew's instruction.
 * `maxWidth: "60%"` (matching CountrySearch's own) added 2026-09-18 so this
 * doesn't overflow a narrow phone screen when it sits next to the mobile
 * Map/List toggle in App.tsx's own mobile layout.
 *
 * The width/maxWidth constraint lives on this wrapping `Box`, not on the
 * `Autocomplete` itself (unlike an earlier version of this file) - the
 * `Autocomplete`'s own parent (App.tsx's plain `<Box data-tour=...>`) has no
 * defined width, so a percentage `maxWidth` set directly on the Autocomplete
 * resolved against that undefined containing block and was ignored for the
 * *flex item's* own size: the wrapper rendered at the full hard-coded 320px
 * regardless, while the Autocomplete inside separately shrank to 60% of
 * that, leaving dead space and pushing the sibling Map/List toggle off the
 * right edge of the screen (found 2026-09-20, matching CountrySearch.tsx's
 * own Paper-wraps-Autocomplete shape fixes it - the constrained element must
 * be the one that's actually the flex item).
 */
export default function LocationSearchBar({
  selectedCountryCode,
  onSelect,
}: {
  selectedCountryCode?: string;
  onSelect: (location: Location) => void;
}) {
  const [options, setOptions] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function search(query: string) {
    if (!query.trim()) {
      setOptions([]);
      return;
    }
    setLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      const results: NominatimResult[] = res.ok ? await res.json() : [];
      setOptions(results);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }

  function pick(result: NominatimResult) {
    onSelect({
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      displayName: result.display_name,
      countryCode: (result.address?.country_code ?? "").toLowerCase(),
    });
  }

  let debounce: ReturnType<typeof setTimeout>;

  return (
    <Box sx={{ width: 320, maxWidth: "60%" }}>
      <Autocomplete
        size="small"
        sx={{ width: "100%" }}
        options={options}
        getOptionLabel={(o) => o.display_name}
        loading={loading}
        filterOptions={(x) => x}
        onInputChange={(_, value) => {
          clearTimeout(debounce);
          debounce = setTimeout(() => search(value), 400);
        }}
        onChange={(_, value) => value && pick(value)}
        renderOption={(props, option) => {
          const { key, ...liProps } = props as typeof props & { key: string };
          return (
            <Box component="li" key={key} {...liProps} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <FlagImg code={option.address?.country_code ?? ""} />
              <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                {option.display_name}
              </Typography>
            </Box>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Search for a country or city"
            slotProps={{
              input: {
                ...params.InputProps,
                startAdornment: selectedCountryCode ? (
                  <Box sx={{ ml: 0.5, mr: 0.25, display: "flex" }}>
                    <FlagImg code={selectedCountryCode} />
                  </Box>
                ) : (
                  <SearchIcon sx={{ fontSize: 18, color: "text.disabled", ml: 0.5, mr: 0.25, flexShrink: 0 }} />
                ),
                endAdornment: (
                  <>
                    {loading ? <CircularProgress color="inherit" size={16} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              },
            }}
          />
        )}
      />
    </Box>
  );
}
