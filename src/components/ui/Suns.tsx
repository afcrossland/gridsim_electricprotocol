import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";

import { scoreSuns } from "../../lib/scoring";

const TOTAL = 5;

/**
 * A rating of one to five suns: a solid sun (a disc with rays) for each sun earned and an outlined sun for each not earned. Drawn as
 * SVG rather than a text symbol so it looks the same on every device (a sun character can turn into a coloured emoji).
 * `color` is usually the score's own colour (see `scoreTextColor`).
 */
export function Suns({
  count,
  size = 13,
  color = "currentColor",
  variant = "sun",
}: {
  count: number;
  size?: number;
  color?: string;
  /** "sun" is a disc with rays (the standard); "disc" is the plain disc without them. */
  variant?: "disc" | "sun";
}) {
  const { t } = useTranslation();
  return (
    <Box
      component="span"
      role="img"
      aria-label={t("sunRating.label", { count })}
      sx={{ display: "inline-flex", alignItems: "center", gap: `${Math.max(2, size * 0.22)}px`, verticalAlign: "middle", lineHeight: 0 }}
    >
      {Array.from({ length: TOTAL }, (_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 10 10" aria-hidden="true">
          {variant === "sun" && (
            <g stroke={color} strokeWidth="0.9" strokeLinecap="round" opacity={i < count ? 1 : 0.5}>
              {Array.from({ length: 8 }, (_, k) => {
                const a = (k * Math.PI) / 4;
                return <line key={k} x1={5 + Math.cos(a) * 3.5} y1={5 + Math.sin(a) * 3.5} x2={5 + Math.cos(a) * 4.7} y2={5 + Math.sin(a) * 4.7} />;
              })}
            </g>
          )}
          <circle
            cx="5"
            cy="5"
            r={variant === "sun" ? 2.4 : 4.2}
            fill={i < count ? color : "none"}
            stroke={color}
            strokeWidth="1.1"
          />
        </svg>
      ))}
    </Box>
  );
}

/** A score as its suns, with the percentage alongside by default - e.g. "●●●●○ (79%)". */
export function SunScore({
  score,
  color,
  size,
  percent = true,
  variant,
}: {
  score: number;
  color?: string;
  size?: number;
  percent?: boolean;
  variant?: "disc" | "sun";
}) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, whiteSpace: "nowrap" }}>
      <Suns count={scoreSuns(score)} color={color} size={size} variant={variant} />
      {percent && <span>({Math.round(score * 100)}%)</span>}
    </Box>
  );
}
