import MeshPeerModule from "@/modules/mesh_peer_module/src/MeshPeerModule";
import { StyleSheet } from "react-native";
import { Surface, useTheme, Snackbar } from "react-native-paper";

import ChatWindow from "@/components/ChatWindow";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function TabOneScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [username, setUsername] = useState<string | null>(null);
  const [showBigStartButton, setShowBigStartButton] = useState(true);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarType, setSnackbarType] = useState<
    "success" | "error" | "info"
  >("info");

  useEffect(() => {
    checkUsername();
  }, []);

  useFocusEffect(
    useCallback(() => {
      console.log("Tab focused - checking service status");
      checkServiceState();
    }, []),
  );

  const showSnackbar = (
    message: string,
    type: "success" | "error" | "info" = "info",
  ) => {
    setSnackbarMessage(message);
    setSnackbarType(type);
    setSnackbarVisible(true);
  };

  const checkServiceState = async () => {
    try {
      const isRunning = await MeshPeerModule.isServiceRunning();
      const discovering = await MeshPeerModule.isDiscovering();
      // If service is running or discovering, hide the big start button
      setShowBigStartButton(!isRunning && !discovering);
    } catch (error) {
      console.error("Failed to check service state:", error);
    }
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

  const requestPermissions = async () => {
    try {
      await MeshPeerModule.requestPermissions();
      return true;
    } catch (error) {
      console.error("Permission request failed:", error);
      showSnackbar(`❌ Permission request failed: ${error}`, "error");
      return false;
    }
  };

  const startDiscovery = async () => {
    try {
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) return;
      await MeshPeerModule.startDiscovery();
      console.log("Discovery started");
      await checkServiceState();
    } catch (error) {
      showSnackbar(`❌ Failed to start discovery: ${error}`, "error");
    }
  };

  const handleStartButtonPress = async () => {
    // Check if service is already running
    const isRunning = await MeshPeerModule.isServiceRunning();

    // Start service first if not running
    if (!isRunning) {
      try {
        await MeshPeerModule.startNearbyService();
        console.log("Service started");
      } catch (err) {
        console.error("Failed to start service:", err);
        showSnackbar(`❌ Failed to start service: ${err}`, "error");
        return;
      }
      // Wait a bit to allow it to start (TODO: fix this hack)
      await sleep(100);
    }

    // Then start discovery
    await startDiscovery();
  };

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
          showBigStartButton={showBigStartButton}
          onStartButtonPress={handleStartButtonPress}
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
