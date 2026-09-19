// Policy's own tour has a third "cta" layout (its own closing scene) not
// implemented here yet, since this pass only ports deployment's own tour
// (hero + story) onto this shared engine, not policy's - see the "shared
// UI" plan. Add it here (and to TourOverlay.tsx) if/when policy's own
// tour is ported too.
export type SceneLayout = "hero" | "story";

export interface SpotlightTarget {
  /** CSS selector for the live-app element to highlight, e.g. '[data-tour="metric-selector"]'. */
  selector: string;
  caption: string;
  tag?: string;
  arrow?: "up" | "down" | "left" | "right";
}

export interface Scene {
  id: number;
  heading: string;
  body: string;
  layout: SceneLayout;
  spotlight?: SpotlightTarget;
  /**
   * Runs as a side effect whenever this scene becomes active - e.g.
   * selecting a real piece of app data so a spotlighted element has real
   * content instead of a mockup (deployment's own tour selects a demo
   * country on its detail-panel scene, and clears the selection on every
   * other scene so scrolling back doesn't leave a stale one open behind
   * an earlier spotlight). Generalized from deployment's/policy's own
   * app-specific `selectCountry`/`media.appState` fields 2026-09-19 - a
   * scene can run any effect, not just "select this country."
   */
  onEnter?: () => void;
}
