import expoConfig from "eslint-config-expo/flat.js";

export default [
  {
    ignores: [
      ".next/**",
      ".expo/**",
      ".worktrees/**",
      "dist/**",
      "ios/**",
      "node_modules/**",
      "public/**",
      "src/**",
      "supabase/**",
    ],
  },
  ...expoConfig,
];
