import { StyleSheet, ToastAndroid, TouchableOpacity } from 'react-native';

import { Text, View } from '@/components/Themed';
import MeshPeerModule from '@/modules/mesh_peer_module/src/MeshPeerModule';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

export default function TabTwoScreen() {
  const [isServiceRunning, setIsServiceRunning] = useState(false);

  useFocusEffect(
    useCallback(() => {
      checkServiceState();
    }, [])
  );

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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
      <Text style={styles.placeholderText}>Settings page coming soon...</Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.stopButton, !isServiceRunning && styles.buttonDisabled]}
          onPress={handleStopService}
          disabled={!isServiceRunning}
        >
          <Text style={styles.buttonText}>Stop Service</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%',
  },
  placeholderText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 10,
  },
  subText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
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
});
