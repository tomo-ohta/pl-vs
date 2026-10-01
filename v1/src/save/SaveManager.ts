import type { RoomGraphSave } from '../world/RoomGraph';

export interface SaveData {
  version: 1;
  savedAt: string;
  graph: RoomGraphSave;
  currentRoomId: string;
  player: { pos: [number, number, number]; yaw: number; pitch: number };
}

const KEY = 'liminal.save.v2';

export const SaveManager = {
  save(data: SaveData): boolean {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  },
  load(): SaveData | null {
    try {
      const s = localStorage.getItem(KEY);
      if (!s) return null;
      const d = JSON.parse(s) as SaveData;
      if (d.version !== 1) return null;
      return d;
    } catch {
      return null;
    }
  },
  has(): boolean {
    try {
      return localStorage.getItem(KEY) !== null;
    } catch {
      return false;
    }
  },
};
