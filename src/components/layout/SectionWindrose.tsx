import { Box, Typography, useTheme } from "@mui/material";

import type { CountryScore, Section } from "../../lib/types";

interface Props {
  sections: { section: Section; score: CountryScore }[];
  /** Which measure the bars show. Completeness is always known; score is withheld ("not enough data") below the ranking threshold. */
  metric: "score" | "completeness";
  /** A second country's per-section scores, same shape as `sections` - when set, each axis splits into a paired wedge and a legend is shown. */
  compareSections?: { section: Section; score: CountryScore }[];
  primaryLabel?: string;
  compareLabel?: string;
}

/** GSC Citrus - distinct from the primary series' teal without introducing a new hue to the palette. */
const COMPARE_COLOR = "#FBB114";

const SIZE = 380;
/** Rendered width - kept below SIZE so the chart stays a reasonable size side by side with its pair. */
const DISPLAY_WIDTH = 330;
const CENTER = SIZE / 2;
const PLOT_RADIUS = 110;
const RINGS = [0.25, 0.5, 0.75, 1];
/** Fraction of each wedge's angular slot left as a gap to its neighbours - the 2px-gap-between-fills rule, adapted to a radial layout. */
const GAP_FRACTION = 0.18;
/** Widest a wrapped axis label is allowed to get, in characters - purely a wrap heuristic, not a pixel measurement. */
const LABEL_WRAP_WIDTH = 14;
/** Floor radius for a value label, so a near-zero bar's number does not sit on top of the centre. */
const MIN_LABEL_RADIUS = 26;

/** Angle of axis `i` of `n`, starting at 12 o'clock and going clockwise. */
function angleOf(i: number, n: number): number {
  return -Math.PI / 2 + (i * 2 * Math.PI) / n;
}

function pointAt(angle: number, radius: number): { x: number; y: number } {
  return { x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle) };
}

/** SVG path for one wedge - a pie slice from the centre out to `radius`, spanning `angle ± halfWidth`. */
function wedgePath(angle: number, halfWidth: number, radius: number): string {
  if (radius <= 0) return "";
  const start = pointAt(angle - halfWidth, radius);
  const end = pointAt(angle + halfWidth, radius);
  return `M ${CENTER} ${CENTER} L ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y} Z`;
}

/** Splits a title into at most two lines, breaking on the nearest word boundary. */
function wrapLabel(text: string): string[] {
  if (text.length <= LABEL_WRAP_WIDTH) return [text];
  const words = text.split(" ");
  let line1 = "";
  let i = 0;
  while (i < words.length && (line1 + words[i]).length <= LABEL_WRAP_WIDTH) {
    line1 += (line1 ? " " : "") + words[i];
    i += 1;
  }
  if (i === 0) i = 1; // one very long word - keep it on its own line rather than looping forever
  const line2 = words.slice(i).join(" ");
  return line2 ? [line1, line2] : [line1];
}

/**
 * A section-by-section profile for one country - a wind rose, one radial bar
 * per section rather than a connected line/polygon. Bars were chosen over a
 * spider-chart outline deliberately: a shared outline distorts area and
 * invites comparing shapes rather than the numbers, where separate wedges
 * keep every section an independent, directly comparable magnitude - the
 * same reasoning that makes a bar chart the default for "compare magnitude"
 * anywhere else in the app.
 *
 * One hue throughout (the country's own profile, not a comparison between
 * series - the score and completeness charts are two separate instances of
 * this component, not two series on one). Data completeness is always a
 * known number, but a section's *score* can be withheld below the ranking
 * threshold - in that case it gets a dashed marker instead of a bar at zero,
 * so a research gap never reads as a confirmed bad score.
 */
/** Fraction of a paired axis slot spent on the gap between its two wedges. */
const INNER_GAP_FRACTION = 0.14;

interface Segment {
  key: string;
  angle: number;
  halfWidth: number;
  score: CountryScore;
  color: string;
  title: string;
}

