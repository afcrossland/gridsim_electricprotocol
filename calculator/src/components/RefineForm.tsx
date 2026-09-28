import { Box, Grid, Typography } from "@mui/material";

import LockedSliderField from "./LockedSliderField";
import SliderField from "./SliderField";

/**
 * The "Design" tab's content - reduced to four sliders per Andrew's own
 * instruction 2026-09-16 ("reduce our choices to... hide the EV and tariff
 * boxes... all inputs as sliders... tidy up"), laid out as a 2-column grid
 * (per Andrew's own instruction 2026-09-17, matching gridsim-frontend's
 * own household-settings sliders - System Sizing there is the same
 * panel-wattage/panel-count/battery-power/battery-energy shape as this
 * tab, in the same 2-up grid): panel count, panel wattage, battery size,
 * and annual demand. Multi-array support, tilt/azimuth, EV charging and
 * tariffs all still exist in the underlying model (App.tsx keeps a
 * single-element `arrays` list, and fixed EV/tariff defaults) - they're
 * just not exposed here any more.
 *
 * Panel size, battery and demand became member-only teasers 2026-09-28 per
 * Andrew's own instruction ("make panel size, battery size and demand
 * members only... fade and put members only over them") - "Number of
 * panels" stays the one free lever. The three locked fields still show
 * their own real current value (via `LockedSliderField`, same "blur +
 * Members only" convention as deployment's own `LockedMetricChart.tsx`),
 * just not a draggable control - the values themselves are unchanged and
 * still drive the other tabs' calculations exactly as before, only this
 * tab's own input for them is gone. There's no submit button - App.tsx's
 * own effect recalculates automatically (debounced) whenever `panels`
 * changes.
 */
export default function RefineForm({
  panels,
  onPanelsChange,
  panelWatts,
  batteryKWh,
  annualKWh,
}: {
  panels: number;
  onPanelsChange: (panels: number) => void;
  panelWatts: number;
  batteryKWh: number;
  annualKWh: number;
}) {
  return (
    <Box data-tour="design-sliders" sx={{ display: "flex", flexDirection: "column", gap: 3, width: "100%" }}>
      <Typography variant="h5">
        Design your system
      </Typography>

      <Grid container spacing={2}>
        <Grid size={6}>
          <SliderField heading="Number of panels" value={panels} unit="" min={0} max={50} step={1} onChange={onPanelsChange} />
        </Grid>
        <Grid size={6}>
          <LockedSliderField heading="Panel size" value={panelWatts} unit="Wp" />
        </Grid>
        <Grid size={6}>
          <LockedSliderField heading="Battery" value={batteryKWh} unit="kWh" precision={1} />
        </Grid>
        <Grid size={6}>
          <LockedSliderField heading="Annual electricity demand" value={annualKWh} unit="kWh" />
        </Grid>
      </Grid>
    </Box>
  );
}
