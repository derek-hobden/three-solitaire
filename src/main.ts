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
if (!app) throw new Error("Missing #app");
