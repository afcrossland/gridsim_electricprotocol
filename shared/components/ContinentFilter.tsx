import { Checkbox, MenuItem, TextField } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";

import { CONTINENTS } from "../lib/continents";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  /** Shown in the closed field when nothing is selected - default matches every app's own pre-existing English copy. */
  allLabel?: string;
  /** Translates a continent's own English name (`CONTINENTS`' values) for display - omit for an app with no i18n (plain English). */
  translate?: (continent: string) => string;
  sx?: SxProps<Theme>;
}

/**
 * The continent multi-select every app's own filter panel used - confirmed
 * byte-identical in shape (a `TextField select multiple` with a checkbox
 * per `MenuItem`, closed-state text joining the selected continents or
 * falling back to `allLabel`) between policy's and deployment's own copies
 * before this shared version was written 2026-09-28, as part of giving
 * calculator the same filter box its siblings already had.
 */
export default function ContinentFilter({ value, onChange, label = "Continent", allLabel = "All continents", translate = (c) => c, sx }: Props) {
  return (
    <TextField
      select
      size="small"
      label={label}
      value={value}
      onChange={(e) => {
        const next = e.target.value;
        onChange(typeof next === "string" ? next.split(",") : next);
      }}
      slotProps={{
        select: {
          multiple: true,
          renderValue: (selected) =>
            (selected as string[]).length > 0 ? (selected as string[]).map(translate).join(", ") : allLabel,
        },
      }}
      sx={sx ?? { minWidth: 220, width: "100%" }}
    >
      {CONTINENTS.map((c) => (
        <MenuItem key={c} value={c}>
          <Checkbox
            icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
            checkedIcon={<CheckBoxIcon fontSize="small" />}
            checked={value.includes(c)}
            size="small"
            sx={{ mr: 1 }}
          />
          {translate(c)}
        </MenuItem>
      ))}
    </TextField>
  );
}
