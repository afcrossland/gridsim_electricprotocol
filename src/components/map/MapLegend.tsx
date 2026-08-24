import { Box, Paper, Typography, useMediaQuery, useTheme } from "@mui/material";

import { COLOR_INSUFFICIENT, COLOR_NO_DATA, SCORE_RAMP } from "../../lib/scoring";
import { useProtocolStore } from "../../stores/protocolStore";

/**
 * Reads which measure is currently painted so its title and "not enough
 * data" swatch stay accurate - the score/completeness choice itself is made
 * in the bottom toolbar (see App.tsx), not here.
 */
export default function MapLegend() {
  const metric = useProtocolStore((s) => s.mapMetric);
  const showingScore = metric === "score";
  const theme = useTheme();
  // The floating bottom-left card assumes a wide, tall map - on the short,
  // full-width map used below `md` it would either overlap most of the
  // visible countries or get clipped, so it becomes a single-row banner
  // pinned to the top of the map instead.
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const gradient = SCORE_RAMP.map((s) => `${s.color} ${s.stop * 100}%`).join(", ");

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
    <Box
      sx={{
        position: "absolute",
        top: 16,
        left: 16,
        zIndex: 1000,
        width: "min(20vw, 100%)",
        px: 1.5,
        py: 1.25,
        bgcolor: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(8px)",
        borderRadius: "8px",
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
      }}
    >
      <Typography
        sx={{
          fontSize: "0.625rem",
          fontWeight: 600,
          letterSpacing: "0.06em",
          color: "#6B7280",
          textTransform: "uppercase",
          mb: 0.75,
          lineHeight: 1.3,
        }}
      >
        {showingScore ? "Protocol score" : "Questions answered, by weight"}
      </Typography>

      {/* Segmented bar - one block per SCORE_RAMP stop, not a smooth
          gradient, so each block reads as the one discrete colour actually
          painted on the map rather than implying a value can fall between
          two of them. */}
      <Box sx={{ display: "flex", borderRadius: "5px", overflow: "hidden", height: 20 }}>
        {SCORE_RAMP.map((s, i) => (
          <Box key={i} sx={{ flex: 1, bgcolor: s.color }} />
        ))}
      </Box>

      {/* Ticks at each quartile rather than just the two ends, so a colour on
          the map can be read against a value without guessing between them. */}
      <Box sx={{ position: "relative", height: 16, mt: 0.5 }}>
        {[0, 25, 50, 75, 100].map((pct) => (
          <Typography
            key={pct}
            sx={{
              position: "absolute",
              fontSize: "0.625rem",
              color: "#9CA3AF",
              lineHeight: 1,
              top: 2,
              left: pct === 100 ? undefined : `${pct}%`,
              right: pct === 100 ? 0 : undefined,
              transform: pct > 0 && pct < 100 ? "translateX(-50%)" : undefined,
            }}
          >
            {pct}%
          </Typography>
        ))}
      </Box>

      {/* Tiled side by side rather than stacked - two short rows wasted the
          card's own width for no reason once each has its own swatch. Text
          wraps instead of clipping if the card ever gets narrower than a
          label needs. */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mt: 1 }}>
        {showingScore && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
            <Swatch color={COLOR_INSUFFICIENT} />
            <Typography variant="caption" sx={{ overflowWrap: "break-word" }}>
              Not enough data
            </Typography>
          </Box>
        )}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
          <Swatch color={COLOR_NO_DATA} />
          <Typography variant="caption" sx={{ overflowWrap: "break-word" }}>
            No data
          </Typography>
        </Box>
      </Box>
    </Box>
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
