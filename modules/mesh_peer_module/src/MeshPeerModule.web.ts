import { NativeModule, registerWebModule } from 'expo';

import { ChangeEventPayload } from './MeshPeerModule.types';

type MeshPeerModuleEvents = {
  onMessageReceive: (params: ChangeEventPayload) => void;
}

class MeshPeerModule extends NativeModule<MeshPeerModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onMessageReceive', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(MeshPeerModule, 'MeshPeerModule');
