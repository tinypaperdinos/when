// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "apps/server/prisma/migrations/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // apps/web must only ever consume the `server` package for its exported
      // `AppRouter` type (see AGENT_RULES.md / plan.md §4.5) — a value import would
      // pull Express/Prisma/Node-only code into the browser bundle. `allowTypeImports`
      // keeps `import type { AppRouter } from "server"` allowed while rejecting any
      // value import from the package.
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server",
              allowTypeImports: true,
              message:
                "Only `import type { AppRouter } from \"server\"` is allowed here — a value import would pull server-only (Express/Prisma/Node) code into the browser bundle.",
            },
          ],
        },
      ],
    },
  },
);
