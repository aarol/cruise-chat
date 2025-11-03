import MeshPeerModule from "@/modules/mesh_peer_module/src/MeshPeerModule";
import { StyleSheet } from "react-native";
import { Snackbar, Surface, useTheme } from "react-native-paper";

import ChatWindow from "@/components/ChatWindow";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";

export default function TabOneScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarType, setSnackbarType] = useState<
    "success" | "error" | "info"
  >("info");

  // Reload every single time we get focus 
  useFocusEffect(
    useCallback(() => {
      checkUsername();
    }, [])
  );

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
