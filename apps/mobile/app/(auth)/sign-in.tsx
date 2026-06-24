import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';

export default function SignInScreen(): React.JSX.Element {
  const { tokens } = useTheme();
  const { signIn, isSigningIn, error } = useAuth();
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: tokens.color.pageBg }]}>
      <View style={styles.center}>
        <Text style={{ color: tokens.color.textStrong, fontFamily: tokens.font[800], fontSize: 26 }}>
          Price Tracker
        </Text>
        <Text style={{ color: tokens.color.textMuted, fontFamily: tokens.font[500], marginTop: 8, marginBottom: 24 }}>
          Find your cheapest vacation window.
        </Text>
        <Pressable
          accessibilityRole="button"
          testID="sign-in-google"
          onPress={() => void signIn()}
          disabled={isSigningIn}
          style={[styles.button, { backgroundColor: tokens.color.card, borderColor: tokens.color.hairline }]}
        >
          {isSigningIn ? (
            <ActivityIndicator color={tokens.color.primary} />
          ) : (
            <Text style={{ color: tokens.color.textStrong, fontFamily: tokens.font[700] }}>
              Sign in with Google
            </Text>
          )}
        </Pressable>
        <Text style={{ color: tokens.color.textFaint, fontFamily: tokens.font[500], fontSize: 11, marginTop: 14 }}>
          We never store passwords
        </Text>
        {error ? (
          <Text style={{ color: tokens.color.warning, fontFamily: tokens.font[500], marginTop: 16, textAlign: 'center' }}>
            {error}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  button: {
    minWidth: 240,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
});
