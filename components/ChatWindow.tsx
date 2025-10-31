import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  Button,
  Card,
  FAB,
  Surface,
  Text,
  TextInput,
  useTheme,
  Snackbar,
  IconButton,
} from "react-native-paper";

import { Message } from "@/database/schema";
import { addMessage, getMessages } from "@/database/services";
import MeshPeerModule from "@/modules/mesh_peer_module/src/MeshPeerModule";

interface ChatWindowProps {
  username: string | null;
  showBigStartButton?: boolean;
  onStartButtonPress?: () => void;
  emptyStateMessage?: string;
  chatId?: string;
}

export default function ChatWindow({
  username,
  showBigStartButton,
  onStartButtonPress,
  emptyStateMessage,
  chatId = "",
}: ChatWindowProps) {
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const scrollViewRef = useRef<ScrollView>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // Load messages from database on mount and listen for new messages
  useEffect(() => {
    const loadMessages = async () => {
      const dbMessages = await getMessages(chatId);
      setMessages(dbMessages);
    };

    loadMessages();

    const newMessagesSubscription = MeshPeerModule.addListener(
      "onNewMessages",
      (data) => {
        console.log(
          `${data.count} new messages received! Total messages: ${data.totalMessages}`,
        );
        console.log(`Reading messages from database...`);
        loadMessages();
      },
    );

    return () => {
      newMessagesSubscription?.remove();
    };
  }, [chatId]);

  // Function to check if user is at bottom of scroll
  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;
    const isBottom =
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;
    setIsAtBottom(isBottom);
  };

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  useEffect(scrollToBottom, [showBigStartButton]);

  // Auto-scroll to bottom when new messages arrive (if user was already at bottom)
  useEffect(() => {
    if (isAtBottom && messages.length > 0) {
      setTimeout(() => {
        scrollToBottom();
      }, 5);
    }
  }, [messages, isAtBottom]);

  const sendMessage = async () => {
    const currentUsername = username || "local-user";
    const newMessage = await addMessage(
      inputText.trim(),
      currentUsername,
      chatId,
    );

    if (inputText.trim()) {
      try {
        console.log("Sending a message through backend");
        await MeshPeerModule.sendMessage(
          newMessage.id,
          newMessage.content,
          newMessage.userId,
          newMessage.createdAt.getTime(),
          newMessage.chatId,
        );
        setMessages((messages) => [...messages, newMessage]);
        setInputText("");
        // Always scroll to bottom when user sends a message
        setTimeout(() => {
          scrollToBottom();
        }, 5);
      } catch (error) {
        console.error("Failed to send message:", error);
        setSnackbarMessage(`Failed to send message: ${error}`);
        setSnackbarVisible(true);
      }
    }
  };

  return (
    <>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        keyboardVerticalOffset={Platform.OS === "ios" ? 120 : 100}
      >
        <Surface style={styles.inner} elevation={0}>
          {showBigStartButton ? (
            // Big start button view
            <Surface style={styles.startButtonContainer} elevation={0}>
              <Button
                mode="contained"
                onPress={onStartButtonPress}
                style={styles.bigStartButton}
                contentStyle={styles.bigStartButtonContent}
                labelStyle={styles.bigStartButtonText}
              >
                I am on the cruise
              </Button>
            </Surface>
          ) : (
            // Messages list
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={true}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              {messages.length === 0 ? (
                <Surface style={styles.emptyStateContainer} elevation={0}>
                  <Text
                    variant="headlineSmall"
                    style={[
                      styles.emptyStateTitle,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    Waiting...
                  </Text>
                  {emptyStateMessage && (
                    <Text
                      variant="bodyMedium"
                      style={[
                        styles.emptyStateSubtitle,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      {emptyStateMessage}
                    </Text>
                  )}
                </Surface>
              ) : (
                messages.map((message) => {
                  const messageTime = new Date(
                    message.createdAt,
                  ).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  });

                  return (
                    <Surface
                      key={message.id}
                      style={[
                        styles.messageCard,
                        { backgroundColor: theme.colors.surfaceVariant },
                      ]}
                      elevation={0}
                    >
                      <Surface
                        style={[
                          styles.messageAccent,
                          { backgroundColor: theme.colors.primary },
                        ]}
                        elevation={0}
                      >
                        <></>
                      </Surface>
                      <Surface style={styles.messageContent} elevation={0}>
                        <Surface style={styles.messageHeader} elevation={0}>
                          <Text
                            variant="labelMedium"
                            style={[
                              styles.username,
                              { color: theme.colors.primary },
                            ]}
                          >
                            {message.userId}
                          </Text>
                          <Text
                            variant="bodySmall"
                            style={[
                              styles.timestamp,
                              { color: theme.colors.onSurfaceVariant },
                            ]}
                          >
                            {messageTime}
                          </Text>
                        </Surface>
                        <Text
                          variant="bodyMedium"
                          style={[
                            styles.messageText,
                            { color: theme.colors.onSurface },
                          ]}
                        >
                          {message.content}
                        </Text>
                      </Surface>
                    </Surface>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* Input area - always shown but disabled when big button is showing */}
          <Surface
            style={[
              styles.inputContainer,
              { backgroundColor: theme.colors.surface },
            ]}
            elevation={3}
          >
            <View style={styles.inputRow}>
              <TextInput
                mode="outlined"
                value={inputText}
                onChangeText={setInputText}
                placeholder="Type a message..."
                style={[
                  styles.textInput,
                  { backgroundColor: theme.colors.surfaceVariant },
                ]}
                contentStyle={styles.textInputContent}
                placeholderStyle={styles.placeholderStyle}
                outlineStyle={styles.textInputOutline}
                multiline={false}
                maxLength={500}
                onSubmitEditing={sendMessage}
                returnKeyType="send"
                blurOnSubmit={false}
                disabled={showBigStartButton}
                dense={false}
              />

              {
                <IconButton
                  icon="send"
                  onPress={sendMessage}
                  disabled={showBigStartButton || inputText.length === 0}
                />
              }
            </View>
          </Surface>
        </Surface>
      </KeyboardAvoidingView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={4000}
        style={{ backgroundColor: theme.colors.errorContainer }}
      >
        {snackbarMessage}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
  },
  startButtonContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  bigStartButton: {
    borderRadius: 28,
    minWidth: 250,
  },
  bigStartButtonContent: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  bigStartButtonText: {
    fontSize: 18,
    fontWeight: "600",
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
    marginBottom: 10,
    minHeight: 100,
  },
  messagesContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
    paddingVertical: 16,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateSubtitle: {
    textAlign: "center",
  },
  messageCard: {
    marginVertical: 6,
    borderRadius: 16,
    flexDirection: "row",
    overflow: "hidden",
    marginHorizontal: 4,
  },
  messageAccent: {
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  messageContent: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "transparent",
  },
  messageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  username: {
    fontWeight: "600",
  },
  timestamp: {
    fontSize: 12,
  },
  messageText: {
    lineHeight: 20,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  textInput: {
    flex: 1,
    minHeight: 56,
    maxHeight: 120,
  },
  textInputContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  placeholderStyle: {
    textAlign: "center",
  },
  textInputOutline: {
    borderRadius: 28,
    borderWidth: 0,
  },
  sendFab: {
    marginBottom: 4,
  },
  micFab: {
    marginBottom: 4,
  },
});
