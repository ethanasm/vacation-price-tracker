import { act, render, waitFor } from "@testing-library/react";
import type { TripFormData } from "../components/trip-form/types";
import { useTripForm } from "../lib/hooks/use-trip-form";

type HookRef = {
  current: ReturnType<typeof useTripForm> | null;
};

function HookHarness({
  initialData,
  hookRef,
}: {
  initialData?: Partial<TripFormData>;
  hookRef: HookRef;
}) {
  hookRef.current = useTripForm(initialData);
  return null;
}

describe("useTripForm", () => {
  it("builds a payload with trimmed codes and one-way dates", () => {
    const hookRef: HookRef = { current: null };
    render(
      <HookHarness
        hookRef={hookRef}
        initialData={{
          originAirport: " sfo ",
          destinationCode: " lax ",
          isRoundTrip: false,
          departDate: new Date(2025, 0, 2),
          returnDate: new Date(2025, 0, 10),
        }}
      />
    );

    act(() => {
      hookRef.current?.setters.setAdults("2");
    });

    const payload = hookRef.current?.getPayload();

    expect(payload?.origin_airport).toBe("SFO");
    expect(payload?.destination_code).toBe("LAX");
    expect(payload?.depart_date).toBe("2025-01-02");
    expect(payload?.return_date).toBeUndefined();
    expect(payload?.adults).toBe(2);
  });

  it("includes flight and hotel prefs when provided", () => {
    const hookRef: HookRef = { current: null };
    render(<HookHarness hookRef={hookRef} />);

    act(() => {
      hookRef.current?.setters.setAirlines(["UA"]);
      hookRef.current?.setters.setRoomTypes(["Suite"]);
      hookRef.current?.setters.setViews(["Ocean"]);
    });

    const payload = hookRef.current?.getPayload();

    expect(payload?.flight_prefs).not.toBeNull();
    expect(payload?.hotel_prefs).not.toBeNull();
  });

  it("resets state back to defaults", () => {
    const hookRef: HookRef = { current: null };
    render(<HookHarness hookRef={hookRef} />);

    act(() => {
      hookRef.current?.setters.setName("Winter Trip");
      hookRef.current?.reset();
    });

    expect(hookRef.current?.formData.name).toBe("");
  });

  it("validates required fields and updates errors", async () => {
    const hookRef: HookRef = { current: null };
    render(
      <HookHarness
        hookRef={hookRef}
        initialData={{
          name: "",
          originAirport: "SF",
          destinationCode: "",
          departDate: undefined,
          returnDate: undefined,
          notificationPrefs: {
            thresholdType: "trip_total",
            thresholdValue: "",
            emailEnabled: true,
            smsEnabled: false,
          },
        }}
      />
    );

    let isValid = true;
    act(() => {
      isValid = hookRef.current?.validate() ?? true;
    });

    await waitFor(() => {
      expect(isValid).toBe(false);
      expect(hookRef.current?.errors.name).toBeDefined();
      expect(hookRef.current?.errors.originAirport).toBeDefined();
      expect(hookRef.current?.errors.destinationCode).toBeDefined();
      expect(hookRef.current?.errors.departDate).toBeDefined();
      expect(hookRef.current?.errors.thresholdValue).toBeDefined();
    });
  });

  it("falls back when numeric fields are invalid", () => {
    const hookRef: HookRef = { current: null };
    render(<HookHarness hookRef={hookRef} />);

    act(() => {
      hookRef.current?.setters.setAdults("bad");
      hookRef.current?.setters.setRooms("nope");
      hookRef.current?.setters.setAdultsPerRoom("none");
      hookRef.current?.setters.setRoomTypes(["Suite"]);
      hookRef.current?.setters.setThresholdValue("invalid");
    });

    const payload = hookRef.current?.getPayload();

    expect(payload?.adults).toBe(1);
    expect(payload?.hotel_prefs?.rooms).toBe(1);
    expect(payload?.hotel_prefs?.adults_per_room).toBe(1);
    expect(payload?.notification_prefs.threshold_value).toBe(0);
  });

  it("handles all basic setters correctly", () => {
    const hookRef: HookRef = { current: null };
    render(<HookHarness hookRef={hookRef} />);

    act(() => {
      hookRef.current?.setters.setName("My Trip");
      hookRef.current?.setters.setOriginAirport("JFK");
      hookRef.current?.setters.setDestinationCode("LAX");
      hookRef.current?.setters.setIsRoundTrip(false);
      hookRef.current?.setters.setDepartDate(new Date(2025, 5, 15));
      hookRef.current?.setters.setReturnDate(new Date(2025, 5, 22));
    });

    expect(hookRef.current?.formData.name).toBe("My Trip");
    expect(hookRef.current?.formData.originAirport).toBe("JFK");
    expect(hookRef.current?.formData.destinationCode).toBe("LAX");
    expect(hookRef.current?.formData.isRoundTrip).toBe(false);
    expect(hookRef.current?.formData.departDate).toEqual(new Date(2025, 5, 15));
    expect(hookRef.current?.formData.returnDate).toEqual(new Date(2025, 5, 22));
  });

  it("handles flight preference setters", () => {
    const hookRef: HookRef = { current: null };
    render(<HookHarness hookRef={hookRef} />);

    act(() => {
      hookRef.current?.setters.setCabin("business");
      hookRef.current?.setters.setStopsMode("nonstop");
      hookRef.current?.setters.setAirlines(["UA", "AA"]);
    });

    expect(hookRef.current?.formData.flightPrefs.cabin).toBe("business");
    expect(hookRef.current?.formData.flightPrefs.stopsMode).toBe("nonstop");
    expect(hookRef.current?.formData.flightPrefs.airlines).toEqual(["UA", "AA"]);
  });

  it("handles hotel preference setters", () => {
    const hookRef: HookRef = { current: null };
    render(<HookHarness hookRef={hookRef} />);

    act(() => {
      hookRef.current?.setters.setRooms("2");
      hookRef.current?.setters.setAdultsPerRoom("3");
      hookRef.current?.setters.setRoomSelectionMode("best_value");
      hookRef.current?.setters.setRoomTypes(["King", "Queen"]);
      hookRef.current?.setters.setViews(["Ocean", "Garden"]);
    });

    expect(hookRef.current?.formData.hotelPrefs.rooms).toBe("2");
    expect(hookRef.current?.formData.hotelPrefs.adultsPerRoom).toBe("3");
    expect(hookRef.current?.formData.hotelPrefs.roomSelectionMode).toBe("best_value");
    expect(hookRef.current?.formData.hotelPrefs.roomTypes).toEqual(["King", "Queen"]);
    expect(hookRef.current?.formData.hotelPrefs.views).toEqual(["Ocean", "Garden"]);
  });

  it("handles notification preference setters", () => {
    const hookRef: HookRef = { current: null };
    render(<HookHarness hookRef={hookRef} />);

    act(() => {
      hookRef.current?.setters.setThresholdType("flight_only");
      hookRef.current?.setters.setThresholdValue("500");
      hookRef.current?.setters.setEmailEnabled(false);
      hookRef.current?.setters.setSmsEnabled(true);
    });

    expect(hookRef.current?.formData.notificationPrefs.thresholdType).toBe("flight_only");
    expect(hookRef.current?.formData.notificationPrefs.thresholdValue).toBe("500");
    expect(hookRef.current?.formData.notificationPrefs.emailEnabled).toBe(false);
    expect(hookRef.current?.formData.notificationPrefs.smsEnabled).toBe(true);
  });

  it("handles section toggle setters", () => {
    const hookRef: HookRef = { current: null };
    render(<HookHarness hookRef={hookRef} />);

    act(() => {
      hookRef.current?.setters.setFlightPrefsOpen(true);
      hookRef.current?.setters.setHotelPrefsOpen(true);
    });

    expect(hookRef.current?.formData.flightPrefsOpen).toBe(true);
    expect(hookRef.current?.formData.hotelPrefsOpen).toBe(true);
  });

  it("includes flight prefs when section is open", () => {
    const hookRef: HookRef = { current: null };
    render(<HookHarness hookRef={hookRef} />);

    act(() => {
      hookRef.current?.setters.setFlightPrefsOpen(true);
    });

    const payload = hookRef.current?.getPayload();

    expect(payload?.flight_prefs).not.toBeNull();
  });

  it("includes hotel prefs when section is open", () => {
    const hookRef: HookRef = { current: null };
    render(<HookHarness hookRef={hookRef} />);

    act(() => {
      hookRef.current?.setters.setHotelPrefsOpen(true);
    });

    const payload = hookRef.current?.getPayload();

    expect(payload?.hotel_prefs).not.toBeNull();
  });

  it("omits flight prefs when not configured and section closed", () => {
    const hookRef: HookRef = { current: null };
    render(<HookHarness hookRef={hookRef} />);

    const payload = hookRef.current?.getPayload();

    expect(payload?.flight_prefs).toBeNull();
  });

  it("omits hotel prefs when not configured and section closed", () => {
    const hookRef: HookRef = { current: null };
    render(<HookHarness hookRef={hookRef} />);

    const payload = hookRef.current?.getPayload();

    expect(payload?.hotel_prefs).toBeNull();
  });

  it("includes return date for round trips", () => {
    const hookRef: HookRef = { current: null };
    render(
      <HookHarness
        hookRef={hookRef}
        initialData={{
          isRoundTrip: true,
          departDate: new Date(2025, 0, 2),
          returnDate: new Date(2025, 0, 10),
        }}
      />
    );

    const payload = hookRef.current?.getPayload();

    expect(payload?.return_date).toBe("2025-01-10");
  });

  it("handles valid threshold value", () => {
    const hookRef: HookRef = { current: null };
    render(<HookHarness hookRef={hookRef} />);

    act(() => {
      hookRef.current?.setters.setThresholdValue("250.50");
    });

    const payload = hookRef.current?.getPayload();

    expect(payload?.notification_prefs.threshold_value).toBe(250.5);
  });

  it("returns valid when form is correct", () => {
    const hookRef: HookRef = { current: null };
    render(
      <HookHarness
        hookRef={hookRef}
        initialData={{
          name: "Valid Trip",
          originAirport: "SFO",
          destinationCode: "LAX",
          departDate: new Date(2025, 5, 15),
          returnDate: new Date(2025, 5, 22),
          notificationPrefs: {
            thresholdType: "trip_total",
            thresholdValue: "100",
            emailEnabled: true,
            smsEnabled: false,
          },
        }}
      />
    );

    let isValid = false;
    act(() => {
      isValid = hookRef.current?.validate() ?? false;
    });

    expect(isValid).toBe(true);
    expect(hookRef.current?.errors).toEqual({});
  });

  it("handles undefined depart date in payload", () => {
    const hookRef: HookRef = { current: null };
    render(
      <HookHarness
        hookRef={hookRef}
        initialData={{
          departDate: undefined,
        }}
      />
    );

    const payload = hookRef.current?.getPayload();

    expect(payload?.depart_date).toBeUndefined();
  });
});
