import MeshPeerModule from '@/modules/mesh_peer_module/src/MeshPeerModule';
import
  {
    StyleSheet,
    ToastAndroid
  } from 'react-native';

import ChatWindow from '@/components/ChatWindow';
import { View } from '@/components/Themed';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

export default function TabOneScreen() {
  const router = useRouter();
  const [connectedPeers, setConnectedPeers] = useState<string[]>([])
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    checkUsername();
  }, []);

  const checkUsername = async () => {
    try {
      const storedUsername = await MeshPeerModule.getUsername();
      
      if (!storedUsername) {
        router.push('/Welcome');
      } else {
        setUsername(storedUsername);
      }
    } catch (error) {
      console.error('Failed to check username:', error);
      // If there's an error, show the modal anyway
      router.push('/Welcome');
    }
  };

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

    const debugMessagesSubscription = MeshPeerModule.addListener('onDebug', (data) => {
      console.log('Native debug:', data.message);
    });
    const errorMessagesSubscription = MeshPeerModule.addListener('onError', (data) => {
      console.log('Error:', data.error);
      ToastAndroid.show(`❌ Error: ${data.error}`, ToastAndroid.LONG);
    });

    return () => {
      peerDiscoveredSubscription?.remove();
      peerConnectedSubscription?.remove();
      peerDisconnectedSubscription?.remove();
      debugMessagesSubscription?.remove();
      errorMessagesSubscription?.remove();
    };
  }, [])

  return (
    <View style={styles.container}>
      <ChatWindow 
        username={username} 
        emptyStateMessage="If you are on the cruise we could see messages soon"
        chatId=''
      />

    </View>
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
