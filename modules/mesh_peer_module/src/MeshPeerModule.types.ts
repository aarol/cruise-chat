import type { StyleProp, ViewStyle } from 'react-native';

export type OnLoadEventPayload = {
  url: string;
};

export type PeerInfo = {
  endpointId: string;
  name: string;
};

export type MessageReceivedPayload = {
  endpointId: string;
  message: string;
};

export type PeerConnectedPayload = {
  endpointId: string;
};

export type PeerDisconnectedPayload = {
  endpointId: string;
};

export type ConnectionFailedPayload = {
  endpointId: string;
  error: string;
};

export type ChangeEventPayload = {
  value: string;
};

// These are the react functions we can call from native code
export type MeshPeerModuleEvents = {
  onPeerDiscovered: (params: PeerInfo) => void;
  onPeerConnected: (params: PeerConnectedPayload) => void;
  onPeerDisconnected: (params: PeerDisconnectedPayload) => void;
  onPeerLost: (params: PeerDisconnectedPayload) => void;
  onMessageReceived: (params: MessageReceivedPayload) => void;
  onConnectionFailed: (params: ConnectionFailedPayload) => void;
  onAdvertisingStarted: () => void;
  onDiscoveryStarted: () => void;
  onDebug: (params: { message: string }) => void;
  onError: (params: { error: string }) => void;
};

export type MeshPeerModuleViewProps = {
  url: string;
  onLoad: (event: { nativeEvent: OnLoadEventPayload }) => void;
  style?: StyleProp<ViewStyle>;
};
