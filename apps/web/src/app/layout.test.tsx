/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";

// Mock the AuthProvider
jest.mock("../context/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock CSS modules
jest.mock("./layout.module.css", () => ({
  footer: "footer",
  divider: "divider",
}));

// Mock next/font/google
jest.mock("next/font/google", () => ({
  Space_Grotesk: () => ({ variable: "--font-display" }),
  Manrope: () => ({ variable: "--font-body" }),
}));

// We need to import after mocks are set up
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { default: RootLayout } = require("./layout");

describe("RootLayout", () => {
  it("renders children", () => {
    render(
      <RootLayout>
        <div>Test content</div>
      </RootLayout>,
    );

    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("renders the site footer", () => {
    render(
      <RootLayout>
        <div>Test content</div>
      </RootLayout>,
    );

    expect(
      screen.getByText("Track flight and hotel prices without the spreadsheet sprawl."),
    ).toBeInTheDocument();
  });

  it("renders footer as contentinfo element", () => {
    render(
      <RootLayout>
        <div>Test content</div>
      </RootLayout>,
    );

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });
});
