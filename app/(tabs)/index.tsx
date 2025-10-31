import MeshPeerModule from "@/modules/mesh_peer_module/src/MeshPeerModule";
import { StyleSheet } from "react-native";
import { Surface, useTheme, Snackbar } from "react-native-paper";

import ChatWindow from "@/components/ChatWindow";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";

export default function TabOneScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [username, setUsername] = useState<string | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarType, setSnackbarType] = useState<
    "success" | "error" | "info"
  >("info");

  useEffect(() => {
    checkUsername();

    // Subscribe to notifications for General chat (empty string chatId)
    const subscribeToGeneralChat = async () => {
      try {
        await MeshPeerModule.subscribeToNotifications("");
        console.log("Subscribed to notifications for General chat");
      } catch (error) {
        console.error("Failed to subscribe to General chat:", error);
      }
    };

    subscribeToGeneralChat();
  }, []);

  const showSnackbar = (
    message: string,
    type: "success" | "error" | "info" = "info",
  ) => {
    setSnackbarMessage(message);
    setSnackbarType(type);
    setSnackbarVisible(true);
  };

  const checkUsername = async () => {
    try {
      const storedUsername = await MeshPeerModule.getUsername();

      if (!storedUsername) {
        router.push("/Welcome");
      } else {
        setUsername(storedUsername);
      }
    } catch (error) {
      console.error("Failed to check username:", error);
      // If there's an error, show the modal anyway
      router.push("/Welcome");
    }
  };

  useEffect(() => {
    // New Nearby Connections listeners
    const peerDiscoveredSubscription = MeshPeerModule.addListener(
      "onPeerDiscovered",
      (peerInfo) => {
        // console.log('Peer discovered:', peerInfo);
      },
    );

    const peerConnectedSubscription = MeshPeerModule.addListener(
      "onPeerConnected",
      (data) => {
        console.log("Peer connected:", data.endpointId);
        showSnackbar("✅ Connected to peer", "success");
        // Refresh connected peers list
        MeshPeerModule.getConnectedPeers().then(setConnectedPeers);
      },
    );

    const peerDisconnectedSubscription = MeshPeerModule.addListener(
      "onPeerDisconnected",
      (data) => {
        console.log("Peer disconnected:", data.endpointId);
        showSnackbar("❌ Peer disconnected", "error");
        MeshPeerModule.getConnectedPeers().then(setConnectedPeers);
      },
    );

    const debugMessagesSubscription = MeshPeerModule.addListener(
      "onDebug",
      (data) => {
        console.log("Native debug:", data.message);
      },
    );

    const errorMessagesSubscription = MeshPeerModule.addListener(
      "onError",
      (data) => {
        console.log("Error:", data.error);
        showSnackbar(`❌ Error: ${data.error}`, "error");
      },
    );

    return () => {
      peerDiscoveredSubscription?.remove();
      peerConnectedSubscription?.remove();
      peerDisconnectedSubscription?.remove();
      debugMessagesSubscription?.remove();
      errorMessagesSubscription?.remove();
    };
  }, []);

  const getSnackbarColor = () => {
    switch (snackbarType) {
      case "success":
        return theme.colors.primary;
      case "error":
        return theme.colors.error;
      default:
        return theme.colors.surface;
    }
  };

  return (
    <>
      <Surface
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <ChatWindow
          username={username}
          emptyStateMessage="If you are on the cruise we could see messages soon"
          chatId=""
        />
      </Surface>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={{ backgroundColor: getSnackbarColor() }}
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
});
