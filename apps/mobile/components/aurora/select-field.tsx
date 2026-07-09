import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';

export interface SelectOption<V extends string> {
  value: V;
  label: string;
}

/**
 * Labelled single-select — the mobile twin of web's shadcn Select. The field
 * shows the current option's label and opens a bottom-sheet option list; the
 * value can only ever be one of `options`, so no free-text parsing/clamping
 * is needed downstream.
 *
 * testID contract (Maestro): the field is `testID`; each option row is
 * `${testID}-option-<value>`.
 */
export function SelectField<V extends string>({
  label,
  value,
  options,
  onChange,
  testID,
  accessibilityLabel,
}: {
  label: string;
  value: V;
  options: SelectOption<V>[];
  onChange: (v: V) => void;
  testID?: string;
  accessibilityLabel?: string;
}): React.JSX.Element {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = React.useState(false);

  const selected = options.find((o) => o.value === value);

  const isAndroid = Platform.OS === 'android';
  const fieldStyle = isAndroid
    ? {
        backgroundColor: 'transparent',
        borderBottomWidth: 2,
        borderBottomColor: tokens.color.primary,
        paddingHorizontal: 0,
      }
    : {
        backgroundColor: tokens.color.surface,
        borderRadius: tokens.radius.inner,
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityValue={selected ? { text: selected.label } : undefined}
        testID={testID}
        onPress={() => setOpen(true)}
        style={[styles.field, fieldStyle]}
      >
        <Text style={{ color: tokens.color.textStrong, fontFamily: tokens.font[600], fontSize: 15 }}>
          {selected?.label ?? ''}
        </Text>
        <ChevronDown color={tokens.color.textMuted} size={16} strokeWidth={2.5} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.fill}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Close ${label} options`}
            style={[styles.backdrop, { backgroundColor: 'rgba(26, 26, 46, 0.45)' }]}
            onPress={() => setOpen(false)}
            testID={testID ? `${testID}-backdrop` : undefined}
          />
          <View
            testID={testID ? `${testID}-options` : undefined}
            style={[
              styles.sheet,
              tokens.shadow.cardOnCanvas,
              { backgroundColor: tokens.color.card, paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: tokens.color.starEmpty }]} />
            <Text style={[styles.sheetTitle, { color: tokens.color.textMuted, fontFamily: tokens.font[700] }]}>
              {label.toUpperCase()}
            </Text>
            {options.map((option) => {
              const active = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected: active }}
                  testID={testID ? `${testID}-option-${option.value}` : undefined}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    { backgroundColor: pressed ? tokens.color.surface : 'transparent' },
                  ]}
                >
                  <Text
                    style={{
                      flex: 1,
                      color: active ? tokens.color.primary : tokens.color.textStrong,
                      fontFamily: tokens.font[active ? 700 : 600],
                      fontSize: 15,
                    }}
                  >
                    {option.label}
                  </Text>
                  {active ? <Check color={tokens.color.primary} size={18} strokeWidth={2.5} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 10 },
  sheetTitle: { fontSize: 11, letterSpacing: 0.5, paddingHorizontal: 8, marginBottom: 4 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 8, borderRadius: 12 },
});
