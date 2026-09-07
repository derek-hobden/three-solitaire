import * as THREE from "three";
import { RANK_LABELS, SUIT_GLYPH, isRed, type Card } from "../game/types";

const faceCache = new Map<string, THREE.CanvasTexture>();
let backTexture: THREE.CanvasTexture | null = null;
let feltTexture: THREE.CanvasTexture | null = null;
let woodTexture: THREE.CanvasTexture | null = null;

function canvasTexture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");
  paint(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function getFaceTexture(card: Card): THREE.CanvasTexture {
  const cached = faceCache.get(card.id);
  if (cached) return cached;

  const ink = isRed(card.suit) ? "#b4232c" : "#1b1f23";
  const glyph = SUIT_GLYPH[card.suit];
  const rank = RANK_LABELS[card.rank];

  const texture = canvasTexture(512, 720, (ctx) => {
    ctx.fillStyle = "#f7f1e4";
    roundRect(ctx, 0, 0, 512, 720, 36);
    ctx.fill();

    ctx.strokeStyle = "#d7c8aa";
    ctx.lineWidth = 10;
    roundRect(ctx, 16, 16, 480, 688, 28);
    ctx.stroke();

    ctx.fillStyle = ink;
    ctx.font = "700 92px 'Source Sans 3', sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(rank, 36, 28);
    ctx.font = "88px serif";
    ctx.fillText(glyph, 36, 118);

    ctx.save();
    ctx.translate(512, 720);
    ctx.rotate(Math.PI);
    ctx.font = "700 92px 'Source Sans 3', sans-serif";
    ctx.fillText(rank, 36, 28);
    ctx.font = "88px serif";
    ctx.fillText(glyph, 36, 118);
    ctx.restore();

    ctx.font = `${card.rank === 1 ? 280 : 196}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(glyph, 256, 370);
  });

  faceCache.set(card.id, texture);
  return texture;
}

export function getBackTexture(): THREE.CanvasTexture {
  if (backTexture) return backTexture;
  backTexture = canvasTexture(512, 720, (ctx) => {
    ctx.fillStyle = "#1b2a4a";
    roundRect(ctx, 0, 0, 512, 720, 36);
    ctx.fill();

    const stripe = ctx.createLinearGradient(0, 0, 512, 720);
    stripe.addColorStop(0, "#27406f");
    stripe.addColorStop(1, "#132038");
    ctx.fillStyle = stripe;
    roundRect(ctx, 22, 22, 468, 676, 28);
    ctx.fill();

    ctx.strokeStyle = "#d7b56d";
    ctx.lineWidth = 8;
    roundRect(ctx, 40, 40, 432, 640, 22);
    ctx.stroke();

    ctx.fillStyle = "rgba(215, 181, 109, 0.16)";
    for (let y = 80; y < 640; y += 36) {
      for (let x = 70; x < 450; x += 36) {
        ctx.beginPath();
        ctx.arc(x + ((y / 36) % 2) * 10, y, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = "#d7b56d";
    ctx.font = "72px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("♠ ♥ ♦ ♣", 256, 360);
  });
  return backTexture;
}

export function getFeltTexture(): THREE.CanvasTexture {
  if (feltTexture) return feltTexture;
  feltTexture = canvasTexture(1024, 1024, (ctx) => {
    ctx.fillStyle = "#0f4a38";
    ctx.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 14000; i += 1) {
      const shade = 18 + Math.floor(Math.random() * 28);
      ctx.fillStyle = `rgba(${shade}, ${70 + shade}, ${40 + shade * 0.4}, 0.18)`;
      ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2);
    }
    const vignette = ctx.createRadialGradient(512, 512, 120, 512, 512, 620);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.28)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, 1024, 1024);
  });
  feltTexture.wrapS = THREE.RepeatWrapping;
  feltTexture.wrapT = THREE.RepeatWrapping;
  feltTexture.repeat.set(2.2, 1.6);
  return feltTexture;
}

export function getWoodTexture(): THREE.CanvasTexture {
  if (woodTexture) return woodTexture;
  woodTexture = canvasTexture(512, 512, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, "#5b3418");
    gradient.addColorStop(0.5, "#7a4a24");
    gradient.addColorStop(1, "#4a2912");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = "rgba(30, 14, 6, 0.25)";
    for (let y = 8; y < 512; y += 14) {
      ctx.beginPath();
      ctx.moveTo(0, y + Math.sin(y) * 4);
      ctx.lineTo(512, y + Math.cos(y) * 6);
      ctx.stroke();
    }
  });
  return woodTexture;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
