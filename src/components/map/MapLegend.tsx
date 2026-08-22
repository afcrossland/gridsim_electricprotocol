import { Box, Paper, ToggleButton, ToggleButtonGroup, Typography, useMediaQuery, useTheme } from "@mui/material";

import { COLOR_INSUFFICIENT, COLOR_NO_DATA, SCORE_RAMP } from "../../lib/scoring";
import { useProtocolStore } from "../../stores/protocolStore";

export default function MapLegend() {
  const metric = useProtocolStore((s) => s.mapMetric);
  const setMetric = useProtocolStore((s) => s.setMapMetric);
  const showingScore = metric === "score";
  const theme = useTheme();
  // The floating bottom-left card assumes a wide, tall map - on the short,
  // full-width map used below `md` it would either overlap most of the
  // visible countries or get clipped, so it becomes a single-row banner
  // pinned to the top of the map instead.
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const gradient = SCORE_RAMP.map((s) => `${s.color} ${s.stop * 100}%`).join(", ");

  const metricToggle = (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={metric}
      onChange={(_, next) => next && setMetric(next)}
    >
      <ToggleButton value="score" sx={{ py: 0.25, px: isMobile ? 1 : 2, fontSize: isMobile ? "0.65rem" : "0.7rem" }}>
        Score
      </ToggleButton>
      <ToggleButton
        value="completeness"
        sx={{ py: 0.25, px: isMobile ? 1 : 2, fontSize: isMobile ? "0.65rem" : "0.7rem" }}
      >
        {isMobile ? "Data" : "Completeness"}
      </ToggleButton>
    </ToggleButtonGroup>
  );

  if (isMobile) {
    return (
      <Paper
        elevation={2}
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1,
          px: 1.5,
          py: 1,
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          bgcolor: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        {metricToggle}

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              height: 8,
              borderRadius: 4,
              background: `linear-gradient(90deg, ${gradient})`,
            }}
          />
          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.25 }}>
            <Typography variant="caption" sx={{ fontSize: "0.6rem", lineHeight: 1 }}>
              0%
            </Typography>
            <Typography variant="caption" sx={{ fontSize: "0.6rem", lineHeight: 1 }}>
              100%
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0 }}>
          {showingScore && <Swatch color={COLOR_INSUFFICIENT} title="Not enough data" />}
          <Swatch color={COLOR_NO_DATA} title="No data" />
        </Box>
      </Paper>
    );
  }

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
        // Frosted glass rather than a solid panel, so the map colour under the
        // legend's own corner stays legible instead of being fully occluded.
        bgcolor: "rgba(255,255,255,0.86)",
        backdropFilter: "blur(8px)",
      }}
    >
      <Box sx={{ mb: 1 }}>{metricToggle}</Box>

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
      {/* Ticks at each quartile rather than just the two ends, so a colour on
          the map can be read against a value without guessing between them. */}
      <Box sx={{ position: "relative", height: 14, mt: 0.5 }}>
        {[0, 25, 50, 75, 100].map((pct) => (
          <Typography
            key={pct}
            variant="caption"
            sx={{
              position: "absolute",
              left: `${pct}%`,
              transform:
                pct === 0 ? "none" : pct === 100 ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            {pct}%
          </Typography>
        ))}
      </Box>

      {showingScore && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
          <Swatch color={COLOR_INSUFFICIENT} />
          <Typography variant="caption">Not enough data</Typography>
        </Box>
      )}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
        <Swatch color={COLOR_NO_DATA} />
        <Typography variant="caption">No data</Typography>
      </Box>
    </Paper>
  );
}

function Swatch({ color, title }: { color: string; title?: string }) {
  return (
    <Box
      title={title}
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
