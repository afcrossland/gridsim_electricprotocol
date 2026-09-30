import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from "@mui/material";

import type { YearlySaving } from "../lib/types";

/**
 * Year-by-year saving breakdown (import saving vs export revenue) - added
 * alongside the cost/IRR/payback table per Andrew's own instruction
 * 2026-09-17, since these figures don't vary by install cost and no
 * longer belong repeated across that table's three rows. Scrolls within
 * its own `TableContainer` (25 rows - payback.ts's own
 * CASH_FLOW_HORIZON_YEARS) rather than growing the sidebar unbounded.
 *
 * Each figure carries its own currency symbol before the number (e.g.
 * "£1,234") rather than naming the currency once in the column header, per
 * Andrew's own instruction 2026-09-18 ("show currency units before each
 * number").
 *
 * A cumulative cashflow column was added per Andrew's own instruction
 * 2026-09-30 - it needs a year 0 (the upfront install cost, as a negative
 * outflow) to cumulate against, which this table's own rows don't carry
 * (`YearlySaving` is cost-independent, per the doc comment above). Rather
 * than threading a cost choice through `payback.ts` and `SavingsResults`,
 * this component takes the single `installCost` it needs directly - the
 * "Typical" row of `paybackRows` (index 1), passed in by the caller - and
 * computes cumulative cashflow locally, purely as a presentational running
 * total. That column's own text is red while still negative (before
 * payback) and green once positive, per Andrew's own instruction
 * 2026-09-30 - the only colour-coded column in this table, since it's the
 * one that actually crosses zero.
 */
export default function YearlySavingsTable({ rows, unit, installCost }: { rows: YearlySaving[]; unit: string; installCost: number }) {
  const currencySymbol = unit.replace("/kWh", "");
  const money = (v: number) => `${v < 0 ? "-" : ""}${currencySymbol}${Math.abs(v).toLocaleString()}`;
  const cumulativeColor = (v: number) => (v < 0 ? "error.main" : "success.main");
  let cumulative = -installCost;
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 320 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Year</TableCell>
            <TableCell align="right">Import saving</TableCell>
            <TableCell align="right">Export revenue</TableCell>
            <TableCell align="right">Total</TableCell>
            <TableCell align="right">Cumulative cashflow</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>0</TableCell>
            <TableCell align="right">-</TableCell>
            <TableCell align="right">-</TableCell>
            <TableCell align="right">{money(-installCost)}</TableCell>
            <TableCell align="right" sx={{ color: cumulativeColor(cumulative) }}>{money(cumulative)}</TableCell>
          </TableRow>
          {rows.map((r) => {
            const total = r.importSaving + r.exportSaving;
            cumulative += total;
            return (
              <TableRow key={r.year}>
                <TableCell>{r.year}</TableCell>
                <TableCell align="right">{money(r.importSaving)}</TableCell>
                <TableCell align="right">{money(r.exportSaving)}</TableCell>
                <TableCell align="right">{money(total)}</TableCell>
                <TableCell align="right" sx={{ color: cumulativeColor(cumulative) }}>{money(cumulative)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
