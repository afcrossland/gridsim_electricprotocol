import type { ReactNode } from "react";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";

/** One swatch in a discrete legend - a band of the scale, or an extra key like "No data". */
export interface LegendSwatch {
  color: string;
  label: ReactNode;
}

interface Props {
  title: string;
  rampStops: { stop: number; color: string }[];
  /** Uppercase the title via CSS `text-transform` - default true, matching every app's own legend until 2026-09-18, when calculator's own copy turned it off because a mixed-case unit ("kWh/kWp") reads as "KWH/KWP" under it. Pass `false` for a title with a mixed-case unit. */
  uppercaseTitle?: boolean;
  /** Quartile (or any) tick labels under the gradient bar, e.g. `["0%","25%","50%","75%","100%"]` - the root app's own legend always shows these; deployment/calculator's own show none. Omit for no ticks. */
  tickLabels?: string[];
  /**
   * Discrete steps instead of the gradient bar - for a map whose fill is
   * stepped rather than interpolated (policy's own score bands), where a
   * smooth gradient would promise shades the map never draws. Overrides
   * `rampStops`/`tickLabels` when given.
   */
  bands?: LegendSwatch[];
  /** Extra keys below the scale, e.g. the greys for "Not enough data" and "No data". */
  extraKeys?: LegendSwatch[];
}

function Bands({ bands, height }: { bands: LegendSwatch[]; height: number }) {
  return (
    <Box sx={{ display: "flex", gap: "2px" }}>
      {bands.map((b, i) => (
        <Box key={i} sx={{ flex: 1, minWidth: 0, textAlign: "center" }}>
          <Box sx={{ height, bgcolor: b.color, borderRadius: i === 0 ? "4px 0 0 4px" : i === bands.length - 1 ? "0 4px 4px 0" : 0 }} />
          <Typography component="div" sx={{ fontSize: "0.625rem", color: "text.secondary", lineHeight: 1, mt: 0.5 }}>
            {b.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function ExtraKeys({ keys }: { keys: LegendSwatch[] }) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: 1.5, rowGap: 0.5, mt: 0.75 }}>
      {keys.map((k, i) => (
        <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: "2px", bgcolor: k.color, border: "1px solid", borderColor: "divider" }} />
          <Typography component="span" sx={{ fontSize: "0.625rem", color: "text.secondary", lineHeight: 1 }}>
            {k.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

/**
 * The floating legend shared by all three apps' own maps - a glassy card
 * pinned top-left of the map on desktop, a full-width banner pinned to
 * the map's top edge below `md` on mobile (a fixed floating card would
 * either overlap most of a short, full-width mobile map or get clipped).
 * Confirmed near-identical between deployment's and calculator's own
 * `MapLegend.tsx` before this shared copy was written 2026-09-19; the
 * root app's own version additionally always shows quartile tick labels
 * and reads its title from its own store rather than a prop - both are
 * covered here via `tickLabels` and this component simply taking
 * `title` as a plain prop (the store-reading stays in whichever
 * thin per-app wrapper renders this).
 */
export default function MapLegend({ title, rampStops, uppercaseTitle = true, tickLabels, bands, extraKeys }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const gradient = rampStops.map((s) => `${s.color} ${s.stop * 100}%`).join(", ");
  const glassBg = theme.palette.mode === "dark" ? "rgba(32,39,42,0.92)" : "rgba(255,255,255,0.92)";

  if (isMobile) {
    return (
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1,
          px: 1.5,
          py: 1,
          bgcolor: glassBg,
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "text.secondary", mb: 0.5 }}>{title}</Typography>
        {bands ? (
          <Bands bands={bands} height={8} />
        ) : (
          <Box sx={{ height: 8, borderRadius: 4, background: `linear-gradient(90deg, ${gradient})` }} />
        )}
        {extraKeys && <ExtraKeys keys={extraKeys} />}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: "absolute",
        top: 16,
        left: 16,
        zIndex: 1000,
        width: "min(20vw, 240px)",
        px: 1.5,
        py: 1.25,
        bgcolor: glassBg,
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
          color: "text.secondary",
          textTransform: uppercaseTitle ? "uppercase" : "none",
          mb: 0.75,
          lineHeight: 1.3,
        }}
      >
        {title}
      </Typography>
      {bands ? (
        <Bands bands={bands} height={10} />
      ) : (
        <>
          <Box sx={{ height: 10, borderRadius: "5px", background: `linear-gradient(90deg, ${gradient})` }} />
          {tickLabels ? (
            <Box sx={{ position: "relative", height: 16, mt: 0.5 }}>
              {tickLabels.map((label, i) => {
                const pct = (i / (tickLabels.length - 1)) * 100;
                return (
                  <Typography
                    key={label}
                    sx={{
                      position: "absolute",
                      fontSize: "0.625rem",
                      color: "text.disabled",
                      lineHeight: 1,
                      top: 2,
                      left: pct === 100 ? undefined : `${pct}%`,
                      right: pct === 100 ? 0 : undefined,
                      transform: pct > 0 && pct < 100 ? "translateX(-50%)" : undefined,
                    }}
                  >
                    {label}
                  </Typography>
                );
              })}
            </Box>
          ) : (
            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
              <Typography sx={{ fontSize: "0.625rem", color: "text.disabled" }}>Lower</Typography>
              <Typography sx={{ fontSize: "0.625rem", color: "text.disabled" }}>Higher</Typography>
            </Box>
          )}
        </>
      )}
      {extraKeys && <ExtraKeys keys={extraKeys} />}
    </Box>
  );
}
