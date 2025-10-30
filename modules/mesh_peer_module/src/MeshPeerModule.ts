import { NativeModule, requireNativeModule } from 'expo';

import { MeshPeerModuleEvents } from './MeshPeerModule.types';

// These are native functions we can call from React code
declare class MeshPeerModule extends NativeModule<MeshPeerModuleEvents> {
  PI: number;
  
  requestPermissions(): Promise<{granted: boolean; permissions?: string[]}>;
  checkPermissions(): Promise<{granted: boolean}>;
  
  // New Nearby Connections functions
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;
  startNearbyService(): Promise<void>;
  stopNearbyService(): Promise<void>;
  sendMessage(id: string, message: string, sender: string, time: number, chat: string): Promise<void>;
  getConnectedPeers(): Promise<string[]>;
  disconnectFromPeer(endpointId: string): Promise<void>;
  disconnectFromAllPeers(): Promise<void>;
  
  // Database functions
  getAllMessageIds(): Promise<string[]>;
  
  // Username functions
  getUsername(): Promise<string | null>;
  setUsername(username: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<MeshPeerModule>('MeshPeerModule');
