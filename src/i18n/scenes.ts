import textEn from "../data/scenes-text.json";
import textEs from "../data/scenes-text.es.json";
import textFr from "../data/scenes-text.fr.json";
import { SCENES as BASE_SCENES, type Scene } from "../scrollstory/scenes";
import { DEFAULT_LANGUAGE } from "./index";

/**
 * Per-language overlay for SCENES' own text (heading/body/the spotlight's
 * tag+caption) - same "structural data stays in one file, translated text
 * lives in per-language JSON keyed by id" idea as help.ts/charter.ts, just
 * merged onto an existing array by id instead of being the whole content.
 * SCENES itself (ids, layout, media.kind, appState, the spotlight
 * selector/arrow) never changes between languages, so it isn't duplicated
 * here - only entries that actually carry text appear in each file, and a
 * scene with no matching entry (there are none today, but a future
 * structural-only scene would work fine) just keeps its base text.
 */
interface SceneText {
  id: number;
  heading?: string;
  body?: string;
  spotlightTag?: string;
  spotlightCaption?: string;
}

const TEXT: Record<string, SceneText[]> = {
  en: textEn,
  es: textEs,
  fr: textFr,
};

export function getScenes(language: string): Scene[] {
  const base = language.split("-")[0];
  const text = TEXT[language] ?? TEXT[base] ?? TEXT[DEFAULT_LANGUAGE];
  const byId = new Map(text.map((t) => [t.id, t]));

  return BASE_SCENES.map((scene) => {
    const t = byId.get(scene.id);
    if (!t) return scene;

    const media =
      scene.media.kind === "app" && scene.media.spotlight
        ? {
            ...scene.media,
            spotlight: {
              ...scene.media.spotlight,
              tag: t.spotlightTag ?? scene.media.spotlight.tag,
              caption: t.spotlightCaption ?? scene.media.spotlight.caption,
            },
          }
        : scene.media;

    return {
      ...scene,
      heading: t.heading ?? scene.heading,
      body: t.body ?? scene.body,
      media,
    };
  });
}
