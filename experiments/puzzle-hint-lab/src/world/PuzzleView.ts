/**
 * ボタンと、動く手がかり（点滅する灯り・色を変える灯り）。押す・判定する・光らせる。
 *
 * - 押したボタンは光り、下に押した順の数字が出る。全部押したら判定（途中では正誤を出さない）
 * - 正解: 部屋を制圧（ボタンは橙のまま）。不正解: 赤く 3 回点滅して全部戻る（その間は押せない）
 * - 点滅の灯り: 部屋の灯りはそろって始まり、1 回に n 回点滅して休む（数を比べられるように）
 * - 色を変える灯り: 色を 1 つずつ灯し、全部灯したら暗く休む（暗い後が始まり）
 */
import * as THREE from 'three';
import { wallPoint } from '../gen/puzzles.ts';
import { isCorrect, type World } from '../gen/world.ts';
import type { GlyphAtlas } from './Glyphs.ts';
import { COLOR_HEX, wallYaw } from './WorldView.ts';

export type PressResult =
  | { kind: 'none' }
  /** 押した（order は 1 から） */
  | { kind: 'pressed'; order: number }
  | { kind: 'solved'; order: number }
  | { kind: 'wrong'; order: number }
  /** 制圧済みの部屋 */
  | { kind: 'locked' };

export interface ButtonView {
  room: number;
  index: number;
  cap: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  color: THREE.Color;
  digit: THREE.Mesh;
  lamp: THREE.MeshBasicMaterial | null;
  blink: number;
  push: number;
}

interface RoomState {
  pressed: number[];
  /** 不正解の点滅を始めた時刻（0 は点滅していない） */
  failAt: number;
  solved: boolean;
}

const NEUTRAL = 0xe6ebf1;
const SOLVED = new THREE.Color(0xff9a3c);
const WRONG = new THREE.Color(0xff3b4e);
const PRESSED_GLOW = new THREE.Color(0x8ff3ff);
const LAMP_ON = new THREE.Color(0xfff1c4);
const LAMP_OFF = new THREE.Color(0x30353d);
/** 点滅: 1 回 0.5 s（点いている 0.22 s）、最大 3 回の後に休む */
const BLINK_CYCLE = 2.9;
/** 不正解の点滅の長さ（s） */
const FAIL_TIME = 0.95;
const CAP_Z = 0.05;

export class PuzzleView {
  readonly group = new THREE.Group();
  private readonly rooms: ButtonView[][];
  private readonly lights: { mat: THREE.MeshBasicMaterial; colors: THREE.Color[] }[] = [];
  private readonly state: RoomState[];
  private readonly caps: THREE.Object3D[][];
  private readonly world: World;
  private hover: ButtonView | null = null;
  private time = 0;

