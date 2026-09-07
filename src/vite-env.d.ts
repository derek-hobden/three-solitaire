/// <reference types="vite/client" />

interface SolitaireDebug {
  getState: () => import("./game/types").GameState;
  draw: () => void;
  newGame: () => void;
  screenOf: (cardId: string) => { x: number; y: number } | null;
}

interface Window {
  __solitaire: SolitaireDebug;
}
