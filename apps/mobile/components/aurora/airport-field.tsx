import React from 'react';
import { View, Text, TextInput, Pressable, Keyboard, StyleSheet, Platform } from 'react-native';
import { Plane } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';
import { searchAirports, findAirportByCode, type LocationResult } from '@/lib/locations';

const MAX_SUGGESTIONS = 5;

/**
 * Airport typeahead field — the mobile twin of web's AirportAutocomplete.
 * Typing two or more characters searches the static OurAirports dataset by
 * code, city, or airport name; picking a row fills the field with the
 * 3-letter IATA code. Typing a bare code (e.g. "SEA") still works without
 * touching the dropdown.
 *
 * The suggestion list renders as an absolutely-positioned overlay below the
 * input (not inline) so opening it never reflows the fields underneath —
 * an inline list used to shift the To field mid-tap, sending keystrokes into
 * the still-focused From input. While blurred, a recognized code displays as
 * "SEA — Seattle–Tacoma International Airport" for confirmation; focusing
 * reverts to the raw code for editing.
 *
 * testID contract (Maestro): the input is `testID`; each suggestion row is
 * `${testID}-option-<CODE>`.
 */
export function AirportField({
  label,
  value,
  onChangeText,
  placeholder,
  right,
  testID,
  accessibilityLabel,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  /** Optional adornment beside the input (e.g. the ⇄ swap button). */
  right?: React.ReactNode;
  testID?: string;
  accessibilityLabel?: string;
  /** Inline validation message; tints the field and renders below it. */
  error?: string | null;
}): React.JSX.Element {
  const { tokens } = useTheme();
  const [results, setResults] = React.useState<LocationResult[]>([]);
  const [open, setOpen] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const blurTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }, []);

  function handleChange(text: string): void {
    onChangeText(text);
    if (text.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const found = searchAirports(text.trim()).slice(0, MAX_SUGGESTIONS);
    setResults(found);
    setOpen(found.length > 0);
  }

  function select(location: LocationResult): void {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    onChangeText(location.code);
    setResults([]);
    setOpen(false);
    Keyboard.dismiss();
  }

  function handleFocus(): void {
    setFocused(true);
    setOpen(results.length > 0 && value.trim().length >= 2);
  }

  function handleBlur(): void {
    setFocused(false);
    // Delay so a suggestion tap (onPressIn) lands before the list unmounts.
    blurTimer.current = setTimeout(() => setOpen(false), 150);
  }

  // Blurred confirmation label for a recognized code ("SEA — Seattle–Tacoma…").
  const selectedAirport = !focused && !open ? findAirportByCode(value) : null;
  const displayValue = selectedAirport ? `${selectedAirport.code} — ${selectedAirport.name}` : value;

  const isAndroid = Platform.OS === 'android';
  const inputStyle = isAndroid
    ? {
        backgroundColor: 'transparent',
        borderBottomWidth: 2,
        borderBottomColor: error ? tokens.color.warning : tokens.color.primary,
        paddingHorizontal: 0,
        color: tokens.color.textStrong,
        fontFamily: tokens.font[600],
      }
    : {
        backgroundColor: tokens.color.surface,
        borderRadius: tokens.radius.inner,
        borderWidth: error ? 1.5 : 0,
        borderColor: error ? tokens.color.warning : 'transparent',
        color: tokens.color.textStrong,
        fontFamily: tokens.font[600],
      };

  return (
    // Lift the whole field above its siblings while the overlay is open so
    // the dropdown paints over the fields below instead of under them.
    <View style={[styles.wrap, open ? styles.wrapRaised : null]}>
      <Text
        style={{
          color: tokens.color.textBodyAlt,
          fontFamily: tokens.font[700],
          fontSize: tokens.type.label.fontSize,
          letterSpacing: tokens.type.label.letterSpacing,
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <View style={styles.anchor}>
        <View style={styles.row}>
          <TextInput
            testID={testID}
            accessibilityLabel={accessibilityLabel ?? label}
            value={displayValue}
            onChangeText={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            placeholderTextColor={tokens.color.textFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            style={[styles.input, inputStyle]}
          />
          {right ? <View style={styles.right}>{right}</View> : null}
        </View>
        {open && results.length > 0 ? (
          <View
            testID={testID ? `${testID}-suggestions` : undefined}
            style={[
              styles.dropdown,
              tokens.shadow.cardOnCanvas,
              { backgroundColor: tokens.color.card, borderColor: tokens.color.hairlineAlt, borderRadius: tokens.radius.inner },
            ]}
          >
            {results.map((location, index) => (
              <Pressable
                key={location.code}
                accessibilityRole="button"
                accessibilityLabel={`${location.code}, ${location.name}`}
                testID={testID ? `${testID}-option-${location.code}` : undefined}
                // onPressIn lands before the input's blur timer on native;
                // onPress is the fallback where the press system resolves the
                // gesture as a click (react-native-web). select() is idempotent.
                onPressIn={() => select(location)}
                onPress={() => select(location)}
                style={({ pressed }) => [
                  styles.option,
                  index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.color.hairline } : null,
                  { backgroundColor: pressed ? tokens.color.surface : 'transparent' },
                ]}
              >
                <View style={[styles.optionIcon, { backgroundColor: tokens.color.chipBg }]}>
                  <Plane color={tokens.color.primary} size={14} strokeWidth={2.5} />
                </View>
                <View style={styles.optionText}>
                  <Text numberOfLines={2} style={{ color: tokens.color.textStrong, fontFamily: tokens.font[600], fontSize: 14 }}>
                    <Text style={{ fontFamily: tokens.font[800] }}>{location.code}</Text>
                    {`  ${location.name}`}
                  </Text>
                  <Text numberOfLines={1} style={{ color: tokens.color.textMuted, fontFamily: tokens.font[500], fontSize: 12, marginTop: 1 }}>
                    {location.city ? `${location.city}, ${location.country}` : location.country}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      {error ? (
        <Text
          testID={testID ? `${testID}-error` : undefined}
          style={{ color: tokens.color.warning, fontFamily: tokens.font[600], fontSize: 12, marginTop: 5 }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  wrapRaised: { zIndex: 30, elevation: 30 },
  anchor: { position: 'relative' },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, paddingVertical: 12, paddingHorizontal: 14, fontSize: 15 },
  right: { marginLeft: 8 },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 6,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 30,
    elevation: 30,
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 12 },
  optionIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  optionText: { flex: 1 },
});
