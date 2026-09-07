import { getPile } from "./klondike";
import type { GameState, PileId } from "./types";

const PILES: PileId[] = [
  { kind: "stock" },
  { kind: "waste" },
  ...[0, 1, 2, 3].map((index) => ({ kind: "foundation" as const, index })),
  ...[0, 1, 2, 3, 4, 5, 6].map((index) => ({ kind: "tableau" as const, index })),
];

export function locateCard(state: GameState, cardId: string): { pile: PileId; index: number } | null {
  for (const pile of PILES) {
    const index = getPile(state, pile).findIndex((card) => card.id === cardId);
    if (index >= 0) return { pile, index };
  }
  return null;
}
