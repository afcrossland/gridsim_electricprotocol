import { ToggleButton, ToggleButtonGroup } from "@mui/material";

export type MobileView = "map" | "list";

/**
 * The List / Map switch every app shows on a phone, where the map and the sidebar cannot sit side by side so they become
 * two full-screen views. (Each app used to carry its own copy of this markup.)
 */
export default function MobileViewToggle({
  value,
  onChange,
  listLabel = "List",
  mapLabel = "Map",
}: {
  value: MobileView;
  onChange: (next: MobileView) => void;
  listLabel?: string;
  mapLabel?: string;
}) {
  return (
    <ToggleButtonGroup size="small" exclusive value={value} onChange={(_, next) => next && onChange(next)}>
      <ToggleButton value="list" sx={{ py: 0.25, px: 1.5, fontSize: "0.75rem" }}>
        {listLabel}
      </ToggleButton>
      <ToggleButton value="map" sx={{ py: 0.25, px: 1.5, fontSize: "0.75rem" }}>
        {mapLabel}
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
