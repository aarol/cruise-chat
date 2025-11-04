import { NativeModule, requireNativeModule } from "expo";

import { MeshPeerModuleEvents } from "./MeshPeerModule.types";

// These are native functions we can call from React code
declare class MeshPeerModule extends NativeModule<MeshPeerModuleEvents> {
  PI: number;

  requestPermissions(): Promise<boolean>;
  checkPermissions(): Promise<{ granted: boolean }>;

  // New Nearby Connections functions
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;
  startNearbyService(): Promise<void>;
  stopNearbyService(): Promise<void>;
  sendMessage(
    id: string,
    content: string,
    userId: string,
    createdAt: number,
    chatId: string,
  ): Promise<void>;
  getConnectedPeers(): Promise<string[]>;
  disconnectFromPeer(endpointId: string): Promise<void>;
  disconnectFromAllPeers(): Promise<void>;

  // Database functions
  getRelevantMessageIds(): Promise<string[]>;
  getMessageCount(): Promise<number>;

  // Username functions
  getUsername(): Promise<string | null>;
  setUsername(username: string): Promise<void>;

  // State functions
  isServiceRunning(): Promise<boolean>;
  isDiscovering(): Promise<boolean>;

  // Notification subscription functions
  subscribeToNotifications(chatId: string): Promise<boolean>;
  unsubscribeFromNotifications(chatId: string): Promise<boolean>;
  getNotificationSubscriptions(): Promise<string[]>;
  isSubscribedToNotifications(chatId: string): Promise<boolean>;
  clearNotificationSubscriptions(): Promise<void>;
}

// Try to load the native module. In development (managed Expo) the native
// module may not be available (unless a dev client / prebuild is used). To
// avoid crashing the JS bundle on import, provide a safe JS fallback that
// implements the same surface with no-ops / safe defaults and a simple
// addListener stub. This allows the app to run while you iterate on the JS
// UX; native functionality will be enabled when the native module is present.
let nativeModule: MeshPeerModule | null = null;
try {
  nativeModule = requireNativeModule<MeshPeerModule>("MeshPeerModule");
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn("MeshPeerModule native module not found, using JS fallback:", e?.message ?? e);
}

// Fallback internal state used to emulate permissions and service state while
// running without the native module. This allows the UI to progress during
// JS-only development and enables testing of features like stickers.
let fallbackStoredUsername: string | null = null;
let fallbackPermissionGranted = false;
let fallbackServiceRunning = false;
let fallbackDiscovering = false;

const jsFallback: any = {
  PI: Math.PI,
  requestPermissions: async () => {
    fallbackPermissionGranted = true;
    return true;
  },
  checkPermissions: async () => ({ granted: fallbackPermissionGranted }),
  startDiscovery: async () => { fallbackDiscovering = true; },
  stopDiscovery: async () => { fallbackDiscovering = false; },
  startNearbyService: async () => { fallbackServiceRunning = true; },
  stopNearbyService: async () => { fallbackServiceRunning = false; },
  sendMessage: async (_id: string, _content: string, _userId: string, _createdAt: number, _chatId: string) => {},
  getConnectedPeers: async () => [] as string[],
  disconnectFromPeer: async (_endpointId: string) => {},
  disconnectFromAllPeers: async () => {},
  getRelevantMessageIds: async () => [] as string[],
  getMessageCount: async () => 0,
  // In-memory fallback storage for username so the Welcome flow works while
  // running without the native module. This persists only for the JS runtime
  // session (lost on full reload), but is sufficient for local UI testing.
  getUsername: async () => fallbackStoredUsername as string | null,
  setUsername: async (username: string) => { fallbackStoredUsername = username; },
  isServiceRunning: async () => fallbackServiceRunning,
  isDiscovering: async () => fallbackDiscovering,
  subscribeToNotifications: async (_chatId: string) => false,
  unsubscribeFromNotifications: async (_chatId: string) => false,
  getNotificationSubscriptions: async () => [] as string[],
  isSubscribedToNotifications: async (_chatId: string) => false,
  clearNotificationSubscriptions: async () => {},
  // Minimal event listener stub used by JS code. Returns an object with remove().
  addListener: (_eventName: string, _cb: (...args: any[]) => void) => ({ remove: () => {} }),
};

const exported: any = nativeModule ?? jsFallback;

export default exported as MeshPeerModule;
