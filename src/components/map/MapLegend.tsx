import { Box, Paper, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";

import { COLOR_INSUFFICIENT, COLOR_NO_DATA, SCORE_RAMP } from "../../lib/scoring";
import { useProtocolStore } from "../../stores/protocolStore";

export default function MapLegend() {
  const thresholdValue = useProtocolStore((s) => s.threshold);
  const metric = useProtocolStore((s) => s.mapMetric);
  const setMetric = useProtocolStore((s) => s.setMapMetric);
  const showingScore = metric === "score";

  const gradient = SCORE_RAMP.map((s) => `${s.color} ${s.stop * 100}%`).join(", ");
  const threshold = Math.round(thresholdValue * 100);

  return (
    <Paper
      elevation={2}
      sx={{
        position: "absolute",
        left: 16,
        bottom: 16,
        zIndex: 1,
        px: 2,
        py: 1.5,
        width: 232,
      }}
    >
      <ToggleButtonGroup
        size="small"
        exclusive
        fullWidth
        value={metric}
        onChange={(_, next) => next && setMetric(next)}
        sx={{ mb: 1 }}
      >
        <ToggleButton value="score" sx={{ py: 0.25, fontSize: "0.7rem" }}>
          Score
        </ToggleButton>
        <ToggleButton value="completeness" sx={{ py: 0.25, fontSize: "0.7rem" }}>
          Completeness
        </ToggleButton>
      </ToggleButtonGroup>

      <Typography variant="overline">
        {showingScore ? "Protocol score" : "Questions answered, by weight"}
      </Typography>
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

      {showingScore && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
          <Swatch color={COLOR_INSUFFICIENT} />
          <Typography variant="caption">Under {threshold}% answered</Typography>
        </Box>
      )}
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
