import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from "@mui/material";

import type { PaybackRow } from "../lib/types";

/**
 * Low/mid/high install-cost rows - cost, IRR, payback only (no saving
 * figures - those are the same regardless of install cost, so they moved
 * to their own year-by-year table, see YearlySavingsTable.tsx, per
 * Andrew's own instruction 2026-09-17).
 */
export default function PaybackTable({ rows }: { rows: PaybackRow[] }) {
  const labels = ["Low estimate", "Typical", "High estimate"];
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Install cost estimate</TableCell>
            <TableCell align="right">Cost</TableCell>
            <TableCell align="right">IRR (pre-tax, unlevered)</TableCell>
            <TableCell align="right">Payback</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell>{labels[i] ?? `Row ${i + 1}`}</TableCell>
              <TableCell align="right">{r.installCost.toLocaleString()}</TableCell>
              <TableCell align="right">{r.irr === null ? "n/a" : `${(r.irr * 100).toFixed(1)}%`}</TableCell>
              <TableCell align="right">
                {r.paybackYears === null ? "> 50 years" : `${r.paybackYears} year${r.paybackYears === 1 ? "" : "s"}`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
