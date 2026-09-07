import * as THREE from "three";
import type { Card } from "../game/types";
import { CARD_H, CARD_T, CARD_W } from "./layout";
import { getBackTexture, getFaceTexture } from "./textures";

export interface CardView {
  card: Card;
  mesh: THREE.Mesh;
  target: THREE.Vector3;
  hover: number;
}

const geometry = new THREE.BoxGeometry(CARD_W, CARD_T, CARD_H);

export function createCardMesh(card: Card): THREE.Mesh {
  const face = new THREE.MeshStandardMaterial({
    map: getFaceTexture(card),
    roughness: 0.38,
    metalness: 0.04,
  });
  const back = new THREE.MeshStandardMaterial({
    map: getBackTexture(),
    roughness: 0.42,
    metalness: 0.05,
  });
  const edge = new THREE.MeshStandardMaterial({
    color: "#efe6d4",
    roughness: 0.6,
    metalness: 0.02,
  });

  const materials = [edge, edge, face, back, edge, edge];
  const mesh = new THREE.Mesh(geometry, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.cardId = card.id;
  return mesh;
}

export function setCardFace(view: CardView, faceUp: boolean): void {
  view.card.faceUp = faceUp;
}
