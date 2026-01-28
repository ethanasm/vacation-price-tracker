/**
 * @jest-environment jsdom
 */
import { render } from "@testing-library/react";

// Mock CSS modules
jest.mock("../app/trips/page.module.css", () =>
  new Proxy({}, { get: (_, prop) => String(prop) })
);
jest.mock("../app/trips/[tripId]/page.module.css", () =>
  new Proxy({}, { get: (_, prop) => String(prop) })
);
jest.mock("../app/trips/new/page.module.css", () =>
  new Proxy({}, { get: (_, prop) => String(prop) })
);

import TripsLoading from "../app/trips/loading";
import TripDetailLoading from "../app/trips/[tripId]/loading";
import NewTripLoading from "../app/trips/new/loading";
import EditTripLoading from "../app/trips/[tripId]/edit/loading";

describe("Loading skeletons", () => {
  it("renders trips dashboard loading skeleton", () => {
    const { container } = render(<TripsLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders trip detail loading skeleton", () => {
    const { container } = render(<TripDetailLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders new trip loading skeleton", () => {
    const { container } = render(<NewTripLoading />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders edit trip loading skeleton", () => {
    const { container } = render(<EditTripLoading />);
    expect(container.firstChild).toBeTruthy();
  });
});
