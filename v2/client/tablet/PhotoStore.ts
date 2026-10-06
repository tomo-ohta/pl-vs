/**
 * タブレットのカメラで撮った写真の保存（ブラウザの中。IndexedDB `liminal2.photos`。入れ物の作りは ImageStore）。新しく撮った順
 */
import { STORAGE_PREFIX } from '../env.ts';
import { ImageStore } from './ImageStore.ts';

export interface PhotoMeta {
  id: number;
  /** 撮った時刻（現実の日時。ms） */
  takenAt: number;
  /** 撮った部屋のルーム ID（番号の無い所・フロアで撮ったときは null） */
  roomId: number | null;
  /** 世界の seed（ルーム ID は seed ごとに違う） */
  seed: number;
  /** 撮った所の名前（B6F・B6F 裏） */
  place: string;
  w: number;
  h: number;
  /** 写真の見た目（settings.photoLook） */
  look: 'clean' | 'video';
}

export class PhotoStore extends ImageStore<PhotoMeta> {
  constructor(useIdb?: boolean) {
    super(`${STORAGE_PREFIX}photos`, (a, b) => b.takenAt - a.takenAt || b.id - a.id, useIdb);
  }
}
