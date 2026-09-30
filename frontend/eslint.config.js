import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

// Start enforcement at the assistant boundary being refactored. Expand this
// list as other features are cleaned, rather than hiding legacy violations.
export default [
  {
    files: [
      "src/features/activity/assistant/**/*.{js,jsx}",
      "src/features/settings/components/assistant-preference-candidate.jsx",
    ],
    ignores: ["**/tests/**"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: globals.browser,
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "no-undef": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["src/features/activity/assistant/**/*.js"],
    ignores: ["**/tests/**"],
    rules: {
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", caughtErrors: "none" },
      ],
    },
  },
];
