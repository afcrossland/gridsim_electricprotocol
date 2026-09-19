import textEn from "../data/scenes-text.json";
import textEs from "../data/scenes-text.es.json";
import textFr from "../data/scenes-text.fr.json";
import { buildScenes } from "../scrollstory/scenes";
import { DEFAULT_LANGUAGE } from "./index";
import type { Scene } from "../../../shared/tour/types";

/**
 * Per-language overlay for SCENES' own text (heading/body/the spotlight's
 * tag+caption) - same idea as ep_policymap's own src/i18n/scenes.ts, just
 * against this app's simpler Scene shape (spotlight sits directly on the
 * scene, not nested under a media.kind === "app" union). SCENES itself
 * (ids, layout, spotlight selector/arrow, selectCountry) never changes
 * between languages, so it isn't duplicated here.
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

export function getScenes(language: string, onSelectCountry: (code: string | null) => void): Scene[] {
  const base = language.split("-")[0];
  const text = TEXT[language] ?? TEXT[base] ?? TEXT[DEFAULT_LANGUAGE];
  const byId = new Map(text.map((t) => [t.id, t]));

  return buildScenes(onSelectCountry).map((scene) => {
    const t = byId.get(scene.id);
    if (!t) return scene;

    return {
      ...scene,
      heading: t.heading ?? scene.heading,
      body: t.body ?? scene.body,
      spotlight: scene.spotlight
        ? {
            ...scene.spotlight,
            tag: t.spotlightTag ?? scene.spotlight.tag,
            caption: t.spotlightCaption ?? scene.spotlight.caption,
          }
        : scene.spotlight,
    };
  });
}