  constructor(world: World, atlas: GlyphAtlas) {
    this.world = world;
    this.state = world.puzzles.map(() => ({ pressed: [], failAt: 0, solved: false }));
    const capGeo = new THREE.CylinderGeometry(0.075, 0.078, 0.05, 40);
    capGeo.rotateX(Math.PI / 2);
    const ringGeo = new THREE.TorusGeometry(0.094, 0.006, 8, 48);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ae, metalness: 0.6, roughness: 0.35 });
    const lampGeo = new THREE.SphereGeometry(0.032, 20, 12);
    const digitMats = new Map<number, THREE.MeshBasicMaterial>();
    const digitGeo = (k: number): THREE.PlaneGeometry => {
      const g = atlas.monoRun(String(k))[0]!;
      const h = 0.085;
      const geo = new THREE.PlaneGeometry(h * g.aspect, h);
      const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
      const [u0, v0, u1, v1] = g.uv;
      // PlaneGeometry の uv: 左上 (0,1)・右上 (1,1)・左下 (0,0)・右下 (1,0)
      uv.setXY(0, u0, v1);
      uv.setXY(1, u1, v1);
      uv.setXY(2, u0, v0);
      uv.setXY(3, u1, v0);
      return geo;
    };
    const digitGeos = [1, 2, 3, 4, 5].map(digitGeo);

    this.rooms = world.puzzles.map((p) => {
      const rect = world.rooms[p.room].rect;
      return p.buttons.map((b, index) => {
        const at = wallPoint(rect, b.mount.side, b.mount.u);
        const group = new THREE.Group();
        group.position.set(at.x, b.mount.y, at.z);
        group.rotation.y = wallYaw(b.mount.side);
        const color = new THREE.Color(b.color ? COLOR_HEX[b.color] : NEUTRAL);
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.04, emissive: color.clone(), emissiveIntensity: 0.12 });
        const cap = new THREE.Mesh(capGeo, mat);
        cap.position.z = CAP_Z;
        cap.userData.button = true;
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.z = 0.027;
        let dm = digitMats.get(0);
        if (!dm) digitMats.set(0, (dm = new THREE.MeshBasicMaterial({ map: atlas.texture, color: 0x8ff3ff, transparent: true, depthWrite: false })));
        const digit = new THREE.Mesh(digitGeos[0], dm);
        digit.position.set(0, -0.2, 0.012);
        digit.visible = false;
        group.add(cap, ring, digit);
        let lamp: THREE.MeshBasicMaterial | null = null;
        if (b.blink > 0) {
          lamp = new THREE.MeshBasicMaterial({ color: LAMP_OFF.clone() });
          const m = new THREE.Mesh(lampGeo, lamp);
          m.position.set(0, 0.21, 0.014);
          group.add(m);
        }
        this.group.add(group);
        const view: ButtonView = { room: p.room, index, cap, mat, color, digit, lamp, blink: b.blink, push: 0 };
        // 数字の形は押した順で差し替える
        view.digit.userData.geos = digitGeos;
        return view;
      });
    });
    this.caps = this.rooms.map((bs) => bs.map((b) => b.cap));

    // 色を変える灯り
    const discGeo = new THREE.CircleGeometry(0.115, 40);
    for (const p of world.puzzles) {
      for (const c of p.clues) {
        if (c.kind !== 'lights') continue;
        const rect = world.rooms[c.mount.room].rect;
        const at = wallPoint(rect, c.mount.side, c.mount.u);
        const mat = new THREE.MeshBasicMaterial({ color: LAMP_OFF.clone() });
        const disc = new THREE.Mesh(discGeo, mat);
        disc.position.set(at.x + at.nx * 0.042, c.mount.y, at.z + at.nz * 0.042);
        disc.rotation.y = wallYaw(c.mount.side);
        this.group.add(disc);
        this.lights.push({ mat, colors: c.colors.map((k) => new THREE.Color(COLOR_HEX[k])) });
      }
    }
  }

  isSolved(room: number): boolean {
    return this.state[room].solved;
  }

  /** 制圧の状態を合わせる（保存からの復元・デバッグ・初期化） */
  setSolved(room: number, solved: boolean): void {
    const s = this.state[room];
    s.solved = solved;
    s.pressed = [];
    s.failAt = 0;
    for (const b of this.rooms[room]) b.digit.visible = false;
  }

  /** 部屋 room の index 番目（左から）のボタン */
  button(room: number, index: number): ButtonView | null {
    return this.rooms[room]?.[index] ?? null;
  }

  /** 部屋の押した数と、不正解の点滅中か */
  sequence(room: number): { pressed: number; failing: boolean } {
    const s = this.state[room];
    return { pressed: s.pressed.length, failing: s.failAt > 0 };
  }

  /** 照準の先のボタン（部屋 room のボタンだけ。届く距離 reach） */
  pick(ray: THREE.Raycaster, room: number, reach: number): ButtonView | null {
    if (room < 0) return null;
    ray.far = reach;
    const hit = ray.intersectObjects(this.caps[room], false)[0];
    if (!hit) return null;
    return this.rooms[room].find((b) => b.cap === hit.object) ?? null;
  }

  setHover(b: ButtonView | null): void {
    this.hover = b && !this.state[b.room].solved ? b : null;
  }

  press(b: ButtonView): PressResult {
    const s = this.state[b.room];
    if (s.solved) return { kind: 'locked' };
    if (s.failAt > 0 || s.pressed.includes(b.index)) return { kind: 'none' };
    s.pressed.push(b.index);
    b.push = 1;
    const order = s.pressed.length;
    const geos = b.digit.userData.geos as THREE.PlaneGeometry[];
    b.digit.geometry = geos[Math.min(order, geos.length) - 1];
    b.digit.visible = this.rooms[b.room].length > 1;
    const p = this.world.puzzles[b.room];
    if (order < p.buttons.length) return { kind: 'pressed', order };
    if (isCorrect(p, s.pressed)) {
      this.setSolved(b.room, true);
      return { kind: 'solved', order };
    }
    s.failAt = this.time;
    return { kind: 'wrong', order };
  }

  update(dt: number): void {
    this.time += dt;
    const t = this.time;
    this.rooms.forEach((buttons, room) => {
      const s = this.state[room];
      let fail = 0;
      if (s.failAt > 0) {
        const e = t - s.failAt;
        if (e >= FAIL_TIME) {
          s.failAt = 0;
          s.pressed = [];
          for (const b of buttons) b.digit.visible = false;
        } else fail = Math.sin((e / FAIL_TIME) * Math.PI * 3) > 0 ? 1 : 0.25;
      }
      const phase = t % BLINK_CYCLE;
      for (const b of buttons) {
        b.push = Math.max(0, b.push - dt * 5);
        b.cap.position.z = CAP_Z - Math.sin(b.push * Math.PI) * 0.018;
        const pressed = s.pressed.includes(b.index);
        const hover = this.hover === b;
        if (s.solved) {
          b.mat.emissive.copy(SOLVED);
          b.mat.emissiveIntensity = 0.75;
        } else if (s.failAt > 0) {
          b.mat.emissive.copy(WRONG);
          b.mat.emissiveIntensity = fail * 1.2;
        } else if (pressed) {
          b.mat.emissive.copy(b.color).lerp(PRESSED_GLOW, 0.35);
          b.mat.emissiveIntensity = 1.0;
        } else {
          b.mat.emissive.copy(b.color);
          b.mat.emissiveIntensity = hover ? 0.42 : 0.12;
        }
        b.cap.scale.setScalar(hover && !pressed ? 1.05 : 1);
        if (b.lamp) {
          const on = phase < b.blink * 0.5 && phase % 0.5 < 0.22;
          b.lamp.color.copy(on ? LAMP_ON : LAMP_OFF);
        }
      }
    });
    for (const l of this.lights) {
      const n = l.colors.length;
      const cycle = n * 0.95 + 1.6;
      const e = t % cycle;
      const k = Math.floor(e / 0.95);
      const on = k < n && e % 0.95 < 0.75;
      l.mat.color.copy(on ? l.colors[k] : LAMP_OFF);
    }
  }
}
