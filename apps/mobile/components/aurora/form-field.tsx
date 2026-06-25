import React from 'react';
import { View, Text, TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { useTheme } from '@/lib/theme';

/**
 * Labelled text input on a `surface` background with `inner` radius. The label
 * is rendered with the Aurora `label` token; `right` paints an optional
 * adornment (e.g. the ⇄ swap button) beside the input. `testID` is forwarded to
 * the inner TextInput so screens can attach the canonical E2E ids, and
 * `accessibilityLabel` defaults to the field label.
 */
export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  right,
  testID,
  accessibilityLabel,
  keyboardType,
  autoCapitalize = 'none',
  autoCorrect = false,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  right?: React.ReactNode;
  testID?: string;
  accessibilityLabel?: string;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
  maxLength?: number;
}): React.JSX.Element {
  const { tokens } = useTheme();
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
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={tokens.color.textFaint}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          maxLength={maxLength}
          style={[
            styles.input,
            {
              backgroundColor: tokens.color.surface,
              borderRadius: tokens.radius.inner,
              color: tokens.color.textStrong,
              fontFamily: tokens.font[600],
            },
          ]}
        />
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, paddingVertical: 12, paddingHorizontal: 14, fontSize: 15 },
  right: { marginLeft: 8 },
});
