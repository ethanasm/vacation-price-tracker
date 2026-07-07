import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/theme';
import { useApiClient } from '@/lib/api/provider';
import { parseSseChunk, initSseState, type SseState } from '@/lib/chat-stream';
import { ChatBubble } from '@/components/aurora/chat-bubble';
import { QuickReplyChips } from '@/components/aurora/quick-reply-chips';
import { SettingsCog } from '@/components/aurora/settings-cog';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  text?: string;
  toolName?: string;
}

const QUICK_REPLIES = ['Track a new trip', 'Cheapest week to Maui?', 'Show my alerts'];

let messageSeq = 0;
function nextId(): string {
  messageSeq += 1;
  return `m${messageSeq}`;
}

/**
 * Apply a parser `SseState` onto the message list: keep the in-progress
 * assistant bubble's text in sync and append any newly-surfaced tool-call
 * chips. `assistantId` is the placeholder assistant bubble created on send.
 */
function applyState(
  messages: Message[],
  assistantId: string,
  state: SseState,
  toolCount: { current: number },
): Message[] {
  const next = messages.map((m) => (m.id === assistantId ? { ...m, text: state.text } : m));
  // Insert any new tool-call chips just before the streaming assistant bubble.
  if (state.toolCalls.length > toolCount.current) {
    const idx = next.findIndex((m) => m.id === assistantId);
    const newChips = state.toolCalls
      .slice(toolCount.current)
      .map<Message>((name) => ({ id: nextId(), role: 'tool', toolName: name }));
    toolCount.current = state.toolCalls.length;
    if (idx >= 0) next.splice(idx, 0, ...newChips);
    else next.push(...newChips);
  }
  return next;
}

export default function ChatScreen(): React.JSX.Element {
  const { tokens } = useTheme();
  const c = tokens.color;
  const api = useApiClient();

  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const scrollRef = React.useRef<ScrollView>(null);
  const threadIdRef = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const send = React.useCallback(
    async (raw: string) => {
      const message = raw.trim();
      if (!message || busy) return;
      setInput('');
      setBusy(true);

      const userId = nextId();
      const assistantId = nextId();
      setMessages((prev) => [
        ...prev,
        { id: userId, role: 'user', text: message },
        { id: assistantId, role: 'assistant', text: '' },
      ]);

      const toolCount = { current: 0 };
      let state = initSseState();
      const ingest = (chunk: string): void => {
        state = parseSseChunk(state, chunk);
        setMessages((prev) => applyState(prev, assistantId, state, toolCount));
      };

      try {
        const res = await api.sendChatMessage({ message, thread_id: threadIdRef.current });
        const body = res.body as ReadableStream<Uint8Array> | null;
        if (body && typeof body.getReader === 'function') {
          const reader = body.getReader();
          const decoder = new TextDecoder();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            ingest(decoder.decode(value, { stream: true }));
            if (state.done) break;
          }
        } else {
          // Platforms without a streaming body (web/test): read once.
          ingest(await res.text());
        }
        // Persist the backend conversation id so the next turn threads into the
        // same server-side conversation (multi-turn context).
        if (state.threadId) threadIdRef.current = state.threadId;
        if (!state.text && state.toolCalls.length === 0) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, text: 'Sorry, I could not generate a reply just now.' }
                : m,
            ),
          );
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, text: 'Something went wrong reaching the assistant. Please try again.' }
              : m,
          ),
        );
      } finally {
        setBusy(false);
      }
    },
    [api, busy],
  );

  const empty = messages.length === 0;
  const sendDisabled = busy || input.trim().length === 0;

  return (
    <SafeAreaView
      style={[styles.fill, { backgroundColor: c.pageBg }]}
      edges={['top', 'left', 'right']}
    >
      <View style={styles.header}>
        <LinearGradient
          colors={tokens.gradient.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.icon, { borderRadius: tokens.radius.pill }]}
        >
          <Text style={styles.iconGlyph}>✦</Text>
        </LinearGradient>
        <View style={styles.headerText}>
          <Text
            accessibilityRole="header"
            style={{ color: c.textStrong, fontFamily: tokens.font[800], fontSize: 20 }}
          >
            Assistant
          </Text>
          <Text style={{ color: c.textMuted, fontFamily: tokens.font[500], fontSize: 12 }}>
            Powered by Groq
          </Text>
        </View>
        <SettingsCog />
      </View>

      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.fill}
          contentContainerStyle={styles.thread}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {empty ? (
            <View style={styles.emptyState}>
              <Text
                style={{
                  color: c.textBodyAlt,
                  fontFamily: tokens.font[500],
                  fontSize: 14,
                  textAlign: 'center',
                  marginBottom: 14,
                }}
              >
                Ask about flights, hotels, or your tracked trips.
              </Text>
              <QuickReplyChips options={QUICK_REPLIES} onPick={send} />
            </View>
          ) : (
            messages.map((m) => (
              <ChatBubble key={m.id} role={m.role} text={m.text} toolName={m.toolName} />
            ))
          )}
        </ScrollView>

        <View
          style={[styles.inputRow, { borderTopColor: c.hairlineAlt, backgroundColor: c.pageBg }]}
        >
          <TextInput
            testID="chat-input"
            accessibilityLabel="Ask anything"
            placeholder="Ask anything…"
            placeholderTextColor={c.textFaint}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
            multiline
            style={[
              styles.input,
              {
                backgroundColor: c.card,
                borderColor: c.hairlineAlt,
                borderRadius: tokens.radius.inner,
                color: c.textStrong,
                fontFamily: tokens.font[500],
              },
            ]}
          />
          <Pressable
            testID="chat-send"
            accessibilityRole="button"
            accessibilityLabel="Send message"
            onPress={() => send(input)}
            disabled={sendDisabled}
            style={[styles.sendWrap, tokens.shadow.primaryButton]}
          >
            <LinearGradient
              colors={tokens.gradient.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.send,
                { borderRadius: tokens.radius.inner, opacity: sendDisabled ? 0.5 : 1 },
              ]}
            >
              <Text style={styles.sendGlyph}>↑</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerText: { flex: 1 },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  iconGlyph: { color: '#FFFFFF', fontSize: 20 },
  thread: { paddingHorizontal: 16, paddingVertical: 12, flexGrow: 1 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
  },
  sendWrap: { borderRadius: 13 },
  send: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sendGlyph: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
});
