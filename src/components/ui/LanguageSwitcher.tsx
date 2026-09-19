import { SUPPORTED_LANGUAGES } from "../../i18n";
import { useProtocolStore } from "../../stores/protocolStore";
import SharedLanguageSwitcher from "../../../shared/components/LanguageSwitcher";

/**
 * This app's own data-wiring around the shared switcher shell - `setLanguage`
 * (in protocolStore.ts) both calls `i18n.changeLanguage` and persists the
 * choice, matching how `mode` is handled.
 */
export default function LanguageSwitcher() {
  const language = useProtocolStore((s) => s.language);
  const setLanguage = useProtocolStore((s) => s.setLanguage);

  return (
    <SharedLanguageSwitcher
      current={language}
      languages={[...SUPPORTED_LANGUAGES]}
      onSelect={setLanguage}
    />
  );
}
