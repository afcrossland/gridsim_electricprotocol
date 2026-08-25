import type { CSSProperties, ReactNode } from "react";

import { capitalizeFirst } from "../../lib/text";
import { impactColor, impactLabel, impactTextColor, scoreBand } from "../../lib/scoring";
import type { CountryScore, ImpactItem, Question, Response, Section } from "../../lib/types";

// Design tokens - the GSC brand palette (src/mui-theme.tsx), plain hex rather
// than MUI theme tokens. Ported from the sibling gridsim-frontend project's
// own PDF report (src/components/report/ReportDocument.tsx there) - same
// page geometry, same header/footer/heading conventions, same reliance on
// plain inline styles (not MUI's sx/Emotion) so html2canvas captures every
// page reliably off-screen.
const C = {
  teal: "#00ABBB", // GSC Aqua
  tealDark: "#008194", // GSC Teal
  tealBg: "#E6F6F8",
  text: "#3B3838", // GSC Deep Gray
  textSm: "#6B7280",
  textXs: "#9CA3AF",
  border: "#E5E7EB",
  bg: "#F9FAFB",
  white: "#FFFFFF",
  orange: "#EF864C", // GSC Burnt Orange
  citrus: "#FBB114", // GSC Citrus
};

const FONT = "'Eastman Grotesque', Arial, Helvetica, -apple-system, BlinkMacSystemFont, sans-serif";

// A4 at 96dpi: 794 x 1123px - see exportCountryReportPdf.ts's PAGE_W/PAGE_H.
const PAGE: CSSProperties = {
  width: 794,
  minHeight: 1123,
  height: 1123,
  padding: "48px 56px 52px",
  boxSizing: "border-box",
  background: C.white,
  fontFamily: FONT,
  position: "relative",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  fontSize: 13,
  lineHeight: 1.5,
  color: C.text,
};

// ─── Shared sub-components ─────────────────────────────────────────────────

function PageHeader() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, flexShrink: 0 }}>
      <img
        src={`${import.meta.env.BASE_URL}favicon.png`}
        style={{ width: 30, height: 30, objectFit: "contain" }}
        alt=""
      />
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em", color: C.text, lineHeight: 1.1 }}>
          GLOBAL SOLAR COUNCIL
        </div>
        <div style={{ fontSize: 9, letterSpacing: "0.1em", color: C.textXs, lineHeight: 1.2 }}>
          SOLAR POLICY ASSESSMENT TOOL
        </div>
      </div>
    </div>
  );
}

function PageFooter({ page, total }: { page: number; total: number }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 28,
        left: 56,
        right: 56,
        borderTop: `1px solid ${C.border}`,
        paddingTop: 10,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span style={{ fontSize: 10, color: C.textXs }}>
        {page} / {total}
      </span>
      <span style={{ fontSize: 10, color: C.teal, fontWeight: 600, letterSpacing: "0.02em" }}>
        Solar. Storage. Future Secured.
      </span>
    </div>
  );
}

function SectionHeading({ children, mt = 20 }: { children: ReactNode; mt?: number }) {
  return (
    <div
      style={{
        fontSize: 15,
        fontWeight: 700,
        color: C.teal,
        marginBottom: 8,
        marginTop: mt,
        paddingBottom: 6,
        borderBottom: `2px solid ${C.tealBg}`,
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

function SmallLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: "0.09em",
        textTransform: "uppercase",
        color: C.textXs,
        marginBottom: 6,
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

function GlanceTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ flex: 1, padding: "14px 16px", background: C.bg }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? C.teal, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: C.textXs, marginTop: 5 }}>{label}</div>
    </div>
  );
}

