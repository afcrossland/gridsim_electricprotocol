import { Box, IconButton } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";

interface Props {
  onZoomIn: () => void;
  onZoomOut: () => void;
  /** "Fit to world"/reset view - each app supplies its own bounds/target. */
  onReset: () => void;
  /** Top offset in px - default 16; deployment's own bumps this to 64 on mobile so it doesn't overlap the full-width mobile legend banner. */
  topOffset?: number;
  /** Override the three plain-English aria-labels - the root app passes its own `t(...)`-translated strings; deployment/calculator have no i18n for this and use the defaults. */
  labels?: { zoomIn?: string; zoomOut?: string; reset?: string };
}

const buttonSx = {
  bgcolor: "background.paper",
  borderRadius: 1,
  boxShadow: 3,
  width: 36,
  height: 36,
  color: "text.secondary",
  "&:hover": { bgcolor: "background.paper", color: "primary.main" },
};

/**
 * The zoom in / zoom out / reset-to-world-view button trio, pixel-
 * identical (top-right, 36×36, `boxShadow: 3`) across all three apps' own
 * map components before this shared copy was written 2026-09-19 - only
 * the reset callback's own target (each app's own "fit to world" bounds)
 * and the top offset (deployment's own moves down on mobile, to clear its
 * own full-width legend banner) ever differed, which is why this takes
 * plain callbacks/a number rather than a map ref.
 */
export default function MapZoomControls({ onZoomIn, onZoomOut, onReset, topOffset = 16, labels }: Props) {
  return (
    <Box sx={{ position: "absolute", top: topOffset, right: 16, zIndex: 10, display: "flex", flexDirection: "column", gap: 0.5 }}>
      <IconButton size="small" onClick={onZoomIn} aria-label={labels?.zoomIn ?? "Zoom in"} sx={buttonSx}>
        <AddIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" onClick={onZoomOut} aria-label={labels?.zoomOut ?? "Zoom out"} sx={buttonSx}>
        <RemoveIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" onClick={onReset} aria-label={labels?.reset ?? "Reset map view"} sx={buttonSx}>
        <ZoomOutMapIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
