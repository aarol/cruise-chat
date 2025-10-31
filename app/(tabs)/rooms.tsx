import { Modal, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

import ChatWindow from '@/components/ChatWindow';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import MeshPeerModule from '@/modules/mesh_peer_module/src/MeshPeerModule';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Pressable } from 'react-native';

export default function MessagesScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [username, setUsername] = useState<string | null>(null);
  const [chatId, setChatId] = useState('default');
  const [showEditModal, setShowEditModal] = useState(true);
  const [tempChatId, setTempChatId] = useState('');

  const handleEditChatId = useCallback(() => {
    setTempChatId(chatId);
    setShowEditModal(true);
  }, [chatId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={handleEditChatId}>
          {({ pressed }) => (
            <FontAwesome
              name="edit"
              size={25}
              color={Colors['light'].text}
              style={{ marginRight: 15, opacity: pressed ? 0.5 : 1 }}
            />
          )}
        </Pressable>
      ),
    });
  }, [navigation, handleEditChatId]);

  const handleSaveChatId = async () => {
    if (tempChatId.trim()) {
      const newChatId = tempChatId.trim().toLowerCase();
      
      // Unsubscribe from old chat and subscribe to new one
      try {
        await MeshPeerModule.unsubscribeFromNotifications(chatId);
        await MeshPeerModule.subscribeToNotifications(newChatId);
        console.log(`Switched notifications from '${chatId}' to '${newChatId}'`);
      } catch (error) {
        console.error('Failed to update notification subscriptions:', error);
      }
      
      setChatId(newChatId);
    }
    setShowEditModal(false);
  };

  useEffect(() => { setTempChatId(chatId); }, [chatId]);
  useEffect(() => { checkUsername(); }, []);
  useEffect(() => {
    const subscribeToInitialChat = async () => {
      try {
        await MeshPeerModule.subscribeToNotifications(chatId);
        console.log(`Subscribed to notifications for '${chatId}'`);
      } catch (error) {
        console.error('Failed to subscribe to initial chat:', error);
      }
    };
    
    subscribeToInitialChat();
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
      router.push('/Welcome');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{chatId.length>0 && (chatId[0].toUpperCase() + chatId.substring(1, chatId.length))}</Text>
      </View>
      <ChatWindow 
        username={username}
        emptyStateMessage="No messages in this chat"
        chatId={chatId}
      />

      {/* Edit Chat ID Modal for Android */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowEditModal(false)}
        >
          <TouchableOpacity 
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>Change Room</Text>
            <TextInput
              style={styles.modalInput}
              value={tempChatId}
              onChangeText={setTempChatId}
              placeholder="Enter chat room ID"
              placeholderTextColor="#999"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveChatId}
              >
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 10,
    paddingBottom: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 25,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#333',
  },
  modalInput: {
    borderBottomWidth: 2,
    borderBottomColor: '#333',
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 0,
    color: '#000',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#999',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 50,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
