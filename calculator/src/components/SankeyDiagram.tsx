import { useState } from "react";
import { Box, useTheme } from "@mui/material";

import { getDispatchColors } from "../lib/dispatchColors";
import type { DispatchHourly } from "../lib/types";

const CHART_WIDTH = 400;
const CHART_HEIGHT = 220;
const PAD = { top: 16, bottom: 16 };
const NODE_WIDTH = 8;
const NODE_GAP = 10;
const LEFT_X = 60;
const MID_X = 196;
const RIGHT_X = 332;

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

interface Link {
  key: string;
  label: string;
  value: number;
  color: string;
  sourceX: number;
  sourceY0: number;
  targetX: number;
  targetY0: number;
}

interface NodeSpec {
  key: string;
  label: string;
  value: number;
  x: number;
  y0: number;
  y1: number;
  color: string;
  /** Which side the label text sits, relative to the node. */
  labelSide: "left" | "right" | "above";
}

/**
 * Annual energy-flow Sankey for the Dispatch tab, per Andrew's own
 * instruction 2026-09-17 ("dispatch tab also needs a sankey diagram at
 * the start to show energy in (grid/solar) on left, battery in middle, to
 * grid/losses/demand on right"). A hand-built, fixed-topology diagram
 * (six known flows, not a general Sankey layout algorithm) - matches this
 * app's own convention of hand-rolled inline-SVG charts rather than a
 * charting library (no Sankey library is a dependency here). Ribbons are
 * drawn as a single bezier centreline with `strokeWidth` set to the
 * flow's own value, not a true tapering two-edge ribbon - a deliberate
 * simplification given the fixed six-flow topology doesn't need a general
 * solver.
 *
 * The six flows, all annual kWh totals summed from `dispatch`: solar to
 * demand, solar to battery (charging), solar to grid (export), grid
 * import to demand, battery to demand (discharging), and battery to
 * losses (`batteryCharge - batteryDischarge`, the round-trip inefficiency
 * - see batteryDispatch.ts's own √0.85 one-way efficiency). Every node's
 * own height is proportional to its total throughput, and by conservation
 * the left column (solar + grid import) and right column (demand + export
 * + losses) sum to the same total, sharing one scale.
 */
