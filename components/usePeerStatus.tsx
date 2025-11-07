import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import MeshPeerModule from "@/modules/mesh_peer_module/src/MeshPeerModule";
import type {
  PeerInfo,
  PeerConnectedPayload,
  PeerDisconnectedPayload,
} from "@/modules/mesh_peer_module/src/MeshPeerModule.types";
import type { EventSubscription } from "expo-modules-core";

interface PeerStatus {
  connectedPeers: string[];
  discoveredPeers: PeerInfo[];
  isServiceRunning: boolean;
  isDiscovering: boolean;
}

interface PeerStatusActions {
  refreshPeerStatus: () => Promise<void>;
  startService: () => Promise<void>;
  stopService: () => Promise<void>;
  startDiscovery: () => Promise<void>;
}

interface PeerStatusContextValue {
  peerStatus: PeerStatus;
  actions: PeerStatusActions;
}

const initialPeerStatus: PeerStatus = {
  connectedPeers: [],
  discoveredPeers: [],
  isServiceRunning: false,
  isDiscovering: false,
};

const PeerStatusContext = createContext<PeerStatusContextValue | null>(null);

interface PeerStatusProviderProps {
  children: ReactNode;
}

export const PeerStatusProvider: React.FC<PeerStatusProviderProps> = ({
  children,
}) => {
  const [peerStatus, setPeerStatus] = useState<PeerStatus>(initialPeerStatus);
  const [listenersInitialized, setListenersInitialized] = useState(false);

  // Update peer status state
  const updatePeerStatus = useCallback((updates: Partial<PeerStatus>) => {
    setPeerStatus((prev) => ({ ...prev, ...updates }));
  }, []);

  // Refresh peer status from native module
  const refreshPeerStatus = useCallback(async () => {
    try {
      const [connectedPeers, isServiceRunning] = await Promise.all([
        MeshPeerModule.getConnectedPeers(),
        MeshPeerModule.isServiceRunning(),
      ]);

      console.log({ connectedPeers, isServiceRunning });

      updatePeerStatus({
        connectedPeers,
        isServiceRunning,
      });
    } catch (error) {
      console.error("Error refreshing peer status:", error);
    }
  }, [updatePeerStatus]);

  // Initialize MeshPeerModule listeners
  useEffect(() => {
    if (listenersInitialized) return;

    console.log("🔧 Initializing MeshPeerModule listeners...");

    const subscriptions: EventSubscription[] = [];

    const setupListeners = async () => {
      try {
        // Peer discovered listener
        const peerDiscoveredSub = MeshPeerModule.addListener(
          "onPeerDiscovered",
          (peerInfo: PeerInfo) => {
            console.log("👀 Peer discovered:", peerInfo);
            setPeerStatus((prev) => ({
              ...prev,
              discoveredPeers: [
                ...prev.discoveredPeers.filter(
                  (p) => p.endpointId !== peerInfo.endpointId,
                ),
                peerInfo,
              ],
            }));
          },
        );

        // Peer connected listener
        const peerConnectedSub = MeshPeerModule.addListener(
          "onPeerConnected",
          async (data: PeerConnectedPayload) => {
            console.log("✅ Peer connected:", data.endpointId);
            try {
              const updatedPeers = await MeshPeerModule.getConnectedPeers();
              updatePeerStatus({
                connectedPeers: updatedPeers,
              });
            } catch (error) {
              console.error(
                "Error refreshing connected peers after connection:",
                error,
              );
            }
          },
        );

        // Peer disconnected listener
        const peerDisconnectedSub = MeshPeerModule.addListener(
          "onPeerDisconnected",
          async (data: PeerDisconnectedPayload) => {
            console.log("❌ Peer disconnected:", data.endpointId);
            try {
              const updatedPeers = await MeshPeerModule.getConnectedPeers();
              setPeerStatus((prev) => ({
                ...prev,
                connectedPeers: updatedPeers,
                connectedPeerCount: updatedPeers.length,
                lastDisconnectedPeer: data.endpointId,
                discoveredPeers: prev.discoveredPeers.filter(
                  (p) => p.endpointId !== data.endpointId,
                ),
              }));
            } catch (error) {
              console.error(
                "Error refreshing connected peers after disconnection:",
                error,
              );
            }
          },
        );

        // Peer lost listener
        const peerLostSub = MeshPeerModule.addListener(
          "onPeerLost",
          (data: PeerDisconnectedPayload) => {
            console.log("👻 Peer lost from discovery:", data.endpointId);
            setPeerStatus((prev) => ({
              ...prev,
              discoveredPeers: prev.discoveredPeers.filter(
                (p) => p.endpointId !== data.endpointId,
              ),
            }));
          },
        );

        // Debug listener
        const debugSub = MeshPeerModule.addListener(
          "onDebug",
          (data: { message: string }) => {
            console.log("🐛 MeshPeer Debug:", data.message);
          },
        );

        // Error listener
        const errorSub = MeshPeerModule.addListener(
          "onError",
          (data: { error: string }) => {
            console.error("❌ MeshPeer Error:", data.error);
          },
        );

        const serviceStartedSub = MeshPeerModule.addListener(
          "onServiceStarted",
          () => {
            setPeerStatus((prev) => ({
              ...prev,
              connectedPeers: [],
              discoveredPeers: [],
              isServiceRunning: true,
            }));
          },
        );
        const serviceStoppedSub = MeshPeerModule.addListener(
          "onServiceStopped",
          () => {
            console.log("service stopped event");
            setPeerStatus((prev) => ({
              ...prev,
              connectedPeers: [],
              discoveredPeers: [],
              isServiceRunning: false,
            }));
          },
        );

        const discoveryStartedSub = MeshPeerModule.addListener(
          "onDiscoveryStarted",
          () => {
            setPeerStatus((prev) => ({
              ...prev,
              isDiscovering: true,
            }));
          },
        );

        const discoveryStoppedSub = MeshPeerModule.addListener(
          "onDiscoveryStopped",
          () => {
            setPeerStatus((prev) => ({
              ...prev,
              isDiscovering: false,
            }));
          },
        );

        subscriptions.push(
          peerDiscoveredSub,
          peerConnectedSub,
          peerDisconnectedSub,
          peerLostSub,
          debugSub,
          errorSub,
          serviceStartedSub,
          serviceStoppedSub,
          discoveryStartedSub,
          discoveryStoppedSub,
        );

        setListenersInitialized(true);
        console.log("✅ MeshPeerModule listeners initialized");

        // Load initial state
        await refreshPeerStatus();
      } catch (error) {
        console.error("Failed to initialize MeshPeerModule listeners:", error);
      }
    };

    setupListeners();
    refreshPeerStatus();

    // Cleanup listeners on unmount
    return () => {
      console.log("🧹 Cleaning up MeshPeerModule listeners...");
      subscriptions.forEach((sub) => sub?.remove());
      setListenersInitialized(false);
    };
  }, [refreshPeerStatus, updatePeerStatus]);

  // Action methods
  const actions: PeerStatusActions = {
    refreshPeerStatus,

    startService: useCallback(async () => {
      try {
        await MeshPeerModule.startNearbyService();
      } catch (error) {
        console.error("Error starting service:", error);
        throw error;
      }
    }, []),

    stopService: useCallback(async () => {
      try {
        await MeshPeerModule.stopNearbyService();
      } catch (error) {
        console.error("Error stopping service:", error);
        throw error;
      }
    }, []),

    startDiscovery: useCallback(async () => {
      try {
        await MeshPeerModule.startDiscovery();
        await refreshPeerStatus();
      } catch (error) {
        console.error("Error starting discovery:", error);
        throw error;
      }
    }, [refreshPeerStatus]),
  };

  const contextValue: PeerStatusContextValue = {
    peerStatus,
    actions,
  };

  return (
    <PeerStatusContext.Provider value={contextValue}>
      {children}
    </PeerStatusContext.Provider>
  );
};

export const usePeerStatus = (): PeerStatusContextValue => {
  const context = useContext(PeerStatusContext);
  if (!context) {
    throw new Error("usePeerStatus must be used within a PeerStatusProvider");
  }
  return context;
};

export default PeerStatusProvider;
