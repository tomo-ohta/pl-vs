import * as THREE from 'three';

/**
 * 表示板の図柄（キャンバスに手続きで描く）。室名の札・注意の表示・床の番号。1 枚の図柄（1024 × 1024）に 4 × 8 升。
 * 升は 256 × 128（横長の札。0.4 × 0.2 m 前後で貼る）
 */

export const SIGN_LIST = [
  { id: 'A', text: 'サーバー室 A', sub: 'SERVER ROOM A', bg: '#e8f6f8', fg: '#14404e' },
  { id: 'B', text: 'サーバー室 B', sub: 'SERVER ROOM B', bg: '#e8f6f8', fg: '#14404e' },
  { id: 'C', text: 'サーバー室 C', sub: 'SERVER ROOM C', bg: '#e8f6f8', fg: '#14404e' },
  { id: 'UPS', text: 'UPS 室', sub: 'UPS ROOM', bg: '#e8f6f8', fg: '#14404e' },
  { id: 'BAT', text: '蓄電池室', sub: 'BATTERY ROOM', bg: '#e8f6f8', fg: '#14404e' },
  { id: 'ELEC', text: '電気室', sub: 'ELECTRICAL', bg: '#e8f6f8', fg: '#14404e' },
  { id: 'GAS', text: '消火ガス ボンベ室', sub: 'FIRE SUPPRESSION', bg: '#e8f6f8', fg: '#14404e' },
  { id: 'STG', text: '開梱室', sub: 'STAGING', bg: '#e8f6f8', fg: '#14404e' },
  { id: 'NOC', text: '監視室', sub: 'NOC', bg: '#e8f6f8', fg: '#14404e' },
  { id: 'LIFT', text: '荷物用 EV', sub: 'FREIGHT', bg: '#e8f6f8', fg: '#14404e' },
  { id: 'DOCK', text: '荷捌き場', sub: 'LOADING DOCK', bg: '#e8f6f8', fg: '#14404e' },
  { id: 'AHU', text: '空調機械室', sub: 'AIR HANDLING', bg: '#e8f6f8', fg: '#14404e' },
  { id: 'STAFF', text: '関係者以外立入禁止', sub: 'AUTHORIZED ONLY', bg: '#c84a50', fg: '#ffffff' },
  { id: 'FIRE', text: '火気厳禁', sub: 'NO OPEN FLAME', bg: '#c84a50', fg: '#ffffff' },
  { id: 'GASW', text: '消火ガス放出注意', sub: 'CAUTION GAS', bg: '#e0c64e', fg: '#1a1a1a' },
  { id: 'VOLT', text: '高電圧 危険', sub: 'HIGH VOLTAGE', bg: '#e0c64e', fg: '#1a1a1a' },
  { id: 'COLD', text: 'COLD AISLE', sub: '扉を閉めること', bg: '#2a7a96', fg: '#e8f8fb' },
  { id: 'HOT', text: 'HOT AISLE', sub: '高温注意', bg: '#b6575c', fg: '#fff2f0' },
  { id: 'R01', text: 'ROW 01', sub: 'A01–A21', bg: '#1d4f62', fg: '#bff0fa' },
  { id: 'R02', text: 'ROW 02', sub: 'B01–B21', bg: '#1d4f62', fg: '#bff0fa' },
  { id: 'MAP', text: '避難経路図', sub: 'EVACUATION', bg: '#f2f6ee', fg: '#2a5a3a' },
  { id: 'EYE', text: '洗眼器', sub: 'EYEWASH', bg: '#3c9a6c', fg: '#ffffff' },
  { id: 'UP', text: '4F', sub: '上の階', bg: '#e8f6f8', fg: '#14404e' },
  { id: 'NOTE', text: '点検中', sub: 'MAINTENANCE', bg: '#e0c64e', fg: '#1a1a1a' },
  // 壁の作り込みの札（dress.ts）: 消火器・分電盤・注意・保護具・前を空ける・禁煙・配管の名・発信機
  { id: 'EXT', text: '消火器', sub: 'EXTINGUISHER', bg: '#c84a50', fg: '#ffffff' },
  { id: 'DB', text: '分電盤', sub: 'DISTRIBUTION', bg: '#e8f6f8', fg: '#14404e' },
  { id: 'WARN', text: '感電注意', sub: 'ELECTRIC SHOCK', bg: '#e0c64e', fg: '#1a1a1a' },
  { id: 'PPE', text: '保護具着用', sub: 'WEAR PPE', bg: '#2f6fb0', fg: '#ffffff' },
  { id: 'KEEP', text: '前を空ける', sub: 'KEEP CLEAR', bg: '#e0c64e', fg: '#1a1a1a' },
  { id: 'NOSMK', text: '禁煙', sub: 'NO SMOKING', bg: '#c84a50', fg: '#ffffff' },
  { id: 'CHW', text: '冷水 →', sub: 'CHILLED WATER', bg: '#3c9a6c', fg: '#ffffff' },
  { id: 'ALARM', text: '火災報知', sub: 'FIRE ALARM', bg: '#c84a50', fg: '#ffffff' },
] as const;

export type SignId = (typeof SIGN_LIST)[number]['id'];

export interface SignAtlas {
  tex: THREE.CanvasTexture;
  uv(id: SignId): [number, number, number, number];
}

export function makeSigns(): SignAtlas {
  const W = 1024;
  const H = 1024;
  const cw = 256;
  const ch = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  const idx = new Map<string, number>();
  SIGN_LIST.forEach((s, i) => {
    idx.set(s.id, i);
    const x = (i % 4) * cw;
    const y = Math.floor(i / 4) * ch;
    g.fillStyle = s.bg;
    g.fillRect(x + 2, y + 2, cw - 4, ch - 4);
    g.strokeStyle = s.fg;
    g.globalAlpha = 0.5;
    g.lineWidth = 3;
    g.strokeRect(x + 8, y + 8, cw - 16, ch - 16);
    g.globalAlpha = 1;
    g.fillStyle = s.fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const len = s.text.length;
    g.font = `bold ${len > 8 ? 26 : len > 5 ? 34 : 42}px sans-serif`;
    g.fillText(s.text, x + cw / 2, y + ch * 0.42);
    g.font = 'bold 18px sans-serif';
    g.fillText(s.sub, x + cw / 2, y + ch * 0.76);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return {
    tex,
    uv: (id) => {
      const i = idx.get(id) ?? 0;
      const x = (i % 4) * cw;
      const y = Math.floor(i / 4) * ch;
      return [(x + 3) / W, 1 - (y + ch - 3) / H, (x + cw - 3) / W, 1 - (y + 3) / H];
    },
  };
}
