import { createDeck, shuffle } from "./deck";
import {
  cloneState,
  isRed,
  type Card,
  type DrawCount,
  type GameState,
  type PileId,
  type Selection,
} from "./types";

export function deal(drawCount: DrawCount = 3, random = Math.random): GameState {
  const deck = shuffle(createDeck(), random);
  const tableau: Card[][] = Array.from({ length: 7 }, () => []);

  for (let col = 0; col < 7; col += 1) {
    for (let row = 0; row <= col; row += 1) {
      const card = deck.pop();
      if (!card) throw new Error("Deck exhausted while dealing");
      card.faceUp = row === col;
      tableau[col].push(card);
    }
  }

  return {
    stock: deck,
    waste: [],
    foundations: [[], [], [], []],
    tableau,
    drawCount,
    moves: 0,
    score: 0,
    won: false,
  };
}

export function getPile(state: GameState, id: PileId): Card[] {
  switch (id.kind) {
    case "stock":
      return state.stock;
    case "waste":
      return state.waste;
    case "foundation":
      return state.foundations[id.index];
    case "tableau":
      return state.tableau[id.index];
  }
}

export function topCard(pile: Card[]): Card | undefined {
  return pile[pile.length - 1];
}

export function isAlternatingDescending(upper: Card, lower: Card): boolean {
  return upper.rank === lower.rank + 1 && isRed(upper.suit) !== isRed(lower.suit);
}

export function canPlaceOnTableau(card: Card, destTop: Card | undefined): boolean {
  if (!destTop) return card.rank === 13;
  return destTop.faceUp && isAlternatingDescending(destTop, card);
}

export function canPlaceOnFoundation(card: Card, destTop: Card | undefined): boolean {
  if (!destTop) return card.rank === 1;
  return destTop.suit === card.suit && card.rank === destTop.rank + 1;
}

export function isFaceUpRun(cards: Card[]): boolean {
  if (cards.length === 0 || cards.some((card) => !card.faceUp)) return false;
  for (let i = 0; i < cards.length - 1; i += 1) {
    if (!isAlternatingDescending(cards[i], cards[i + 1])) return false;
  }
  return true;
}

export function selectionCards(state: GameState, selection: Selection): Card[] {
  return getPile(state, selection.from).slice(selection.startIndex);
}

export function canSelect(state: GameState, selection: Selection): boolean {
  const pile = getPile(state, selection.from);
  if (selection.startIndex < 0 || selection.startIndex >= pile.length) return false;

  switch (selection.from.kind) {
    case "stock":
      return false;
    case "waste":
    case "foundation":
      return selection.startIndex === pile.length - 1 && pile[selection.startIndex].faceUp;
    case "tableau":
      return isFaceUpRun(pile.slice(selection.startIndex));
  }
}

export function canMove(state: GameState, selection: Selection, dest: PileId): boolean {
  if (!canSelect(state, selection)) return false;
  if (samePile(selection.from, dest)) return false;

  const moving = selectionCards(state, selection);
  if (moving.length === 0) return false;

  if (dest.kind === "stock" || dest.kind === "waste") return false;

  if (dest.kind === "foundation") {
    return moving.length === 1 && canPlaceOnFoundation(moving[0], topCard(getPile(state, dest)));
  }

  return canPlaceOnTableau(moving[0], topCard(getPile(state, dest)));
}

export function draw(state: GameState): GameState {
  const next = cloneState(state);

  if (next.stock.length === 0) {
    if (next.waste.length === 0) return state;
    next.stock = next.waste.reverse().map((card) => ({ ...card, faceUp: false }));
    next.waste = [];
    next.moves += 1;
    next.score = Math.max(0, next.score - 20);
    return next;
  }

  const count = Math.min(next.drawCount, next.stock.length);
  for (let i = 0; i < count; i += 1) {
    const card = next.stock.pop();
    if (!card) break;
    next.waste.push({ ...card, faceUp: true });
  }
  next.moves += 1;
  return next;
}

export function moveCards(state: GameState, selection: Selection, dest: PileId): GameState {
  if (!canMove(state, selection, dest)) return state;

  const next = cloneState(state);
  const fromPile = getPile(next, selection.from);
  const moving = fromPile.splice(selection.startIndex);
  getPile(next, dest).push(...moving);

  revealTableau(next, selection.from);
  next.moves += 1;
  next.score += scoreForMove(selection.from, dest);
  next.won = next.foundations.every((pile) => pile.length === 13);
  if (next.won) next.score += 100;
  return next;
}

