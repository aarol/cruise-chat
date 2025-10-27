import { NativeModule, requireNativeModule } from 'expo';

import { MeshPeerModuleEvents } from './MeshPeerModule.types';

// These are native functions we can call from React
declare class MeshPeerModule extends NativeModule<MeshPeerModuleEvents> {
  // Legacy properties and functions
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
  
  // Permission functions
  requestPermissions(): Promise<{granted: boolean; permissions?: string[]}>;
  checkPermissions(): Promise<{granted: boolean}>;
  
  // New Nearby Connections functions
  startAdvertising(): Promise<void>;
  startDiscovery(): Promise<void>;
  stopAdvertising(): Promise<void>;
  stopDiscovery(): Promise<void>;
  sendMessage(endpointId: string, message: string): Promise<void>;
  broadcastMessage(message: string): Promise<void>;
  getConnectedPeers(): Promise<string[]>;
  disconnectFromPeer(endpointId: string): Promise<void>;
  disconnectFromAllPeers(): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<MeshPeerModule>('MeshPeerModule');