export default function SankeyDiagram({ dispatch }: { dispatch: DispatchHourly }) {
  const theme = useTheme();
  const colors = getDispatchColors(theme.palette.mode);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const solarToDemand = sum(dispatch.solarToDemand);
  const solarToBattery = sum(dispatch.batteryCharge);
  const solarExport = sum(dispatch.solarExport);
  const gridImport = sum(dispatch.gridImport);
  const batteryDischarge = sum(dispatch.batteryDischarge);
  const batteryLosses = Math.max(0, solarToBattery - batteryDischarge);

  const demandColor = theme.palette.mode === "dark" ? "#94A3B8" : "#475569";
  const lossesColor = colors.batteryCharge; // reuses "solar to battery"'s own orange - a battery-related identity, distinct from teal's "useful" battery energy

  const solarTotal = solarToDemand + solarToBattery + solarExport;
  const gridInTotal = gridImport;
  const batteryTotal = solarToBattery;
  const demandTotal = solarToDemand + gridImport + batteryDischarge;
  const gridOutTotal = solarExport;
  const lossesTotal = batteryLosses;

  const leftTotal = solarTotal + gridInTotal;
  const rightTotal = demandTotal + gridOutTotal + lossesTotal;
  const innerH = CHART_HEIGHT - PAD.top - PAD.bottom;
  const scale = innerH / Math.max(leftTotal, rightTotal, 1);

  // Left column: Solar above Grid import.
  const solarH = solarTotal * scale;
  const gridInH = gridInTotal * scale;
  const leftColH = solarH + gridInH + (gridInH > 0 && solarH > 0 ? NODE_GAP : 0);
  const leftTop = PAD.top + (innerH - leftColH) / 2;
  const solarY0 = leftTop;
  const gridInY0 = solarY0 + solarH + (gridInH > 0 && solarH > 0 ? NODE_GAP : 0);

  // Middle column: Battery, centred.
  const batteryH = batteryTotal * scale;
  const batteryY0 = PAD.top + (innerH - batteryH) / 2;

  // Right column: Demand, then Grid export, then Losses.
  const demandH = demandTotal * scale;
  const gridOutH = gridOutTotal * scale;
  const lossesH = lossesTotal * scale;
  const gaps = (demandH > 0 ? 1 : 0) + (gridOutH > 0 ? 1 : 0) + (lossesH > 0 ? 1 : 0) - 1;
  const rightColH = demandH + gridOutH + lossesH + Math.max(0, gaps) * NODE_GAP;
  const rightTop = PAD.top + (innerH - rightColH) / 2;
  const demandY0 = rightTop;
  const gridOutY0 = demandY0 + demandH + (demandH > 0 && gridOutH > 0 ? NODE_GAP : 0);
  const lossesY0 = gridOutY0 + gridOutH + (gridOutH > 0 && lossesH > 0 ? NODE_GAP : 0);

  const nodes: NodeSpec[] = [
    { key: "solar", label: "Solar", value: solarTotal, x: LEFT_X, y0: solarY0, y1: solarY0 + solarH, color: colors.solarToDemand, labelSide: "left" },
    { key: "gridIn", label: "Grid", value: gridInTotal, x: LEFT_X, y0: gridInY0, y1: gridInY0 + gridInH, color: colors.gridImport, labelSide: "left" },
    { key: "battery", label: "Battery", value: batteryTotal, x: MID_X, y0: batteryY0, y1: batteryY0 + batteryH, color: colors.batteryDischarge, labelSide: "above" },
    { key: "demand", label: "Demand", value: demandTotal, x: RIGHT_X, y0: demandY0, y1: demandY0 + demandH, color: demandColor, labelSide: "right" },
    { key: "gridOut", label: "Grid export", value: gridOutTotal, x: RIGHT_X, y0: gridOutY0, y1: gridOutY0 + gridOutH, color: colors.solarExport, labelSide: "right" },
    { key: "losses", label: "Losses", value: lossesTotal, x: RIGHT_X, y0: lossesY0, y1: lossesY0 + lossesH, color: lossesColor, labelSide: "right" },
  ] satisfies NodeSpec[];
  const visibleNodes = nodes.filter((n) => n.value > 0.5);

  // Per-node stacking cursors - links touching the same node stack in a
  // fixed draw order along its own height, so the node's own segments
  // never overlap.
  let solarCursor = solarY0;
  let demandCursor = demandY0;
  let batteryOutCursor = batteryY0;

  const links: Link[] = [];

  function addLink(key: string, label: string, value: number, color: string, sourceX: number, sourceY0: number, targetX: number, targetY0: number) {
    if (value <= 0.5) return;
    links.push({ key, label, value, color, sourceX, sourceY0, targetX, targetY0 });
  }

  addLink("solarToDemand", "Solar to demand", solarToDemand, colors.solarToDemand, LEFT_X + NODE_WIDTH, solarCursor, RIGHT_X, demandCursor);
  solarCursor += solarToDemand * scale;
  demandCursor += solarToDemand * scale;

  addLink("solarToBattery", "Solar to battery", solarToBattery, colors.batteryCharge, LEFT_X + NODE_WIDTH, solarCursor, MID_X, batteryY0);
  solarCursor += solarToBattery * scale;

  addLink("solarExport", "Solar export", solarExport, colors.solarExport, LEFT_X + NODE_WIDTH, solarCursor, RIGHT_X, gridOutY0);

  addLink("gridImport", "Grid import to demand", gridImport, colors.gridImport, LEFT_X + NODE_WIDTH, gridInY0, RIGHT_X, demandCursor);
  demandCursor += gridImport * scale;

  addLink("batteryDischarge", "Battery to demand", batteryDischarge, colors.batteryDischarge, MID_X + NODE_WIDTH, batteryOutCursor, RIGHT_X, demandCursor);
  batteryOutCursor += batteryDischarge * scale;

  addLink("batteryLosses", "Battery losses", batteryLosses, lossesColor, MID_X + NODE_WIDTH, batteryOutCursor, RIGHT_X, lossesY0);

  function linkPath(l: Link): string {
    const h = l.value * scale;
    const sy = l.sourceY0 + h / 2;
    const ty = l.targetY0 + h / 2;
    const midX = (l.sourceX + l.targetX) / 2;
    return `M ${l.sourceX} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${l.targetX} ${ty}`;
  }

  return (
    <Box sx={{ position: "relative" }}>
      <Box component="svg" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} sx={{ width: "100%", height: "auto", display: "block" }}>
        {links.map((l) => (
          <path
            key={l.key}
            d={linkPath(l)}
            fill="none"
            stroke={l.color}
            strokeWidth={Math.max(1, l.value * scale)}
            strokeOpacity={hoverKey === null || hoverKey === l.key ? 0.45 : 0.15}
            style={{ transition: "stroke-opacity 120ms ease", cursor: "default" }}
            onMouseEnter={() => setHoverKey(l.key)}
            onMouseLeave={() => setHoverKey(null)}
          />
        ))}

        {visibleNodes.map((n) => (
          <g key={n.key}>
            <rect x={n.x} y={n.y0} width={NODE_WIDTH} height={Math.max(1, n.y1 - n.y0)} rx={1.5} fill={n.color} />
            {n.labelSide === "left" && (
              <text x={n.x - 4} y={(n.y0 + n.y1) / 2} dy={2} fontSize={6} fill="currentColor" textAnchor="end">
                {n.label}
              </text>
            )}
            {n.labelSide === "right" && (
              <text x={n.x + NODE_WIDTH + 4} y={(n.y0 + n.y1) / 2} dy={2} fontSize={6} fill="currentColor" textAnchor="start">
                {n.label}
              </text>
            )}
            {n.labelSide === "above" && (
              <text x={n.x + NODE_WIDTH / 2} y={n.y0 - 6} fontSize={6} fill="currentColor" textAnchor="middle">
                {n.label}
              </text>
            )}
            <text
              x={n.labelSide === "left" ? n.x - 4 : n.labelSide === "right" ? n.x + NODE_WIDTH + 4 : n.x + NODE_WIDTH / 2}
              y={n.labelSide === "above" ? n.y1 + 10 : (n.y0 + n.y1) / 2 + 9}
              dy={2}
              fontSize={5}
              fill="currentColor"
              opacity={0.6}
              textAnchor={n.labelSide === "left" ? "end" : n.labelSide === "right" ? "start" : "middle"}
            >
              {Math.round(n.value).toLocaleString()} kWh
            </text>
          </g>
        ))}
      </Box>
    </Box>
  );
}
