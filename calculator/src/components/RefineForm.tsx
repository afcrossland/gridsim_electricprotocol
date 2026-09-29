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
 * Members only" convention as deployment's own `LockedMetricChart.tsx`)
 * until `member` is true (the shared password gate, see
 * `shared/lib/membership.ts`), at which point they become real, draggable
 * `SliderField`s again - the values themselves were never actually gated
 * (they keep driving the other tabs' calculations either way), only
 * whether this tab lets a visitor change them. There's no submit button -
 * App.tsx's own effect recalculates automatically (debounced) whenever one
 * of these values changes.
 */
export default function RefineForm({
  panels,
  onPanelsChange,
  panelWatts,
  onPanelWattsChange,
  batteryKWh,
  onBatteryChange,
  annualKWh,
  onAnnualKWhChange,
  member,
}: {
  panels: number;
  onPanelsChange: (panels: number) => void;
  panelWatts: number;
  onPanelWattsChange: (watts: number) => void;
  batteryKWh: number;
  onBatteryChange: (kwh: number) => void;
  annualKWh: number;
  onAnnualKWhChange: (kwh: number) => void;
  member: boolean;
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
          {member ? (
            <SliderField
              heading="Panel size"
              value={panelWatts}
              unit="Wp"
              min={400}
              max={750}
              step={10}
              onChange={onPanelWattsChange}
            />
          ) : (
            <LockedSliderField heading="Panel size" value={panelWatts} unit="Wp" />
          )}
        </Grid>
        <Grid size={6}>
          {member ? (
            <SliderField
              heading="Battery"
              value={batteryKWh}
              unit="kWh"
              min={0}
              max={40}
              step={2.5}
              precision={1}
              onChange={onBatteryChange}
            />
          ) : (
            <LockedSliderField heading="Battery" value={batteryKWh} unit="kWh" precision={1} />
          )}
        </Grid>
        <Grid size={6}>
          {member ? (
            <SliderField
              heading="Annual electricity demand"
              value={annualKWh}
              unit="kWh"
              min={500}
              max={20000}
              step={250}
              onChange={onAnnualKWhChange}
            />
          ) : (
            <LockedSliderField heading="Annual electricity demand" value={annualKWh} unit="kWh" />
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
