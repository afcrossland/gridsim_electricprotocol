import { Box, Slider, Typography } from "@mui/material";

interface SliderFieldProps {
  heading: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  precision?: number;
  onChange: (value: number) => void;
}

/**
 * Same heading-then-bold-value-then-slider shape as gridsim-frontend's own
 * `FormattedSlider` (ui/sliders/formattedSlider.tsx) - a muted label above
 * a large bold "value + unit" line, the slider itself below, no icon and
 * no separate min/max caption (gridsim's own doesn't have either) - per
 * Andrew's own instruction 2026-09-17 ("look at gridsim-frontend to work
 * out how to best lay out the sliders on design... we dont want emojis").
 * Kept in this app's own bordered-card shape (gridsim wraps its sliders in
 * a Paper/Accordion instead) since that's this app's established
 * convention for a grouped field, e.g. Stat tiles. Shared between the
 * Design tab (RefineForm.tsx) and the Economics tab's own tariff sliders
 * (ResultsPanel.tsx) - extracted out 2026-09-17 rather than duplicated a
 * second time.
 */
export default function SliderField({ heading, value, unit, min, max, step, precision = 0, onChange }: SliderFieldProps) {
  return (
    <Box sx={{ p: 2, borderRadius: "12px", border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {heading}
      </Typography>
      <Typography sx={{ fontWeight: 700, fontSize: "1.0625rem", mb: 1 }}>
        {value.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision })}
        {unit ? ` ${unit}` : ""}
      </Typography>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        valueLabelDisplay="auto"
        valueLabelFormat={(v) => `${v.toLocaleString()}${unit ? ` ${unit}` : ""}`}
        onChange={(_, v) => onChange(v as number)}
      />
    </Box>
  );
}
