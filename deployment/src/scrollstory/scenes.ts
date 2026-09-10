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
   * The country the live app should have selected while this scene is
   * active - undefined leaves whatever's already selected alone, `null`
   * clears it. Only the country-detail scene sets one; every other scene
   * clears it, so scrolling back doesn't leave a stale selection open
   * behind an earlier scene's spotlight.
   */
  selectCountry?: string | null;
}

/**
 * Demo country for the "click a country" scene - has real data in all
 * three of this app's datasets (installed capacity, generation mix,
 * population), so every part of the detail panel this scene spotlights
 * has something real to show rather than a partial/empty state.
 */
export const DEMO_COUNTRY = "DE";

/**
 * A short version of Policy Explorer's own scroll-driven tour
 * (`src/scrollstory/`) - this app needed a much smaller one, per Andrew's
 * "only needs 2/3 windows" instruction, so this is a trimmed sibling of
 * that structure, not a full port: no hero "solar bloom" animation, no CTA
 * layout of its own - the last scene is a plain spotlight step, dismissed
 * via the same Skip/nav controls as every other one (just relabelled
 * "Start exploring"). The one bit of app-state orchestration it does keep,
 * ported down from Policy Explorer's fuller version: the final scene
 * actually selects a real country (`DEMO_COUNTRY`) so it can spotlight the
 * real detail panel that appears, rather than describing it over a static
 * screenshot.
 */
export const SCENES: Scene[] = [
  {
    id: 0,
    heading: "Welcome to the Solar Deployment Explorer",
    body: "See how much solar power countries really have.",
    layout: "hero",
    selectCountry: null,
  },
  {
    id: 1,
    heading: "",
    body: "",
    layout: "story",
    selectCountry: null,
    spotlight: {
      selector: '[data-tour="metric-selector"]',
      tag: "Three views",
      caption: "Switch between installed capacity, capacity per person, and how much of a country's electricity comes from solar.",
      arrow: "down",
    },
  },
  {
    id: 2,
    heading: "",
    body: "",
    layout: "story",
    selectCountry: null,
    spotlight: {
      selector: '[data-tour="ranking-list"]',
      tag: "Pick a country",
      caption: "Click a country on the map, search for one, or pick from this list to see its own numbers and history.",
      arrow: "right",
    },
  },
  {
    id: 3,
    heading: "",
    body: "",
    layout: "story",
    selectCountry: DEMO_COUNTRY,
    spotlight: {
      selector: '[data-tour="country-detail"]',
      tag: "Click a country",
      caption: "See its installed capacity, its share of electricity, and the population used for the per-person view - plus links to see it in the other GSC tools.",
      arrow: "right",
    },
  },
];
