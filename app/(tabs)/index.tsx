import MeshPeerModule from '@/modules/mesh_peer_module/src/MeshPeerModule';
import
  {
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    PermissionsAndroid,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback
  } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useEffect, useState } from 'react';

export default function TabOneScreen() {

  // Replace with a better data structure down the line
  const [messages, setMessages] = useState<string[]>([])
  const [inputText, setInputText] = useState('')
  const [connectedPeers, setConnectedPeers] = useState<string[]>([])
  const [isAdvertising, setIsAdvertising] = useState(false)
  const [isDiscovering, setIsDiscovering] = useState(false)

  // Many of these listeners are unnecessary and shouldn't broadcast to frontend
  useEffect(() => {
    // Legacy message listener
    const messageSubscription = MeshPeerModule.addListener('onMessageReceive', (eventData) => {
      console.log('Legacy message received:', eventData.value);
      setMessages(messages => [...messages, `You: ${eventData.value}`]);
    });

    // New Nearby Connections listeners
    const peerDiscoveredSubscription = MeshPeerModule.addListener('onPeerDiscovered', (peerInfo) => {
      console.log('Peer discovered:', peerInfo);
      setMessages(messages => [...messages, `📡 Found: ${peerInfo.name}`]);
    });

    const peerConnectedSubscription = MeshPeerModule.addListener('onPeerConnected', (data) => {
      console.log('Peer connected:', data.endpointId);
      setMessages(messages => [...messages, `✅ Connected to peer`]);
      // Refresh connected peers list
      MeshPeerModule.getConnectedPeers().then(setConnectedPeers);
    });

    const peerDisconnectedSubscription = MeshPeerModule.addListener('onPeerDisconnected', (data) => {
      console.log('Peer disconnected:', data.endpointId);
      setMessages(messages => [...messages, `❌ Peer disconnected`]);
      // Refresh connected peers list
      MeshPeerModule.getConnectedPeers().then(setConnectedPeers);
    });

    const messageReceivedSubscription = MeshPeerModule.addListener('onMessageReceived', (data) => {
      console.log('Nearby message received:', data);
      setMessages(messages => [...messages, `📱 ${data.message}`]);
    });

    const advertisingStartedSubscription = MeshPeerModule.addListener('onAdvertisingStarted', () => {
      console.log('Started advertising');
      setIsAdvertising(true);
    });

    const discoveryStartedSubscription = MeshPeerModule.addListener('onDiscoveryStarted', () => {
      console.log('Started discovery');
      setIsDiscovering(true);
    });

    const debugMessagesSubscription = MeshPeerModule.addListener('onDebug', (data) => {
      console.log('Native debug:', data.message);
      setMessages(messages => [...messages, data.message]);
    });

    return () => {
      messageSubscription?.remove();
      peerDiscoveredSubscription?.remove();
      peerConnectedSubscription?.remove();
      peerDisconnectedSubscription?.remove();
      messageReceivedSubscription?.remove();
      advertisingStartedSubscription?.remove();
      discoveryStartedSubscription?.remove();
      debugMessagesSubscription?.remove();
    };
  }, [])

const requestPermissions = async () => {
  try {
    if (Platform.OS === 'android') {
      const apiLevel = Platform.constants.Release;
      const apiNumber = parseInt(apiLevel);
      console.log("API: " + apiNumber);

      let allGranted = true;
      const grantedPermissions: string[] = [];
      const deniedPermissions: string[] = [];

      if (true) { //apiNumber >= 12
        // Android 12+ - Use requestMultiple for all supported permissions
        const permissions = [
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES,
        ];

        const granted = await PermissionsAndroid.requestMultiple(permissions);
        
        Object.entries(granted).forEach(([perm, status]) => {
          if (status === PermissionsAndroid.RESULTS.GRANTED) {
            grantedPermissions.push(perm);
          } else {
            deniedPermissions.push(perm);
            allGranted = false;
          }
        });
      } else {
      }

      if (allGranted) {
        setMessages(messages => [...messages, `✅ All permissions granted!`]);

        const res = await MeshPeerModule.checkPermissions()
        if (!res.granted)
        {
          await MeshPeerModule.requestPermissions()
        }

        return true;
      } else {
        const deniedNames = deniedPermissions.map(p => p.split('.').pop()).join(', ');
        setMessages(messages => [...messages, `❌ Denied: ${deniedNames}`]);
        Alert.alert(
          'Permissions Required',
          'CruiseChat needs location and Bluetooth permissions to find nearby devices. Please grant all permissions in Settings.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('Permission request failed:', error);
    setMessages(messages => [...messages, `❌ Permission error: ${error}`]);
    return false;
  }
};

  const startNearbyConnections = async () => {
    try {
      // First request permissions
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) {
        return;
      }

      await MeshPeerModule.startAdvertising();
      await MeshPeerModule.startDiscovery();
      setMessages(messages => [...messages, `🚢 CruiseChat started! Looking for nearby devices...`]);
    } catch (error) {
      console.error('Failed to start Nearby Connections:', error);
      setMessages(messages => [...messages, `❌ Failed to start: ${error}`]);
    }
  };

  const stopNearbyConnections = async () => {
    try {
      await MeshPeerModule.stopAdvertising();
      await MeshPeerModule.stopDiscovery();
      setIsAdvertising(false);
      setIsDiscovering(false);
      setMessages(messages => [...messages, `⏹️ Stopped advertising and discovery`]);
    } catch (error) {
      console.error('Failed to stop Nearby Connections:', error);
    }
  };

  const startAdvertising = async () => {
    try {
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) return;
      await MeshPeerModule.startAdvertising();
    } catch (error) {
      setMessages(messages => [...messages, `❌ Failed to start advertising: ${error}`]);
    }
  };

  const stopAdvertising = async () => {
    try {
      await MeshPeerModule.stopAdvertising();
      setIsAdvertising(false)
    } catch (error) {
      setMessages(messages => [...messages, `❌ Failed to stop advertising: ${error}`]);
    }
  };

  const startDiscovery = async () => {
    try {
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) return;
      await MeshPeerModule.startDiscovery();
    } catch (error) {
      setMessages(messages => [...messages, `❌ Failed to start discovery: ${error}`]);
    }
  };

  const stopDiscovery = async () => {
    try {
      await MeshPeerModule.stopDiscovery();
      setIsDiscovering(false)
    } catch (error) {
      setMessages(messages => [...messages, `❌ Failed to stop discovery: ${error}`]);
    }
  };

  const sendMessage = async () => {
    if (inputText.trim()) {
      try {
        if (connectedPeers.length > 0) {
          // Send to all connected peers using new API
          await MeshPeerModule.broadcastMessage(inputText);
          setMessages(messages => [...messages, `You: ${inputText}`]);
        } else {
          // Fallback to legacy method
          await MeshPeerModule.setValueAsync(inputText);
        }
        setInputText('');
      } catch (error) {
        console.error('Failed to send message:', error);
        setMessages(messages => [...messages, `❌ Failed to send message`]);
      }
    }
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 120 : 100}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.inner}>
          <Text style={styles.title}>Global chat</Text>
          
          {/* Messages list */}
          <ScrollView 
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((message, index) => (
              <Text key={index} style={styles.messageText}>
                {message}
              </Text>
            ))}
          </ScrollView>
          
          {/* Control buttons */}
          <View style={styles.controlsContainer}>
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.debugButton, isAdvertising && styles.activeButton]} 
                onPress={isAdvertising ? stopAdvertising : startAdvertising}
              >
                <Text style={styles.debugButtonText}>
                  {isAdvertising ? '📡 Stop' : '� Broadcast'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.debugButton, isDiscovering && styles.activeButton]} 
                onPress={isDiscovering ? stopDiscovery : startDiscovery}
              >
                <Text style={styles.debugButtonText}>
                  {isDiscovering ? '🔍 Stop' : '🔍 Discover'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.statusText}>
              Connected: {connectedPeers.length} • {isAdvertising ? 'Broadcasting' : isDiscovering ? 'Discovering' : 'Idle'}
            </Text>
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
            />
            <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'space-between',
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
  },
  messagesContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
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
});
