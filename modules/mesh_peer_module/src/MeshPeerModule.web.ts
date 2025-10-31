import { NativeModule, registerWebModule } from "expo";

type MeshPeerModuleEvents = {
  // onMessageReceive: (params: ChangeEventPayload) => void;
};

class MeshPeerModule extends NativeModule<MeshPeerModuleEvents> {
  PI = Math.PI;
  // hello() {
  //   return 'Hello world! 👋';
  // }
}

export default registerWebModule(MeshPeerModule, "MeshPeerModule");
