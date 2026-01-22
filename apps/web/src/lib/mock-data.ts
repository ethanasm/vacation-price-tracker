/**
 * Mock data for development.
 * This data simulates API responses for trip tracking.
 */

import type { TripDetailResponse } from "@/lib/api";

/**
 * Mock trip detail data keyed by trip ID.
 * Used by the trip detail page and dashboard.
 */
export const mockTripsData: Record<string, TripDetailResponse> = {
  "1": {
    trip: {
      id: "1",
      name: "Orlando Family Vacation",
      origin_airport: "SFO",
      destination_code: "MCO",
      depart_date: "2025-06-15",
      return_date: "2025-06-22",
      is_round_trip: true,
      adults: 4,
      status: "active",
      current_flight_price: "892.50",
      current_hotel_price: "1245.00",
      total_price: "2137.50",
      last_refreshed: "2025-01-21T10:30:00Z",
      flight_prefs: {
        airlines: ["United", "Delta"],
        stops_mode: "any",
        max_stops: 1,
        cabin: "economy",
      },
      hotel_prefs: {
        rooms: 2,
        adults_per_room: 2,
        room_selection_mode: "cheapest",
        preferred_room_types: ["Double", "Queen"],
        preferred_views: [],
      },
      notification_prefs: {
        threshold_type: "total",
        threshold_value: "2000.00",
        notify_without_threshold: false,
        email_enabled: true,
        sms_enabled: false,
      },
      created_at: "2025-01-15T08:00:00Z",
      updated_at: "2025-01-21T10:30:00Z",
    },
    top_flights: [
      {
        id: "fl1",
        airline: "United Airlines",
        airline_code: "UA",
        flight_number: "UA 1234",
        departure_time: "2025-06-15T08:00:00",
        arrival_time: "2025-06-15T16:30:00",
        duration_minutes: 330,
        stops: 1,
        stop_cities: ["Denver"],
        cabin: "economy",
        price: "892.50",
        return_flight: {
          flight_number: "UA 5678",
          departure_time: "2025-06-22T10:00:00",
          arrival_time: "2025-06-22T18:15:00",
          duration_minutes: 315,
          stops: 1,
        },
      },
      {
        id: "fl2",
        airline: "Delta Air Lines",
        airline_code: "DL",
        flight_number: "DL 456",
        departure_time: "2025-06-15T06:30:00",
        arrival_time: "2025-06-15T14:45:00",
        duration_minutes: 315,
        stops: 0,
        cabin: "economy",
        price: "1045.00",
        return_flight: {
          flight_number: "DL 789",
          departure_time: "2025-06-22T08:00:00",
          arrival_time: "2025-06-22T16:30:00",
          duration_minutes: 330,
          stops: 0,
        },
      },
      {
        id: "fl3",
        airline: "United Airlines",
        airline_code: "UA",
        flight_number: "UA 9012",
        departure_time: "2025-06-15T14:00:00",
        arrival_time: "2025-06-15T22:45:00",
        duration_minutes: 345,
        stops: 1,
        stop_cities: ["Chicago"],
        cabin: "economy",
        price: "925.00",
        return_flight: {
          flight_number: "UA 3456",
          departure_time: "2025-06-22T15:00:00",
          arrival_time: "2025-06-22T23:30:00",
          duration_minutes: 330,
          stops: 1,
        },
      },
    ],
    tracked_hotels: [
      {
        id: "h1",
        hotel_name: "Disney's Art of Animation Resort",
        hotel_id: "disney-aoa",
        star_rating: 3,
        room_type: "Family Suite",
        room_description: "Family Suite with 2 bedrooms, sleeps 6",
        price_per_night: "177.86",
        total_price: "1245.00",
        amenities: ["Pool", "Free WiFi", "Disney Transportation", "Food Court"],
      },
      {
        id: "h2",
        hotel_name: "Universal's Cabana Bay Beach Resort",
        hotel_id: "universal-cabana",
        star_rating: 3,
        room_type: "Family Suite",
        room_description: "Retro-style Family Suite with kitchenette",
        price_per_night: "199.00",
        total_price: "1393.00",
        amenities: ["Pool", "Free WiFi", "Lazy River", "Bowling Alley"],
      },
      {
        id: "h3",
        hotel_name: "Hyatt Regency Orlando",
        hotel_id: "hyatt-orlando",
        star_rating: 4,
        room_type: "Double Queen",
        room_description: "Spacious room with 2 Queen beds",
        price_per_night: "215.00",
        total_price: "1505.00",
        amenities: ["Pool", "Free WiFi", "Fitness Center", "Restaurant"],
      },
    ],
    price_history: [
      { id: "ph1", flight_price: "950.00", hotel_price: "1300.00", total_price: "2250.00", created_at: "2025-01-15T08:00:00Z" },
      { id: "ph2", flight_price: "920.00", hotel_price: "1280.00", total_price: "2200.00", created_at: "2025-01-17T08:00:00Z" },
      { id: "ph3", flight_price: "892.50", hotel_price: "1245.00", total_price: "2137.50", created_at: "2025-01-21T10:30:00Z" },
    ],
    hotel_price_histories: [
      {
        hotel_id: "disney-aoa",
        snapshots: [
          { date: "2025-01-15", price_per_night: "185.71", total_price: "1300.00" },
          { date: "2025-01-17", price_per_night: "182.86", total_price: "1280.00" },
          { date: "2025-01-21", price_per_night: "177.86", total_price: "1245.00" },
        ],
      },
      {
        hotel_id: "universal-cabana",
        snapshots: [
          { date: "2025-01-15", price_per_night: "210.00", total_price: "1470.00" },
          { date: "2025-01-17", price_per_night: "205.00", total_price: "1435.00" },
          { date: "2025-01-21", price_per_night: "199.00", total_price: "1393.00" },
        ],
      },
      {
        hotel_id: "hyatt-orlando",
        snapshots: [
          { date: "2025-01-15", price_per_night: "225.00", total_price: "1575.00" },
          { date: "2025-01-17", price_per_night: "220.00", total_price: "1540.00" },
          { date: "2025-01-21", price_per_night: "215.00", total_price: "1505.00" },
        ],
      },
    ],
  },
  "2": {
    trip: {
      id: "2",
      name: "Hawaii Honeymoon",
      origin_airport: "LAX",
      destination_code: "HNL",
      depart_date: "2025-08-01",
      return_date: "2025-08-10",
      is_round_trip: true,
      adults: 2,
      status: "active",
      current_flight_price: "654.00",
      current_hotel_price: "2100.00",
      total_price: "2754.00",
      last_refreshed: "2025-01-21T09:15:00Z",
      flight_prefs: {
        airlines: [],
        stops_mode: "nonstop",
        max_stops: null,
        cabin: "business",
      },
      hotel_prefs: {
        rooms: 1,
        adults_per_room: 2,
        room_selection_mode: "preferred",
        preferred_room_types: ["King", "Suite"],
        preferred_views: ["ocean"],
      },
      notification_prefs: {
        threshold_type: "total",
        threshold_value: "2500.00",
        notify_without_threshold: true,
        email_enabled: true,
        sms_enabled: true,
      },
      created_at: "2025-01-10T12:00:00Z",
      updated_at: "2025-01-21T09:15:00Z",
    },
    top_flights: [
      {
        id: "fl4",
        airline: "Hawaiian Airlines",
        airline_code: "HA",
        flight_number: "HA 11",
        departure_time: "2025-08-01T08:30:00",
        arrival_time: "2025-08-01T11:45:00",
        duration_minutes: 375,
        stops: 0,
        cabin: "business",
        price: "654.00",
        return_flight: {
          flight_number: "HA 12",
          departure_time: "2025-08-10T14:00:00",
          arrival_time: "2025-08-10T22:30:00",
          duration_minutes: 330,
          stops: 0,
        },
      },
      {
        id: "fl5",
        airline: "United Airlines",
        airline_code: "UA",
        flight_number: "UA 789",
        departure_time: "2025-08-01T10:00:00",
        arrival_time: "2025-08-01T13:30:00",
        duration_minutes: 390,
        stops: 0,
        cabin: "business",
        price: "720.00",
        return_flight: {
          flight_number: "UA 790",
          departure_time: "2025-08-10T16:00:00",
          arrival_time: "2025-08-11T00:15:00",
          duration_minutes: 375,
          stops: 0,
        },
      },
      {
        id: "fl6",
        airline: "Delta Air Lines",
        airline_code: "DL",
        flight_number: "DL 123",
        departure_time: "2025-08-01T07:00:00",
        arrival_time: "2025-08-01T10:30:00",
        duration_minutes: 390,
        stops: 0,
        cabin: "business",
        price: "780.00",
        return_flight: {
          flight_number: "DL 124",
          departure_time: "2025-08-10T12:00:00",
          arrival_time: "2025-08-10T20:15:00",
          duration_minutes: 375,
          stops: 0,
        },
      },
    ],
    tracked_hotels: [
      {
        id: "h4",
        hotel_name: "The Royal Hawaiian",
        hotel_id: "royal-hawaiian",
        star_rating: 5,
        room_type: "Ocean View King",
        room_description: "Luxurious King room with ocean view balcony",
        price_per_night: "233.33",
        total_price: "2100.00",
        amenities: ["Beachfront", "Pool", "Spa", "Fine Dining", "Free WiFi"],
      },
      {
        id: "h5",
        hotel_name: "Halekulani",
        hotel_id: "halekulani",
        star_rating: 5,
        room_type: "Ocean Front Suite",
        room_description: "Stunning suite with direct ocean views",
        price_per_night: "311.11",
        total_price: "2800.00",
        amenities: ["Beachfront", "Pool", "Spa", "Michelin Restaurant", "Butler Service"],
      },
      {
        id: "h6",
        hotel_name: "Outrigger Waikiki Beach Resort",
        hotel_id: "outrigger-waikiki",
        star_rating: 4,
        room_type: "Partial Ocean View King",
        room_description: "Comfortable King room with partial ocean view",
        price_per_night: "188.89",
        total_price: "1700.00",
        amenities: ["Beachfront", "Pool", "Restaurant", "Free WiFi"],
      },
    ],
    price_history: [
      { id: "ph4", flight_price: "720.00", hotel_price: "2200.00", total_price: "2920.00", created_at: "2025-01-10T12:00:00Z" },
      { id: "ph5", flight_price: "680.00", hotel_price: "2150.00", total_price: "2830.00", created_at: "2025-01-14T12:00:00Z" },
      { id: "ph6", flight_price: "654.00", hotel_price: "2100.00", total_price: "2754.00", created_at: "2025-01-21T09:15:00Z" },
    ],
    hotel_price_histories: [
      {
        hotel_id: "royal-hawaiian",
        snapshots: [
          { date: "2025-01-10", price_per_night: "244.44", total_price: "2200.00" },
          { date: "2025-01-14", price_per_night: "238.89", total_price: "2150.00" },
          { date: "2025-01-21", price_per_night: "233.33", total_price: "2100.00" },
        ],
      },
      {
        hotel_id: "halekulani",
        snapshots: [
          { date: "2025-01-10", price_per_night: "333.33", total_price: "3000.00" },
          { date: "2025-01-14", price_per_night: "322.22", total_price: "2900.00" },
          { date: "2025-01-21", price_per_night: "311.11", total_price: "2800.00" },
        ],
      },
      {
        hotel_id: "outrigger-waikiki",
        snapshots: [
          { date: "2025-01-10", price_per_night: "200.00", total_price: "1800.00" },
          { date: "2025-01-14", price_per_night: "194.44", total_price: "1750.00" },
          { date: "2025-01-21", price_per_night: "188.89", total_price: "1700.00" },
        ],
      },
    ],
  },
  "3": {
    trip: {
      id: "3",
      name: "NYC Weekend",
      origin_airport: "SFO",
      destination_code: "JFK",
      depart_date: "2025-03-14",
      return_date: "2025-03-16",
      is_round_trip: true,
      adults: 2,
      status: "paused",
      current_flight_price: "425.00",
      current_hotel_price: "890.00",
      total_price: "1315.00",
      last_refreshed: "2025-01-20T14:00:00Z",
      flight_prefs: {
        airlines: ["JetBlue"],
        stops_mode: "any",
        max_stops: null,
        cabin: "economy",
      },
      hotel_prefs: {
        rooms: 1,
        adults_per_room: 2,
        room_selection_mode: "cheapest",
        preferred_room_types: [],
        preferred_views: ["city"],
      },
      notification_prefs: null,
      created_at: "2025-01-05T16:00:00Z",
      updated_at: "2025-01-20T14:00:00Z",
    },
    top_flights: [
      {
        id: "fl7",
        airline: "JetBlue Airways",
        airline_code: "B6",
        flight_number: "B6 416",
        departure_time: "2025-03-14T06:00:00",
        arrival_time: "2025-03-14T14:30:00",
        duration_minutes: 330,
        stops: 0,
        cabin: "economy",
        price: "425.00",
        return_flight: {
          flight_number: "B6 417",
          departure_time: "2025-03-16T19:00:00",
          arrival_time: "2025-03-16T22:30:00",
          duration_minutes: 390,
          stops: 0,
        },
      },
      {
        id: "fl8",
        airline: "JetBlue Airways",
        airline_code: "B6",
        flight_number: "B6 524",
        departure_time: "2025-03-14T10:00:00",
        arrival_time: "2025-03-14T18:45:00",
        duration_minutes: 345,
        stops: 0,
        cabin: "economy",
        price: "475.00",
        return_flight: {
          flight_number: "B6 525",
          departure_time: "2025-03-16T15:00:00",
          arrival_time: "2025-03-16T18:30:00",
          duration_minutes: 390,
          stops: 0,
        },
      },
      {
        id: "fl9",
        airline: "JetBlue Airways",
        airline_code: "B6",
        flight_number: "B6 718",
        departure_time: "2025-03-14T14:00:00",
        arrival_time: "2025-03-14T22:30:00",
        duration_minutes: 330,
        stops: 0,
        cabin: "economy",
        price: "450.00",
        return_flight: {
          flight_number: "B6 719",
          departure_time: "2025-03-16T21:00:00",
          arrival_time: "2025-03-17T00:30:00",
          duration_minutes: 390,
          stops: 0,
        },
      },
    ],
    tracked_hotels: [
      {
        id: "h7",
        hotel_name: "Pod Times Square",
        hotel_id: "pod-times-square",
        star_rating: 3,
        room_type: "Full Pod",
        room_description: "Compact room with Queen bed and city views",
        price_per_night: "445.00",
        total_price: "890.00",
        amenities: ["Free WiFi", "Rooftop Bar", "24hr Fitness"],
      },
      {
        id: "h8",
        hotel_name: "citizenM New York Times Square",
        hotel_id: "citizenm-times-square",
        star_rating: 4,
        room_type: "King Room",
        room_description: "Modern room with King bed and mood lighting",
        price_per_night: "525.00",
        total_price: "1050.00",
        amenities: ["Free WiFi", "Rooftop Bar", "24hr Living Room", "Smart TV"],
      },
      {
        id: "h9",
        hotel_name: "The Standard High Line",
        hotel_id: "standard-highline",
        star_rating: 4,
        room_type: "Hudson River View King",
        room_description: "Stylish room with floor-to-ceiling windows",
        price_per_night: "625.00",
        total_price: "1250.00",
        amenities: ["Free WiFi", "Rooftop Bar", "Spa", "Restaurant", "Gym"],
      },
    ],
    price_history: [
      { id: "ph7", flight_price: "450.00", hotel_price: "920.00", total_price: "1370.00", created_at: "2025-01-05T16:00:00Z" },
      { id: "ph8", flight_price: "425.00", hotel_price: "890.00", total_price: "1315.00", created_at: "2025-01-20T14:00:00Z" },
    ],
    hotel_price_histories: [
      {
        hotel_id: "pod-times-square",
        snapshots: [
          { date: "2025-01-05", price_per_night: "460.00", total_price: "920.00" },
          { date: "2025-01-20", price_per_night: "445.00", total_price: "890.00" },
        ],
      },
      {
        hotel_id: "citizenm-times-square",
        snapshots: [
          { date: "2025-01-05", price_per_night: "550.00", total_price: "1100.00" },
          { date: "2025-01-20", price_per_night: "525.00", total_price: "1050.00" },
        ],
      },
      {
        hotel_id: "standard-highline",
        snapshots: [
          { date: "2025-01-05", price_per_night: "650.00", total_price: "1300.00" },
          { date: "2025-01-20", price_per_night: "625.00", total_price: "1250.00" },
        ],
      },
    ],
  },
};

