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
      <img src="/favicon.png" style={{ width: 30, height: 30, objectFit: "contain" }} alt="" />
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
          { label: "Policy sections", value: String(data.sections.length) },
        ]}
      />

      <p style={{ fontSize: 11, color: C.textXs, marginTop: 14, marginBottom: 0, flexShrink: 0 }}>
        Scores are weighted by each question's policy impact and reflect only answered questions - see Data completeness
        for how much of the assessment this country has filled in.
      </p>

      <div style={{ marginTop: 24, flexShrink: 0 }}>
        <SmallLabel>In this report</SmallLabel>
        <ul style={{ margin: 0, paddingLeft: 18, color: C.textSm, fontSize: 12 }}>
          <li>Score and data completeness, broken down by policy section</li>
          <li>Biggest policy wins - the changes that would raise this score the most</li>
          <li>The full question set, this country's current answer to each, and the evidence behind it</li>
        </ul>
      </div>

      <PageFooter page={page} total={total} />
    </div>
  );
}

// ─── Page 2: By section ─────────────────────────────────────────────────────

function Page2({ data, page, total }: { data: CountryReportData; page: number; total: number }) {
  return (
    <div className="report-page" style={PAGE}>
      <PageHeader />
      <SectionHeading mt={0}>Score and data completeness by section</SectionHeading>
      <p style={{ fontSize: 12.5, color: C.textSm, marginBottom: 4, marginTop: 4, flexShrink: 0 }}>
        A dashed marker means there isn't enough evidence yet for that section - not a score of zero.
      </p>

      <div style={{ display: "flex", gap: 12, marginTop: 12, flexShrink: 0 }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <SmallLabel>Score</SmallLabel>
          <ReportWindrose sections={data.sectionScores} metric="score" />
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <SmallLabel>Data completeness</SmallLabel>
          <ReportWindrose sections={data.sectionScores} metric="completeness" />
        </div>
      </div>

      <SectionHeading mt={20}>By section</SectionHeading>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
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

// ─── Biggest policy wins pages ──────────────────────────────────────────────

function WinsPage({
  items,
  isFirst,
  page,
  total,
}: {
  items: ImpactItem[];
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
            {["Section", "Question", "Currently", "Impact"].map((h, i) => (
              <th
                key={h}
                style={{
                  textAlign: i >= 3 ? "right" : "left",
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
          {items.map((item, i) => {
            const tierLabel = item.question.rubric.find((t) => t.score === item.currentScore)?.label;
            return (
              <tr key={item.question.id} style={{ background: i % 2 === 1 ? C.bg : C.white }}>
                <td style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}`, color: C.textSm, whiteSpace: "nowrap" }}>
                  {item.section.title}
                </td>
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
          })}
        </tbody>
      </table>
      <PageFooter page={page} total={total} />
    </div>
  );
}

// ─── Full question set (appendix) pages ────────────────────────────────────

type QaRow = { kind: "section"; section: Section } | { kind: "question"; question: Question; response?: Response };

function QaPage({ rows, page, total }: { rows: QaRow[]; page: number; total: number }) {
  return (
    <div className="report-page" style={PAGE}>
      <PageHeader />
      <div style={{ flex: 1, overflow: "hidden" }}>
        {rows.map((row, i) =>
          row.kind === "section" ? (
            <SectionHeading key={`s-${row.section.id}`} mt={i === 0 ? 0 : 18}>
              {row.section.title}
            </SectionHeading>
          ) : (
            <QaQuestionRow key={row.question.id} question={row.question} response={row.response} />
          ),
        )}
      </div>
      <PageFooter page={page} total={total} />
    </div>
  );
}

function QaQuestionRow({ question, response }: { question: Question; response?: Response }) {
  const tierLabel = response ? question.rubric.find((t) => t.score === response.score)?.label : undefined;
  return (
    <div style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 12, marginBottom: 4 }}>{question.text}</div>
      <div style={{ fontSize: 11.5, marginBottom: response?.evidence?.length ? 3 : 0 }}>
        <span style={{ color: C.textXs, fontWeight: 700, fontSize: 9.5, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          Answer:{" "}
        </span>
        <span style={{ color: tierLabel ? C.text : C.textXs, fontStyle: tierLabel ? "normal" : "italic" }}>
          {tierLabel ? capitalizeFirst(tierLabel) : "Not yet answered"}
        </span>
      </div>
      {response?.evidence?.length ? (
        <div style={{ fontSize: 10.5, color: C.textSm }}>
          {response.evidence.map((e, i) => (
            <div key={i} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              &bull; {e.title || e.source || "Evidence"}
              {e.source && e.title ? ` - ${e.source}` : ""}
            </div>
          ))}
        </div>
      ) : (
        response && (
          <div style={{ fontSize: 10.5, color: C.orange, fontStyle: "italic" }}>No evidence provided</div>
        )
      )}
    </div>
  );
}

// Approximate vertical "slots" a row costs, to chunk the appendix into pages
// without measuring real DOM height (the report is captured off-screen, so
// nothing has actually laid out yet when this decision is made). A section
// heading costs a bit more than a bare question; a question with evidence
// costs one slot per citation on top of its own - deliberately conservative
// so a page is more likely to under-fill than to overflow and get clipped by
// PAGE's own `overflow: hidden`.
function slotsOf(row: QaRow): number {
  if (row.kind === "section") return 1.5;
  const evidenceCount = row.response?.evidence?.length ?? 0;
  return 1 + evidenceCount * 0.6;
}
const QA_PAGE_BUDGET = 13;

function paginateQaRows(rows: QaRow[]): QaRow[][] {
  const pages: QaRow[][] = [];
  let current: QaRow[] = [];
  let used = 0;
  for (const row of rows) {
    const cost = slotsOf(row);
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

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ─── Root export ────────────────────────────────────────────────────────────

const WINS_LIMIT = 20;
const WINS_PER_PAGE = 14;

export default function CountryReportDocument({ data }: { data: CountryReportData }) {
  const wins = data.impact.slice(0, WINS_LIMIT);
  const winPages = wins.length > 0 ? chunk(wins, WINS_PER_PAGE) : [];

  const qaRows: QaRow[] = data.sections.flatMap((section) => [
    { kind: "section" as const, section },
    ...data.questions
      .filter((q) => q.sectionId === section.id)
      .sort((a, b) => a.order - b.order)
      .map((question) => ({ kind: "question" as const, question, response: data.byQuestion.get(question.id) })),
  ]);
  const qaPages = paginateQaRows(qaRows);

  const total = 2 + winPages.length + qaPages.length;

  return (
    <div id="country-report-root">
      <Page1 data={data} page={1} total={total} />
      <Page2 data={data} page={2} total={total} />
      {winPages.map((items, i) => (
        <WinsPage key={i} items={items} isFirst={i === 0} page={3 + i} total={total} />
      ))}
      {qaPages.map((rows, i) => (
        <QaPage key={i} rows={rows} page={3 + winPages.length + i} total={total} />
      ))}
    </div>
  );
}
