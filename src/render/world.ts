import * as THREE from "three";
import { applyRig, createRig, framePlayfield, hudInsets } from "./camera";
import { layoutForViewport, setLayout } from "./layout";
import { getFeltTexture, getWoodTexture } from "./textures";

export function createWorld(container: HTMLElement, onLayout?: () => void) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#08110e");
  scene.fog = new THREE.Fog("#08110e", 18, 48);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  const rig = createRig();
  applyRig(camera, rig);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.replaceChildren(renderer.domElement);

  const hemi = new THREE.HemisphereLight("#f3efe4", "#123226", 0.72);
  scene.add(hemi);

  const key = new THREE.DirectionalLight("#fff6e4", 1.35);
  key.position.set(-4, 14, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -10;
  key.shadow.camera.right = 10;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -8;
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 28;
  scene.add(key);

  const fill = new THREE.DirectionalLight("#9ad7c4", 0.28);
  fill.position.set(6, 6, -4);
  scene.add(fill);

  const table = new THREE.Group();
  const felt = new THREE.Mesh(
    new THREE.BoxGeometry(16.4, 0.16, 10.6),
    new THREE.MeshStandardMaterial({
      map: getFeltTexture(),
      roughness: 0.92,
      metalness: 0.02,
    }),
  );
  felt.receiveShadow = true;
  felt.position.y = -0.08;
  table.add(felt);

  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(17.2, 0.42, 11.4),
    new THREE.MeshStandardMaterial({
      map: getWoodTexture(),
      roughness: 0.55,
      metalness: 0.08,
    }),
  );
  rail.receiveShadow = true;
  rail.position.y = -0.3;
  table.add(rail);
  scene.add(table);

  const resize = () => {
    const view = window.visualViewport;
    const width = Math.round(view?.width ?? container.clientWidth);
    const height = Math.round(view?.height ?? container.clientHeight);
    const aspect = width / Math.max(height, 1);
    camera.aspect = aspect;
    const layoutChanged = setLayout(layoutForViewport(width, height));
    if (layoutChanged) onLayout?.();
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    if (layoutChanged || !rig.userMoved) {
      const insets = hudInsets(height);
      framePlayfield(camera, rig, aspect, insets.top, insets.bottom);
    } else {
      applyRig(camera, rig);
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = `${width}px`;
    renderer.domElement.style.height = `${height}px`;
  };
  const resetView = () => {
    rig.userMoved = false;
    resize();
  };
  window.addEventListener("resize", resize);
  window.visualViewport?.addEventListener("resize", resize);
  resize();

  return { scene, camera, renderer, resize, rig, resetView };
}
