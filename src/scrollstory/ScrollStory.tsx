import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import Spotlight from "./Spotlight";
import { DEFAULT_TOUR_COUNTRY, SCENES } from "./scenes";
import { useProtocolStore } from "../stores/protocolStore";

const WHEEL_COOLDOWN_MS = 650;
const RING = "#00ABBB"; // GSC Aqua

const CARD_BASE = {
  bgcolor: "rgba(255,255,255,0.96)",
  backdropFilter: "blur(12px)",
  borderRadius: "12px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
  border: "1px solid rgba(255,255,255,0.6)",
} as const;

const FADE_UP = {
  "@keyframes fadeInUp": {
    from: { opacity: 0, transform: "translateY(18px)" },
    to: { opacity: 1, transform: "translateY(0)" },
  },
  animation: "fadeInUp 0.45s cubic-bezier(0.22,1,0.36,1) both",
} as const;

// Shared white pill used for both the "Scroll to begin" hint and the Skip
// button, so they read as a matched pair at the foot of the tour.
const PILL = {
  display: "flex",
  alignItems: "center",
  gap: 0.75,
  bgcolor: "#fff",
  color: RING,
  px: 2.25,
  py: 1,
  borderRadius: "22px",
  boxShadow: "0 6px 20px rgba(0,0,0,0.28)",
  fontSize: "0.875rem",
  fontWeight: 700,
  letterSpacing: "0.01em",
  lineHeight: 1,
} as const;

const NAV_BTN = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 38,
  height: 38,
  borderRadius: "50%",
  border: "none",
  bgcolor: "#fff",
  color: RING,
  cursor: "pointer",
  boxShadow: "0 6px 20px rgba(0,0,0,0.28)",
  pointerEvents: "auto",
  p: 0,
  transition: "background-color 0.15s ease, opacity 0.15s ease",
  "&:hover": { bgcolor: "#F0FBFC" },
  "&:disabled": { opacity: 0.4, cursor: "default", "&:hover": { bgcolor: "#fff" } },
} as const;

/**
 * Scroll-driven onboarding tour: a hero screen, a sequence of scenes that
 * drive the live app underneath and spotlight one real element at a time
 * (see `scenes.ts`), ending in a call to action. Ported from gridsim-
 * frontend's `scrollstory/` (a sibling GSC project), trimmed to this app's
 * own features - no i18n, no decorative background media, and only the one
 * auto-advance case this app needs (picking a jurisdiction), where gridsim
 * also has date-range and simulation-run steps.
 *
 * Mounted as a fixed, full-viewport overlay above the real app, which stays
 * mounted underneath the whole time - "app" scenes show through directly
 * (nothing painted over them but the spotlight cutout and its caption);
 * "map" scenes (hero and the closing CTA) add a dark vignette over the same
 * live map, cleared back to its default globe view, so the card text stays
 * readable without needing a separate decorative map component.
 */
interface Props {
  onDismiss: () => void;
  /** Reports the active scene's id on every change - lets the app hide chrome (the sidebar, on the opening scene) that would otherwise show through the mostly-transparent overlay. */
  onSceneChange?: (sceneId: number) => void;
  /** Opens the Charter welcome screen on top of the tour - offered right on the opening scene for anyone who wants the Charter itself rather than the tour. Does not end the tour; see `paused`. */
  onOpenCharter?: () => void;
  /** True while the Charter is open on top of the tour - suspends wheel/keyboard scene navigation so scrolling the Charter's own content doesn't also drive the tour underneath it. */
  paused?: boolean;
}

