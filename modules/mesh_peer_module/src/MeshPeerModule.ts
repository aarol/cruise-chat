import { NativeModule, requireNativeModule } from 'expo';

import { MeshPeerModuleEvents } from './MeshPeerModule.types';

// These are native functions we can call from React
declare class MeshPeerModule extends NativeModule<MeshPeerModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<MeshPeerModule>('MeshPeerModule');
