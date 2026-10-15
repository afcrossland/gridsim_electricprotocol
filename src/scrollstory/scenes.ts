export type SceneLayout = "hero" | "story" | "cta";

export interface SpotlightTarget {
  /** CSS selector for the live-app element to highlight, e.g. '[data-tour="submit-suggestion"]'. */
  selector: string;
  caption: string;
  tag?: string;
  arrow?: "up" | "down" | "left" | "right";
}

/** What the tour should set on the live app for this scene, applied on scene entry. */
export interface AppTourState {
  /** null clears the selection (the interactive-select scene); undefined leaves it alone. */
  selectedCountry?: string | null;
  /**
   * Forces CountryPanel's accordion open on a specific section (by id, from
   * protocol.seed.json) - null closes it back to the full tile grid,
   * undefined leaves it alone. Needed since the accordion redesign
   * (2026-10-09): a question's own rubric box only renders once its
   * section has actually been clicked open, so any scene that spotlights
   * something inside a section (the rubric itself) has to open one first
   * or there is nothing for the spotlight to find.
   */
  activeSectionId?: string | null;
}

export type SceneMedia =
  | { kind: "map" }
  | {
      kind: "app";
      appState?: AppTourState;
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
    heading: "Welcome to the Solar Policy Explorer",
    body: "Explore the international policy environment for behind-the-meter solar and storage. Identify impactful policy gaps to accelerate the energy transition",
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
        caption: "Select a jurisdiction to view its details.",
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
    id: 7,
    heading: "",
    body: "",
    layout: "story",
    media: {
      kind: "app",
      // Closed explicitly (not just left at its initial default) so
      // scrolling back up to this scene after scene 11 opened a section
      // returns to the full tile grid the caption is actually describing.
      appState: { activeSectionId: null },
      spotlight: {
        selector: '[data-tour="country-tabs"]',
        tag: "Policy Landscape",
        caption: "Score and data completeness per policy area - click a tile to see its own exemplars, questions, rubric, and the evidence behind each answer, editable by anyone.",
        arrow: "up",
      },
    },
  },
  {
    id: 11,
    heading: "",
    body: "",
    layout: "story",
    media: {
      kind: "app",
      // Opens a real section so the rubric box this scene spotlights
      // actually exists - see AppTourState's own doc comment for why this
      // became necessary once the accordion redesign made the rubric
      // conditional on a tile click.
      appState: { activeSectionId: "self-consumption" },
      spotlight: {
        selector: '[data-tour="question-rubric"]',
        tag: "Edit an answer",
        caption: "Click a rubric tier to record what's actually in place, then use Evidence to add the citation behind it - a law, a regulator decision, or a market operator's own data.",
        arrow: "up",
      },
    },
  },
  {
    id: 12,
    heading: "",
    body: "",
    layout: "story",
    media: {
      kind: "app",
      spotlight: {
        selector: '[data-tour="suggest-correction"]',
        tag: "Suggest a correction",
        caption: "Spotted an error? Suggest a correction on any answer - pick the answer you think is right, add your evidence (a link or the name of a report) and your name, and an admin will review it.",
        arrow: "left",
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
    body: "Pick a jurisdiction, or browse the scoreboard and update missing policy information.",
    layout: "cta",
    media: { kind: "map" },
  },
];
