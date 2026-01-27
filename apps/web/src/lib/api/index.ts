/**
 * Re-export generated API types with cleaner names.
 *
 * Generated types live in ./types.ts (auto-generated from OpenAPI spec).
 * This file provides convenience exports for common types.
 *
 * To regenerate types: pnpm run generate:api-types
 */

import type { components, operations } from "./types";

// =============================================================================
// Schema Types (from components.schemas)
// =============================================================================

// User
export type UserResponse = components["schemas"]["UserResponse"];

// Trip types
export type TripStatus = components["schemas"]["TripStatus"];
export type TripCreate = components["schemas"]["TripCreate"];
export type TripResponse = components["schemas"]["TripResponse"];
export type TripDetail = components["schemas"]["TripDetail"];
export type TripDetailResponse = components["schemas"]["TripDetailResponse"];
export type TripStatusUpdate = components["schemas"]["TripStatusUpdate"];

// Preferences
export type FlightPrefs = components["schemas"]["FlightPrefs"];
export type HotelPrefs = components["schemas"]["HotelPrefs"];
export type NotificationPrefsInput = components["schemas"]["NotificationPrefs-Input"];
export type NotificationPrefsOutput = components["schemas"]["NotificationPrefs-Output"];

// Enums
export type CabinClass = components["schemas"]["CabinClass"];
export type StopsMode = components["schemas"]["StopsMode"];
export type RoomSelectionMode = components["schemas"]["RoomSelectionMode"];
export type ThresholdType = components["schemas"]["ThresholdType"];

// Price snapshots and offers
export type PriceSnapshotResponse = components["schemas"]["PriceSnapshotResponse"];
export type FlightSegment = components["schemas"]["FlightSegment"];
export type FlightItinerary = components["schemas"]["FlightItinerary"];
export type FlightOffer = components["schemas"]["FlightOffer"];
export type HotelOffer = components["schemas"]["HotelOffer"];

// Refresh types
export type RefreshStartResponse = components["schemas"]["RefreshStartResponse"];
export type RefreshStatusResponse = components["schemas"]["RefreshStatusResponse"];

// Location types
export type LocationResult = components["schemas"]["LocationResult"];

// API Response wrappers
export type APIResponse<T> = {
  data: T;
  meta?: { [key: string]: unknown } | null;
};

// =============================================================================
// Operation Types (request/response shapes for each endpoint)
// =============================================================================

// List trips
export type ListTripsParams = operations["list_trips_v1_trips_get"]["parameters"]["query"];
export type ListTripsResponse = operations["list_trips_v1_trips_get"]["responses"]["200"]["content"]["application/json"];

// Create trip
export type CreateTripRequest = operations["create_trip_v1_trips_post"]["requestBody"]["content"]["application/json"];
export type CreateTripResponse = operations["create_trip_v1_trips_post"]["responses"]["201"]["content"]["application/json"];

// Get trip details
export type GetTripDetailsParams = operations["get_trip_details_v1_trips__trip_id__get"]["parameters"]["query"];
export type GetTripDetailsResponse = operations["get_trip_details_v1_trips__trip_id__get"]["responses"]["200"]["content"]["application/json"];

// Refresh all trips
export type RefreshAllResponse = operations["refresh_all_trips_v1_trips_refresh_all_post"]["responses"]["200"]["content"]["application/json"];

// Refresh status
export type RefreshStatusParams = operations["refresh_status_v1_trips_refresh_status_get"]["parameters"]["query"];
export type GetRefreshStatusResponse = operations["refresh_status_v1_trips_refresh_status_get"]["responses"]["200"]["content"]["application/json"];

// Update trip status
export type UpdateTripStatusRequest = operations["update_trip_status_v1_trips__trip_id__status_patch"]["requestBody"]["content"]["application/json"];
export type UpdateTripStatusResponse = operations["update_trip_status_v1_trips__trip_id__status_patch"]["responses"]["200"]["content"]["application/json"];

// Search locations
export type SearchLocationsParams = operations["search_locations_v1_locations_search_get"]["parameters"]["query"];
export type SearchLocationsResponse = operations["search_locations_v1_locations_search_get"]["responses"]["200"]["content"]["application/json"];
