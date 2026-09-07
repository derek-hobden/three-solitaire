export const SUITS = ["spades", "hearts", "diamonds", "clubs"] as const;
export type Suit = (typeof SUITS)[number];
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
export type DrawCount = 1 | 3;

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
}

export type PileKind = "stock" | "waste" | "foundation" | "tableau";

export type PileId =
  | { kind: "stock" }
  | { kind: "waste" }
  | { kind: "foundation"; index: number }
  | { kind: "tableau"; index: number };

export interface Selection {
  from: PileId;
  startIndex: number;
}

export interface GameState {
  stock: Card[];
  waste: Card[];
  foundations: Card[][];
  tableau: Card[][];
  drawCount: DrawCount;
  moves: number;
  score: number;
  won: boolean;
}

export const RANK_LABELS: Record<Rank, string> = {
  1: "A",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
};

export const SUIT_GLYPH: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

export function isRed(suit: Suit): boolean {
  return suit === "hearts" || suit === "diamonds";
}

export function pileKey(id: PileId): string {
  return id.kind === "stock" || id.kind === "waste"
    ? id.kind
    : `${id.kind}-${id.index}`;
}

export function cloneCards(cards: Card[]): Card[] {
  return cards.map((card) => ({ ...card }));
}

export function cloneState(state: GameState): GameState {
  return {
    stock: cloneCards(state.stock),
    waste: cloneCards(state.waste),
    foundations: state.foundations.map(cloneCards),
    tableau: state.tableau.map(cloneCards),
    drawCount: state.drawCount,
    moves: state.moves,
    score: state.score,
    won: state.won,
  };
}

export function cardsEqual(a: Card, b: Card): boolean {
  return a.id === b.id && a.faceUp === b.faceUp;
}
