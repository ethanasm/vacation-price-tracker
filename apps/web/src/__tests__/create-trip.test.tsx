/**
 * Simple import tests for CreateTripPage.
 * Full integration testing should be done with Playwright or Cypress
 * due to the complexity of mocking Next.js client components.
 */

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

// Mock sonner
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock date-fns
jest.mock("date-fns", () => ({
  addDays: (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  },
}));

describe("CreateTripPage", () => {
  it("can be imported", () => {
    // Verify the module can be imported without throwing
    expect(() => require("../app/trips/create/page")).not.toThrow();
  });

  it("exports a default component", () => {
    const CreateTripPage = require("../app/trips/create/page").default;
    expect(typeof CreateTripPage).toBe("function");
  });
});
