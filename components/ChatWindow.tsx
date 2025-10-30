import { useEffect, useRef, useState } from 'react';
import
    {
        KeyboardAvoidingView,
        Platform,
        ScrollView,
        StyleSheet,
        TextInput,
        ToastAndroid,
        TouchableOpacity
    } from 'react-native';

import { Text, View } from '@/components/Themed';
import { Message } from '@/database/schema';
import { addMessage, getMessages } from '@/database/services';
import MeshPeerModule from '@/modules/mesh_peer_module/src/MeshPeerModule';

interface ChatWindowProps {
  username: string | null;
  emptyStateMessage?: string;
}

export default function ChatWindow({ username, emptyStateMessage }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Load messages from database on mount and listen for new messages
  useEffect(() => {
    const loadMessages = async () => {
      const dbMessages = await getMessages();
      setMessages(dbMessages);
    };

    loadMessages();

    const newMessagesSubscription = MeshPeerModule.addListener('onNewMessages', (data) => {
      console.log(`${data.count} new messages received! Total messages: ${data.totalMessages}`);
      console.log(`Reading messages from database...`);
      loadMessages();
    });

    return () => {
      newMessagesSubscription?.remove();
    };
  }, []);

  // Function to check if user is at bottom of scroll
  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;
    const isBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    setIsAtBottom(isBottom);
  };

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  // Auto-scroll to bottom when new messages arrive (if user was already at bottom)
  useEffect(() => {
    if (isAtBottom && messages.length > 0) {
      setTimeout(() => { scrollToBottom(); }, 5);
    }
  }, [messages, isAtBottom]);

  const sendMessage = async () => {
    const currentUsername = username || 'local-user';
    const newMessage = await addMessage(inputText.trim(), currentUsername, "global-chat");

    if (inputText.trim()) {
      try {
        console.log("Sending a message through backend");
        await MeshPeerModule.sendMessage(
          newMessage.id,
          newMessage.content,
          newMessage.userId,
          newMessage.createdAt.getTime() * 1000,
          newMessage.chatId
        );
        setMessages(messages => [...messages, newMessage]);
        setInputText('');
        // Always scroll to bottom when user sends a message
        setTimeout(() => { scrollToBottom(); }, 5);
      } catch (error) {
        console.error('Failed to send message:', error);
        ToastAndroid.show(`❌ Failed to send message: ${error}`, ToastAndroid.LONG);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 120 : 100}
    >
      <View style={styles.inner}>
        {/* Messages list */}
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
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateTitle}>Waiting...</Text>
              {emptyStateMessage && (
                <Text style={styles.emptyStateSubtitle}>{emptyStateMessage}</Text>
              )}
            </View>
          ) : (
            messages.map((message) => {
              const messageTime = new Date(message.createdAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              });
              
              return (
                <View key={message.id} style={styles.messageContainer}>
                  <View style={styles.messageBar} />
                  <View style={styles.messageContent}>
                    <Text style={styles.messageText}>
                      <Text style={styles.username}>{message.userId}</Text>
                      <Text style={styles.messageBody}>: {message.content}</Text>
                    </Text>
                  </View>
                  <Text style={styles.timestamp}>{messageTime}</Text>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Input area */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            multiline={false}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
            blurOnSubmit={false}
            underlineColorAndroid="transparent"
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <Text style={styles.sendButtonText}>➤</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 8,
    marginBottom: 10,
    minHeight: 100,
  },
  messagesContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingVertical: 10,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 8,
  },
  messageBar: {
    width: 4,
    backgroundColor: '#007AFF',
    borderRadius: 2,
    marginRight: 8,
    alignSelf: 'stretch',
  },
  messageContent: {
    flex: 1,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
    alignSelf: 'flex-start',
  },
  username: {
    fontWeight: 'bold',
    color: '#000',
  },
  messageBody: {
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  textInput: {
    flex: 1,
    borderBottomWidth: 2,
    borderBottomColor: '#333',
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 0,
    color: '#000',
  },
  sendButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 12,
    paddingVertical: 12,
  },
  sendButtonText: {
    color: '#333',
    fontSize: 24,
    fontWeight: 'bold',
  },
});
