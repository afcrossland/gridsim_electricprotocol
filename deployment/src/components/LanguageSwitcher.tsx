import { useTranslation } from "react-i18next";

import { LANGUAGE_KEY, SUPPORTED_LANGUAGES } from "../i18n";
import SharedLanguageSwitcher from "../../../shared/components/LanguageSwitcher";

/**
 * This app's own data-wiring around the shared switcher shell - no
 * persisted store here, so the choice is written straight to localStorage
 * (see main.tsx, which reads it back on the next load).
 */
export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const handleSelect = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem(LANGUAGE_KEY, lng);
  };

  return (
    <SharedLanguageSwitcher
      current={i18n.language}
      languages={[...SUPPORTED_LANGUAGES]}
      onSelect={handleSelect}
    />
  );
}
