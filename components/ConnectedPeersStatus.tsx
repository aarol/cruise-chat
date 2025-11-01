import { View } from "react-native";
import { usePeerStatus } from "./usePeerStatus";
import { Text } from "react-native-paper";

export function ConnectedPeersStatus() {
  const { peerStatus } = usePeerStatus();

  return (
    <View style={{ margin: 10 }}>
      <Text variant="labelLarge">
        {peerStatus.connectedPeers.length} connected
      </Text>
    </View>
  );
}
