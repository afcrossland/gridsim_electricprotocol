import { Box, Paper, Typography } from "@mui/material";

import { COLOR_INSUFFICIENT, COLOR_NO_DATA, SCORE_RAMP } from "../../lib/scoring";
import { protocol } from "../../stores/protocolStore";

export default function MapLegend() {
  const gradient = SCORE_RAMP.map((s) => `${s.color} ${s.stop * 100}%`).join(", ");
  const threshold = Math.round(protocol.completenessThreshold * 100);

  return (
    <Paper
      elevation={2}
      sx={{ position: "absolute", left: 16, bottom: 16, px: 2, py: 1.5, minWidth: 220 }}
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
