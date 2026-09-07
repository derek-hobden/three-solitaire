import { createDeck, shuffle } from "./deck";
import {
  canMove,
  canPlaceOnFoundation,
  canPlaceOnTableau,
  deal,
  draw,
  isFaceUpRun,
  moveCards,
  tryAutoFoundation,
} from "./klondike";
import type { Card, GameState, Rank, Suit } from "./types";

function card(suit: Suit, rank: Rank, faceUp = true): Card {
  return { id: `${suit}-${rank}`, suit, rank, faceUp };
}

function emptyState(overrides: Partial<GameState> = {}): GameState {
  return {
    stock: [],
    waste: [],
    foundations: [[], [], [], []],
    tableau: [[], [], [], [], [], [], []],
    drawCount: 1,
    moves: 0,
    score: 0,
    won: false,
    ...overrides,
  };
}

const tests: Array<[string, () => void]> = [
  [
    "deals 52 cards into klondike layout",
    () => {
      const state = deal(3, () => 0.5);
      const count =
        state.stock.length +
        state.waste.length +
        state.foundations.flat().length +
        state.tableau.flat().length;
      if (count !== 52) throw new Error(`expected 52 cards, got ${count}`);
      if (state.tableau.some((pile, index) => pile.length !== index + 1)) {
        throw new Error("tableau deal sizes are wrong");
      }
      if (state.tableau.some((pile) => !pile[pile.length - 1].faceUp)) {
        throw new Error("tableau tops should be face up");
      }
    },
  ],
  [
    "shuffle keeps every card",
    () => {
      const deck = createDeck();
      const shuffled = shuffle(deck, () => 0.2);
      if (shuffled.length !== 52) throw new Error("shuffle lost cards");
      if (new Set(shuffled.map((c) => c.id)).size !== 52) throw new Error("duplicate cards");
    },
  ],
  [
    "tableau placement follows alternating descending ranks",
    () => {
      if (!canPlaceOnTableau(card("hearts", 12), card("spades", 13))) {
        throw new Error("Qh should go on Ks");
      }
      if (canPlaceOnTableau(card("hearts", 12), card("hearts", 13))) {
        throw new Error("same color should be illegal");
      }
      if (!canPlaceOnTableau(card("spades", 13), undefined)) {
        throw new Error("king should fill an empty column");
      }
    },
  ],
  [
    "foundations build ace through king by suit",
    () => {
      if (!canPlaceOnFoundation(card("clubs", 1), undefined)) throw new Error("ace first");
      if (!canPlaceOnFoundation(card("clubs", 2), card("clubs", 1))) throw new Error("two on ace");
      if (canPlaceOnFoundation(card("spades", 2), card("clubs", 1))) throw new Error("wrong suit");
    },
  ],
  [
    "draws from stock and recycles waste",
    () => {
      let state = emptyState({
        stock: [card("spades", 2, false), card("spades", 1, false)],
        drawCount: 3,
      });
      state = draw(state);
      if (state.waste.length !== 2 || state.stock.length !== 0) throw new Error("draw failed");
      state = draw(state);
      if (state.stock.length !== 2 || state.waste.length !== 0) throw new Error("recycle failed");
      if (state.stock.some((c) => c.faceUp)) throw new Error("recycled cards should be face down");
    },
  ],
  [
    "moves a tableau run onto a valid column",
    () => {
      const state = emptyState({
        tableau: [[card("spades", 13), card("hearts", 12)], [card("clubs", 13)], [], [], [], [], []],
      });
      if (!isFaceUpRun(state.tableau[0])) throw new Error("run should be valid");
      const next = moveCards(state, { from: { kind: "tableau", index: 0 }, startIndex: 0 }, { kind: "tableau", index: 2 });
      if (next.tableau[2].length !== 2) throw new Error("run did not move");
      if (next.tableau[0].length !== 0) throw new Error("source should be empty");
    },
  ],
  [
    "auto-sends a waste ace to a foundation",
    () => {
      const state = emptyState({ waste: [card("diamonds", 1)] });
      const next = tryAutoFoundation(state, {
        from: { kind: "waste" },
        startIndex: 0,
      });
      if (next.foundations.flat().length !== 1) throw new Error("ace did not auto-move");
      if (!canMove(state, { from: { kind: "waste" }, startIndex: 0 }, { kind: "foundation", index: 0 })) {
        throw new Error("ace should be legal on empty foundation");
      }
    },
  ],
];

let failed = 0;
for (const [name, run] of tests) {
  try {
    run();
    console.log(`ok  ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`fail  ${name}`);
    console.error(error);
  }
}

if (failed > 0) {
  process.exit(1);
}
console.log(`\n${tests.length} tests passed`);
