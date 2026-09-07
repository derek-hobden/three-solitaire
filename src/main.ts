import "./style.css";
import * as THREE from "three";
import {
  autoFinish,
  canAutoFinish,
  canSelect,
  deal,
  draw,
  findHint,
  getPile,
  moveCards,
  setDrawCount,
  tryAutoFoundation,
} from "./game/klondike";
import { locateCard } from "./game/locate";
import { cloneState, pileKey, type GameState, type PileId, type Selection } from "./game/types";
import { createCardMesh, setCardFace, type CardView } from "./render/cards";
import {
  ALL_SLOTS,
  CARD_H,
  CARD_W,
  cardPose,
  layoutForViewport,
  pileAnchor,
  setLayout,
} from "./render/layout";
import { createCameraControls } from "./render/controls";
import { createWorld } from "./render/world";

const app = document.querySelector<HTMLDivElement>("#app");
<if (!app) throw new Error("Missing #app");

const hud = {
  moves: document.querySelector<HTMLElement>("#moves")!,
  score: document.querySelector<HTMLElement>("#score")!,
  time: document.querySelector<HTMLElement>("#time")!,
  hintText: document.querySelector<HTMLParagraphElement>("#hint-text")!,
  win: document.querySelector<HTMLElement>("#win")!,
  winStats: document.querySelector<HTMLElement>("#win-stats")!,
  drawMode: document.querySelector<HTMLButtonElement>("#draw-mode")!,
  undo: document.querySelector<HTMLButtonElement>("#undo")!,
  auto: document.querySelector<HTMLButtonElement>("#auto")!,
};

setLayout(
  layoutForViewport(
    window.visualViewport?.width ?? window.innerWidth,
    window.visualViewport?.height ?? window.innerHeight,
  ),
);

const { scene, camera, renderer, resize, rig, resetView } = createWorld(app, () => {
  for (const pad of pads) {
    const anchor = pileAnchor(pad.userData.pile);
    pad.position.set(anchor.x, 0.004, anchor.z);
  }
  syncMeshes(state);
});
const camInput = createCameraControls(camera, renderer.domElement, rig);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPoint = new THREE.Vector3();
let lastFrame = performance.now();

const views = new Map<string, CardView>();
const pads: THREE.Mesh[] = [];
const history: GameState[] = [];
let state = deal(3);
let startedAt: number | null = null;
let elapsed = 0;
let hintTimer = 0;
let drag: {
  selection: Selection;
  ids: string[];
  offset: THREE.Vector3;
} | null = null;
let pending:
  | {
      cardId: string;
      x: number;
      y: number;
      selection: Selection;
    }
  | null = null;
let lastClick = { time: 0, cardId: "" };

for (const id of ALL_SLOTS) {
  const pad = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W * 1.08, CARD_H * 1.08),
    new THREE.MeshStandardMaterial({
      color: id.kind === "foundation" ? "#163f32" : "#0d3328",
      roughness: 1,
      transparent: true,
      opacity: 0.55,
    }),
  );
  const anchor = pileAnchor(id);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(anchor.x, 0.004, anchor.z);
  pad.userData.pile = id;
  pad.receiveShadow = true;
  scene.add(pad);
  pads.push(pad);
}

function allCards(game: GameState) {
  return [...game.stock, ...game.waste, ...game.foundations.flat(), ...game.tableau.flat()];
}

function syncMeshes(game: GameState, snap = false): void {
  const live = new Set(allCards(game).map((card) => card.id));
  for (const [id, view] of views) {
    if (!live.has(id)) {
      scene.remove(view.mesh);
      views.delete(id);
    }
  }

  for (const card of allCards(game)) {
    let view = views.get(card.id);
    if (!view) {
      const mesh = createCardMesh(card);
      view = {
        card,
        mesh,
        target: new THREE.Vector3(),
        hover: 0,
      };
      mesh.rotation.x = card.faceUp ? 0 : Math.PI;
      scene.add(mesh);
      views.set(card.id, view);
    }
    view.card = card;
    setCardFace(view, card.faceUp);
    const found = locateCard(game, card.id);
    if (!found) continue;
    const pose = cardPose(game, found.pile, found.index);
    view.target.set(pose.x, pose.y, pose.z);
    if (snap || !view.mesh.userData.placed) {
      view.mesh.position.copy(view.target);
      view.mesh.userData.placed = true;
    }
  }
}

