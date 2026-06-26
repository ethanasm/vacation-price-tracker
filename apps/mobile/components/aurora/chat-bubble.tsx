import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/lib/theme';
import { StatusChip } from './status-chip';

export type ChatRole = 'user' | 'assistant' | 'tool';

/**
 * A single chat message bubble.
 *
 * - `user`     — violet (`tokens.color.primary`) bubble, white text, right-aligned.
 * - `assistant`— white card-style bubble, hairline border, body text, left-aligned.
 *                Carries the canonical `assistant-message` testID (E2E contract)
 *                so Maestro can wait on the streamed reply.
 * - `tool`     — a success-tone `StatusChip` "🔧 {name}" tool-call chip, left-aligned.
 */
export function ChatBubble({
  role,
  text,
  toolName,
}: {
  role: ChatRole;
  text?: string;
  toolName?: string;
}): React.JSX.Element {
  const { tokens } = useTheme();
  const c = tokens.color;

  if (role === 'tool') {
    return (
      <View style={[styles.row, styles.left]}>
        <StatusChip tone="success" label={`🔧 ${toolName ?? ''}`.trim()} />
      </View>
    );
  }

  const isUser = role === 'user';
  return (
    <View style={[styles.row, isUser ? styles.right : styles.left]}>
      <View
        testID={isUser ? undefined : 'assistant-message'}
        accessibilityLabel={isUser ? undefined : 'Assistant message'}
        style={[
          styles.bubble,
          { borderRadius: tokens.radius.inner },
          isUser
            ? { backgroundColor: c.primary, borderBottomRightRadius: 4 }
            : {
                backgroundColor: c.card,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: c.hairlineAlt,
                borderBottomLeftRadius: 4,
              },
        ]}
      >
        <Text
          style={{
            color: isUser ? '#FFFFFF' : c.textBody,
            fontFamily: tokens.font[500],
            fontSize: 14,
            lineHeight: 20,
          }}
        >
          {text ?? ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%', marginVertical: 4, flexDirection: 'row' },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10 },
});
