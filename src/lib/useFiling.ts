import { useState } from "react";

import { usingDatabase } from "../data/policyData";

/**
 * Sending state for the public "Suggest a correction" / "Propose a question"
 * dialogs. On database builds they file with the server (lib/reviewApi.ts),
 * so they can wait and fail; elsewhere filing is local and instant.
 *
 * `honeypotProps` go on a visually hidden <input> in each dialog: people
 * never see or tab to it, form-filling bots fill it in, and the server
 * quietly drops what they send.
 */
export function useFiling() {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [website, setWebsite] = useState("");

  /** Resolves true once filed (straight away on builds without the database). */
  const file = async (send: (website: string) => Promise<void>): Promise<boolean> => {
    if (!usingDatabase()) return true;
    setSending(true);
    setError(null);
    try {
      await send(website);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setSending(false);
    setError(null);
    setWebsite("");
  };

  const honeypotProps = {
    name: "website",
    value: website,
    onChange: (e: { target: { value: string } }) => setWebsite(e.target.value),
    tabIndex: -1,
    autoComplete: "off",
    "aria-hidden": true,
    style: { position: "absolute", left: "-10000px", width: 1, height: 1, opacity: 0 } as const,
  };

  return { sending, error, file, reset, honeypotProps };
}