export function tryAutoFoundation(state: GameState, selection: Selection): GameState {
  if (!canSelect(state, selection)) return state;
  if (selectionCards(state, selection).length !== 1) return state;

  for (let index = 0; index < 4; index += 1) {
    const dest: PileId = { kind: "foundation", index };
    if (canMove(state, selection, dest)) {
      return moveCards(state, selection, dest);
    }
  }
  return state;
}

export function autoFinish(state: GameState): GameState {
  let current = state;
  let progressed = true;

  while (progressed && !current.won) {
    progressed = false;

    const wasteTop = topCard(current.waste);
    if (wasteTop) {
      const attempt = tryAutoFoundation(current, {
        from: { kind: "waste" },
        startIndex: current.waste.length - 1,
      });
      if (attempt !== current) {
        current = attempt;
        progressed = true;
        continue;
      }
    }

    for (let index = 0; index < 7; index += 1) {
      const pile = current.tableau[index];
      if (pile.length === 0) continue;
      const attempt = tryAutoFoundation(current, {
        from: { kind: "tableau", index },
        startIndex: pile.length - 1,
      });
      if (attempt !== current) {
        current = attempt;
        progressed = true;
        break;
      }
    }
  }

  return current;
}

export function canAutoFinish(state: GameState): boolean {
  if (state.stock.length > 0 || state.waste.length > 0) return false;
  return state.tableau.every((pile) => pile.every((card) => card.faceUp));
}

export interface Hint {
  label: string;
  from: PileId;
  dest?: PileId;
}

export function findHint(state: GameState): Hint | null {
  const tries: Array<{ selection: Selection; dest: PileId; label: string }> = [];

  if (state.waste.length > 0) {
    const selection = { from: { kind: "waste" } as PileId, startIndex: state.waste.length - 1 };
    collectDestinations(state, selection, tries, describeCard(topCard(state.waste)!));
  }

  for (let index = 0; index < 7; index += 1) {
    const pile = state.tableau[index];
    for (let startIndex = 0; startIndex < pile.length; startIndex += 1) {
      const selection = { from: { kind: "tableau", index } as PileId, startIndex };
      if (!canSelect(state, selection)) continue;
      collectDestinations(
        state,
        selection,
        tries,
        startIndex === pile.length - 1
          ? describeCard(pile[startIndex])
          : `${describeCard(pile[startIndex])} stack`,
      );
    }
  }

  const useful = tries.find((move) => !isUselessKingShift(state, move.selection, move.dest));
  if (useful) return { label: useful.label, from: useful.selection.from, dest: useful.dest };

  if (state.stock.length > 0 || state.waste.length > 0) {
    return { label: "Draw from the stock", from: { kind: "stock" } };
  }
  return null;
}

function collectDestinations(
  state: GameState,
  selection: Selection,
  out: Array<{ selection: Selection; dest: PileId; label: string }>,
  subject: string,
): void {
  for (let index = 0; index < 4; index += 1) {
    const dest: PileId = { kind: "foundation", index };
    if (canMove(state, selection, dest)) {
      out.push({ selection, dest, label: `Move ${subject} to a foundation` });
    }
  }
  for (let index = 0; index < 7; index += 1) {
    const dest: PileId = { kind: "tableau", index };
    if (canMove(state, selection, dest)) {
      out.push({ selection, dest, label: `Move ${subject} to a column` });
    }
  }
}

function isUselessKingShift(state: GameState, selection: Selection, dest: PileId): boolean {
  if (dest.kind !== "tableau") return false;
  const moving = selectionCards(state, selection);
  if (moving[0]?.rank !== 13) return false;
  if (selection.from.kind !== "tableau") return false;
  return selection.startIndex === 0;
}

function describeCard(card: Card): string {
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const suits = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };
  return `${ranks[card.rank - 1]}${suits[card.suit]}`;
}

function revealTableau(state: GameState, from: PileId): void {
  if (from.kind !== "tableau") return;
  const pile = state.tableau[from.index];
  const top = topCard(pile);
  if (top && !top.faceUp) {
    top.faceUp = true;
    state.score += 5;
  }
}

function scoreForMove(from: PileId, dest: PileId): number {
  if (dest.kind === "foundation") return 10;
  if (from.kind === "waste" && dest.kind === "tableau") return 5;
  if (from.kind === "foundation" && dest.kind === "tableau") return -15;
  return 0;
}

function samePile(a: PileId, b: PileId): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "stock" || a.kind === "waste") return true;
  return a.index === (b as { index: number }).index;
}

export function setDrawCount(state: GameState, drawCount: DrawCount): GameState {
  if (state.drawCount === drawCount) return state;
  return { ...cloneState(state), drawCount };
}
