import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { ChevronDown, ChevronUp, Star } from 'lucide-react-native';
import { AuroraCard, HotelPhoto } from '@/components/aurora';
import { useTheme, formatUsd } from '@/lib/theme';
import { parsePrice, type HotelOffer } from '@/lib/aurora';

/** Collapsed: photo + name + star row + descriptor + `$X/night · $Y total` +
 * radio + chevron. Expanded: an address / cancellation info line. */
export function HotelRow({
  offer,
  nights,
  selected,
  expanded,
  onPress,
}: {
  offer: HotelOffer;
  nights: number;
  selected: boolean;
  expanded: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const { tokens } = useTheme();
  const c = tokens.color;
  const perNight = parsePrice(offer.price) ?? 0;
  const total = perNight * Math.max(nights, 0);
  const stars = Math.max(0, Math.min(5, Math.round(offer.rating ?? 0)));

  return (
    <AuroraCard
      style={[
        styles.card,
        selected ? { backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.selectedBorder } : null,
      ]}
    >
      <Pressable
        testID={`hotel-option-${offer.id}`}
        accessibilityRole="button"
        accessibilityLabel={offer.name}
        accessibilityState={{ selected }}
        onPress={onPress}
        style={styles.headerRow}
      >
        <HotelPhoto uri={null} size={52} />

        <View style={styles.titleCol}>
          <Text numberOfLines={1} style={[styles.name, { color: c.textStrong, fontFamily: tokens.font[600] }]}>
            {offer.name}
          </Text>
          <View style={styles.starRow}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Star
                key={i}
                size={12}
                color={i < stars ? c.star : c.starEmpty}
                fill={i < stars ? c.star : 'none'}
                strokeWidth={1.5}
              />
            ))}
          </View>
          {offer.description ? (
            <Text numberOfLines={1} style={[styles.descriptor, { color: c.textBodyAlt, fontFamily: tokens.font[500] }]}>
              {offer.description}
            </Text>
          ) : null}
          <Text style={[styles.priceLine, { color: c.textBody, fontFamily: tokens.font[600] }]}>
            {`${formatUsd(perNight)} /night · ${formatUsd(total)} total`}
          </Text>
        </View>

        <View style={styles.rightCol}>
          <View
            style={[
              styles.radio,
              { borderColor: selected ? c.primary : c.textFaint },
              selected ? { backgroundColor: c.primary } : null,
            ]}
          >
            {selected ? <View style={styles.radioDot} /> : null}
          </View>
          {expanded ? (
            <ChevronUp size={18} color={c.textMuted} strokeWidth={2} />
          ) : (
            <ChevronDown size={18} color={c.textMuted} strokeWidth={2} />
          )}
        </View>
      </Pressable>

      {expanded ? (
        <View testID={`hotel-detail-${offer.id}`} style={[styles.detail, { borderTopColor: c.hairline }]}>
          {offer.address ? (
            <Text style={[styles.infoLine, { color: c.textBodyAlt, fontFamily: tokens.font[500] }]}>
              {offer.address}
            </Text>
          ) : null}
          <Text style={[styles.infoLine, { color: c.textMuted, fontFamily: tokens.font[500] }]}>
            {offer.description ?? 'Free cancellation up to 24h before check-in.'}
          </Text>
        </View>
      ) : null}
    </AuroraCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titleCol: { flex: 1, gap: 3 },
  name: { fontSize: 15 },
  starRow: { flexDirection: 'row', gap: 2 },
  descriptor: { fontSize: 12 },
  priceLine: { fontSize: 13, marginTop: 2 },
  rightCol: { alignItems: 'center', gap: 8 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF' },
  detail: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 6 },
  infoLine: { fontSize: 12 },
});
