import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useTheme } from '@/lib/theme';
import type { ChartPoint } from '@/lib/aurora';

/**
 * Price-history chart: violet Total area + dashed cyan Hotel line + a moving
 * "current" dot, y-axis fixed $0–$1000, with a "Now $X" badge near the last
 * point. Hand-rolled with react-native-svg (no chart lib dependency).
 */
export function PriceChart({
  points,
  nowLabel,
  height = 160,
}: {
  points: ChartPoint[];
  nowLabel: string;
  height?: number;
}): React.JSX.Element {
  const { tokens } = useTheme();
  const [w, setW] = React.useState(0);
  const pad = { l: 8, r: 8, t: 12, b: 18 };
  const yMax = 1000;
  const innerW = Math.max(w - pad.l - pad.r, 1);
  const innerH = height - pad.t - pad.b;
  const n = Math.max(points.length - 1, 1);
  const x = (i: number) => pad.l + (innerW * i) / n;
  const y = (v: number) => pad.t + innerH * (1 - Math.min(v, yMax) / yMax);

  const totalLine = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.total)}`).join(' ');
  const area = points.length
    ? `${totalLine} L ${x(points.length - 1)} ${pad.t + innerH} L ${x(0)} ${pad.t + innerH} Z`
    : '';
  const hotelLine = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.hotel)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 ? (
        <Svg width={w} height={height}>
          <Defs>
            <SvgGradient id="totalFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={tokens.color.primary} stopOpacity={0.28} />
              <Stop offset="1" stopColor={tokens.color.primary} stopOpacity={0.02} />
            </SvgGradient>
          </Defs>
          {[0, 250, 500, 750, 1000].map((g) => (
            <Line key={g} x1={pad.l} x2={w - pad.r} y1={y(g)} y2={y(g)} stroke={tokens.color.hairline} strokeWidth={1} />
          ))}
          {area ? <Path d={area} fill="url(#totalFill)" /> : null}
          <Path d={totalLine} stroke={tokens.color.primary} strokeWidth={2.5} fill="none" />
          <Path d={hotelLine} stroke={tokens.color.accentCyan} strokeWidth={2} strokeDasharray="5 4" fill="none" />
          {last ? <Circle cx={x(points.length - 1)} cy={y(last.total)} r={5} fill={tokens.color.primary} stroke="#FFFFFF" strokeWidth={2} /> : null}
        </Svg>
      ) : null}
      <View style={[styles.nowBadge, { backgroundColor: tokens.color.primary, borderRadius: tokens.radius.pill }]}>
        <Text style={{ color: '#FFFFFF', fontFamily: tokens.font[800], fontSize: 11 }}>{nowLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nowBadge: { position: 'absolute', top: 8, right: 8, paddingHorizontal: 8, paddingVertical: 3 },
});
