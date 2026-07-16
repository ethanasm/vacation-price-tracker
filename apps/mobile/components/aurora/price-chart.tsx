import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Path,
  Line,
  Circle,
  Rect,
  Polygon,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
} from 'react-native-svg';
import { useTheme } from '@/lib/theme';
import { PROVIDER_META, providersInChart, yAxisTicks, type ChartPoint } from '@/lib/aurora';

/** Display label for a provider marker ("fast_flights" → "Fast Flights"). */
function providerLabel(provider: string): string {
  const meta = PROVIDER_META[provider];
  if (meta) return meta.label;
  return provider
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Per-provider point marker (shape, not color, carries provider identity so it
 * stays legible next to the series colors and for colorblind readers).
 * Skiplagged = circle, Kiwi = square, Fast Flights = triangle. Mirrors the web
 * trip-detail chart's ProviderMarker.
 */
function ProviderMarker({
  cx,
  cy,
  provider,
  color,
  r,
}: {
  cx: number;
  cy: number;
  provider: string | null;
  color: string;
  r: number;
}): React.JSX.Element {
  const shape = provider ? PROVIDER_META[provider]?.shape : undefined;
  const ring = { stroke: '#FFFFFF', strokeWidth: 1.5 } as const;
  if (shape === 'square') {
    return <Rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill={color} {...ring} />;
  }
  if (shape === 'triangle') {
    const pts = `${cx},${cy - r - 1} ${cx + r + 1},${cy + r} ${cx - r - 1},${cy + r}`;
    return <Polygon points={pts} fill={color} {...ring} />;
  }
  return <Circle cx={cx} cy={cy} r={r} fill={color} {...ring} />;
}

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
 * The x-axis labels every data point's day, thinned evenly to what the width
 * fits without crowding. Press-and-drag scrubbing snaps to the nearest data
 * point and shows a crosshair + popup with each visible series' exact price
 * (mirroring the web chart's hover tooltip). Hand-rolled with
 * react-native-svg (no chart lib dependency).
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
  const [activeIdx, setActiveIdx] = React.useState<number | null>(null);
  const [tipW, setTipW] = React.useState(0);

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

  // One entry per visible series: drives the legend, the scrub popup rows,
  // and the snapped markers.
  const series: {
    label: string;
    color: string;
    dashed: boolean;
    valueOf: (p: ChartPoint) => number | undefined;
  }[] = [
    ...(showHotel
      ? [{ label: 'Total', color: c.primary, dashed: false, valueOf: (p: ChartPoint) => p.total }]
      : []),
    {
      label: 'Flight (min)',
      color: c.accentCyan,
      dashed: !soloMinLine,
      valueOf: (p: ChartPoint) => p.minFlight,
    },
    ...(hasSelectedFlight
      ? [
          {
            label: selectedFlightLabel || 'Selected flight',
            color: c.accentCyan,
            dashed: false,
            valueOf: (p: ChartPoint) => p.selectedFlight,
          },
        ]
      : []),
    ...(showHotel
      ? [{ label: 'Hotel (min)', color: c.accentPink, dashed: true, valueOf: (p: ChartPoint) => p.hotel }]
      : []),
    ...(hasSelectedHotel
      ? [
          {
            label: selectedHotelLabel || 'Selected hotel',
            color: c.accentPink,
            dashed: false,
            valueOf: (p: ChartPoint) => p.selectedHotel,
          },
        ]
      : []),
  ];

  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(hi, lo));

  // Providers present in the plotted data — drives the per-point hero-line
  // markers and the "Source" legend row.
  const chartProviders = providersInChart(points);

  // Day labels for every point, evenly thinned (keeping both ends) once the
  // width can't fit them all without crowding. The end labels are clamped
  // inside the chart, which shifts them toward the middle — so also drop any
  // middle label whose point sits too close to a clamped end label.
  const X_LABEL_W = 60;
  const labelCenter = (i: number) => clamp(x(i) - X_LABEL_W / 2, 0, w - X_LABEL_W) + X_LABEL_W / 2;
  const maxXLabels = Math.max(2, Math.min(Math.floor(innerW / (X_LABEL_W * 0.8)), 8));
  const labelCount = Math.min(points.length, maxXLabels);
  const xLabelIdx = [
    ...new Set(
      Array.from({ length: labelCount }, (_, i) =>
        Math.round((i * (points.length - 1)) / Math.max(labelCount - 1, 1)),
      ),
    ),
  ].filter(
    (i, k, arr) =>
      k === 0 ||
      k === arr.length - 1 ||
      (x(i) - labelCenter(arr[0]) >= 40 && labelCenter(arr[arr.length - 1]) - x(i) >= 40),
  );
  const indexAt = (locationX: number): number =>
    clamp(Math.round(((locationX - pad.l) / innerW) * n), 0, points.length - 1);
  const scrubTo = (locationX: number) => setActiveIdx(indexAt(locationX));
  const active = activeIdx === null ? undefined : points[activeIdx];

  // Gesture-direction tracking so a vertical swipe that starts on the chart
  // still scrolls the page (on Android the chart lives inside the trip
  // screen's ScrollView): a hold or horizontal drag keeps the scrub, but a
  // termination request — the ScrollView trying to take over — is granted
  // once the movement is clearly vertical.
  const gesture = React.useRef({ x: 0, y: 0, dx: 0, dy: 0 });
  const isVerticalSwipe = () =>
    Math.abs(gesture.current.dy) > 8 && Math.abs(gesture.current.dy) > Math.abs(gesture.current.dx);

  return (
    <View>
      <View
        style={{ height }}
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        // Press-and-drag scrubbing: claim the touch and snap to the nearest
        // point; yield to the ScrollView only on a vertical swipe.
        onStartShouldSetResponder={() => w > 0 && points.length > 0}
        onMoveShouldSetResponder={() => w > 0 && points.length > 0}
        onResponderTerminationRequest={isVerticalSwipe}
        onResponderGrant={(e) => {
          gesture.current = { x: e.nativeEvent.pageX ?? 0, y: e.nativeEvent.pageY ?? 0, dx: 0, dy: 0 };
          scrubTo(e.nativeEvent.locationX);
        }}
        onResponderMove={(e) => {
          gesture.current.dx = (e.nativeEvent.pageX ?? 0) - gesture.current.x;
          gesture.current.dy = (e.nativeEvent.pageY ?? 0) - gesture.current.y;
          scrubTo(e.nativeEvent.locationX);
        }}
        onResponderRelease={() => setActiveIdx(null)}
        onResponderTerminate={() => setActiveIdx(null)}
      >
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
            {/* Per-day provider markers on the hero line: the shape names the
                provider the day's snapshot came from (Source legend below). */}
            {points.map((p, i) =>
              p.provider ? (
                <ProviderMarker
                  key={`prov-${i}`}
                  cx={x(i)}
                  cy={y(heroValue(p))}
                  provider={p.provider}
                  color={showHotel ? c.primary : c.accentCyan}
                  r={3.5}
                />
              ) : null,
            )}
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
            {activeIdx !== null && active ? (
              <>
                <Line
                  x1={x(activeIdx)}
                  x2={x(activeIdx)}
                  y1={pad.t}
                  y2={pad.t + innerH}
                  stroke={c.textFaint}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                {series.map((s) => {
                  const v = s.valueOf(active);
                  return v === undefined ? null : (
                    <Circle
                      key={s.label}
                      cx={x(activeIdx)}
                      cy={y(v)}
                      r={4}
                      fill={s.color}
                      stroke="#FFFFFF"
                      strokeWidth={1.5}
                    />
                  );
                })}
              </>
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
        {/* X day labels, one per (thinned) data point, centered under it. */}
        {w > 0
          ? xLabelIdx.map((i) => (
              <Text
                key={i}
                numberOfLines={1}
                style={[
                  styles.xLabel,
                  {
                    color: c.textMuted,
                    fontFamily: tokens.font[600],
                    width: X_LABEL_W,
                    left: clamp(x(i) - X_LABEL_W / 2, 0, w - X_LABEL_W),
                  },
                ]}
              >
                {points[i].label}
              </Text>
            ))
          : null}
        {activeIdx === null ? (
          <View style={[styles.nowBadge, { backgroundColor: c.primary, borderRadius: tokens.radius.pill }]}>
            <Text style={{ color: '#FFFFFF', fontFamily: tokens.font[800], fontSize: 11 }}>{nowLabel}</Text>
          </View>
        ) : null}
        {activeIdx !== null && active ? (
          <View
            pointerEvents="none"
            onLayout={(e) => setTipW(e.nativeEvent.layout.width)}
            style={[
              styles.tooltip,
              tokens.shadow.cardOnCanvas,
              {
                backgroundColor: c.card,
                borderColor: c.hairlineAlt,
                borderRadius: tokens.radius.inner,
                left: clamp(x(activeIdx) - tipW / 2, 4, w - tipW - 4),
                opacity: tipW > 0 ? 1 : 0,
              },
            ]}
          >
            <Text style={[styles.tooltipDay, { color: c.textMuted, fontFamily: tokens.font[700] }]}>
              {active.provider ? `${active.label} · via ${providerLabel(active.provider)}` : active.label}
            </Text>
            {series.map((s) => {
              const v = s.valueOf(active);
              return v === undefined ? null : (
                <View key={s.label} style={styles.tooltipRow}>
                  <View style={[styles.tooltipDot, { backgroundColor: s.color }]} />
                  <Text
                    numberOfLines={1}
                    style={[styles.tooltipLabel, { color: c.textBodyAlt, fontFamily: tokens.font[600] }]}
                  >
                    {s.label}
                  </Text>
                  <Text style={[styles.tooltipPrice, { color: c.textStrong, fontFamily: tokens.font[800] }]}>
                    {`$${Math.round(v).toLocaleString('en-US')}`}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
      <View style={styles.legendRow}>
        {series.map((item) => (
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
      {chartProviders.length > 0 ? (
        <View style={styles.legendRow} testID="provider-legend">
          <Text style={[styles.legendSourceTitle, { color: c.textMuted, fontFamily: tokens.font[700] }]}>
            SOURCE
          </Text>
          {chartProviders.map((provider) => (
            <View key={provider} style={styles.legendItem}>
              <Svg width={10} height={10} viewBox="0 0 10 10">
                <ProviderMarker cx={5} cy={5} provider={provider} color={c.textMuted} r={3.5} />
              </Svg>
              <Text
                numberOfLines={1}
                style={[styles.legendLabel, { color: c.textMuted, fontFamily: tokens.font[600] }]}
              >
                {providerLabel(provider)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  nowBadge: { position: 'absolute', top: 8, right: 8, paddingHorizontal: 8, paddingVertical: 3 },
  tickLabel: { position: 'absolute', left: 0, fontSize: 9 },
  xLabel: { position: 'absolute', bottom: 0, fontSize: 9, textAlign: 'center' },
  tooltip: {
    position: 'absolute',
    top: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    gap: 2,
    maxWidth: 200,
  },
  tooltipDay: { fontSize: 10 },
  tooltipRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tooltipDot: { width: 6, height: 6, borderRadius: 3 },
  tooltipLabel: { fontSize: 10, flexShrink: 1 },
  tooltipPrice: { fontSize: 11 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 2, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '48%' },
  legendKey: { width: 14, height: 2, borderRadius: 1 },
  legendKeyDashed: { width: 14, height: 2, flexDirection: 'row', justifyContent: 'space-between' },
  legendDash: { width: 5, height: 2, borderRadius: 1 },
  legendLabel: { fontSize: 10 },
  legendSourceTitle: { fontSize: 8, letterSpacing: 0.5 },
});