export default function ScrollStory({ onDismiss, onSceneChange, onOpenCharter, paused = false }: Props) {
  const [activeScene, setActiveScene] = useState(0);
  const scene = SCENES[activeScene];
  const media = scene.media;

  const selectCountry = useProtocolStore((s) => s.selectCountry);
  const setCountryPanelTab = useProtocolStore((s) => s.setCountryPanelTab);

  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const goToScene = useCallback(
    (index: number) => setActiveScene(Math.max(0, Math.min(index, SCENES.length - 1))),
    [],
  );
  const advance = useCallback(() => {
    setActiveScene((i) => Math.min(i + 1, SCENES.length - 1));
  }, []);
  const retreat = useCallback(() => setActiveScene((i) => Math.max(i - 1, 0)), []);

  // Wheel drives the tour. Capturing on window (and stopping propagation)
  // keeps the live map from zooming under it.
  useEffect(() => {
    const lock = { until: 0 };
    const onWheel = (e: WheelEvent) => {
      if (pausedRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const now = Date.now();
      if (now < lock.until || Math.abs(e.deltaY) < 8) return;
      lock.until = now + WHEEL_COOLDOWN_MS;
      if (e.deltaY > 0) advance();
      else retreat();
    };
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => window.removeEventListener("wheel", onWheel, { capture: true } as AddEventListenerOptions);
  }, [advance, retreat]);

  // Keyboard navigation, same capturing pattern as the wheel handler above.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (pausedRef.current) return;
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        advance();
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        e.stopPropagation();
        retreat();
      } else if (e.key === "Escape") {
        e.stopPropagation();
        onDismiss();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true } as AddEventListenerOptions);
  }, [advance, retreat, onDismiss]);

  useEffect(() => {
    onSceneChange?.(SCENES[activeScene].id);
  }, [activeScene, onSceneChange]);

  // Orchestrate the live app to match the active scene.
  useEffect(() => {
    const m = SCENES[activeScene].media;
    if (m.kind !== "app") {
      selectCountry(null);
      return;
    }
    if (m.appState.selectedCountry !== undefined) {
      selectCountry(m.appState.selectedCountry);
    } else if (!useProtocolStore.getState().selectedCountry) {
      // The first walkthrough scene reached without a selection yet jumps
      // straight to a real country's detail view rather than asking the
      // visitor to pick one first.
      selectCountry(DEFAULT_TOUR_COUNTRY);
    }
    if (m.appState.countryPanelTab) setCountryPanelTab(m.appState.countryPanelTab);
  }, [activeScene, selectCountry, setCountryPanelTab]);

  const spotlight = media.kind === "app" ? media.spotlight : undefined;

  return (
    <Box sx={{ position: "fixed", inset: 0, zIndex: 300, overflow: "hidden", pointerEvents: "none" }}>
      {/* Vignette - only over the "map" scenes (hero and the closing CTA), not
          over the live app scenes underneath. */}
      {media.kind !== "app" && (
        <>
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 45%)",
              pointerEvents: "none",
            }}
          />
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 25%)",
              pointerEvents: "none",
            }}
          />
        </>
      )}

      {/* Spotlight step. Kept mounted across scenes (no per-scene key) so the
          cutout glides between targets instead of flashing. */}
      {spotlight && <Spotlight target={spotlight} />}

      {/* Hero layout */}
      {scene.layout === "hero" && (
        <Box
          key={scene.id}
          sx={{
            ...FADE_UP,
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <Box sx={{ ...CARD_BASE, px: 5, py: 4, textAlign: "center", maxWidth: 540 }}>
            <Box
              component="img"
              src={`${import.meta.env.BASE_URL}favicon.png`}
              alt=""
              sx={{ height: 48, width: 48, display: "block", mx: "auto", mb: 1.75 }}
            />
            <Typography
              sx={{
                color: RING,
                fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
                fontWeight: 800,
                lineHeight: 1.15,
                letterSpacing: "-0.03em",
                mb: 1.5,
              }}
            >
              {scene.heading}
            </Typography>
            <Typography sx={{ color: "#6B7280", fontSize: "1.0625rem", lineHeight: 1.6, mb: 2.5 }}>
              {scene.body}
            </Typography>
            <Box sx={{ pt: 2, borderTop: "1px solid #E5E7EB" }}>
              <Typography sx={{ fontSize: "0.8125rem", color: "#9CA3AF", lineHeight: 1.4 }}>
                by The Global Solar Council&ensp;·&ensp;
                <Box component="span" sx={{ color: "#D97706", fontStyle: "italic", fontWeight: 600 }}>
                  Solar. Storage. Future Secured.
                </Box>
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* Story layout - either a spotlight (rendered above already carries its
          own card) or, for the interactive-select scene, a plain floating
          card over the live map. */}
      {scene.layout === "story" && !spotlight && Boolean(scene.heading || scene.body) && (
        <Box
          key={scene.id}
          sx={{
            ...FADE_UP,
            position: "absolute",
            bottom: 80,
            left: 56,
            maxWidth: 420,
            ...CARD_BASE,
            px: 3.5,
            py: 3,
            pointerEvents: "none",
          }}
        >
          {scene.tag && (
            <Typography
              sx={{
                color: RING,
                fontSize: "0.6875rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                mb: 1,
              }}
            >
              {scene.tag}
            </Typography>
          )}
          <Typography
            sx={{
              color: RING,
              fontSize: "clamp(1.4rem, 2.5vw, 1.875rem)",
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
              mb: 1,
            }}
          >
            {scene.heading}
          </Typography>
          <Typography sx={{ color: "#374151", fontSize: "0.9375rem", lineHeight: 1.6 }}>
            {scene.body}
          </Typography>
        </Box>
      )}

      {/* CTA layout */}
      {scene.layout === "cta" && (
        <Box
          key={scene.id}
          sx={{
            ...FADE_UP,
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <Box sx={{ ...CARD_BASE, px: 5, py: 4.5, textAlign: "center", maxWidth: 460, pointerEvents: "auto" }}>
            <Typography
              sx={{
                color: RING,
                fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
                fontWeight: 700,
                lineHeight: 1.15,
                letterSpacing: "-0.025em",
                mb: 1.25,
              }}
            >
              {scene.heading}
            </Typography>
            <Typography sx={{ color: "#6B7280", fontSize: "1rem", mb: 3, lineHeight: 1.6 }}>
              {scene.body}
            </Typography>
            <Box
              component="button"
              onClick={onDismiss}
              sx={{
                bgcolor: RING,
                color: "#fff",
                fontWeight: 600,
                fontSize: "1rem",
                border: "none",
                borderRadius: "8px",
                px: 4.5,
                py: 1.5,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: "0 4px 20px rgba(0,171,187,0.4)",
                "&:hover": { bgcolor: "#008194" },
              }}
            >
              Start exploring
            </Box>
          </Box>
        </Box>
      )}

      {/* Progress dots */}
      <Box
        sx={{
          position: "absolute",
          bottom: 26,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 5,
          pointerEvents: "auto",
          display: "flex",
          gap: "4px",
          alignItems: "center",
        }}
      >
        {SCENES.map((_, i) => (
          <Box
            key={i}
            onClick={() => goToScene(i)}
            sx={{
              width: i === activeScene ? 26 : 12,
              height: 5,
              borderRadius: "3px",
              cursor: "pointer",
              bgcolor:
                i === activeScene
                  ? RING
                  : i < activeScene
                    ? "rgba(0,171,187,0.55)"
                    : "rgba(120,130,140,0.4)",
              transition: "all 0.3s ease",
            }}
          />
        ))}
      </Box>

      {/* Bottom controls: scroll hint (scene 0) stacked above Skip + nav. */}
      <Box
        sx={{
          position: "absolute",
          bottom: 52,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 6,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          alignItems: "center",
        }}
      >
        {activeScene === 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, pointerEvents: "auto" }}>
            <Box
              sx={{
                ...PILL,
                "@keyframes hintBounce": {
                  "0%, 100%": { transform: "translateY(0)" },
                  "50%": { transform: "translateY(5px)" },
                },
                animation: "hintBounce 1.5s ease infinite",
              }}
            >
              Scroll to begin
              <KeyboardArrowDownIcon sx={{ fontSize: 20 }} />
            </Box>

            {onOpenCharter && (
              <Box
                component="button"
                onClick={onOpenCharter}
                sx={{ ...PILL, border: "none", cursor: "pointer", fontFamily: "inherit", "&:hover": { bgcolor: "#F0FBFC" } }}
              >
                Read the Citizens Electrification Charter
              </Box>
            )}
          </Box>
        )}
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          <Box
            component="button"
            onClick={retreat}
            disabled={activeScene === 0}
            aria-label="Previous"
            sx={NAV_BTN}
          >
            <ChevronLeftIcon sx={{ fontSize: 22 }} />
          </Box>
          <Box
            component="button"
            onClick={onDismiss}
            sx={{
              ...PILL,
              border: "none",
              cursor: "pointer",
              pointerEvents: "auto",
              fontFamily: "inherit",
              "&:hover": { bgcolor: "#F0FBFC" },
            }}
          >
            Skip intro
          </Box>
          <Box
            component="button"
            onClick={advance}
            disabled={activeScene === SCENES.length - 1}
            aria-label="Next"
            sx={NAV_BTN}
          >
            <ChevronRightIcon sx={{ fontSize: 22 }} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
