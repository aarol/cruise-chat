import { requireNativeView } from 'expo';
import * as React from 'react';

import { MeshPeerModuleViewProps } from './MeshPeerModule.types';

const NativeView: React.ComponentType<MeshPeerModuleViewProps> =
  requireNativeView('MeshPeerModule');

export default function MeshPeerModuleView(props: MeshPeerModuleViewProps) {
  return <NativeView {...props} />;
}
