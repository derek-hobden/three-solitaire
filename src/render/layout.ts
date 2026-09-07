import type { GameState, PileId } from "../game/types";

export const CARD_W = 1.12;
export const CARD_H = 1.58;
export const CARD_T = 0.034;
export const STACK_LIFT = 0.018;

export interface LayoutProfile {
  spacing: number;
  topZ: number;
  tableauZ: number;
  tableauGap: number;
}

const DESKTOP: LayoutProfile = {
  spacing: 1.5,
  topZ: -3.15,
  tableauZ: -1.15,
  tableauGap: 0.28,
};

const TABLET: LayoutProfile = {
  spacing: 1.32,
  topZ: -2.85,
  tableauZ: -1.0,
  tableauGap: 0.26,
};

const PHONE: LayoutProfile = {
  spacing: 1.16,
  topZ: -2.55,
  tableauZ: -0.78,
  tableauGap: 0.34,
};

let profile: LayoutProfile = DESKTOP;

export function currentLayout(): LayoutProfile {
  return profile;
}

export function layoutForViewport(width: number, height: number): LayoutProfile {
  const aspect = width / Math.max(height, 1);
  if (aspect < 0.78) return PHONE;
  if (aspect < 1.05) return TABLET;
  return DESKTOP;
}

export function setLayout(next: LayoutProfile): boolean {
  if (
    next.spacing === profile.spacing &&
    next.topZ === profile.topZ &&
    next.tableauZ === profile.tableauZ &&
    next.tableauGap === profile.tableauGap
  ) {
    return false;
  }
  profile = next;
  return true;
}

export function pileAnchor(id: PileId): { x: number; z: number } {
  const { spacing, topZ, tableauZ } = profile;
  const left = -3 * spacing;
  switch (id.kind) {
    case "stock":
      return { x: left, z: topZ };
    case "waste":
      return { x: left + spacing, z: topZ };
    case "foundation":
      return { x: left + (3 + id.index) * spacing, z: topZ };
    case "tableau":
      return { x: left + id.index * spacing, z: tableauZ };
  }
}

export interface SlotPose {
  x: number;
  y: number;
  z: number;
}

export function cardPose(state: GameState, id: PileId, index: number): SlotPose {
  const anchor = pileAnchor(id);
  const pile =
    id.kind === "stock"
      ? state.stock
      : id.kind === "waste"
        ? state.waste
        : id.kind === "foundation"
          ? state.foundations[id.index]
          : state.tableau[id.index];

  if (id.kind === "tableau") {
    return {
      x: anchor.x,
      y: CARD_T * 0.5 + index * STACK_LIFT,
      z: anchor.z + index * profile.tableauGap,
    };
  }

  if (id.kind === "waste") {
    const fromEnd = pile.length - 1 - index;
    const fan = Math.min(2, Math.max(0, 2 - fromEnd));
    return {
      x: anchor.x + fan * 0.18,
      y: CARD_T * 0.5 + index * STACK_LIFT,
      z: anchor.z,
    };
  }

  return {
    x: anchor.x,
    y: CARD_T * 0.5 + index * STACK_LIFT,
    z: anchor.z,
  };
}

export function playBounds() {
  const { spacing, topZ, tableauZ, tableauGap } = profile;
  const left = -3 * spacing;
  const right = 3 * spacing;
  return {
    minX: left - CARD_W * 0.55,
    maxX: right + CARD_W * 0.55,
    minZ: topZ - CARD_H * 0.55,
    maxZ: tableauZ + 6 * tableauGap + CARD_H * 0.55,
  };
}

export const ALL_SLOTS: PileId[] = [
  { kind: "stock" },
  { kind: "waste" },
  ...[0, 1, 2, 3].map((index) => ({ kind: "foundation" as const, index })),
  ...[0, 1, 2, 3, 4, 5, 6].map((index) => ({ kind: "tableau" as const, index })),
];
