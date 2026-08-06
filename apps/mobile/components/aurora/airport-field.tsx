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
 * the still-focused From input. A recognized code shows the airport's full
 * name as a caption under the field; the input itself always holds the raw
 * code (swapping a pretty label through the controlled value would let a
 * fast keystroke feed the label back into form state).
 *
 * `collapsable={false}` on the outer wrap is load-bearing, not decoration. It
 * pins the wrap as a real native view unconditionally, and that view must never
 * come and go: it used to gain `zIndex`/`elevation` only while the list was
 * open, and those are precisely the props that decide whether a View forms a
 * native view at all (`!collapsable`, `zIndex` on a non-static position, and —
 * Android only — `elevation != 0`; see ViewShadowNode::formsStackingContext and
 * HostPlatformViewTraitsInitializer). Flipping them flipped this wrap between
 * flattened (no native view) and unflattened, and unflattening re-parents the
 * whole subtree — including the focused TextInput — into the newly created
 * view. A view detached from the window resigns first responder on iOS and
 * clears focus on Android, so the keyboard closed the instant the dropdown
 * appeared on the 2nd character; and because re-tapping the field re-opened the
 * dropdown (handleFocus), it blurred again immediately, locking the user out of
 * the From/To fields entirely. `collapsable={false}` is the one guard that
 * holds on both platforms — never trade it for a conditional style. Ordering
 * *between* the two airport fields is the parent screen's job (see the static
 * originFieldWrap / destinationFieldWrap z-order in app/trip/new.tsx and
 * app/trip/[id]/edit.tsx).
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
    setOpen(results.length > 0 && value.trim().length >= 2);
  }

  function handleBlur(): void {
    // Delay so a suggestion tap (onPressIn) lands before the list unmounts.
    blurTimer.current = setTimeout(() => setOpen(false), 150);
  }

  // Confirmation caption for a recognized code, rendered under the field.
  const selectedAirport = !open ? findAirportByCode(value) : null;

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
    // Never flattened: see the note above — a wrap that materializes only while
    // the list is open re-parents the focused TextInput and kills the keyboard.
    <View collapsable={false} style={styles.wrap}>
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
            value={value}
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
      {/* The open dropdown overlays this space — suppress the caption/error
          until it closes so they never paint through the list. */}
      {!open && selectedAirport ? (
        <Text
          numberOfLines={1}
          testID={testID ? `${testID}-selected-name` : undefined}
          style={{ color: tokens.color.textMuted, fontFamily: tokens.font[500], fontSize: 12, marginTop: 5 }}
        >
          {selectedAirport.name}
        </Text>
      ) : null}
      {!open && error ? (
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
  // Deliberately carries no zIndex/elevation: the wrap is pinned as a native
  // view by collapsable={false}, and stacking is the parent screen's job. Adding
  // stacking props here is fine only if they are unconditional — see the note
  // on the component.
  wrap: { marginBottom: 14 },
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
    // No `elevation` here: tokens.shadow.cardOnCanvas is applied after this
    // style and sets elevation 8, so anything declared here is dead. 8 already
    // clears every sibling inside the wrap (all at 0).
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 12 },
  optionIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  optionText: { flex: 1 },
});
