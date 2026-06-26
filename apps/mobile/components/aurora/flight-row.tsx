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
  formatMoneyString,
  clockLabel,
  type FlightOffer,
  type FlightSegment,
} from '@/lib/aurora';

/** Outbound itinerary (first) of an offer. */
function outboundSegments(offer: FlightOffer): FlightSegment[] {
  return (offer.itineraries ?? [])[0]?.segments ?? [];
}

/** Unique carrier codes across the outbound segments (for the multi-carrier pair). */
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

function durationLabel(minutes?: number | null): string {
  const m = minutes ?? 0;
  if (m <= 0) return '';
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
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
  const segs = outboundSegments(offer);
  const codes = carrierCodes(segs);
  const multiCarrier = codes.length > 1;
  const viaCode = offer.stops > 0 ? segs[0]?.arrival_airport ?? null : null;
  const badge = stopsBadge(offer.stops, viaCode);
  const price = formatMoneyString(offer.price);

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

      {expanded ? (
        <View testID={`flight-detail-${offer.id}`} style={[styles.detail, { borderTopColor: c.hairline }]}>
          <Text style={[styles.detailHeading, { color: c.textMuted, fontFamily: tokens.font[700] }]}>OUTBOUND</Text>
          {segs.map((seg, i) => {
            const next = segs[i + 1];
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
                    {`${durationLabel(seg.duration_minutes)} · ${(seg.carrier_code ?? '').toUpperCase()} ${seg.flight_number ?? ''}`.trim()}
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
