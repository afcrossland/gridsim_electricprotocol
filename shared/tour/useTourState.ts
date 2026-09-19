import { useCallback, useEffect, useState } from "react";

interface TourState {
  tourOpen: boolean;
  openTour: () => void;
  dismissTour: () => void;
  /** The active scene's own id, as reported by `TourOverlay`'s own `onSceneChange` - wire it straight through. */
  tourSceneId: number;
  setTourSceneId: (id: number) => void;
  /** True while the tour is open AND showing its opening (id 0) hero scene - every app that had this used it to hide its own sidebar/nav/footer for an unobstructed view underneath. */
  heroScene: boolean;
}

/**
 * The tour-seen/URL-param wiring every app with a tour re-implemented in
 * its own `App.tsx` - a `localStorage` "seen once" flag (opens
 * automatically on a first-ever visit), `?showTour=1` to force it open
 * even for a returning visitor (used by the Playbook homepage's own
 * "Show me how" link), and the inverse `?skipIntro=1` to mark it seen
 * without opening it (the homepage's own "Click to explore" link).
 * Extracted into `shared/tour/` 2026-09-19 alongside `TourOverlay`/
 * `Spotlight` - `seenKey` is each app's own localStorage key (e.g.
 * `"deployment-tour-seen"`), kept per-app so one app's "seen" flag never
 * silently marks a sibling app's tour seen too.
 */
export function useTourState(seenKey: string): TourState {
  const [tourOpen, setTourOpen] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem(seenKey)) setTourOpen(true);
  }, [seenKey]);

  const dismissTour = useCallback(() => {
    setTourOpen(false);
    localStorage.setItem(seenKey, "1");
  }, [seenKey]);

  const [tourSceneId, setTourSceneId] = useState(0);
  const heroScene = tourOpen && tourSceneId === 0;

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("showTour")) return;
    setTourOpen(true);
    const url = new URL(window.location.href);
    url.searchParams.delete("showTour");
    window.history.replaceState({}, "", url);
  }, []);

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("skipIntro")) return;
    setTourOpen(false);
    localStorage.setItem(seenKey, "1");
    const url = new URL(window.location.href);
    url.searchParams.delete("skipIntro");
    window.history.replaceState({}, "", url);
  }, [seenKey]);

  return { tourOpen, openTour: () => setTourOpen(true), dismissTour, tourSceneId, setTourSceneId, heroScene };
}
