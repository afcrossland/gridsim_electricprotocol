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
 */
export default function YearlySavingsTable({ rows, unit }: { rows: YearlySaving[]; unit: string }) {
  const currencySymbol = unit.replace("/kWh", "");
  const money = (v: number) => `${currencySymbol}${v.toLocaleString()}`;
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 320 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Year</TableCell>
            <TableCell align="right">Import saving</TableCell>
            <TableCell align="right">Export revenue</TableCell>
            <TableCell align="right">Total</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.year}>
              <TableCell>{r.year}</TableCell>
              <TableCell align="right">{money(r.importSaving)}</TableCell>
              <TableCell align="right">{money(r.exportSaving)}</TableCell>
              <TableCell align="right">{money(r.importSaving + r.exportSaving)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