export default function SectionWindrose({
  sections,
  metric,
  compareSections,
  primaryLabel = "This jurisdiction",
  compareLabel = "Compared with",
}: Props) {
  const theme = useTheme();
  const n = sections.length;
  if (n < 2) return null;

  const gridColor = theme.palette.divider;
  const labelColor = theme.palette.text.secondary;
  const seriesColor = theme.palette.primary.main;
  const halfWidth = ((2 * Math.PI) / n / 2) * (1 - GAP_FRACTION);

  const valueOf = (score: CountryScore) => (metric === "completeness" ? score.completeness : score.score);
  const knownOf = (score: CountryScore) => metric === "completeness" || score.ranked;
  const noun = metric === "completeness" ? "Data completeness" : "Score";

  const isDual = Boolean(compareSections && compareSections.length === n);
  const subHalfWidth = isDual ? (halfWidth * (1 - INNER_GAP_FRACTION)) / 2 : halfWidth;
  const subOffset = isDual ? subHalfWidth + (halfWidth * INNER_GAP_FRACTION) / 2 : 0;

  // One or two wedges per axis, flattened into a single list so the wedge,
  // label and marker passes below stay one map each regardless of whether
  // this is a single-country or paired chart.
  const segments: Segment[] = sections.flatMap(({ section, score }, i) => {
    const angle = angleOf(i, n);
    if (!isDual) {
      return [{ key: section.id, angle, halfWidth: subHalfWidth, score, color: seriesColor, title: section.title }];
    }
    const compareScore = compareSections![i].score;
    return [
      {
        key: `${section.id}-primary`,
        angle: angle - subOffset,
        halfWidth: subHalfWidth,
        score,
        color: seriesColor,
        title: section.title,
      },
      {
        key: `${section.id}-compare`,
        angle: angle + subOffset,
        halfWidth: subHalfWidth,
        score: compareScore,
        color: COMPARE_COLOR,
        title: section.title,
      },
    ];
  });

  return (
    <Box>
      {isDual && (
        <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mb: 1, flexWrap: "wrap" }}>
          <LegendEntry color={seriesColor} label={primaryLabel} />
          <LegendEntry color={COMPARE_COLOR} label={compareLabel} />
        </Box>
      )}
      <Box sx={{ display: "flex", justifyContent: "center" }}>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ width: "100%", maxWidth: DISPLAY_WIDTH, height: "auto" }}
          role="img"
          aria-label={`${noun} by section`}
        >
          {/* Grid rings for scale reference. */}
          {RINGS.map((level) => (
            <circle
              key={level}
              cx={CENTER}
              cy={CENTER}
              r={level * PLOT_RADIUS}
              fill="none"
              stroke={gridColor}
              strokeWidth={1}
            />
          ))}

          {segments.map((seg) => {
            const known = knownOf(seg.score);
            const barRadius = known ? valueOf(seg.score) * PLOT_RADIUS : 0;

            if (known) {
              return (
                <path key={seg.key} d={wedgePath(seg.angle, seg.halfWidth, barRadius)} fill={seg.color} fillOpacity={0.85}>
                  <title>{`${seg.title}: ${Math.round(valueOf(seg.score) * 100)}%`}</title>
                </path>
              );
            }
            // A dashed marker near the centre, not a bar at zero - a research
            // gap is not the same claim as "nothing is in place", and drawing
            // it as a full-height wedge outline would read as close to 100%
            // at a glance.
            const marker = pointAt(seg.angle, 14);
            return (
              <circle
                key={seg.key}
                cx={marker.x}
                cy={marker.y}
                r={4}
                fill={theme.palette.background.paper}
                stroke={theme.palette.text.disabled}
                strokeWidth={1.5}
                strokeDasharray="2,2"
              >
                <title>{`${seg.title}: not enough data`}</title>
              </circle>
            );
          })}

          {/* Direct value label per wedge, in a text token rather than the
              series colour - see the doc comment above: a single hue does
              not clear a comfortable contrast ratio on its own, so the
              number needs to stand on its own too. The white halo
              (paint-order + stroke) keeps it legible over the filled wedge. */}
          {segments.map((seg) => {
            const known = knownOf(seg.score);
            const barRadius = known ? valueOf(seg.score) * PLOT_RADIUS : 0;
            const labelPoint = pointAt(seg.angle, Math.max(barRadius, MIN_LABEL_RADIUS));
            return (
              <text
                key={seg.key}
                x={labelPoint.x}
                y={labelPoint.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={isDual ? 11 : 12}
                fontWeight={600}
                fill={known ? theme.palette.text.primary : theme.palette.text.disabled}
                stroke={theme.palette.background.paper}
                strokeWidth={3}
                paintOrder="stroke"
              >
                {known ? `${Math.round(valueOf(seg.score) * 100)}%` : "–"}
              </text>
            );
          })}

          {/* Axis labels, wrapped to at most two lines and anchored by which side of the circle they fall on - centred on the whole (possibly paired) slot, not on either individual wedge. */}
          {sections.map(({ section }, i) => {
            const angle = angleOf(i, n);
            const cos = Math.cos(angle);
            const anchor = cos > 0.15 ? "start" : cos < -0.15 ? "end" : "middle";
            const label = pointAt(angle, PLOT_RADIUS + 14);
            const lines = wrapLabel(section.title);
            return (
              <text
                key={section.id}
                x={label.x}
                y={label.y}
                textAnchor={anchor}
                fontSize={13}
                fill={labelColor}
                dominantBaseline="middle"
              >
                {lines.map((line, li) => (
                  <tspan key={li} x={label.x} dy={li === 0 ? -((lines.length - 1) * 7) : 14}>
                    {line}
                  </tspan>
                ))}
              </text>
            );
          })}
        </svg>
      </Box>
    </Box>
  );
}

function LegendEntry({ color, label }: { color: string; label: string }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
      <Typography variant="caption" sx={{ whiteSpace: "nowrap" }}>
        {label}
      </Typography>
    </Box>
  );
}
