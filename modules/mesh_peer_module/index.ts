// Reexport the native module. On web, it will be resolved to MeshPeerModule.web.ts
// and on native platforms to MeshPeerModule.ts
export { default } from "./src/MeshPeerModule";
export { default as MeshPeerModuleView } from "./src/MeshPeerModuleView";
export * from "./src/MeshPeerModule.types";
