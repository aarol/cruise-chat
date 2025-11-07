import { View } from "react-native";
import { usePeerStatus } from "./usePeerStatus";
import { Text } from "react-native-paper";

export function ConnectedPeersStatus() {
  const { peerStatus } = usePeerStatus();
  const hasConnections = peerStatus.connectedPeers.length > 0;
  const serviceRunning = peerStatus.isServiceRunning;

  if (!serviceRunning) return <View />;

  return (
    <View style={{ margin: 10, flexDirection: "row", alignItems: "center" }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: hasConnections ? "#4CAF50" : "#9E9E9E",
          marginRight: 8,
        }}
      />
      <Text variant="labelLarge">
        {hasConnections ? "Connected" : "Searching"}
      </Text>
    </View>
  );
}
