import type { ReactNode } from "react";
import { Checkbox, ListSubheader, MenuItem, TextField } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";

import { CONTINENTS } from "../lib/continents";

/**
 * Interleaves a non-selectable `ListSubheader` before each run of options
 * that share a group (per `groupLabel`), or just maps `renderItem` over
 * `options` unchanged when no `groupLabel` was given - the one piece of
 * logic both the single- and multi-select branches below need.
 */
function withGroups(
  options: readonly string[],
  groupLabel: ((option: string) => string) | undefined,
  renderItem: (option: string) => ReactNode,
): ReactNode[] {
  if (!groupLabel) return options.map(renderItem);
  const nodes: ReactNode[] = [];
  let lastGroup: string | null = null;
  for (const option of options) {
    const group = groupLabel(option);
    if (group !== lastGroup) {
      nodes.push(
        <ListSubheader key={`group-${group}`} sx={{ fontWeight: 700 }}>
          {group}
        </ListSubheader>,
      );
      lastGroup = group;
    }
    nodes.push(renderItem(option));
  }
  return nodes;
}

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  /** Shown in the closed field when nothing is selected - default matches every app's own pre-existing English copy. */
  allLabel?: string;
  /** Translates a continent's own English name (`CONTINENTS`' values) for display - omit for an app with no i18n (plain English). */
  translate?: (continent: string) => string;
  sx?: SxProps<Theme>;
  /**
   * Restricts the picker to one continent at a time instead of several -
   * deployment's own map zooms to fit whatever's selected (2026-10-14),
   * and fitting the union of several scattered continents doesn't read
   * as "zoom in here" the way one continent does. Defaults to `true`
   * (every app's own original multi-select, unchanged) - only deployment
   * opts into `false`.
   */
  multiple?: boolean;
  /**
   * The list to pick from - defaults to the six-continent `CONTINENTS`
   * list every app originally used. Deployment's own filter (2026-10-14)
   * passes the UN geoscheme's finer `SUBREGIONS` list instead (see
   * `shared/lib/continents.ts`) - the component itself doesn't care which
   * flat string list it's showing, so this is the only change that took.
   */
  options?: readonly string[];
  /**
   * Groups `options` under a non-selectable subheader wherever this
   * returns a new value - deployment's own 22-item sub-region list groups
   * by continent this way (2026-10-14, "add break headers with the
   * continent names... easier to use"), since a flat 22-item list is a
   * lot to scan without the six-continent structure it's really built
   * from. Omitted (no grouping) by every other caller - a six-item
   * continent list needs no further grouping above it. Assumes `options`
   * is already sorted so every item in a group is contiguous, same
   * assumption `SUBREGIONS`' own declaration order relies on.
   */
  groupLabel?: (option: string) => string;
}

/**
 * The continent (or, per `options`, any other flat region list) select
 * every app's own filter panel used - confirmed byte-identical in shape (a
 * `TextField select multiple` with a checkbox per `MenuItem`, closed-state
 * text joining the selections or falling back to `allLabel`) between
 * policy's and deployment's own copies before this shared version was
 * written 2026-09-28, as part of giving calculator the same filter box its
 * siblings already had.
 */
export default function ContinentFilter({
  value,
  onChange,
  label = "Continent",
  allLabel = "All continents",
  translate = (c) => c,
  sx,
  multiple = true,
  options = CONTINENTS,
  groupLabel,
}: Props) {
  if (!multiple) {
    return (
      <TextField
        select
        size="small"
        label={label}
        value={value[0] ?? ""}
        onChange={(e) => onChange(e.target.value ? [e.target.value] : [])}
        sx={sx ?? { minWidth: 220, width: "100%" }}
      >
        <MenuItem value="">{allLabel}</MenuItem>
        {withGroups(options, groupLabel, (c) => (
          <MenuItem key={c} value={c}>
            {translate(c)}
          </MenuItem>
        ))}
      </TextField>
    );
  }

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
      {withGroups(options, groupLabel, (c) => (
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
