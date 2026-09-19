import type { Scene } from "../../../shared/tour/types";

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
 *
 * Built as a function taking `onSelectCountry` (not a static array), since
 * moving onto the shared `Scene.onEnter` hook 2026-09-19 (see
 * `shared/tour/types.ts`) means each scene's own side effect has to close
 * over the callback that runs it - `selectCountry` used to be a plain
 * data field the caller (ScrollStory.tsx) interpreted itself.
 */
export function buildScenes(onSelectCountry: (code: string | null) => void): Scene[] {
  return [
    {
      id: 0,
      heading: "Welcome to the Solar Deployment Explorer",
      body: "See how much solar power countries really have.",
      layout: "hero",
      onEnter: () => onSelectCountry(null),
    },
    {
      id: 1,
      heading: "",
      body: "",
      layout: "story",
      onEnter: () => onSelectCountry(null),
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
      onEnter: () => onSelectCountry(null),
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
      onEnter: () => onSelectCountry(DEMO_COUNTRY),
      spotlight: {
        selector: '[data-tour="country-detail"]',
        tag: "Click a country",
        caption: "See its installed capacity, its share of electricity, and the population used for the per-person view - plus links to see it in the other GSC tools.",
        arrow: "right",
      },
    },
  ];
}
