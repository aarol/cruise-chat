import MeshPeerModule from '@/modules/mesh_peer_module/src/MeshPeerModule';
import {
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
import { useEffect, useRef, useState } from 'react';

export default function TabOneScreen() {

  // Replace with a better data structure down the line
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [connectedPeers, setConnectedPeers] = useState<string[]>([])
  const [isAdvertising, setIsAdvertising] = useState<false | true | 'pending'>(false)
  const [isDiscovering, setIsDiscovering] = useState<false | true | 'pending'>(false)
  const [serviceRunning, setServiceRunning] = useState(false) // Todo: query from module instead of storing this
  const [permissionsRequested, setPermissionsRequested] = useState(false)

  // ScrollView ref and auto-scroll state
  const scrollViewRef = useRef<ScrollView>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  // Function to check if user is at bottom of scroll
  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent
    const paddingToBottom = 20
    const isBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom
    setIsAtBottom(isBottom)
  }

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true })
  }

  useEffect(() => {

    // New Nearby Connections listeners
    const peerDiscoveredSubscription = MeshPeerModule.addListener('onPeerDiscovered', (peerInfo) => {
      // console.log('Peer discovered:', peerInfo);
    });

    const peerConnectedSubscription = MeshPeerModule.addListener('onPeerConnected', (data) => {
      console.log('Peer connected:', data.endpointId);
      ToastAndroid.show('✅ Connected to peer', ToastAndroid.SHORT);
      // Refresh connected peers list
      MeshPeerModule.getConnectedPeers().then(setConnectedPeers);
    });

    const peerDisconnectedSubscription = MeshPeerModule.addListener('onPeerDisconnected', (data) => {
      console.log('Peer disconnected:', data.endpointId);
      ToastAndroid.show(`❌ Peer disconnected`, ToastAndroid.SHORT);
      MeshPeerModule.getConnectedPeers().then(setConnectedPeers);
    });

    const newMessagesSubscription = MeshPeerModule.addListener('onNewMessages', (data) => {
      console.log(`${data.count} new messages received! Total messages: ${data.totalMessages}`);
      console.log(`Reading messages from database...`);
      setMessagesFromDb();
    });

    const debugMessagesSubscription = MeshPeerModule.addListener('onDebug', (data) => {
      console.log('Native debug:', data.message);
      // setMessages(messages => [...messages, data.message]);
    });
    const errorMessagesSubscription = MeshPeerModule.addListener('onError', (data) => {
      console.log('Error:', data.error);
      ToastAndroid.show(`❌ Error: ${data.error}`, ToastAndroid.LONG);
    });

    setMessagesFromDb();

    return () => {
      peerDiscoveredSubscription?.remove();
      peerConnectedSubscription?.remove();
      peerDisconnectedSubscription?.remove();
      debugMessagesSubscription?.remove();
      errorMessagesSubscription?.remove();
      newMessagesSubscription?.remove();
    };
  }, [])

  // Auto-scroll to bottom when new messages arrive (if user was already at bottom)
  useEffect(() => {
    if (isAtBottom && messages.length > 0) {
      setTimeout(() => { scrollToBottom() }, 5)
    }
  }, [messages, isAtBottom])

  const requestPermissions = async () => {
    try {
      await MeshPeerModule.requestPermissions()
      setPermissionsRequested(true);
      return true;
    } catch (error) {
      console.error('Permission request failed:', error);
      ToastAndroid.show(`❌ Permission request failed: ${error}`, ToastAndroid.LONG);
      setPermissionsRequested(true); // Still show buttons even if permissions failed
      return false;
    }
  };


  const setMessagesFromDb = async () => {
    getMessages().then(dbMessages => {
      setMessages(dbMessages);
    });
  }

  const startNearbyConnections = async () => {
    startDiscovery()
  };

  const stopNearbyConnections = async () => {
    stopDiscovery()
  };

  const toggleService = async () => {
    if (!serviceRunning) {
      MeshPeerModule.startNearbyService().then(() => console.log('ok')).catch((err) => {
        console.error('Failed to start service:', err);
      });
      setServiceRunning(true)
    }
    else {
      MeshPeerModule.stopNearbyService().then(() => console.log('ok')).catch((err) => {
        console.error('Failed to stop service:', err);
      });
      setServiceRunning(false)
    }
  }

  const startDiscovery = async () => {
    try {
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) return;
      setIsDiscovering('pending');
      await MeshPeerModule.startDiscovery();
      console.log('Discovery started');
      setIsDiscovering(true);

    } catch (error) {
      ToastAndroid.show(`❌ Failed to start discovery: ${error}`, ToastAndroid.LONG);
    }
  };

  const stopDiscovery = async () => {
    try {
      await MeshPeerModule.stopDiscovery();
      setIsDiscovering(false)
    } catch (error) {
      ToastAndroid.show(`❌ Failed to stop discovery: ${error}`, ToastAndroid.LONG);
    }
  };

  const sendMessage = async () => {

    const newMessage = await addMessage(inputText.trim(), 'local-user', "global-chat"); // TODO: replace with actual values

    if (inputText.trim()) {
      try {
        await MeshPeerModule.sendMessage(newMessage.id, newMessage.content, newMessage.userId, newMessage.createdAt.getTime() * 1000, newMessage.chatId);
        setMessages(messages => [...messages, newMessage]);
        setInputText('');
        // Always scroll to bottom when user sends a message
        setTimeout(() => { scrollToBottom() }, 5)
      } catch (error) {
        console.error('Failed to send message:', error);
        ToastAndroid.show(`❌ Failed to send message: ${error}`, ToastAndroid.LONG);
      }
    }
  }

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
          {messages.map((message, index) => (
            <Text key={message.id} style={styles.messageText}>
              {message.userId}: {message.content}
            </Text>
          ))}
        </ScrollView>

        {/* Control buttons */}
        <View style={styles.controlsContainer}>
          {!permissionsRequested ? (
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestPermissions}
            >
              <Text style={styles.permissionButtonText}>
                🔐 Request Permissions
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[
                    styles.debugButton,
                    (isAdvertising === true || isDiscovering === true) && styles.activeButton,
                    (isAdvertising === 'pending' || isDiscovering === 'pending') && styles.pendingButton
                  ]}
                  onPress={(isAdvertising || isDiscovering) ? stopNearbyConnections : startNearbyConnections}
                  disabled={isAdvertising == 'pending' || isDiscovering == 'pending'}
                >
                  <Text style={styles.debugButtonText}>
                    {(isAdvertising || isDiscovering) ? '📡 Stop' : '📡 Find'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.debugButton, serviceRunning && styles.activeButton]}
                  onPress={toggleService}
                >
                  <Text style={styles.debugButtonText}>
                    {!serviceRunning ? 'Start service' : 'Stop service'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.statusText}>
                Connected: {connectedPeers.length} • {(isAdvertising == 'pending') ? 'Waiting...' : isDiscovering ? 'Discovering' : 'Idle'}
              </Text>
            </>
          )}
        </View>

        {/* Input area */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor="#888"
            multiline={false}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
            blurOnSubmit={true}
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <Text style={styles.sendButtonText}>Send</Text>
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 60,
    marginBottom: 20,
    textAlign: 'center',
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 20,
    marginBottom: 10,
    minHeight: 100,
  },
  messagesContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingVertical: 10,
  },
  messageText: {
    color: 'black',
    fontSize: 16,
    marginVertical: 5,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignSelf: 'flex-start',
    maxWidth: '80%',
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
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    marginRight: 10,
    backgroundColor: '#f8f8f8',
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  debugButton: {
    flex: 1,
    backgroundColor: '#FF6B35',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  controlsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  controlButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 10,
  },
  activeButton: {
    backgroundColor: '#4CAF50',
  },
  pendingButton: {
    backgroundColor: '#888',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginBottom: 10,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
