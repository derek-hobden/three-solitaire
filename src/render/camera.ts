import * as THREE from "three";
import { playBounds } from "./layout";

export interface CameraRig {
  target: THREE.Vector3;
  direction: THREE.Vector3;
  distance: number;
  minDistance: number;
  maxDistance: number;
  userMoved: boolean;
}

export function createRig(): CameraRig {
  return {
    target: new THREE.Vector3(0, 0, -1.1),
    direction: new THREE.Vector3(0, 1, 0.45).normalize(),
    distance: 14,
    minDistance: 4,
    maxDistance: 36,
    userMoved: false,
  };
}

export function applyRig(camera: THREE.PerspectiveCamera, rig: CameraRig): void {
  camera.position.copy(rig.target).addScaledVector(rig.direction, rig.distance);
  camera.up.set(0, 1, 0);
  camera.lookAt(rig.target);
  camera.updateMatrixWorld(true);
}

export function clampRig(rig: CameraRig): void {
  const bounds = playBounds();
  rig.target.x = THREE.MathUtils.clamp(rig.target.x, bounds.minX, bounds.maxX);
  rig.target.z = THREE.MathUtils.clamp(rig.target.z, bounds.minZ, bounds.maxZ);
  rig.target.y = 0;
  rig.distance = THREE.MathUtils.clamp(rig.distance, rig.minDistance, rig.maxDistance);
}

export function framePlayfield(
  camera: THREE.PerspectiveCamera,
  rig: CameraRig,
  aspect: number,
  topInset = 0.22,
  bottomInset = 0.08,
): void {
  camera.aspect = Math.max(aspect, 0.2);
  camera.fov = aspect < 0.75 ? 46 : aspect < 1 ? 42 : 38;
  camera.updateProjectionMatrix();

  const bounds = playBounds();
  const lookAt = new THREE.Vector3(0, 0, (bounds.minZ + bounds.maxZ) * 0.5);
  const corners = [
    new THREE.Vector3(bounds.minX, 0, bounds.minZ),
    new THREE.Vector3(bounds.maxX, 0, bounds.minZ),
    new THREE.Vector3(bounds.minX, 0, bounds.maxZ),
    new THREE.Vector3(bounds.maxX, 0, bounds.maxZ),
  ];

  const tilt = aspect < 0.8 ? 0.2 : aspect < 1.05 ? 0.34 : 0.52;
  const direction = new THREE.Vector3(0, 1, tilt).normalize();
  const projected = new THREE.Vector3();
  let low = 5;
  let high = 36;

  for (let step = 0; step < 20; step += 1) {
    const dist = (low + high) * 0.5;
    camera.position.copy(lookAt).addScaledVector(direction, dist);
    camera.up.set(0, 1, 0);
    camera.lookAt(lookAt);
    camera.updateMatrixWorld(true);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const corner of corners) {
      projected.copy(corner).project(camera);
      minX = Math.min(minX, projected.x);
      maxX = Math.max(maxX, projected.x);
      minY = Math.min(minY, projected.y);
      maxY = Math.max(maxY, projected.y);
    }

    const edge = aspect < 0.85 ? 0.94 : 0.9;
    const fits =
      minX > -edge &&
      maxX < edge &&
      minY > -1 + bottomInset &&
      maxY < 1 - topInset;

    if (fits) high = dist;
    else low = dist;
  }

  rig.target.copy(lookAt);
  rig.direction.copy(direction);
  rig.distance = high * 1.015;
  rig.minDistance = Math.max(3.2, rig.distance * 0.28);
  rig.maxDistance = rig.distance * 2.4;
  rig.userMoved = false;
  applyRig(camera, rig);
}

export function hudInsets(height: number): { top: number; bottom: number } {
  const hud = document.querySelector<HTMLElement>("#hud");
  const hint = document.querySelector<HTMLElement>("#hint-text");
  const topPx = hud ? hud.getBoundingClientRect().bottom + 8 : 16;
  const hintBox = hint && !hint.hidden ? hint.getBoundingClientRect() : null;
  const bottomPx = hintBox ? height - hintBox.top + 8 : 24;
  return {
    top: THREE.MathUtils.clamp((topPx / height) * 2, 0.08, 0.7),
    bottom: THREE.MathUtils.clamp((bottomPx / height) * 2, 0.05, 0.35),
  };
}
