import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './MeshPeerModule.types';

type MeshPeerModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class MeshPeerModule extends NativeModule<MeshPeerModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(MeshPeerModule, 'MeshPeerModule');
