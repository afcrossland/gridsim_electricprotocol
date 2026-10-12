import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import seed from "../../../src/data/protocol.seed.json";
import { seedResponses } from "../../../src/stores/protocolStore";
import { scoreCountry } from "../../../src/lib/scoring";
import { jurisdictionName } from "../../../src/lib/jurisdictions";
import type { Protocol, Question, Response } from "../../../src/lib/types";

const protocol = seed as unknown as Protocol;
const questions = seed.questions as unknown as Question[];

// The Policy Explorer's data: every jurisdiction with at least one answer, how complete it is,
// and (on click) each answer with its evidence. Built from the same seed + researched answers
// the explorer itself loads, before any visitor's local edits.
export default function PolicyPanel() {
  const responses = useMemo(() => seedResponses(), []);
  const byCountry = useMemo(() => {
    const m = new Map<string, Response[]>();
    for (const r of responses) (m.get(r.countryCode) ?? m.set(r.countryCode, []).get(r.countryCode)!).push(r);
    return m;
  }, [responses]);
  const rows = useMemo(
    () =>
      [...byCountry.keys()]
        .map((code) => scoreCountry(protocol, questions, responses, code, jurisdictionName(code)))
        .sort((a, b) => b.completeness - a.completeness),
    [byCountry, responses],
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const shown = rows.filter((r) => !q || r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));

  return (
    <Box>
      <Typography variant="body2" sx={{ color: "text.secondary", my: 2 }}>
        {rows.length} jurisdictions have at least one answer, out of {questions.length} questions. Completeness is the share of total question weight answered; below{" "}
        {Math.round(protocol.completenessThreshold * 100)}% a jurisdiction is not ranked. Click a row for its answers and evidence.
      </Typography>
      <TextField size="small" label="Filter" value={query} onChange={(e) => setQuery(e.target.value)} sx={{ mb: 2 }} />
      <Box sx={{ overflow: "auto", maxHeight: "65vh", border: 1, borderColor: "divider", borderRadius: 1 }}>
        <Box component="table" sx={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
          <thead>
            <tr>
              {["Jurisdiction", "Answered", "Completeness", "Score", "Ranked"].map((h) => (
                <Box component="th" key={h} sx={{ position: "sticky", top: 0, bgcolor: "background.paper", textAlign: "left", p: 1, borderBottom: 1, borderColor: "divider" }}>
                  {h}
                </Box>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <Box component="tr" key={r.code} onClick={() => setOpen(r.code)} sx={{ cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}>
                <Cell>
                  <strong>{r.code}</strong> {r.name !== r.code ? r.name : ""}
                </Cell>
                <Cell>
                  {r.answered} / {r.total}
                </Cell>
                <Cell>{Math.round(r.completeness * 100)}%</Cell>
                <Cell>{r.ranked ? `${Math.round(r.score * 100)}%` : "-"}</Cell>
                <Cell>{r.ranked ? "yes" : "no"}</Cell>
              </Box>
            ))}
          </tbody>
        </Box>
      </Box>
      {open && <Detail code={open} responses={byCountry.get(open) ?? []} onClose={() => setOpen(null)} />}
    </Box>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <Box component="td" sx={{ p: 1, borderBottom: 1, borderColor: "divider", whiteSpace: "nowrap" }}>
      {children}
    </Box>
  );
}

function Detail({ code, responses, onClose }: { code: string; responses: Response[]; onClose: () => void }) {
  const byQ = new Map(responses.map((r) => [r.questionId, r]));
  const sections = protocol.sections;
  return (
    <Drawer anchor="right" open onClose={onClose} slotProps={{ paper: { sx: { width: { xs: "100%", md: 760 }, p: 3 } } }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, flex: 1 }}>
          {jurisdictionName(code)} <Typography component="span" variant="body2" sx={{ color: "text.secondary" }}>{code}</Typography>
        </Typography>
        <IconButton aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>
      {sections.map((s) => {
        const qs = questions.filter((qq) => qq.sectionId === s.id);
        if (!qs.length) return null;
        return (
          <Box key={s.id} sx={{ mb: 3 }}>
            <Typography sx={{ fontWeight: 600, mb: 1 }}>{s.title}</Typography>
            {qs.map((qq) => {
              const r = byQ.get(qq.id);
              const tier = r ? qq.rubric.find((t) => t.score === r.score) : undefined;
              return (
                <Box key={qq.id} sx={{ py: 1, borderTop: 1, borderColor: "divider", opacity: r ? 1 : 0.55 }}>
                  <Typography variant="body2">{qq.text}</Typography>
                  {r ? (
                    <Box sx={{ mt: 0.5 }}>
                      <Chip size="small" label={`${r.score} - ${tier?.label ?? ""}`.slice(0, 90)} sx={{ mr: 1 }} />
                      {r.basis && <Chip size="small" variant="outlined" label={r.basis} />}
                      {r.evidence.map((e, i) => (
                        <Typography key={i} variant="caption" sx={{ display: "block", mt: 0.5, color: "text.secondary" }}>
                          {/^https?:/.test(e.source) ? <Link href={e.source} target="_blank" rel="noopener noreferrer">{e.title}</Link> : e.title}
                        </Typography>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      Not answered
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        );
      })}
    </Drawer>
  );
}
