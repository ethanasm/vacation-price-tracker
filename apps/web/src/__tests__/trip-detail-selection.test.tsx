import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { Suspense } from "react";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/lib/sse-provider", () => ({ useSSEContextOptional: () => null }));

// Mock recharts so the chart renders cheaply in jsdom.
jest.mock("recharts", () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="chart-line" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
}));
jest.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="chart-container">{children}</div>
  ),
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

const snapshot = {
  id: "s1", created_at: "2025-08-01T00:00:00Z",
  flight_price: "142", hotel_price: "538", total_price: "680",
  flight_offers: [
    { id: "as", airline_code: "AS", price: "177", stops: 0,
      itineraries: [{ direction: "outbound", stops: 0, segments: [
        { carrier_code: "AS", flight_number: "AS1", departure_airport: "SFO", arrival_airport: "RDM",
          departure_time: "2025-08-22T07:05:00", arrival_time: "2025-08-22T09:00:00", duration_minutes: 115 }] }] },
    { id: "ua", airline_code: "UA", price: "142", stops: 1,
      itineraries: [{ direction: "outbound", stops: 1, segments: [
        { carrier_code: "UA", flight_number: "UA508", departure_airport: "SFO", arrival_airport: "DEN",
          departure_time: "2025-08-22T06:00:00", arrival_time: "2025-08-22T09:30:00", duration_minutes: 210 },
        { carrier_code: "AS", flight_number: "AS2201", departure_airport: "DEN", arrival_airport: "RDM",
          departure_time: "2025-08-22T10:40:00", arrival_time: "2025-08-22T12:10:00", duration_minutes: 90 }] }] },
    { id: "dl", airline_code: "DL", price: "142", stops: 0,
      itineraries: [{ direction: "outbound", stops: 0, segments: [
        { carrier_code: "DL", flight_number: "DL77", departure_airport: "SFO", arrival_airport: "RDM",
          departure_time: "2025-08-22T08:00:00", arrival_time: "2025-08-22T10:00:00", duration_minutes: 120 }] }] },
  ],
  hotel_offers: [
    { id: "river", name: "Riverhouse", price: "612", rating: 4 },
    { id: "eviva", name: "Eviva", price: "538", rating: 3 },
  ],
};

const trip = {
  id: "t1", name: "Test 2", origin_airport: "SFO", destination_code: "RDM",
  depart_date: "2025-08-22", return_date: "2025-08-26", status: "active",
  is_round_trip: true, adults: 2,
  current_flight_price: "142", current_hotel_price: "538", total_price: "680",
  hotel_prefs: { rooms: 1 }, track_flights: true, track_hotels: true,
};

jest.mock("@/lib/api", () => {
  class ApiError extends Error {
    status = 0;
    detail = "";
  }
  return {
    ApiError,
    api: {
      trips: {
        getDetails: jest.fn(async () => ({ data: { trip, price_history: [snapshot] } })),
      },
    },
  };
});

// Import after mocks.
import TripDetailPage from "@/app/trips/[tripId]/page";

async function renderPage() {
  await act(async () => {
    render(
      <Suspense fallback={<div>Loading…</div>}>
        <TripDetailPage params={Promise.resolve({ tripId: "t1" })} />
      </Suspense>,
    );
  });
}

// The accessible name of each flight radio leads with the operating airline
// name. We match by that name but skip the multi-carrier "Operated by …"
// subtitle (which can mention a second airline) so each airline resolves to a
// single row.
function findFlightRadio(name: RegExp): HTMLElement {
  const radios = screen.getAllByRole("radio");
  const matches = radios.filter((r) => {
    const text = r.textContent ?? "";
    const primary = text.split("Operated by")[0];
    return name.test(primary);
  });
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one flight radio for ${name}, found ${matches.length}`);
  }
  return matches[0];
}

async function selectFlight(name: RegExp) {
  await userEvent.click(findFlightRadio(name));
}
async function selectHotel(name: RegExp) {
  // Hotels live behind the Hotels tab; switch to it before selecting.
  await userEvent.click(screen.getByRole("button", { name: /^Hotels$/ }));
  await userEvent.click(screen.getByRole("radio", { name }));
}

describe("Trip detail selection → total (verified)", () => {
  it("Alaska (non-stop) + Riverhouse = $789", async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText("Test 2")).toBeInTheDocument());
    await selectFlight(/Alaska/i);
    await selectHotel(/Riverhouse/i);
    const total = screen.getByTestId("trip-total");
    expect(within(total).getByText("$789")).toBeInTheDocument();
    expect(screen.getByTestId("now-badge")).toHaveTextContent("Now $789");
  });

  it("United (1-stop) + Riverhouse = $754", async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText("Test 2")).toBeInTheDocument());
    await selectFlight(/United/i);
    await selectHotel(/Riverhouse/i);
    expect(within(screen.getByTestId("trip-total")).getByText("$754")).toBeInTheDocument();
    expect(screen.getByTestId("now-badge")).toHaveTextContent("Now $754");
  });

  it("Delta + Eviva = $680", async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText("Test 2")).toBeInTheDocument());
    await selectFlight(/Delta/i);
    await selectHotel(/Eviva/i);
    expect(within(screen.getByTestId("trip-total")).getByText("$680")).toBeInTheDocument();
    expect(screen.getByTestId("now-badge")).toHaveTextContent("Now $680");
  });

  it("re-tapping the expanded flight collapses it but keeps it selected", async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText("Test 2")).toBeInTheDocument());
    const alaska = findFlightRadio(/Alaska/i);
    await userEvent.click(alaska);
    expect(alaska).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(alaska);
    expect(alaska).toHaveAttribute("aria-expanded", "false");
    expect(alaska).toHaveAttribute("aria-checked", "true");
  });
});
