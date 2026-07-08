import React from 'react';
import { View, Text, TextInput, Pressable, Keyboard, StyleSheet, Platform } from 'react-native';
import { Plane } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';
import { searchAirports, type LocationResult } from '@/lib/locations';

const MAX_SUGGESTIONS = 5;

/**
 * Airport typeahead field — the mobile twin of web's AirportAutocomplete.
 * Typing two or more characters searches the static OurAirports dataset by
 * code, city, or airport name and renders an inline suggestion list; picking
 * a row fills the field with the 3-letter IATA code. Typing a bare code
 * (e.g. "SEA") still works without touching the dropdown.
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
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  /** Optional adornment beside the input (e.g. the ⇄ swap button). */
  right?: React.ReactNode;
  testID?: string;
  accessibilityLabel?: string;
}): React.JSX.Element {
  const { tokens } = useTheme();
  const [results, setResults] = React.useState<LocationResult[]>([]);
  const [open, setOpen] = React.useState(false);
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

  function handleBlur(): void {
    // Delay so a suggestion tap (onPressIn) lands before the list unmounts.
    blurTimer.current = setTimeout(() => setOpen(false), 150);
  }

  const isAndroid = Platform.OS === 'android';
  const inputStyle = isAndroid
    ? {
        backgroundColor: 'transparent',
        borderBottomWidth: 2,
        borderBottomColor: tokens.color.primary,
        paddingHorizontal: 0,
        color: tokens.color.textStrong,
        fontFamily: tokens.font[600],
      }
    : {
        backgroundColor: tokens.color.surface,
        borderRadius: tokens.radius.inner,
        color: tokens.color.textStrong,
        fontFamily: tokens.font[600],
      };

  return (
    <View style={styles.wrap}>
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
      <View style={styles.row}>
        <TextInput
          testID={testID}
          accessibilityLabel={accessibilityLabel ?? label}
          value={value}
          onChangeText={handleChange}
          onFocus={() => setOpen(results.length > 0 && value.trim().length >= 2)}
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
                <Text numberOfLines={1} style={{ color: tokens.color.textStrong, fontFamily: tokens.font[600], fontSize: 14 }}>
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
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, paddingVertical: 12, paddingHorizontal: 14, fontSize: 15 },
  right: { marginLeft: 8 },
  dropdown: { marginTop: 6, borderWidth: 1, overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 12 },
  optionIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  optionText: { flex: 1 },
});
