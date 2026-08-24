export type SceneLayout = "hero" | "story" | "cta";

export interface SpotlightTarget {
  /** CSS selector for the live-app element to highlight, e.g. '[data-tour="compare-button"]'. */
  selector: string;
  caption: string;
  tag?: string;
  arrow?: "up" | "down" | "left" | "right";
}

/** What the tour should set on the live app for this scene, applied on scene entry. */
export interface AppTourState {
  /** null clears the selection (the interactive-select scene); undefined leaves it alone. */
  selectedCountry?: string | null;
  countryPanelTab?: "impact" | "sections" | "windrose";
}

export type SceneMedia =
  | { kind: "map" }
  | {
      kind: "app";
      appState: AppTourState;
      spotlight?: SpotlightTarget;
    };

export interface Scene {
  id: number;
  tag?: string;
  heading: string;
  body: string;
  layout: SceneLayout;
  media: SceneMedia;
}

/**
 * The country a walkthrough scene falls back to if the tour reaches it
 * without a selection - either the visitor scrolled straight past the
 * pick-a-jurisdiction step, or came in via "Take the tour" from the nav bar
 * with a country already open. Great Britain has full data coverage, so
 * every tab has something real to show.
 */
export const DEFAULT_TOUR_COUNTRY = "GB";

/**
 * The scroll-story scenes, in order. Ported from gridsim-frontend's
 * `scrollstory/scenes.ts` structure (hero -> story beats -> CTA, `app`
 * scenes that both set live state and spotlight a real element via a
 * `data-tour` selector) but trimmed to this app's own features - there is no
 * i18n here yet, so copy lives inline rather than behind a translation
 * function.
 */
export const SCENES: Scene[] = [
  {
    id: 0,
    heading: "Welcome to the Solar Policy Assessment Tool",
    body: "Explore the international policy environment for behind-the-meter solar and storage.",
    layout: "hero",
    media: { kind: "map" },
  },
  {
    id: 1,
    heading: "The scoreboard",
    body: "Every jurisdiction with data, ranked by how much of the questionnaire is actually answered - not by score, so the thin rows are as visible as the impressive ones.",
    layout: "story",
    media: {
      kind: "app",
      appState: { selectedCountry: null },
      spotlight: {
        selector: '[data-tour="scoreboard"]',
        tag: "The scoreboard",
        caption: "Ranked by data completeness first - how much is actually known, not just how well a place scores.",
        arrow: "right",
      },
    },
  },
  {
    id: 2,
    heading: "",
    body: "",
    layout: "story",
    media: {
      kind: "app",
      appState: { selectedCountry: null },
      spotlight: {
        selector: '[data-tour="jurisdiction-search"]',
        tag: "Search",
        caption: "Jump straight to a jurisdiction by name, from anywhere on the map.",
        arrow: "left",
      },
    },
  },
  {
    id: 3,
    heading: "",
    body: "",
    layout: "story",
    media: {
      kind: "app",
      appState: { selectedCountry: null },
      spotlight: {
        selector: '[data-tour="scoreboard-filters"]',
        tag: "Filter and sort",
        caption: "Narrow the list by continent, country or score band, and change what it's sorted by.",
        arrow: "right",
      },
    },
  },
  {
    id: 5,
    heading: "",
    body: "",
    layout: "story",
    media: {
      kind: "app",
      appState: { countryPanelTab: "windrose" },
      spotlight: {
        selector: '[data-tour="country-tabs"]',
        tag: "By section",
        caption: "Score and data completeness, broken down by section - worked out the same way as the headline figure.",
        arrow: "up",
      },
    },
  },
  {
    id: 6,
    heading: "",
    body: "",
    layout: "story",
    media: {
      kind: "app",
      appState: { countryPanelTab: "sections" },
      spotlight: {
        selector: '[data-tour="country-tabs"]',
        tag: "Policy Score and Evidence",
        caption: "Every question, its rubric, and the evidence behind each answer - editable by anyone.",
        arrow: "up",
      },
    },
  },
  {
    id: 7,
    heading: "",
    body: "",
    layout: "story",
    media: {
      kind: "app",
      appState: { countryPanelTab: "impact" },
      spotlight: {
        selector: '[data-tour="country-tabs"]',
        tag: "Biggest Policy Wins",
        caption: "The changes that would raise this jurisdiction's score the most, ranked by weighted points.",
        arrow: "up",
      },
    },
  },
  {
    id: 8,
    heading: "",
    body: "",
    layout: "story",
    media: {
      kind: "app",
      appState: { countryPanelTab: "windrose" },
      spotlight: {
        selector: '[data-tour="compare-button"]',
        tag: "Compare",
        caption: "Open two jurisdictions side by side, with a shared tab and section selection.",
        arrow: "right",
      },
    },
  },
  {
    id: 9,
    heading: "",
    body: "",
    layout: "story",
    media: {
      kind: "app",
      appState: { countryPanelTab: "windrose" },
      spotlight: {
        selector: '[data-tour="nav-links"]',
        tag: "Read more",
        caption: "The Charter is under About, how scoring works is in Help - or dig into the question set yourself in the Admin console.",
        arrow: "up",
      },
    },
  },
  {
    id: 10,
    heading: "Start exploring",
    body: "Pick a jurisdiction, or browse the scoreboard to see who's leading.",
    layout: "cta",
    media: { kind: "map" },
  },
];