function GlanceStrip({ tiles }: { tiles: { label: string; value: string; color?: string }[] }) {
  return (
    <div style={{ display: "flex", border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
      {tiles.map((tile, i) => (
        <div key={i} style={{ flex: 1, borderRight: i < tiles.length - 1 ? `1px solid ${C.border}` : "none" }}>
          <GlanceTile {...tile} />
        </div>
      ))}
    </div>
  );
}

// ─── Windrose - self-contained port of SectionWindrose's geometry ─────────
// Plain inline styles / SVG only (no MUI, no theme lookup) so it captures
// reliably off-screen - see SectionWindrose.tsx for the annotated original
// this was adapted from.

const WR_SIZE = 380;
const WR_CENTER = WR_SIZE / 2;
const WR_PLOT_RADIUS = 130;
const WR_RINGS = [0.25, 0.5, 0.75, 1];
const WR_GAP_FRACTION = 0.18;
const WR_LABEL_WRAP_WIDTH = 14;
const WR_MIN_LABEL_RADIUS = 26;

function wrAngleOf(i: number, n: number): number {
  return -Math.PI / 2 + (i * 2 * Math.PI) / n;
}
function wrPointAt(angle: number, radius: number): { x: number; y: number } {
  return { x: WR_CENTER + radius * Math.cos(angle), y: WR_CENTER + radius * Math.sin(angle) };
}
function wrWedgePath(angle: number, halfWidth: number, radius: number): string {
  if (radius <= 0) return "";
  const start = wrPointAt(angle - halfWidth, radius);
  const end = wrPointAt(angle + halfWidth, radius);
  return `M ${WR_CENTER} ${WR_CENTER} L ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y} Z`;
}
function wrWrapLabel(text: string): string[] {
  if (text.length <= WR_LABEL_WRAP_WIDTH) return [text];
  const words = text.split(" ");
  let line1 = "";
  let i = 0;
  while (i < words.length && (line1 + words[i]).length <= WR_LABEL_WRAP_WIDTH) {
    line1 += (line1 ? " " : "") + words[i];
    i += 1;
  }
  if (i === 0) i = 1;
  const line2 = words.slice(i).join(" ");
  return line2 ? [line1, line2] : [line1];
}

function ReportWindrose({
  sections,
  metric,
}: {
  sections: { section: Section; score: CountryScore }[];
  metric: "score" | "completeness";
}) {
  const n = sections.length;
  if (n < 2) return null;
  const halfWidth = ((2 * Math.PI) / n / 2) * (1 - WR_GAP_FRACTION);
  const valueOf = (score: CountryScore) => (metric === "completeness" ? score.completeness : score.score);
  const knownOf = (score: CountryScore) => metric === "completeness" || score.ranked;

  return (
    <svg viewBox={`0 0 ${WR_SIZE} ${WR_SIZE}`} width="100%" height="auto" style={{ maxWidth: 330, display: "block" }}>
      {WR_RINGS.map((level) => (
        <circle key={level} cx={WR_CENTER} cy={WR_CENTER} r={level * WR_PLOT_RADIUS} fill="none" stroke={C.border} strokeWidth={1} />
      ))}

      {sections.map(({ section, score }, i) => {
        const angle = wrAngleOf(i, n);
        const known = knownOf(score);
        const barRadius = known ? valueOf(score) * WR_PLOT_RADIUS : 0;
        if (!known) {
          const marker = wrPointAt(angle, 14);
          return (
            <circle
              key={section.id}
              cx={marker.x}
              cy={marker.y}
              r={4}
              fill={C.white}
              stroke={C.textXs}
              strokeWidth={1.5}
              strokeDasharray="2,2"
            />
          );
        }
        return (
          <path key={section.id} d={wrWedgePath(angle, halfWidth, barRadius)} fill={C.teal} fillOpacity={0.85} />
        );
      })}

      {sections.map(({ section, score }, i) => {
        const angle = wrAngleOf(i, n);
        const known = knownOf(score);
        const barRadius = known ? valueOf(score) * WR_PLOT_RADIUS : 0;
        const labelPoint = wrPointAt(angle, Math.max(barRadius, WR_MIN_LABEL_RADIUS));
        return (
          <text
            key={section.id}
            x={labelPoint.x}
            y={labelPoint.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={12}
            fontWeight={700}
            fill={known ? C.text : C.textXs}
            stroke={C.white}
            strokeWidth={3}
            paintOrder="stroke"
          >
            {known ? `${Math.round(valueOf(score) * 100)}%` : "-"}
          </text>
        );
      })}

      {sections.map(({ section }, i) => {
        const angle = wrAngleOf(i, n);
        const cos = Math.cos(angle);
        const anchor = cos > 0.15 ? "start" : cos < -0.15 ? "end" : "middle";
        const label = wrPointAt(angle, WR_PLOT_RADIUS + 14);
        const lines = wrWrapLabel(section.title);
        return (
          <text key={section.id} x={label.x} y={label.y} textAnchor={anchor} fontSize={11} fill={C.textSm} dominantBaseline="middle">
            {lines.map((line, li) => (
              <tspan key={li} x={label.x} dy={li === 0 ? -((lines.length - 1) * 6) : 12}>
                {line}
              </tspan>
            ))}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Data shape ─────────────────────────────────────────────────────────────

export interface CompareEntry {
  code: string;
  name: string;
  /** Assigned via compareColorFor in lib/compareColors.ts - same colour as that jurisdiction's windrose line and rubric-tile flags. */
  color: string;
  score: CountryScore;
  sections: { section: Section; score: CountryScore }[];
  byQuestion: Map<string, Response>;
}

export interface CountryReportData {
  countryCode: string;
  countryName: string;
  generatedOn: string;
  score: CountryScore;
  sectionScores: { section: Section; score: CountryScore }[];
  impact: ImpactItem[];
  sections: Section[];
  questions: Question[];
  byQuestion: Map<string, Response>;
  /** Empty outside compare mode - adds the ComparePage. */
  compareEntries: CompareEntry[];
}

function flagUrl(code: string): string {
  return `https://flagcdn.com/${code.toLowerCase()}.svg`;
}

// ─── Page 1: Cover ──────────────────────────────────────────────────────────

function Page1({ data, page, total }: { data: CountryReportData; page: number; total: number }) {
  const { score } = data;
  const band = score.ranked ? scoreBand(score.score) : null;

  return (
    <div className="report-page" style={PAGE}>
      <PageHeader />

      <div style={{ marginBottom: 20, flexShrink: 0 }}>
        <div style={{ fontSize: 12, color: C.textSm, fontWeight: 500, marginBottom: 8 }}>Policy assessment report for</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <img src={flagUrl(data.countryCode)} width={36} height={27} style={{ objectFit: "cover", borderRadius: 3 }} alt="" />
          <span style={{ fontSize: 28, fontWeight: 700, color: C.teal, lineHeight: 1.1 }}>{data.countryName}</span>
        </div>
        <div style={{ fontSize: 12, color: C.textXs }}>Generated {data.generatedOn}</div>
      </div>

      <div style={{ borderTop: `2px solid ${C.tealBg}`, marginBottom: 20, flexShrink: 0 }} />

      <SectionHeading mt={0}>Key metrics</SectionHeading>
      <p style={{ fontSize: 12.5, color: C.textSm, marginBottom: 20, marginTop: 4, flexShrink: 0 }}>
        {score.ranked
          ? `${data.countryName} is rated "${band!.label}" - ${Math.round(score.score * 100)}% of the weighted score available, based on ${score.answered} of ${score.total} questions answered.`
          : `${data.countryName} does not yet have enough answered data to be scored - ${score.answered} of ${score.total} questions answered so far.`}
      </p>

      <GlanceStrip
        tiles={[
          { label: "Overall score", value: score.ranked ? `${Math.round(score.score * 100)}%` : "N/A", color: band?.color },
          { label: "Data completeness", value: `${Math.round(score.completeness * 100)}%` },
          { label: "Questions answered", value: `${score.answered} / ${score.total}` },
        ]}
      />

      <p style={{ fontSize: 11, color: C.textXs, marginTop: 14, marginBottom: 0, flexShrink: 0 }}>
        Scores are weighted by each question's policy impact and reflect only answered questions - see Data completeness
        for how much of the assessment this country has filled in.
      </p>

      <p style={{ fontSize: 12.5, color: C.textSm, marginTop: 20, marginBottom: 4, flexShrink: 0 }}>
        A dashed marker means there isn't enough evidence yet for that section - not a score of zero.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 8, flexShrink: 0 }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <SmallLabel>Score</SmallLabel>
          <ReportWindrose sections={data.sectionScores} metric="score" />
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <SmallLabel>Data completeness</SmallLabel>
          <ReportWindrose sections={data.sectionScores} metric="completeness" />
        </div>
      </div>

      <PageFooter page={page} total={total} />
    </div>
  );
}

// ─── Page 2: Summary of policy environment ─────────────────────────────────

function Page2({ data, page, total }: { data: CountryReportData; page: number; total: number }) {
  return (
    <div className="report-page" style={PAGE}>
      <PageHeader />
      <SectionHeading mt={0}>Summary of policy environment</SectionHeading>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, marginTop: 8 }}>
        <thead>
          <tr>
            {["Section", "Score", "Data completeness"].map((h, i) => (
              <th
                key={h}
                style={{
                  textAlign: i === 0 ? "left" : "right",
                  padding: "6px 8px",
                  color: C.textXs,
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.sectionScores.map(({ section, score }, i) => (
            <tr key={section.id} style={{ background: i % 2 === 1 ? C.bg : C.white }}>
              <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}` }}>{section.title}</td>
              <td style={{ padding: "6px 8px", textAlign: "right", borderBottom: `1px solid ${C.border}`, color: score.ranked ? scoreBand(score.score).color : C.textXs, fontWeight: 600 }}>
                {score.ranked ? `${Math.round(score.score * 100)}%` : "N/A"}
              </td>
              <td style={{ padding: "6px 8px", textAlign: "right", borderBottom: `1px solid ${C.border}` }}>
                {Math.round(score.completeness * 100)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <PageFooter page={page} total={total} />
    </div>
  );
}

// ─── Compare (only present when compareEntries is non-empty) ──────────────

function ComparePage({ data, page, total }: { data: CountryReportData; page: number; total: number }) {
  // Every column reads in plain grey except the primary country's own score
  // values, emphasised in GSC Burnt Orange - the app's established "this is
  // the one that matters most" colour (QuestionCard's selected-tile colour,
  // ImpactList's "Currently:" label) - not the compare palette's per-country
  // hues, which would otherwise make several columns look coloured/singled
  // out at once instead of just the one this whole report is about.
  const columns = [
    { code: data.countryCode, name: data.countryName, sections: data.sectionScores },
    ...data.compareEntries.map((e) => ({ code: e.code, name: e.name, sections: e.sections })),
  ];
  const scoreBySection = columns.map(
    (col) => new Map(col.sections.map(({ section, score }) => [section.id, score])),
  );

  return (
    <div className="report-page" style={PAGE}>
      <PageHeader />
      <SectionHeading mt={0}>Compare</SectionHeading>
      <p style={{ fontSize: 12.5, color: C.textSm, marginBottom: 4, marginTop: 4, flexShrink: 0 }}>
        Score by section - {data.countryName} against {data.compareEntries.length} other jurisdiction
        {data.compareEntries.length === 1 ? "" : "s"} selected for comparison.
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginTop: 12 }}>
        <thead>
          <tr>
            <th
              style={{
                textAlign: "left",
                padding: "6px 8px",
                color: C.textXs,
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              Section
            </th>
            {columns.map((col) => (
              <th
                key={col.code}
                style={{
                  textAlign: "right",
                  padding: "6px 8px",
                  color: C.textXs,
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                {col.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.sections.map((section, i) => (
            <tr key={section.id} style={{ background: i % 2 === 1 ? C.bg : C.white }}>
              <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}` }}>{section.title}</td>
              {columns.map((col, ci) => {
                const score = scoreBySection[ci].get(section.id);
                const isPrimary = ci === 0;
                return (
                  <td
                    key={col.code}
                    style={{
                      padding: "6px 8px",
                      textAlign: "right",
                      borderBottom: `1px solid ${C.border}`,
                      color: isPrimary && score?.ranked ? C.orange : C.textSm,
                      fontWeight: isPrimary ? 700 : 600,
                    }}
                  >
                    {score?.ranked ? `${Math.round(score.score * 100)}%` : "N/A"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <PageFooter page={page} total={total} />
    </div>
  );
}

// ─── Biggest policy wins pages ──────────────────────────────────────────────

type WinRow = { kind: "group"; section: Section } | { kind: "item"; item: ImpactItem };

function WinsPage({
  rows,
  isFirst,
  page,
  total,
}: {
  rows: WinRow[];
  isFirst: boolean;
  page: number;
  total: number;
}) {
  return (
    <div className="report-page" style={PAGE}>
      <PageHeader />
      {isFirst && (
        <>
          <SectionHeading mt={0}>Biggest policy wins</SectionHeading>
          <p style={{ fontSize: 12.5, color: C.textSm, marginBottom: 12, marginTop: 4, flexShrink: 0 }}>
            Biggest policy wins based on policy score and evidence provided.
          </p>
        </>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginTop: isFirst ? 0 : 24 }}>
        <thead>
          <tr>
            {["Question", "Currently", "Impact"].map((h, i) => (
              <th
                key={h}
                style={{
                  textAlign: i >= 2 ? "right" : "left",
                  padding: "6px 8px",
                  color: C.textXs,
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) =>
            row.kind === "group" ? (
              <tr key={`g-${row.section.id}`}>
                <td
                  colSpan={3}
                  style={{
                    padding: "8px 8px 4px",
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: C.tealDark,
                  }}
                >
                  {row.section.title}
                </td>
              </tr>
            ) : (
              (() => {
                const item = row.item;
                const tierLabel = item.question.rubric.find((t) => t.score === item.currentScore)?.label;
                return (
                  <tr key={item.question.id} style={{ background: i % 2 === 1 ? C.bg : C.white }}>
                    <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}` }}>{item.question.text}</td>
                    <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}`, color: C.orange }}>
                      {tierLabel ? capitalizeFirst(tierLabel) : "-"}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", borderBottom: `1px solid ${C.border}` }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 7px",
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 700,
                          background: impactColor(item.question.weight),
                          color: impactTextColor(item.question.weight),
                        }}
                      >
                        {impactLabel(item.question.weight)}
                      </span>
                    </td>
                  </tr>
                );
              })()
            ),
          )}
        </tbody>
      </table>
      <PageFooter page={page} total={total} />
    </div>
  );
}

// ─── Full question set (appendix) pages ────────────────────────────────────

type QaRow =
  | { kind: "section"; section: Section }
  | { kind: "question"; question: Question; response?: Response; numberInSection: number };

/** Group title inside the appendix - deliberately smaller/lighter than SectionHeading (the report's own page-level H1s), so it reads as a level below "Policy environment". */
function GroupHeading({ children, mt = 20 }: { children: ReactNode; mt?: number }) {
  return (
    <div style={{ fontSize: 12.5, fontWeight: 700, color: C.tealDark, marginBottom: 6, marginTop: mt, flexShrink: 0 }}>
      {children}
    </div>
  );
}

function QaPage({
  rows,
  compareEntries,
  isFirstPage,
  page,
  total,
}: {
  rows: QaRow[];
  compareEntries: CompareEntry[];
  isFirstPage: boolean;
  page: number;
  total: number;
}) {
  return (
    <div className="report-page" style={PAGE}>
      <PageHeader />
      <div style={{ flex: 1, overflow: "hidden" }}>
        {isFirstPage && (
          <div style={{ fontSize: 19, fontWeight: 700, color: C.text, marginBottom: 4 }}>Policy environment</div>
        )}
        {rows.map((row, i) =>
          row.kind === "section" ? (
            <GroupHeading key={`s-${row.section.id}`} mt={i === 0 && isFirstPage ? 8 : i === 0 ? 0 : 18}>
              {row.section.title}
            </GroupHeading>
          ) : (
            <QaQuestionRow
              key={row.question.id}
              question={row.question}
              response={row.response}
              number={row.numberInSection}
              compareEntries={compareEntries}
            />
          ),
        )}
      </div>
      <PageFooter page={page} total={total} />
    </div>
  );
}

function QaQuestionRow({
  question,
  response,
  number,
  compareEntries,
}: {
  question: Question;
  response?: Response;
  number: number;
  compareEntries: CompareEntry[];
}) {
  const tierLabel = response ? question.rubric.find((t) => t.score === response.score)?.label : undefined;
  return (
    <div style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          color: C.textXs,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          marginBottom: 2,
        }}
      >
        Question {number}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4 }}>{question.text}</div>
      <div style={{ fontSize: 11.5, marginBottom: response?.evidence?.length ? 3 : 0 }}>
        <span style={{ color: C.textXs, fontWeight: 700, fontSize: 9.5, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          Answer:{" "}
        </span>
        <span style={{ color: tierLabel ? C.text : C.textXs, fontWeight: 600, fontStyle: tierLabel ? "normal" : "italic" }}>
          {tierLabel ? capitalizeFirst(tierLabel) : "Not yet answered"}
        </span>
      </div>
      {response?.evidence?.length ? (
        <div style={{ fontSize: 10.5, color: C.textSm, marginBottom: compareEntries.length > 0 ? 4 : 0 }}>
          {response.evidence.map((e, i) => (
            <div key={i} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              &bull; {e.title || e.source || "Evidence"}
              {e.source && e.title ? ` - ${e.source}` : ""}
            </div>
          ))}
        </div>
      ) : (
        response && (
          <div style={{ fontSize: 10.5, color: C.orange, fontStyle: "italic", marginBottom: compareEntries.length > 0 ? 4 : 0 }}>
            No evidence provided
          </div>
        )
      )}

      {/* One short answer + its evidence per comparator, after the primary's
          own evidence - same order every question uses in this appendix, so
          a reader always finds a given comparator in the same place. */}
      {compareEntries.map((entry) => {
        const compareResponse = entry.byQuestion.get(question.id);
        const compareTierLabel = compareResponse
          ? question.rubric.find((t) => t.score === compareResponse.score)?.label
          : undefined;
        return (
          <div key={entry.code} style={{ fontSize: 10.5, borderLeft: `2px solid ${entry.color}`, paddingLeft: 6, marginTop: 2 }}>
            <span style={{ fontWeight: 700, color: entry.color }}>Answer for {entry.name}: </span>
            <span style={{ color: compareTierLabel ? C.textSm : C.textXs, fontStyle: compareTierLabel ? "normal" : "italic" }}>
              {compareTierLabel ? capitalizeFirst(compareTierLabel) : "Not yet answered"}
            </span>
            {compareResponse?.evidence?.length ? (
              <div style={{ color: C.textXs }}>
                {compareResponse.evidence.map((e, i) => (
                  <div key={i} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    &bull; {e.title || e.source || "Evidence"}
                    {e.source && e.title ? ` - ${e.source}` : ""}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// One "slot" = roughly one rendered text line (~20px at this section's font
// sizes), to chunk the appendix into pages without measuring real DOM
// height (the report is captured off-screen, so nothing has actually laid
// out yet when this decision is made). An earlier version costed rows in
// abstract weighted units against a budget of 12 - calibrated for a single
// country with no comparators, it under-filled every page by roughly 3x
// once compare mode added several extra lines per question, leaving most of
// each page blank. Costing in actual estimated lines against the page's
// real available line count (see QA_PAGE_BUDGET) keeps pages full
// regardless of how many comparators are active.
function slotsOf(row: QaRow, compareEntries: CompareEntry[]): number {
  if (row.kind === "section") return 2.2;
  const question = row.question;
  const questionLines = Math.max(1, Math.ceil(question.text.length / 65));
  const evidenceCount = row.response?.evidence?.length ?? 0;
  // Every evidence bullet is capped to one line by its own `nowrap` +
  // ellipsis styling, so it costs exactly one slot regardless of length -
  // "No evidence provided" is the same one line when there's none at all.
  const primaryEvidenceLines = Math.max(1, evidenceCount);
  let cost = 0.8 /* "Question N" label */ + questionLines * 0.85 + 0.8 /* answer line */ + primaryEvidenceLines * 0.85 + 0.8; /* row padding/border */
  // Each comparator adds its own "Answer for X" line, plus one more per its evidence bullet (none shown at all when it has no evidence, unlike the primary).
  for (const entry of compareEntries) {
    const compareEvidenceCount = entry.byQuestion.get(question.id)?.evidence?.length ?? 0;
    cost += 0.85 + compareEvidenceCount * 0.85;
  }
  return cost;
}
// ~965px of content height per page (1123 minus top/bottom padding, the
// logo header, and room for the footer) at ~20px per line.
const QA_PAGE_BUDGET = 44;

function paginateQaRows(rows: QaRow[], compareEntries: CompareEntry[]): QaRow[][] {
  const pages: QaRow[][] = [];
  let current: QaRow[] = [];
  // Only the very first page also carries the "Policy environment" H1 above
  // the first group heading - reserve a couple of lines for it up front.
  let used = 1.5;
  for (const row of rows) {
    const cost = slotsOf(row, compareEntries);
    // A section heading never starts a page as the very last thing on the
    // previous one - hold it back so it always leads at least one question.
    const isOrphanHeading = row.kind === "section" && used + cost > QA_PAGE_BUDGET - 1;
    if ((used + cost > QA_PAGE_BUDGET || isOrphanHeading) && current.length > 0) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(row);
    used += cost;
  }
  if (current.length > 0) pages.push(current);
  return pages;
}

// ─── Root export ────────────────────────────────────────────────────────────

const WINS_LIMIT = 20;

// One "slot" ~= one rendered text line. The first recalibration (44, at 85
// chars/line) still overflowed pages into the footer - it assumed the
// Question column spans the full table width, but Question shares its row
// with Currently and Impact, so it is only roughly the left half of it;
// counting far fewer characters per line before a wrap means more real
// lines than that estimate credited, which undercounted every row's true
// height and packed too many onto a page. Narrower per-column character
// counts and a lower budget (a deliberate under-estimate, same margin of
// safety as the Q&A appendix) trade a little blank space for never again
// overlapping the footer.
const WINS_PAGE_BUDGET = 32;
/** Roughly how many characters fit on one line of the Question/Currently columns at this table's font size and (much narrower than full-width) column widths. */
const WINS_CHARS_PER_LINE = 52;
const WINS_CURRENTLY_CHARS_PER_LINE = 40;

function slotsOfWin(item: ImpactItem): number {
  const tierLabel = item.question.rubric.find((t) => t.score === item.currentScore)?.label;
  const currentlyText = tierLabel ? capitalizeFirst(tierLabel) : "-";
  const questionLines = Math.ceil(item.question.text.length / WINS_CHARS_PER_LINE);
  const currentlyLines = Math.ceil(currentlyText.length / WINS_CURRENTLY_CHARS_PER_LINE);
  return Math.max(1, questionLines, currentlyLines) + 0.4; /* row padding/border, no per-line discount this time */
}

/**
 * Groups the ranked wins by section, in the order each section is first
 * encountered (i.e. the order of its single highest-ranked item) - "biggest
 * wins" stays a ranking, this just makes which section each one belongs to
 * a heading instead of a repeated column, and keeps a section's items
 * together instead of interleaved with other sections'.
 */
function groupWinsBySection(items: ImpactItem[]): WinRow[] {
  const bySection = new Map<string, ImpactItem[]>();
  for (const item of items) {
    const list = bySection.get(item.section.id);
    if (list) list.push(item);
    else bySection.set(item.section.id, [item]);
  }
  const rows: WinRow[] = [];
  for (const sectionItems of bySection.values()) {
    rows.push({ kind: "group", section: sectionItems[0].section });
    for (const item of sectionItems) rows.push({ kind: "item", item });
  }
  return rows;
}

function slotsOfWinRow(row: WinRow): number {
  return row.kind === "group" ? 1.6 : slotsOfWin(row.item);
}

function paginateWinRows(rows: WinRow[]): WinRow[][] {
  const pages: WinRow[][] = [];
  let current: WinRow[] = [];
  // The first page alone carries the "Biggest policy wins" heading and
  // intro paragraph above the table - reserve room for it up front so that
  // page doesn't get the same row budget as a bare continuation page.
  let used = 2.5;
  for (const row of rows) {
    const cost = slotsOfWinRow(row);
    // A group heading never starts a page as the very last thing on the
    // previous one - same orphan guard as the Q&A appendix's section
    // headings, so a group's items always follow their heading onto
    // whichever page it lands on rather than being split across the break.
    const isOrphanHeading = row.kind === "group" && used + cost > WINS_PAGE_BUDGET - 1;
    if ((used + cost > WINS_PAGE_BUDGET || isOrphanHeading) && current.length > 0) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(row);
    used += cost;
  }
  if (current.length > 0) pages.push(current);
  return pages;
}

export default function CountryReportDocument({ data }: { data: CountryReportData }) {
  const wins = data.impact.slice(0, WINS_LIMIT);
  const winPages = paginateWinRows(groupWinsBySection(wins));

  const qaRows: QaRow[] = data.sections.flatMap((section) => [
    { kind: "section" as const, section },
    // Numbered from 1 within each group, not across the whole question set.
    ...data.questions
      .filter((q) => q.sectionId === section.id)
      .sort((a, b) => a.order - b.order)
      .map((question, i) => ({
        kind: "question" as const,
        question,
        response: data.byQuestion.get(question.id),
        numberInSection: i + 1,
      })),
  ]);
  const qaPages = paginateQaRows(qaRows, data.compareEntries);

  const hasCompare = data.compareEntries.length > 0;
  const compareOffset = hasCompare ? 1 : 0;
  const total = 2 + compareOffset + winPages.length + qaPages.length;

  return (
    <div id="country-report-root">
      <Page1 data={data} page={1} total={total} />
      <Page2 data={data} page={2} total={total} />
      {hasCompare && <ComparePage data={data} page={3} total={total} />}
      {winPages.map((rows, i) => (
        <WinsPage key={i} rows={rows} isFirst={i === 0} page={3 + compareOffset + i} total={total} />
      ))}
      {qaPages.map((rows, i) => (
        <QaPage
          key={i}
          rows={rows}
          compareEntries={data.compareEntries}
          isFirstPage={i === 0}
          page={3 + compareOffset + winPages.length + i}
          total={total}
        />
      ))}
    </div>
  );
}
