/**
 * `RoomLayout.particles` の複数スロット対応ヘルパ。
 * particles は `ParticleSpec | ParticleSpec[]`（単一は従来の Generator / Modifier がそのまま代入する形）。
 *  - particleList(L): 配列に正規化して読む（undefined → []）。
 *  - addParticles(L, spec): スロットを足す（単一なら配列に昇格）。
 *  - replaceParticles(L, type, spec): 同じ type のスロットを取り除いてから足す（ParticleDetail が使う。Generator の別 type は残る）。
 */
import type { ParticleSpec, ParticleType, RoomLayout } from './layout';

export function particleList(L: RoomLayout): ParticleSpec[] {
  const p = L.particles;
  if (!p) return [];
  return Array.isArray(p) ? p : [p];
}

export function addParticles(L: RoomLayout, ...specs: ParticleSpec[]): void {
  if (specs.length === 0) return;
  L.particles = [...particleList(L), ...specs];
}

export function replaceParticles(L: RoomLayout, type: ParticleType, spec: ParticleSpec): void {
  L.particles = [...particleList(L).filter((s) => s.type !== type), spec];
}
