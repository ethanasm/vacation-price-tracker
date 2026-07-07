import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useTheme } from '@/lib/theme';
import { yAxisTicks, type ChartPoint } from '@/lib/aurora';

/**
 * Price-history chart, mirroring the web trip-detail chart's series:
 *
 * - hotel-tracking trips: violet Total line+area, dashed cyan "Flight (min)",
 *   solid cyan selected flight, dashed pink "Hotel (min)", solid pink selected
 *   hotel;
 * - flights-only trips: dashed cyan "Flight (min)" + solid cyan selected
 *   flight (with the area wash under the selected line) — no Total/Hotel
 *   series, which would only duplicate or flatline at $0.
 *
 * The y-axis scales to the plotted data (clean rounded ticks) instead of the
 * old fixed $0–$1000 window, and a compact legend names each visible series.
 * Hand-rolled with react-native-svg (no chart lib dependency).
 */
export function PriceChart({
  points,
  nowLabel,
  showHotel = true,
  selectedFlightLabel,
  selectedHotelLabel,
  height = 160,
}: {
  points: ChartPoint[];
  nowLabel: string;
  showHotel?: boolean;
  selectedFlightLabel?: string | null;
  selectedHotelLabel?: string | null;
  height?: number;
}): React.JSX.Element {
  const { tokens } = useTheme();
  const c = tokens.color;
  const [w, setW] = React.useState(0);

  const hasSelectedFlight = points.some((p) => p.selectedFlight !== undefined);
  const hasSelectedHotel = showHotel && points.some((p) => p.selectedHotel !== undefined);

  const plottedValues = points.flatMap((p) => [
    ...(showHotel ? [p.total, p.hotel] : []),
    p.minFlight,
    ...(hasSelectedFlight && p.selectedFlight !== undefined ? [p.selectedFlight] : []),
    ...(hasSelectedHotel && p.selectedHotel !== undefined ? [p.selectedHotel] : []),
  ]);
  const ticks = yAxisTicks(Math.max(...plottedValues, 0));
  const yMax = ticks[ticks.length - 1];

  const pad = { l: 34, r: 8, t: 12, b: 18 };
  const innerW = Math.max(w - pad.l - pad.r, 1);
  const innerH = height - pad.t - pad.b;
  const n = Math.max(points.length - 1, 1);
  const x = (i: number) => pad.l + (innerW * i) / n;
  const y = (v: number) => pad.t + innerH * (1 - Math.min(v, yMax) / Math.max(yMax, 1));

  const linePath = (value: (p: ChartPoint) => number | undefined): string =>
    points
      .map((p, i) => ({ v: value(p), i }))
      .filter((d): d is { v: number; i: number } => d.v !== undefined)
      .map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${x(d.i)} ${y(d.v)}`)
      .join(' ');

  // The hero series carries the gradient area and the "current" dot: Total for
  // hotel-tracking trips, the selected flight (falling back to the flight
  // minimum) for flights-only trips.
  const heroValue = (p: ChartPoint): number =>
    showHotel ? p.total : (p.selectedFlight ?? p.minFlight);
  const heroLine = linePath((p) => heroValue(p));
  const area = points.length
    ? `${heroLine} L ${x(points.length - 1)} ${pad.t + innerH} L ${x(0)} ${pad.t + innerH} Z`
    : '';

  // Flights-only with nothing selected: the hero line IS the flight minimum,
  // so a separate dashed min line would just overdraw the same values.
  const soloMinLine = !showHotel && !hasSelectedFlight;
  const minFlightLine = soloMinLine ? '' : linePath((p) => p.minFlight);
  const selectedFlightLine = hasSelectedFlight ? linePath((p) => p.selectedFlight) : '';
  const hotelLine = showHotel ? linePath((p) => p.hotel) : '';
  const selectedHotelLine = hasSelectedHotel ? linePath((p) => p.selectedHotel) : '';

  const last = points[points.length - 1];
  const first = points[0];

  const legend: { label: string; color: string; dashed: boolean }[] = [
    ...(showHotel ? [{ label: 'Total', color: c.primary, dashed: false }] : []),
    { label: 'Flight (min)', color: c.accentCyan, dashed: !soloMinLine },
    ...(hasSelectedFlight
      ? [{ label: selectedFlightLabel || 'Selected flight', color: c.accentCyan, dashed: false }]
      : []),
    ...(showHotel ? [{ label: 'Hotel (min)', color: c.accentPink, dashed: true }] : []),
    ...(hasSelectedHotel
      ? [{ label: selectedHotelLabel || 'Selected hotel', color: c.accentPink, dashed: false }]
      : []),
  ];

  return (
    <View>
      <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {w > 0 ? (
          <Svg width={w} height={height}>
            <Defs>
              <SvgGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                <Stop
                  offset="0"
                  stopColor={showHotel ? c.primary : c.accentCyan}
                  stopOpacity={0.22}
                />
                <Stop
                  offset="1"
                  stopColor={showHotel ? c.primary : c.accentCyan}
                  stopOpacity={0.02}
                />
              </SvgGradient>
            </Defs>
            {ticks.map((g) => (
              <Line
                key={g}
                x1={pad.l}
                x2={w - pad.r}
                y1={y(g)}
                y2={y(g)}
                stroke={c.hairline}
                strokeWidth={1}
              />
            ))}
            {area ? <Path d={area} fill="url(#heroFill)" /> : null}
            {minFlightLine ? (
              <Path
                d={minFlightLine}
                stroke={c.accentCyan}
                strokeWidth={2}
                strokeDasharray="5 4"
                strokeLinecap="round"
                fill="none"
              />
            ) : null}
            {hotelLine ? (
              <Path
                d={hotelLine}
                stroke={c.accentPink}
                strokeWidth={2}
                strokeDasharray="5 4"
                strokeLinecap="round"
                fill="none"
              />
            ) : null}
            {selectedHotelLine ? (
              <Path
                d={selectedHotelLine}
                stroke={c.accentPink}
                strokeWidth={2}
                strokeLinecap="round"
                fill="none"
              />
            ) : null}
            {showHotel && heroLine ? (
              <Path d={heroLine} stroke={c.primary} strokeWidth={2.5} strokeLinecap="round" fill="none" />
            ) : null}
            {selectedFlightLine ? (
              <Path
                d={selectedFlightLine}
                stroke={c.accentCyan}
                strokeWidth={2.5}
                strokeLinecap="round"
                fill="none"
              />
            ) : null}
            {!showHotel && !selectedFlightLine && heroLine ? (
              <Path d={heroLine} stroke={c.accentCyan} strokeWidth={2.5} strokeLinecap="round" fill="none" />
            ) : null}
            {last ? (
              <Circle
                cx={x(points.length - 1)}
                cy={y(heroValue(last))}
                r={5}
                fill={showHotel ? c.primary : c.accentCyan}
                stroke="#FFFFFF"
                strokeWidth={2}
              />
            ) : null}
          </Svg>
        ) : null}
        {/* Y tick labels (skip the $0 baseline; it reads from the axis itself). */}
        {w > 0
          ? ticks
              .filter((t) => t > 0)
              .map((t) => (
                <Text
                  key={t}
                  style={[
                    styles.tickLabel,
                    { color: c.textMuted, fontFamily: tokens.font[600], top: y(t) - 6 },
                  ]}
                >
                  {`$${t.toLocaleString('en-US')}`}
                </Text>
              ))
          : null}
        {/* First/last x labels. */}
        {w > 0 && first ? (
          <Text
            style={[
              styles.xLabel,
              { color: c.textMuted, fontFamily: tokens.font[600], left: pad.l },
            ]}
          >
            {first.label}
          </Text>
        ) : null}
        {w > 0 && last && points.length > 1 ? (
          <Text
            style={[
              styles.xLabel,
              { color: c.textMuted, fontFamily: tokens.font[600], right: pad.r },
            ]}
          >
            {last.label}
          </Text>
        ) : null}
        <View style={[styles.nowBadge, { backgroundColor: c.primary, borderRadius: tokens.radius.pill }]}>
          <Text style={{ color: '#FFFFFF', fontFamily: tokens.font[800], fontSize: 11 }}>{nowLabel}</Text>
        </View>
      </View>
      <View style={styles.legendRow}>
        {legend.map((item) => (
          <View key={item.label} style={styles.legendItem}>
            {item.dashed ? (
              <View style={styles.legendKeyDashed}>
                <View style={[styles.legendDash, { backgroundColor: item.color }]} />
                <View style={[styles.legendDash, { backgroundColor: item.color }]} />
              </View>
            ) : (
              <View style={[styles.legendKey, { backgroundColor: item.color }]} />
            )}
            <Text
              numberOfLines={1}
              style={[styles.legendLabel, { color: c.textMuted, fontFamily: tokens.font[600] }]}
            >
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nowBadge: { position: 'absolute', top: 8, right: 8, paddingHorizontal: 8, paddingVertical: 3 },
  tickLabel: { position: 'absolute', left: 0, fontSize: 9 },
  xLabel: { position: 'absolute', bottom: 0, fontSize: 9 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 2, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '48%' },
  legendKey: { width: 14, height: 2, borderRadius: 1 },
  legendKeyDashed: { width: 14, height: 2, flexDirection: 'row', justifyContent: 'space-between' },
  legendDash: { width: 5, height: 2, borderRadius: 1 },
  legendLabel: { fontSize: 10 },
});
