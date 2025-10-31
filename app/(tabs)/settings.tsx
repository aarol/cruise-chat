import { StyleSheet, TextInput, ToastAndroid, TouchableOpacity } from 'react-native';

import { Text, View } from '@/components/Themed';
import MeshPeerModule from '@/modules/mesh_peer_module/src/MeshPeerModule';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

export default function TabTwoScreen() {
  const [isServiceRunning, setIsServiceRunning] = useState(false);
  const [username, setUsername] = useState('');
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      checkServiceState();
      loadUsername();
      loadConnectedPeers();
    }, [])
  );

  const loadUsername = async () => {
    try {
      const storedUsername = await MeshPeerModule.getUsername();
      if (storedUsername) {
        setUsername(storedUsername);
      }
    } catch (error) {
      console.error('Failed to load username:', error);
    }
  };

  const loadConnectedPeers = async () => {
    try {
      const peers = await MeshPeerModule.getConnectedPeers();
      setConnectedPeers(peers);
    } catch (error) {
      console.error('Failed to load connected peers:', error);
    }
  };

  const checkServiceState = async () => {
    try {
      const running = await MeshPeerModule.isServiceRunning();
      setIsServiceRunning(running);
    } catch (error) {
      console.error('Failed to check service state:', error);
    }
  };

  const handleStopService = async () => {
    try {
      // Stop discovery first
      await MeshPeerModule.stopDiscovery();
      // Then stop the service
      await MeshPeerModule.stopNearbyService();
      setIsServiceRunning(false);
    } catch (error) {
      console.error('Failed to stop service:', error);
      ToastAndroid.show(`Failed to stop service: ${error}`, ToastAndroid.LONG);
    }
  };

  const handleSaveUsername = async () => {
    if (!username.trim()) {
      ToastAndroid.show('Username cannot be empty', ToastAndroid.SHORT);
      return;
    }
    try {
      await MeshPeerModule.setUsername(username.trim());
      ToastAndroid.show('Username updated successfully', ToastAndroid.SHORT);
    } catch (error) {
      console.error('Failed to save username:', error);
      ToastAndroid.show(`Failed to save username: ${error}`, ToastAndroid.LONG);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Username Section */}
        <View style={styles.settingSection}>
          <Text style={styles.sectionLabel}>Username</Text>
          <View style={styles.usernameContainer}>
            <TextInput
              style={styles.usernameInput}
              value={username}
              onChangeText={setUsername}
              placeholder="Enter username"
              placeholderTextColor="#999"
            />
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={handleSaveUsername}
            >
              <Text style={styles.buttonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Stop Service Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.stopButton, !isServiceRunning && styles.buttonDisabled]}
            onPress={handleStopService}
            disabled={!isServiceRunning}
          >
            <Text style={styles.buttonText}>Stop Message Discovery</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Info Footer */}
      <View style={styles.footer}>
        <Text style={styles.infoText}>Cruise Chat v1.0</Text>
        <Text style={styles.infoText}>Mesh networking for offline communication</Text>
        <Text style={styles.infoText}>Currently connected: {connectedPeers.length} peer{connectedPeers.length !== 1 && 's'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  settingSection: {
    width: '100%',
    marginBottom: 30,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
    textAlign: 'center',
  },
  usernameContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  usernameInput: {
    flex: 1,
    borderBottomWidth: 2,
    borderBottomColor: '#333',
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 0,
    color: '#000',
  },
  saveButton: {
    backgroundColor: '#555',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 50,
    alignItems: 'center',
  },
  buttonContainer: {
    marginTop: 30,
    width: '100%',
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    minWidth: 200,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  footer: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  infoText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
    textAlign: 'center',
  },
});
