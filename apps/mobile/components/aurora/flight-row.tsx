import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { ChevronDown, ChevronUp, Plane } from 'lucide-react-native';
import { AuroraCard, StatusChip, AirlineChip, AirlineChipPair } from '@/components/aurora';
import { useTheme } from '@/lib/theme';
import {
  airlineChip,
  stopsBadge,
  layoverLabel,
  multiCarrierSubtitle,
  flightSummaryLine,
  returnSummaryLine,
  displayLegs,
  durationLabel,
  formatMoneyString,
  clockLabel,
  segmentMetaLabel,
  type FlightOffer,
  type FlightSegment,
} from '@/lib/aurora';

/** Unique carrier codes across every segment of every leg (for the multi-carrier pair). */
function carrierCodes(segs: FlightSegment[]): string[] {
  return [...new Set(segs.map((s) => (s.carrier_code ?? '').toUpperCase()).filter(Boolean))];
}

const CARRIER_NAMES: Record<string, string> = { AS: 'Alaska', UA: 'United', DL: 'Delta' };
function carrierName(code: string): string {
  return CARRIER_NAMES[code.toUpperCase()] ?? code.toUpperCase();
}

function minutesBetween(aIso?: string | null, bIso?: string | null): number {
  if (!aIso || !bIso) return 0;
  const a = Date.parse(aIso);
  const b = Date.parse(bIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(Math.round((b - a) / 60000), 0);
}

/** Collapsed: radio + airline chip + name + stops badge + price + chevron, with a
 * one-line summary. Expanded: per-leg detail (multi-stop) or OUTBOUND block. */
export function FlightRow({
  offer,
  nights: _nights,
  selected,
  expanded,
  onPress,
}: {
  offer: FlightOffer;
  nights: number;
  selected: boolean;
  expanded: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const { tokens } = useTheme();
  const c = tokens.color;
  const legs = displayLegs(offer);
  const outbound = legs.find((l) => l.label === 'OUTBOUND')?.segments ?? [];
  // Carrier codes span every leg so a return-only codeshare still reads as multi-carrier.
  const codes = carrierCodes(legs.flatMap((l) => l.segments));
  const multiCarrier = codes.length > 1;
  const viaCode = offer.stops > 0 ? outbound[0]?.arrival_airport ?? null : null;
  const badge = stopsBadge(offer.stops, viaCode);
  const price = formatMoneyString(offer.price);
  const returnLine = returnSummaryLine(offer);

  return (
    <AuroraCard
      accent={multiCarrier ? c.layover : undefined}
      style={[
        styles.card,
        selected ? { backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.selectedBorder } : null,
      ]}
    >
      <Pressable
        testID={`flight-option-${offer.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${offer.airline_name ?? ''} ${price}`.trim()}
        accessibilityState={{ selected }}
        onPress={onPress}
        style={styles.headerRow}
      >
        <View
          style={[
            styles.radio,
            { borderColor: selected ? c.primary : c.textFaint },
            selected ? { backgroundColor: c.primary } : null,
          ]}
        >
          {selected ? <View style={styles.radioDot} /> : null}
        </View>

        {multiCarrier ? (
          <AirlineChipPair codes={codes as [string, string]} />
        ) : (
          <AirlineChip code={offer.airline_code} />
        )}

        <View style={styles.titleCol}>
          <Text numberOfLines={1} style={[styles.airlineName, { color: c.textStrong, fontFamily: tokens.font[600] }]}>
            {offer.airline_name ?? airlineChip(offer.airline_code).label}
          </Text>
          <StatusChip tone={badge.tone} label={badge.label} />
        </View>

        <View style={styles.priceCol}>
          <Text
            style={[styles.price, { color: selected ? c.primary : c.textStrong, fontFamily: tokens.font[800] }]}
          >
            {price}
          </Text>
          {expanded ? (
            <ChevronUp size={18} color={c.textMuted} strokeWidth={2} />
          ) : (
            <ChevronDown size={18} color={c.textMuted} strokeWidth={2} />
          )}
        </View>
      </Pressable>

      <Text numberOfLines={1} style={[styles.summary, { color: c.textBodyAlt, fontFamily: tokens.font[500] }]}>
        {flightSummaryLine(offer)}
      </Text>
      {returnLine ? (
        <Text numberOfLines={1} style={[styles.summary, { color: c.textBodyAlt, fontFamily: tokens.font[500] }]}>
          {`Return · ${returnLine}`}
        </Text>
      ) : offer.round_trip_total ? (
        // Round-trip price without an itemized return leg (e.g. Google
        // Flights lists departing options at the round-trip total): say the
        // return is included instead of silently showing outbound only.
        <Text numberOfLines={1} style={[styles.summary, { color: c.textBodyAlt, fontFamily: tokens.font[500] }]}>
          Return · included in price
        </Text>
      ) : null}

      {expanded ? (
        <View testID={`flight-detail-${offer.id}`} style={[styles.detail, { borderTopColor: c.hairline }]}>
          {legs.map((leg, legIdx) => {
            const total = durationLabel(leg.totalMinutes);
            return (
              <View
                key={`leg-${legIdx}`}
                testID={`flight-itinerary-${offer.id}-${legIdx}`}
                style={legIdx > 0 ? [styles.itinerary, { borderTopColor: c.hairline }] : null}
              >
                <View style={styles.itineraryHeadingRow}>
                  <Text style={[styles.detailHeading, { color: c.textMuted, fontFamily: tokens.font[700] }]}>
                    {leg.label}
                  </Text>
                  {total ? (
                    <Text style={[styles.itineraryTotal, { color: c.textMuted, fontFamily: tokens.font[500] }]}>
                      {`${total} total`}
                    </Text>
                  ) : null}
                </View>
                {leg.segments.map((seg, i) => {
                  const next = leg.segments[i + 1];
                  const layMin = next ? minutesBetween(seg.arrival_time, next.departure_time) : 0;
                  return (
                    <View key={`${seg.carrier_code}-${seg.flight_number}-${i}`}>
                      <View style={styles.legRow}>
                        <AirlineChip code={seg.carrier_code} size={24} />
                        <View style={styles.legTimes}>
                          <Text style={[styles.legPort, { color: c.textStrong, fontFamily: tokens.font[700] }]}>
                            {`${clockLabel(seg.departure_time)} ${seg.departure_airport ?? ''}`}
                          </Text>
                          <View style={styles.progress}>
                            <View style={[styles.progressLine, { backgroundColor: c.hairlineAlt }]} />
                            <Plane size={12} color={c.primary} strokeWidth={2} />
                          </View>
                          <Text style={[styles.legPort, { color: c.textStrong, fontFamily: tokens.font[700] }]}>
                            {`${clockLabel(seg.arrival_time)} ${seg.arrival_airport ?? ''}`}
                          </Text>
                        </View>
                        <Text style={[styles.legMeta, { color: c.textMuted, fontFamily: tokens.font[500] }]}>
                          {segmentMetaLabel(seg)}
                        </Text>
                      </View>
                      {next ? (
                        <View style={styles.layoverRow}>
                          <StatusChip
                            tone="layover"
                            label={layoverLabel(layMin, seg.arrival_airport ?? '', seg.arrival_airport ?? '')}
                          />
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            );
          })}
          {offer.round_trip_total && !legs.some((l) => l.label === 'RETURN') ? (
            <View
              testID={`flight-return-included-${offer.id}`}
              style={[styles.itinerary, { borderTopColor: c.hairline }]}
            >
              <Text style={[styles.detailHeading, { color: c.textMuted, fontFamily: tokens.font[700] }]}>
                RETURN
              </Text>
              <Text style={[styles.summary, { color: c.textBodyAlt, fontFamily: tokens.font[500] }]}>
                Included in the round-trip price — this source doesn&apos;t itemize return
                flight details.
              </Text>
            </View>
          ) : null}
          {offer.round_trip_total && legs.some((l) => l.label === 'RETURN') ? (
            <Text
              testID={`flight-return-qualifier-${offer.id}`}
              style={[styles.summary, { color: c.textMuted, fontFamily: tokens.font[500] }]}
            >
              Same-airline return option — Google prices this trip as a round-trip total.
            </Text>
          ) : null}
          {multiCarrier ? (
            <Text style={[styles.subtitle, { color: c.textBodyAlt, fontFamily: tokens.font[500] }]}>
              {multiCarrierSubtitle(codes.map(carrierName)) ?? ''}
            </Text>
          ) : null}
        </View>
      ) : null}
    </AuroraCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF' },
  titleCol: { flex: 1, gap: 4 },
  airlineName: { fontSize: 15 },
  priceCol: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  price: { fontSize: 16, letterSpacing: -0.3 },
  summary: { fontSize: 12 },
  detail: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 8 },
  itinerary: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 8, marginTop: 2 },
  itineraryHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itineraryTotal: { fontSize: 10, letterSpacing: 0.3 },
  detailHeading: { fontSize: 10, letterSpacing: 0.6 },
  legRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legTimes: { flex: 1, gap: 2 },
  legPort: { fontSize: 13 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  progressLine: { flex: 1, height: 2, borderRadius: 1 },
  legMeta: { fontSize: 11, textAlign: 'right' },
  layoverRow: { paddingLeft: 34, paddingVertical: 4 },
  subtitle: { fontSize: 12, marginTop: 2 },
});
