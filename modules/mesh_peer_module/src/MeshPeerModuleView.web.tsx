import * as React from 'react';

import { MeshPeerModuleViewProps } from './MeshPeerModule.types';

export default function MeshPeerModuleView(props: MeshPeerModuleViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
