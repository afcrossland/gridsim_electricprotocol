import { useEffect, useLayoutEffect, useState } from "react";
import { Box, Typography } from "@mui/material";

import type { SpotlightTarget } from "./scenes";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;
const RADIUS = 12; // shared by the cutout and the ring so their corners match
const CARD_W = 340;
const CARD_GAP = 22;
const DIM = "rgba(8,15,20,0.62)";
const RING = "#00ABBB"; // GSC Aqua
// Eased motion for the cutout, ring and caption as they move between targets.
const GLIDE =
  "top 0.5s cubic-bezier(0.22,1,0.36,1), left 0.5s cubic-bezier(0.22,1,0.36,1), width 0.5s cubic-bezier(0.22,1,0.36,1), height 0.5s cubic-bezier(0.22,1,0.36,1)";

/**
 * One transparent panel of the spotlight frame; blocks interaction where it
 * sits (the dim itself is painted by a single box-shadow element so the
 * cutout can be rounded). Slightly oversized hole edges are harmless.
 */
function BlockPanel({
  left,
  top,
  width,
  height,
}: {
  left: number;
  top: number;
  width: number | string;
  height: number | string;
}) {
  return <Box sx={{ position: "absolute", left, top, width, height, pointerEvents: "auto" }} />;
}

/**
 * Dims the whole viewport except a rounded-rect cutout around a live-app
 * element (found via `target.selector`), then floats a caption card next to
 * it. Re-measures every frame rather than once, so a target that mounts
 * late (e.g. only once a jurisdiction is selected) or moves as surrounding
 * panels resize still gets a correctly-placed cutout instead of a stale or
 * missing one.
 */
export default function Spotlight({ target }: { target: SpotlightTarget }) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [vw, setVw] = useState(() => window.innerWidth);
  const [vh, setVh] = useState(() => window.innerHeight);

  useLayoutEffect(() => {
    let raf = 0;
    let cancelled = false;
    let found = false;
    let last = "";
    const start = performance.now();
    const MAX_SEARCH = 60000; // keep looking this long for not-yet-mounted targets
    // Deliberately not resetting rect to null here - keeping the previous
    // cutout in place lets it glide to the next target instead of flashing
    // to a full-screen dim between scenes.

    const loop = () => {
      if (cancelled) return;
      const el = document.querySelector(target.selector) as HTMLElement | null;
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          found = true;
          const key = `${r.top}|${r.left}|${r.width}|${r.height}`;
          if (key !== last) {
            last = key;
            setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
          }
        }
      }
      if (found || performance.now() - start < MAX_SEARCH) {
        raf = requestAnimationFrame(loop);
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [target.selector]);

  useEffect(() => {
    const onResize = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const hole = rect
    ? {
        top: Math.max(rect.top - PAD, 0),
        left: Math.max(rect.left - PAD, 0),
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  const card = cardPosition(hole, target.arrow, vw, vh);

  return (
    <Box sx={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none" }}>
      {hole ? (
        <>
          <Box
            sx={{
              position: "absolute",
              left: hole.left,
              top: hole.top,
              width: hole.width,
              height: hole.height,
              borderRadius: `${RADIUS}px`,
              boxShadow: `0 0 0 9999px ${DIM}`,
              pointerEvents: "none",
              transition: GLIDE,
            }}
          />
          <BlockPanel left={0} top={0} width="100%" height={hole.top} />
          <BlockPanel
            left={0}
            top={hole.top + hole.height}
            width="100%"
            height={`calc(100% - ${hole.top + hole.height}px)`}
          />
          <BlockPanel left={0} top={hole.top} width={hole.left} height={hole.height} />
          <BlockPanel
            left={hole.left + hole.width}
            top={hole.top}
            width={`calc(100% - ${hole.left + hole.width}px)`}
            height={hole.height}
          />
          {/* Glowing ring around the open hole (non-interactive). */}
          <Box
            sx={{
              position: "absolute",
              left: hole.left,
              top: hole.top,
              width: hole.width,
              height: hole.height,
              border: `2.5px solid ${RING}`,
              borderRadius: `${RADIUS}px`,
              boxShadow: "0 0 12px rgba(0,171,187,0.7)",
              pointerEvents: "none",
              transition: GLIDE,
              "@keyframes spotPulse": {
                "0%, 100%": { borderColor: RING },
                "50%": { borderColor: "rgba(0,171,187,0.4)" },
              },
              animation: "spotPulse 2s ease-in-out infinite",
            }}
          />
        </>
      ) : (
        <Box sx={{ position: "absolute", inset: 0, bgcolor: DIM, pointerEvents: "auto" }} />
      )}

      {/* Caption card - glides to its new anchor; its text crossfades per step */}
      <Box
        sx={{
          position: "absolute",
          top: card.top,
          left: card.left,
          width: CARD_W,
          maxWidth: "calc(100vw - 32px)",
          bgcolor: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(12px)",
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
          border: "1px solid rgba(255,255,255,0.6)",
          px: 3,
          py: 2.5,
          pointerEvents: "auto",
          transition: GLIDE,
        }}
      >
        {/* Keyed on the caption so changing step replays the fade. */}
        <Box
          key={target.caption}
          sx={{
            "@keyframes spotTextIn": {
              from: { opacity: 0, transform: "translateY(6px)" },
              to: { opacity: 1, transform: "translateY(0)" },
            },
            animation: "spotTextIn 0.45s cubic-bezier(0.22,1,0.36,1) both",
          }}
        >
          {target.tag && (
            <Typography
              sx={{
                color: RING,
                fontSize: "0.6875rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                mb: 0.75,
              }}
            >
              {target.tag}
            </Typography>
          )}
          <Typography sx={{ color: "#1F2937", fontSize: "0.9375rem", lineHeight: 1.55, fontWeight: 500 }}>
            {target.caption}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Place the caption card relative to the hole, clamped to the viewport.
 * `arrow` is the direction the arrow points (from the card toward the
 * target), so the card sits on the opposite side.
 */
const CARD_H = 130; // approximate, for vertical placement only

function cardPosition(
  hole: Rect | null,
  arrow: SpotlightTarget["arrow"],
  vw: number,
  vh: number,
): { top: number; left: number } {
  const clampLeft = (l: number) => Math.min(Math.max(l, 16), Math.max(vw - CARD_W - 16, 16));
  const clampTop = (t: number) => Math.min(Math.max(t, 16), Math.max(vh - CARD_H - 16, 16));

  if (!hole) {
    return { top: vh / 2 - CARD_H / 2, left: clampLeft(vw / 2 - CARD_W / 2) };
  }

  const cx = hole.left + hole.width / 2;
  const cy = hole.top + hole.height / 2;

  switch (arrow) {
    case "down": // card above the target
      return { top: clampTop(hole.top - CARD_H - CARD_GAP), left: clampLeft(cx - CARD_W / 2) };
    case "up": // card below the target
      return { top: clampTop(hole.top + hole.height + CARD_GAP), left: clampLeft(cx - CARD_W / 2) };
    case "left": // card to the right of the target
      return { top: clampTop(cy - CARD_H / 2), left: clampLeft(hole.left + hole.width + CARD_GAP) };
    case "right": // card to the left of the target
    default:
      return { top: clampTop(cy - CARD_H / 2), left: clampLeft(hole.left - CARD_W - CARD_GAP) };
  }
}
