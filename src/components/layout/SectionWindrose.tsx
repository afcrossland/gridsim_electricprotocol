import { Box, Typography, useTheme } from "@mui/material";

import { PRIMARY_SERIES_COLOR, compareColorFor } from "../../lib/compareColors";
import type { CountryScore, Section } from "../../lib/types";

export interface CompareSeries {
  code: string;
  label: string;
  sections: { section: Section; score: CountryScore }[];
}

interface Props {
  sections: { section: Section; score: CountryScore }[];
  /** Which measure the bars show. Completeness is always known; score is withheld ("not enough data") below the ranking threshold. */
  metric: "score" | "completeness";
  /**
   * Up to MAX_COMPARE_COUNTRIES other jurisdictions' per-section scores, same
   * shape as `sections` - when set, the chart switches from single-series
   * wedges to a multi-series line/radar chart (one line per jurisdiction,
   * colour-coded via compareColorFor) with a legend, since a wedge split N
   * ways stops being readable past two series.
   */
  compareSeries?: CompareSeries[];
  primaryLabel?: string;
}

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
/** Fixed radius for an unranked/unknown vertex on the line chart - matches the wedge chart's own dashed-marker radius. */
const UNKNOWN_RADIUS = 14;

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

function valueOfScore(score: CountryScore, metric: "score" | "completeness"): number {
  return metric === "completeness" ? score.completeness : score.score;
}
function knownOfScore(score: CountryScore, metric: "score" | "completeness"): boolean {
  return metric === "completeness" || score.ranked;
}

/**
 * A section-by-section profile for one country - a wind rose, one radial bar
 * per section rather than a connected line/polygon, UNLESS one or more other
 * jurisdictions are being compared against it, in which case every
 * jurisdiction (this one plus each comparator) becomes its own line/radar
 * outline instead - wedges cannot split more than two ways and stay
 * readable, but lines of different colours scale to several jurisdictions
 * with a legend to tell them apart.
 *
 * Bars were chosen over an outline for the single-country case deliberately:
 * a shared outline distorts area and invites comparing shapes rather than
 * the numbers, where separate wedges keep every section an independent,
 * directly comparable magnitude. That reasoning only holds for one series -
 * once there are several, an outline per jurisdiction is the only way to
 * keep them visually separable at all, and area-distortion is an acceptable
 * trade against outright illegibility.
 *
 * One hue throughout in single mode (the country's own profile). In compare
 * mode every jurisdiction, including the primary one, gets a fixed colour
 * from lib/compareColors.ts - validated for categorical/CVD separation, not
 * this app's usual brand aqua (see that file's doc comment for why).
 */
export default function SectionWindrose({ sections, metric, compareSeries, primaryLabel = "This jurisdiction" }: Props) {
  const theme = useTheme();
  const n = sections.length;
  if (n < 2) return null;

  const gridColor = theme.palette.divider;
  const labelColor = theme.palette.text.secondary;
  const noun = metric === "completeness" ? "Data completeness" : "Score";

  const compareMode = Boolean(compareSeries && compareSeries.length > 0);

  if (compareMode) {
    const series = [
      { code: "__primary", label: primaryLabel, color: PRIMARY_SERIES_COLOR, sections },
      ...compareSeries!.map((s, i) => ({ ...s, color: compareColorFor(i) })),
    ];

    const outlineFor = (s: (typeof series)[number]) =>
      s.sections
        .map(({ score }, i) => {
          const angle = angleOf(i, n);
          const known = knownOfScore(score, metric);
          const radius = known ? valueOfScore(score, metric) * PLOT_RADIUS : UNKNOWN_RADIUS;
          return pointAt(angle, radius);
        });

    return (
      <Box>
        <Box sx={{ display: "flex", justifyContent: "center", gap: 1.5, mb: 1, flexWrap: "wrap" }}>
          {series.map((s) => (
            <LegendEntry key={s.code} color={s.color} label={s.label} />
          ))}
        </Box>
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            style={{ width: "100%", maxWidth: DISPLAY_WIDTH, height: "auto" }}
            role="img"
            aria-label={`${noun} by section, compared across ${series.length} jurisdictions`}
          >
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

            {series.map((s) => {
              const points = outlineFor(s);
              const d = `M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")} Z`;
              return <path key={s.code} d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />;
            })}

            {series.map((s) =>
              s.sections.map(({ score }, i) => {
                const angle = angleOf(i, n);
                const known = knownOfScore(score, metric);
                const radius = known ? valueOfScore(score, metric) * PLOT_RADIUS : UNKNOWN_RADIUS;
                const p = pointAt(angle, radius);
                return known ? (
                  <circle key={`${s.code}-${i}`} cx={p.x} cy={p.y} r={3} fill={s.color}>
                    <title>{`${s.label} - ${sections[i].section.title}: ${Math.round(valueOfScore(score, metric) * 100)}%`}</title>
                  </circle>
                ) : (
                  <circle
                    key={`${s.code}-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r={3.5}
                    fill={theme.palette.background.paper}
                    stroke={s.color}
                    strokeWidth={1.5}
                    strokeDasharray="1.5,1.5"
                  >
                    <title>{`${s.label} - ${sections[i].section.title}: not enough data`}</title>
                  </circle>
                );
              }),
            )}

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

  const seriesColor = theme.palette.primary.main;
  const halfWidth = ((2 * Math.PI) / n / 2) * (1 - GAP_FRACTION);

  const segments = sections.map(({ section, score }, i) => ({
    key: section.id,
    angle: angleOf(i, n),
    halfWidth,
    score,
    title: section.title,
  }));

  return (
    <Box>
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
            const known = knownOfScore(seg.score, metric);
            const barRadius = known ? valueOfScore(seg.score, metric) * PLOT_RADIUS : 0;

            if (known) {
              return (
                <path key={seg.key} d={wedgePath(seg.angle, seg.halfWidth, barRadius)} fill={seriesColor} fillOpacity={0.85}>
                  <title>{`${seg.title}: ${Math.round(valueOfScore(seg.score, metric) * 100)}%`}</title>
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
            const known = knownOfScore(seg.score, metric);
            const barRadius = known ? valueOfScore(seg.score, metric) * PLOT_RADIUS : 0;
            const labelPoint = pointAt(seg.angle, Math.max(barRadius, MIN_LABEL_RADIUS));
            return (
              <text
                key={seg.key}
                x={labelPoint.x}
                y={labelPoint.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={12}
                fontWeight={600}
                fill={known ? theme.palette.text.primary : theme.palette.text.disabled}
                stroke={theme.palette.background.paper}
                strokeWidth={3}
                paintOrder="stroke"
              >
                {known ? `${Math.round(valueOfScore(seg.score, metric) * 100)}%` : "–"}
              </text>
            );
          })}

          {/* Axis labels, wrapped to at most two lines and anchored by which side of the circle they fall on. */}
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
