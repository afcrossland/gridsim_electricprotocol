import type { Scene } from "../../../shared/tour/types";
import type { TabKey } from "../App";

/**
 * Calculator's own new onboarding tour, added 2026-09-19 - built on the
 * shared `shared/tour/` engine (`TourOverlay`/`Spotlight`/`useTourState`)
 * extracted from deployment's own tour the same day, per Andrew's own
 * instruction ("give calculator the same buttons too" - Tour, Help,
 * Login, matching what deployment and policy already had). New content
 * throughout - this app had no tour before.
 *
 * `onSelectDemo`/`onSetTab` let a scene actually pick the demo location
 * and switch tabs, so the Design/Generation & demand scenes spotlight
 * real, live content rather than describing it over a static screenshot -
 * same idea as deployment's own tour selecting a demo country on its own
 * final scene.
 */
export function buildScenes(onSelectDemo: () => void, onSetTab: (tab: TabKey) => void): Scene[] {
  return [
    {
      id: 0,
      heading: "Welcome to the Solar Homes Calculator",
      body: "See what solar panels and a battery could mean for a home anywhere in the world.",
      layout: "hero",
    },
    {
      id: 1,
      heading: "",
      body: "",
      layout: "story",
      spotlight: {
        selector: '[data-tour="location-search"]',
        tag: "Pick a place",
        caption: "Search for a country or city, or click anywhere on the map, to configure a system for that location.",
        arrow: "up",
      },
    },
    {
      id: 2,
      heading: "",
      body: "",
      layout: "story",
      spotlight: {
        selector: '[data-tour="ranking-list"]',
        tag: "Or browse the list",
        caption: "Every country ranked by self-sufficiency or generation potential - click a row to select it, same as clicking the map.",
        arrow: "right",
      },
    },
    {
      id: 3,
      heading: "",
      body: "",
      layout: "story",
      onEnter: () => {
        onSelectDemo();
        onSetTab("refine");
      },
      spotlight: {
        selector: '[data-tour="design-sliders"]',
        tag: "Design your system",
        caption: "Panel count, panel size, battery size and annual demand - drag any slider and every tab updates automatically.",
        arrow: "left",
      },
    },
    {
      id: 4,
      heading: "",
      body: "",
      layout: "story",
      onEnter: () => {
        onSelectDemo();
        onSetTab("generation");
      },
      spotlight: {
        selector: '[data-tour="generation-demand-chart"]',
        tag: "See where the energy goes",
        caption: "The system's own hour-by-hour solar output next to the home's demand - members also get a full dispatch and battery breakdown below this.",
        arrow: "up",
      },
    },
  ];
}
