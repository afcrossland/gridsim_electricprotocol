import { Box, Paper, Slider, Typography } from "@mui/material";

import { COLOR_INSUFFICIENT, COLOR_NO_DATA, SCORE_RAMP } from "../../lib/scoring";
import { protocol, useProtocolStore } from "../../stores/protocolStore";

interface Props {
  /** How many jurisdictions currently clear the threshold. */
  rankedCount: number;
  withData: number;
}

export default function MapLegend({ rankedCount, withData }: Props) {
  const thresholdValue = useProtocolStore((s) => s.threshold);
  const setThreshold = useProtocolStore((s) => s.setThreshold);

  const gradient = SCORE_RAMP.map((s) => `${s.color} ${s.stop * 100}%`).join(", ");
  const threshold = Math.round(thresholdValue * 100);

  return (
    <Paper
      elevation={2}
      sx={{
        position: "absolute",
        right: 16,
        top: 16,
        zIndex: 1,
        px: 2,
        py: 1.5,
        width: 232,
      }}
    >
      <Typography variant="overline">Protocol score</Typography>
      <Box
        sx={{
          height: 10,
          borderRadius: 5,
          mt: 0.5,
          background: `linear-gradient(90deg, ${gradient})`,
        }}
      />
      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
        <Typography variant="caption">0%</Typography>
        <Typography variant="caption">100%</Typography>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
        <Swatch color={COLOR_INSUFFICIENT} />
        <Typography variant="caption">Under {threshold}% answered</Typography>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
        <Swatch color={COLOR_NO_DATA} />
        <Typography variant="caption">No data</Typography>
      </Box>

      {/* How much evidence counts as enough is a judgement, not a property of
          the data, so it is exposed rather than fixed at the protocol default.
          The live count makes the trade explicit: lowering it colours more of
          the map on thinner evidence. */}
      <Box sx={{ mt: 1.5, pt: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Typography variant="overline">Completeness threshold</Typography>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            {threshold}%
          </Typography>
        </Box>

        {/* The explanation sits as text rather than a tooltip: a tooltip on the
            label opens downwards, directly over the slider it describes. */}
        <Typography variant="caption" sx={{ display: "block", mb: 0.5 }}>
          Below this, a jurisdiction stays grey and unranked
        </Typography>

        <Slider
          size="small"
          min={0}
          max={100}
          step={5}
          value={threshold}
          onChange={(_, v) => setThreshold((v as number) / 100)}
          marks={[{ value: Math.round(protocol.completenessThreshold * 100) }]}
          valueLabelDisplay="off"
          sx={{ mt: 0.5 }}
        />

        <Typography variant="caption">
          {rankedCount} of {withData} ranked
        </Typography>
      </Box>
    </Paper>
  );
}

function Swatch({ color }: { color: string }) {
  return (
    <Box
      sx={{
        width: 14,
        height: 14,
        borderRadius: 0.5,
        bgcolor: color,
        border: "1px solid",
        borderColor: "divider",
        flexShrink: 0,
      }}
    />
  );
}
