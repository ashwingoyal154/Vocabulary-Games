import { defineConfig } from "vitest/config";

// Unit tests live in tests/ (outside src/) so `tsc -b` and `vite build` never see
// them; vitest transpiles on the fly. jsdom provides localStorage / DOM for the
// store singleton and component tests.
export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