function apply(next: GameState, record = true): void {
  if (next === state) return;
  if (record) history.push(cloneState(state));
  if (history.length > 80) history.shift();
  if (!startedAt && next.moves > state.moves) startedAt = performance.now();
  state = next;
  syncMeshes(state);
  refreshHud();
}

function refreshHud(): void {
  hud.moves.textContent = String(state.moves);
  hud.score.textContent = String(state.score);
  hud.drawMode.textContent = state.drawCount === 3 ? "Draw 3" : "Draw 1";
  hud.drawMode.setAttribute("aria-pressed", state.drawCount === 3 ? "true" : "false");
  hud.undo.disabled = history.length === 0;
  hud.auto.disabled = !canAutoFinish(state) || state.won;
  hud.win.hidden = !state.won;
  if (state.won) {
    const seconds = Math.floor(elapsed);
    hud.winStats.textContent = `${state.moves} moves · ${state.score} points · ${formatTime(seconds)}`;
  }
}

function formatTime(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function ndcFromEvent(event: PointerEvent): void {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function intersectTable(event: PointerEvent): THREE.Vector3 | null {
  ndcFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.ray.intersectPlane(tablePlane, hitPoint) ? hitPoint.clone() : null;
}

function projectToScreen(x: number, y: number, z: number): { x: number; y: number } {
  const projected = new THREE.Vector3(x, y, z).project(camera);
  const rect = renderer.domElement.getBoundingClientRect();
  return {
    x: (projected.x * 0.5 + 0.5) * rect.width + rect.left,
    y: (-projected.y * 0.5 + 0.5) * rect.height + rect.top,
  };
}

function containsPoint(
  point: { x: number; y: number },
  corners: Array<{ x: number; y: number }>,
): boolean {
  let inside = false;
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i, i += 1) {
    const a = corners[i];
    const b = corners[j];
    const intersect = a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

function cardScreenQuad(cardId: string): Array<{ x: number; y: number }> | null {
  const view = views.get(cardId);
  if (!view) return null;
  const { x, y, z } = view.target;
  return [
    projectToScreen(x - CARD_W * 0.5, y, z - CARD_H * 0.5),
    projectToScreen(x + CARD_W * 0.5, y, z - CARD_H * 0.5),
    projectToScreen(x + CARD_W * 0.5, y, z + CARD_H * 0.5),
    projectToScreen(x - CARD_W * 0.5, y, z + CARD_H * 0.5),
  ];
}

function pickCardId(event: PointerEvent): string | null {
  let best: { id: string; z: number } | null = null;
  for (const [id, view] of views) {
    if (drag?.ids.includes(id)) continue;
    const quad = cardScreenQuad(id);
    if (!quad || !containsPoint({ x: event.clientX, y: event.clientY }, quad)) continue;
    if (!best || view.target.z > best.z) best = { id, z: view.target.z };
  }
  return best?.id ?? null;
}

function pickPile(event: PointerEvent): PileId | null {
  const cardId = pickCardId(event);
  if (cardId) return locateCard(state, cardId)?.pile ?? null;

  let best: { pile: PileId; dist: number } | null = null;
  for (const pile of ALL_SLOTS) {
    const top = getPile(state, pile).at(-1);
    const pose = top
      ? views.get(top.id)?.target
      : new THREE.Vector3(pileAnchor(pile).x, 0, pileAnchor(pile).z);
    if (!pose) continue;
    const screen = projectToScreen(pose.x, pose.y, pose.z);
    const dist = Math.hypot(screen.x - event.clientX, screen.y - event.clientY);
    if (dist < 54 && (!best || dist < best.dist)) best = { pile, dist };
  }
  return best?.pile ?? null;
}

function startDrag(cardId: string, event: PointerEvent): void {
  const found = locateCard(state, cardId);
  if (!found) return;

  if (found.pile.kind === "stock") {
    apply(draw(state));
    return;
  }

  const selection: Selection = { from: found.pile, startIndex: found.index };
  if (!canSelect(state, selection)) return;

  const now = performance.now();
  if (lastClick.cardId === cardId && now - lastClick.time < 500) {
    apply(tryAutoFoundation(state, selection));
    lastClick = { time: 0, cardId: "" };
    return;
  }
  lastClick = { time: now, cardId };
  pending = { cardId, x: event.clientX, y: event.clientY, selection };
}

function beginDrag(event: PointerEvent): void {
  if (!pending || drag) return;
  const point = intersectTable(event);
  const view = views.get(pending.cardId);
  if (!point || !view) return;
  const found = locateCard(state, pending.cardId);
  if (!found) return;
  drag = {
    selection: pending.selection,
    ids: getPile(state, found.pile)
      .slice(found.index)
      .map((card) => card.id),
    offset: view.mesh.position.clone().setY(0).sub(point.setY(0)),
  };
  pending = null;
}

function dropOn(dest: PileId | null): void {
  if (!drag) return;
  const selection = drag.selection;
  drag = null;
  if (dest && dest.kind !== "stock") {
    const next = moveCards(state, selection, dest);
    if (next !== state) {
      apply(next);
      return;
    }
  }
  syncMeshes(state);
}

function newGame(): void {
  history.length = 0;
  startedAt = null;
  elapsed = 0;
  drag = null;
  state = deal(state.drawCount);
  syncMeshes(state, true);
  refreshHud();
  showHint("Drag cards. Pinch to zoom, drag the felt to pan.");
}

function showHint(text: string): void {
  hud.hintText.hidden = false;
  hud.hintText.textContent = text;
  hintTimer = 3.4;
}

renderer.domElement.addEventListener("pointerdown", (event) => {
  camInput.onPointerDown(event);
  if (camInput.pointerCount() > 1) {
    pending = null;
    if (drag) dropOn(null);
    event.preventDefault();
    return;
  }
  if (state.won) return;
  const cardId = pickCardId(event);
  if (cardId) {
    startDrag(cardId, event);
    return;
  }
  if (pickPile(event)?.kind === "stock") apply(draw(state));
});

renderer.domElement.addEventListener("pointermove", (event) => {
  if (camInput.pointerCount() > 1) {
    pending = null;
    if (drag) dropOn(null);
    camInput.onPointerMove(event);
    return;
  }

  if (pending && Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > 7) {
    beginDrag(event);
  }

  const point = intersectTable(event);
  if (drag && point) {
    drag.ids.forEach((id, offset) => {
      const view = views.get(id);
      if (!view) return;
      view.target.set(
        point.x + drag!.offset.x,
        0.42 + offset * 0.03,
        point.z + drag!.offset.z + offset * 0.22,
      );
    });
    return;
  }

  if (!pending && !drag && camInput.pointerCount() === 1) {
    camInput.beginPan();
    camInput.onPointerMove(event);
    renderer.domElement.style.cursor = "grab";
    return;
  }

  if (camInput.isGesturing()) {
    camInput.onPointerMove(event);
    return;
  }

  const cardId = pickCardId(event);
  renderer.domElement.style.cursor = cardId || pickPile(event) ? "pointer" : "default";
  for (const view of views.values()) {
    view.hover = view.card.id === cardId ? 1 : 0;
  }
});

renderer.domElement.addEventListener("pointerup", (event) => {
  camInput.onPointerUp(event);
  if (drag) {
    dropOn(pickPile(event));
    return;
  }
  pending = null;
});

renderer.domElement.addEventListener("pointerleave", () => {
  camInput.resetFlags();
  pending = null;
  if (drag) dropOn(null);
});

renderer.domElement.addEventListener(
  "wheel",
  (event) => {
    camInput.onWheel(event);
  },
  { passive: false },
);

document.querySelector("#new-game")?.addEventListener("click", newGame);
document.querySelector("#play-again")?.addEventListener("click", newGame);
document.querySelector("#undo")?.addEventListener("click", () => {
  const previous = history.pop();
  if (!previous) return;
  state = previous;
  drag = null;
  syncMeshes(state);
  refreshHud();
});
document.querySelector("#hint")?.addEventListener("click", () => {
  const hint = findHint(state);
  showHint(hint?.label ?? "No useful move — try a new deal.");
  if (!hint) return;
  for (const view of views.values()) {
    const found = locateCard(state, view.card.id);
    view.hover = found && pileKey(found.pile) === pileKey(hint.from) ? 1 : 0;
  }
});
document.querySelector("#auto")?.addEventListener("click", () => {
  if (!canAutoFinish(state)) return;
  apply(autoFinish(state));
});
hud.drawMode.addEventListener("click", () => {
  apply(setDrawCount(state, state.drawCount === 3 ? 1 : 3), false);
});
document.querySelector("#reset-view")?.addEventListener("click", () => {
  resetView();
  showHint("View reset. Pinch or scroll to zoom, drag the felt to pan.");
});

window.addEventListener("keydown", (event) => {
  if (event.key === "n" || event.key === "N") newGame();
  if ((event.key === "z" || event.key === "Z") && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    hud.undo.click();
  }
});

syncMeshes(state);
refreshHud();
showHint("Pinch or scroll to zoom. Drag the felt to pan.");
requestAnimationFrame(() => {
  resize();
  requestAnimationFrame(resize);
});

function tick(): void {
  const now = performance.now();
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  if (startedAt && !state.won) {
    elapsed = (performance.now() - startedAt) / 1000;
    hud.time.textContent = formatTime(Math.floor(elapsed));
  }
  if (hintTimer > 0) {
    hintTimer -= dt;
    if (hintTimer <= 0) hud.hintText.hidden = true;
  }

  for (const view of views.values()) {
    const lift = (drag?.ids.includes(view.card.id) ? 0.08 : 0) + view.hover * 0.04;
    const goal = view.target.clone();
    goal.y += lift;
    view.mesh.position.lerp(goal, 1 - Math.pow(0.0008, dt));
    const flip = view.card.faceUp ? 0 : Math.PI;
    view.mesh.rotation.x = THREE.MathUtils.lerp(view.mesh.rotation.x, flip, 0.2);
    const materials = view.mesh.material as THREE.MeshStandardMaterial[];
    const glow = view.hover * 0.16;
    for (const material of materials) {
      material.emissive.set("#d7b56d");
      material.emissiveIntensity = glow;
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);

function screenOf(cardId: string): { x: number; y: number } | null {
  const view = views.get(cardId);
  if (!view) return null;
  const projected = view.target.clone().project(camera);
  const rect = renderer.domElement.getBoundingClientRect();
  return {
    x: (projected.x * 0.5 + 0.5) * rect.width + rect.left,
    y: (-projected.y * 0.5 + 0.5) * rect.height + rect.top,
  };
}

function pickAt(x: number, y: number) {
  const fake = { clientX: x, clientY: y } as PointerEvent;
  const cardId = pickCardId(fake);
  return { cardId, pile: pickPile(fake) };
}

Object.assign(window, {
  __solitaire: {
    getState: () => state,
    draw: () => apply(draw(state)),
    newGame,
    screenOf,
    pickAt,
    cameraDistance: () => rig.distance,
    resetView,
  },
});
