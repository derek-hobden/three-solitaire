import { SUITS, type Card, type Rank } from "./types";

export function createDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank += 1) {
      cards.push({
        id: `${suit}-${rank}`,
        suit,
        rank: rank as Rank,
        faceUp: false,
      });
    }
  }
  return cards;
}

export function shuffle<T>(items: T[], random = Math.random): T[] {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}
