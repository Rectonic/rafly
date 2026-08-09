module.exports = {
  preset: "jest-expo",
  roots: ["<rootDir>/__tests__"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  modulePathIgnorePatterns: [
    "<rootDir>/.next/",
    "<rootDir>/.worktrees/",
    "<rootDir>/dist/",
    "<rootDir>/ios/",
    "<rootDir>/src/",
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/.next/",
    "/.worktrees/",
    "/ios/",
    "/src/",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
};
