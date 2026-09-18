import { Box, Grid, Typography } from "@mui/material";

import PaybackTable from "./PaybackTable";
import SliderField from "./SliderField";
import YearlySavingsTable from "./YearlySavingsTable";
import { currencyUnit } from "../lib/currency";
import type { PanelArray, SavingsResults, Tariffs } from "../lib/types";

/**
 * The "Economics" tab's content (named "Typical home" until Andrew's own
 * instruction 2026-09-16 renamed it, alongside "Refine" becoming "Design"):
 * first the system spec itself (panel/battery count - there's no separate
 * headline tile for this any more, it's the tab's own opening line), then
 * three tariff sliders (import day, import night, export - per Andrew's
 * own instruction 2026-09-17, "add three sliders... show all in $/kWh for
 * now"), then the payback table, which they drive. The from-solar/from-grid
 * tiles that used to open this tab moved to the Dispatch tab 2026-09-17
 * ("would be better on the dispatch tab"), alongside the new Sankey
 * diagram - see DispatchPanel.tsx. Fills the sidebar's own full width (no
 * `maxWidth` cap) now that the sidebar is 2/3 of the screen rather than a
 * narrow fixed column.
 *
 * The sliders' own unit switches to the visitor's local currency (USD,
 * CAD, AUD, NZD, EUR or GBP, USD everywhere else) per Andrew's own
 * instruction 2026-09-17 - see `lib/currency.ts` for the mapping and the
 * deliberate "display symbol only, not real conversion" caveat.
 */
export default function ResultsPanel({
  results,
  arrays,
  batteryKWh,
  tariffs,
  onTariffsChange,
  countryCode,
}: {
  results: SavingsResults;
  arrays: PanelArray[];
  batteryKWh: number;
  tariffs: Tariffs;
  onTariffsChange: (tariffs: Tariffs) => void;
  countryCode: string | undefined;
}) {
  const totalPanels = arrays.reduce((sum, a) => sum + a.panels, 0);
  const unit = currencyUnit(countryCode);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, width: "100%" }}>
      <Box>
        <Typography variant="h5">
          {totalPanels} panel{totalPanels === 1 ? "" : "s"} · {batteryKWh} kWh battery
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Here's what that could mean for a typical home at this location.
        </Typography>
      </Box>

      <Box>
        <Typography variant="overline" sx={{ display: "block", color: "text.secondary", mb: 1 }}>
          Tariffs
        </Typography>
        <Grid container spacing={2}>
          <Grid size={4}>
            <SliderField
              heading="Import price (day)"
              value={tariffs.importRateDay}
              unit={unit}
              min={0}
              max={1}
              step={0.01}
              precision={2}
              onChange={(importRateDay) => onTariffsChange({ ...tariffs, importRateDay })}
            />
          </Grid>
          <Grid size={4}>
            <SliderField
              heading="Import price (night)"
              value={tariffs.importRateNight}
              unit={unit}
              min={0}
              max={1}
              step={0.01}
              precision={2}
              onChange={(importRateNight) => onTariffsChange({ ...tariffs, importRateNight })}
            />
          </Grid>
          <Grid size={4}>
            <SliderField
              heading="Export sale value"
              value={tariffs.exportRate}
              unit={unit}
              min={0}
              max={0.5}
              step={0.01}
              precision={2}
              onChange={(exportRate) => onTariffsChange({ ...tariffs, exportRate })}
            />
          </Grid>
        </Grid>
      </Box>

      <Box>
        <Typography variant="overline" sx={{ display: "block", color: "text.secondary", mb: 1 }}>
          Payback
        </Typography>
        <PaybackTable rows={results.paybackRows} />
      </Box>

      <Box>
        <Typography variant="overline" sx={{ display: "block", color: "text.secondary", mb: 1 }}>
          Saving by year
        </Typography>
        <YearlySavingsTable rows={results.yearlySavings} unit={unit} />
      </Box>
    </Box>
  );
}

/**
 * Same StatTile shape as Deployment Explorer's own Sidebar.tsx -
 * border/radius/padding, an uppercase label, a bold value - so this app's
 * stat tiles read as the same family, wherever they show up (this tab's own
 * two tiles, and the three headline tiles App.tsx shows under the country
 * name). `muted` is for a tile with no real value yet ("Coming soon") -
 * same shape, de-emphasised text so it doesn't read as a real number.
 */
export function Stat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <Box
      sx={{
        flex: 1,
        borderRadius: "12px",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        p: 1.5,
        textAlign: "center",
      }}
    >
      <Typography
        sx={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: "text.secondary",
          textTransform: "uppercase",
          mb: 0.5,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontWeight: muted ? 600 : 800,
          fontSize: "1rem",
          color: muted ? "text.secondary" : "text.primary",
          fontStyle: muted ? "italic" : "normal",
          lineHeight: 1.2,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
