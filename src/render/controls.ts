import * as THREE from "three";
import { applyRig, clampRig, type CameraRig } from "./camera";

const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
const ndc = new THREE.Vector2();

function tablePoint(
  camera: THREE.PerspectiveCamera,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): THREE.Vector3 | null {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, camera);
  return ray.ray.intersectPlane(tablePlane, hit) ? hit.clone() : null;
}

function pinchGap(points: Array<{ x: number; y: number }>): number {
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

export function createCameraControls(
  camera: THREE.PerspectiveCamera,
  canvas: HTMLCanvasElement,
  rig: CameraRig,
) {
  const pointers = new Map<number, { x: number; y: number }>();
  let lastPinch = 0;
  let lastTable: THREE.Vector3 | null = null;
  let panning = false;

  function apply(): void {
    clampRig(rig);
    applyRig(camera, rig);
  }

  function zoomAt(anchor: THREE.Vector3 | null, factor: number): void {
    const next = THREE.MathUtils.clamp(rig.distance * factor, rig.minDistance, rig.maxDistance);
    const used = next / rig.distance;
    rig.distance = next;
    if (anchor && Math.abs(used - 1) > 0.0001) {
      rig.target.lerp(anchor, 1 - used);
    }
    rig.userMoved = true;
    apply();
  }

  function mid(a: { x: number; y: number }, b: { x: number; y: number }) {
    return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
  }

  function onPointerDown(event: PointerEvent): void {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      lastTable = tablePoint(camera, canvas, event.clientX, event.clientY);
      lastPinch = 0;
    }
    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      lastPinch = pinchGap(pts);
      const center = mid(pts[0], pts[1]);
      lastTable = tablePoint(camera, canvas, center.x, center.y);
      panning = true;
    }
  }

  function onPointerMove(event: PointerEvent): "camera" | null {
    if (!pointers.has(event.pointerId)) return panning ? "camera" : null;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size >= 2) {
      const pts = [...pointers.values()];
      const gap = pinchGap(pts);
      if (lastPinch > 0 && gap > 0) zoomAt(lastTable, lastPinch / gap);
      lastPinch = gap;
      const center = mid(pts[0], pts[1]);
      const point = tablePoint(camera, canvas, center.x, center.y);
      if (point && lastTable) {
        rig.target.add(lastTable).sub(point);
        rig.userMoved = true;
        apply();
      }
      lastTable = tablePoint(camera, canvas, center.x, center.y);
      panning = true;
      return "camera";
    }

    if (panning) {
      const point = tablePoint(camera, canvas, event.clientX, event.clientY);
      if (point && lastTable) {
        rig.target.add(lastTable).sub(point);
        rig.userMoved = true;
        apply();
        lastTable = tablePoint(camera, canvas, event.clientX, event.clientY);
      }
      return "camera";
    }

    return null;
  }

  function beginPan(): void {
    panning = true;
  }

  function onPointerUp(event: PointerEvent): void {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) lastPinch = 0;
    if (pointers.size === 0) {
      panning = false;
      lastTable = null;
    } else if (pointers.size === 1) {
      const left = [...pointers.values()][0];
      lastTable = tablePoint(camera, canvas, left.x, left.y);
    }
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault();
    const factor = Math.exp(event.deltaY * 0.0015);
    zoomAt(tablePoint(camera, canvas, event.clientX, event.clientY), factor);
  }

  function isGesturing(): boolean {
    return panning || pointers.size > 1;
  }

  function pointerCount(): number {
    return pointers.size;
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    beginPan,
    isGesturing,
    pointerCount,
    resetFlags: () => {
      pointers.clear();
      panning = false;
      lastTable = null;
      lastPinch = 0;
    },
  };
}
