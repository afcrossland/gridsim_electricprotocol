import SharedLanguageSwitcher from "../../../shared/components/LanguageSwitcher";

/**
 * This app has no i18n system yet (see README.md) - a menu with only
 * "English" in it is the same real state the sibling apps are in today
 * (`SUPPORTED_LANGUAGES = ["en"]`, es/fr built but not offered), just
 * without any i18next scaffolding behind it yet.
 */
export default function LanguageSwitcher() {
  return <SharedLanguageSwitcher current="en" languages={["en"]} onSelect={() => {}} />;
}
