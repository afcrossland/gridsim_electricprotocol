// Throwaway config so `extractCountryData.ts` can run under Vite's existing
// TS/JSON transform pipeline without matching the app's normal test glob
// (it isn't a test - see the comment at the top of that file).
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scripts/extractCountryData.ts"],
    globals: true,
  },
});
