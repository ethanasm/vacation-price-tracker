import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const config: Config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: ["**/__tests__/**/*.test.{ts,tsx}", "**/*.test.{ts,tsx}"],
  silent: true,
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  collectCoverageFrom: [
    "src/app/**/*.{ts,tsx}",
    "src/components/**/*.{ts,tsx}",
    "src/context/**/*.{ts,tsx}",
    "src/lib/**/*.{ts,tsx}",
    "src/middleware.ts",
    "!src/app/**/layout.tsx",
    "!src/components/ui/**/*.{ts,tsx}",
    "!src/context/ThemeContext.tsx",
    "!src/lib/fixtures/**/*.{ts,tsx}",
    "!src/lib/mock-data.ts",
    "!src/lib/navigation.ts",
    "!src/data/**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/index.ts",
    "!**/index.tsx",
  ],
  coverageReporters: ["text", "lcov", "json"],
  coverageDirectory: "coverage",
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
};

export default createJestConfig(config);
