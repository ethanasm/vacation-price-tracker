import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Plane } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { AuroraCard, GradientButton } from '@/components/aurora';

/** Original 4-color Google "G" mark drawn from four quarter-arc paths. */
function GoogleGlyph(): React.JSX.Element {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48" accessibilityRole="image">
      <Path
        fill="#4285F4"
        d="M47.5 24.5c0-1.6-.14-3.16-.41-4.66H24v9.42h13.2c-.57 3.06-2.3 5.66-4.9 7.4v6.14h7.92C44.86 38.6 47.5 32.1 47.5 24.5z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.6 0 12.14-2.18 16.18-5.92l-7.92-6.14c-2.2 1.48-5.02 2.36-8.26 2.36-6.36 0-11.74-4.3-13.66-10.08H2.16v6.34C6.18 42.62 14.42 48 24 48z"
      />
      <Path
        fill="#FBBC05"
        d="M10.34 28.22c-.5-1.48-.78-3.06-.78-4.72s.28-3.24.78-4.72v-6.34H2.16A23.96 23.96 0 0 0 0 23.5c0 3.86.92 7.52 2.16 10.86l8.18-6.14z"
      />
      <Path
        fill="#EA4335"
        d="M24 9.5c3.6 0 6.82 1.24 9.36 3.66l7.02-7.02C36.14 2.16 30.6 0 24 0 14.42 0 6.18 5.38 2.16 13.5l8.18 6.34C12.26 13.8 17.64 9.5 24 9.5z"
      />
    </Svg>
  );
}

export default function SignInScreen(): React.JSX.Element {
  const { tokens } = useTheme();
  const { signIn, isSigningIn, error } = useAuth();
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: tokens.color.pageBg }]}>
      <LinearGradient
        colors={['rgba(167,139,250,0.22)', 'rgba(236,72,153,0.10)', 'rgba(250,248,255,0)']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.9, y: 0.7 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.center}>
        <LinearGradient colors={tokens.gradient.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logo}>
          <Plane size={26} color="#FFFFFF" strokeWidth={2.2} />
        </LinearGradient>
        <Text style={{ color: tokens.color.textMuted, fontFamily: tokens.font[700], fontSize: 11, letterSpacing: 1, marginTop: 20 }}>
          DATE-RANGE OPTIMIZER
        </Text>
        <Text style={[styles.h1, { color: tokens.color.textStrong, fontFamily: tokens.font[800] }]}>
          Find your cheapest{'\n'}
          <Text style={{ color: tokens.color.primary }}>vacation window</Text>
        </Text>
        <Text style={{ color: tokens.color.textBody, fontFamily: tokens.font[500], fontSize: 14, textAlign: 'center', marginTop: 10, maxWidth: 300 }}>
          Track flights & hotels across flexible dates and get alerted when the total drops.
        </Text>
        <Text style={{ color: tokens.color.textMuted, fontFamily: tokens.font[600], fontSize: 12, marginTop: 14 }}>
          Flights · Hotels · Price alerts
        </Text>
        <AuroraCard style={styles.card}>
          <Text style={{ color: tokens.color.textStrong, fontFamily: tokens.font[700], fontSize: 16, marginBottom: 14, textAlign: 'center' }}>
            Ready to get started?
          </Text>
          <View style={styles.buttonRow}>
            <View style={styles.glyph} pointerEvents="none">
              <GoogleGlyph />
            </View>
            <GradientButton
              variant="secondary"
              label="Continue with Google"
              onPress={() => void signIn()}
              loading={isSigningIn}
              testID="sign-in-google-button"
              accessibilityLabel="Continue with Google"
            />
          </View>
          <Text style={{ color: tokens.color.textFaint, fontFamily: tokens.font[500], fontSize: 11, marginTop: 12, textAlign: 'center' }}>
            We never store passwords
          </Text>
          {error ? (
            <Text style={{ color: tokens.color.warning, fontFamily: tokens.font[500], fontSize: 12, marginTop: 12, textAlign: 'center' }}>
              {error}
            </Text>
          ) : null}
        </AuroraCard>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logo: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  h1: { fontSize: 26, lineHeight: 32, letterSpacing: -0.5, textAlign: 'center', marginTop: 8 },
  card: { width: '100%', maxWidth: 360, marginTop: 28 },
  buttonRow: { justifyContent: 'center' },
  glyph: {
    position: 'absolute',
    left: 24,
    top: 0,
    bottom: 0,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
