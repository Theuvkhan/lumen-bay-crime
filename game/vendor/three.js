// Thin ES-module wrapper around the vendored three.js r158 classic global build. The library ships
// as game/vendor/three.min.js, a plain <script src> that sets window.THREE, so index.html loads it
// first and the game's modules import the global through this file. Vendored, so the dossier lists
// it and never shows it as the game's source.
const THREE = window.THREE;
export default THREE;
export const Scene = THREE.Scene;
export const PerspectiveCamera = THREE.PerspectiveCamera;
export const WebGLRenderer = THREE.WebGLRenderer;
export const Color = THREE.Color;
export const Vector3 = THREE.Vector3;
export const Matrix4 = THREE.Matrix4;
export const FogExp2 = THREE.FogExp2;
export const SphereGeometry = THREE.SphereGeometry;
export const ShaderMaterial = THREE.ShaderMaterial;
export const BackSide = THREE.BackSide;
export const PlaneGeometry = THREE.PlaneGeometry;
export const MeshStandardMaterial = THREE.MeshStandardMaterial;
export const MeshBasicMaterial = THREE.MeshBasicMaterial;
export const Mesh = THREE.Mesh;
export const Group = THREE.Group;
export const BoxGeometry = THREE.BoxGeometry;
export const CylinderGeometry = THREE.CylinderGeometry;
export const ConeGeometry = THREE.ConeGeometry;
export const TorusGeometry = THREE.TorusGeometry;
export const InstancedMesh = THREE.InstancedMesh;
export const CanvasTexture = THREE.CanvasTexture;
export const SRGBColorSpace = THREE.SRGBColorSpace;
export const RepeatWrapping = THREE.RepeatWrapping;
export const AdditiveBlending = THREE.AdditiveBlending;
export const DoubleSide = THREE.DoubleSide;
export const ACESFilmicToneMapping = THREE.ACESFilmicToneMapping;
export const PCFSoftShadowMap = THREE.PCFSoftShadowMap;
export const HemisphereLight = THREE.HemisphereLight;
export const DirectionalLight = THREE.DirectionalLight;
export const AmbientLight = THREE.AmbientLight;
export const StaticDrawUsage = THREE.StaticDrawUsage;
export const LinearFilter = THREE.LinearFilter;
