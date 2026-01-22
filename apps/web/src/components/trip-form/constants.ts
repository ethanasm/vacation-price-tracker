export const CABIN_CLASSES = [
  { value: "economy", label: "Economy" },
  { value: "premium_economy", label: "Premium Economy" },
  { value: "business", label: "Business" },
  { value: "first", label: "First Class" },
] as const;

export const STOPS_MODES = [
  { value: "any", label: "Any number of stops" },
  { value: "nonstop", label: "Non-stop only" },
  { value: "1-stop", label: "1 stop maximum" },
] as const;

export const ROOM_SELECTION_MODES = [
  { value: "cheapest", label: "Cheapest available" },
  { value: "preferred", label: "Match my preferences" },
] as const;

export const THRESHOLD_TYPES = [
  { value: "trip_total", label: "Total trip price" },
  { value: "flight_total", label: "Flight price only" },
  { value: "hotel_total", label: "Hotel price only" },
] as const;

export const ROOM_TYPES = ["King", "Queen", "Double", "Suite", "Studio"];

export const VIEW_TYPES = ["Ocean", "City", "Garden", "Pool", "Mountain"];

export const TRAVELER_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export const ROOM_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export const ADULTS_PER_ROOM_COUNTS = [1, 2, 3, 4] as const;