/**
 * Dashboard trip list data format.
 * Simpler format used by the trips list page.
 */
export interface DashboardTrip {
  id: string;
  name: string;
  origin_airport: string;
  destination_code: string;
  depart_date: string;
  return_date: string | null;
  is_round_trip: boolean;
  status: "ACTIVE" | "PAUSED" | "ERROR";
  flight_price: number | null;
  hotel_price: number | null;
  total_price: number | null;
  updated_at: string;
}

/**
 * Mock trips for the dashboard list view.
 * Derived from the detailed mock data above.
 */
export const mockDashboardTrips: DashboardTrip[] = [
  {
    id: "1",
    name: "Orlando Family Vacation",
    origin_airport: "SFO",
    destination_code: "MCO",
    depart_date: "2025-06-15",
    return_date: "2025-06-22",
    is_round_trip: true,
    status: "ACTIVE",
    flight_price: 892.5,
    hotel_price: 1245.0,
    total_price: 2137.5,
    updated_at: "2025-01-21T10:30:00Z",
  },
  {
    id: "2",
    name: "Hawaii Honeymoon",
    origin_airport: "LAX",
    destination_code: "HNL",
    depart_date: "2025-08-01",
    return_date: "2025-08-10",
    is_round_trip: true,
    status: "ACTIVE",
    flight_price: 654.0,
    hotel_price: 2100.0,
    total_price: 2754.0,
    updated_at: "2025-01-21T09:15:00Z",
  },
  {
    id: "3",
    name: "NYC Weekend",
    origin_airport: "SFO",
    destination_code: "JFK",
    depart_date: "2025-03-14",
    return_date: "2025-03-16",
    is_round_trip: true,
    status: "PAUSED",
    flight_price: 425.0,
    hotel_price: 890.0,
    total_price: 1315.0,
    updated_at: "2025-01-20T14:00:00Z",
  },
];
