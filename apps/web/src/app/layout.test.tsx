/**
 * @jest-environment jsdom
 */
import { screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

// Mock the AuthProvider
jest.mock("../context/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock the SSEProvider (uses useRouter which isn't available in tests)
jest.mock("../lib/sse-provider", () => ({
  SSEProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
  const renderLayout = (children: React.ReactNode) => {
    const html = renderToStaticMarkup(<RootLayout>{children}</RootLayout>);
    const parsed = new DOMParser().parseFromString(html, "text/html");
    document.body.innerHTML = parsed.body.innerHTML;
  };

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders children", () => {
    renderLayout(<div>Test content</div>);

    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("renders the site footer", () => {
    renderLayout(<div>Test content</div>);

    expect(
      screen.getByText("Track flight and hotel prices without the spreadsheet sprawl."),
    ).toBeInTheDocument();
  });

  it("renders footer as contentinfo element", () => {
    renderLayout(<div>Test content</div>);

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });
});
