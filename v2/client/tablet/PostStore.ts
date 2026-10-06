/**
 * タブレットの SNS の投稿（ブラウザの中。IndexedDB `liminal2.sns`。入れ物の作りは ImageStore）。新しく投稿した順。
 *
 * 投稿は写真の写しを持つ（ギャラリーで写真を消しても投稿は残る）。同じ写真は 1 回だけ投稿できる（photoId で見る）。
 * 投稿者（author）は遊ぶ人の id と名前を持つ（今は自分だけ。いろいろな人の投稿を並べるときも同じ形で受け取れる）
 */
import { STORAGE_PREFIX } from '../env.ts';
import { ImageStore } from './ImageStore.ts';

export interface PostAuthor {
  /** 遊ぶ人の id（端末ごと。localPlayerId） */
  id: string;
  /** 投稿したときの名前 */
  name: string;
}

export interface PostMeta {
  id: number;
  /** 投稿した時刻（現実の日時。ms） */
  postedAt: number;
  author: PostAuthor;
  /** 元のギャラリーの写真の id（同じ写真を 2 度投稿しないため。写真を消しても投稿は残る） */
  photoId: number | null;
  /** 撮った部屋のルーム ID（無ければ null） */
  roomId: number | null;
  /** 撮った世界の seed */
  seed: number;
  /** 撮った所の名前（B6F） */
  place: string;
  /** 撮った時刻 */
  takenAt: number;
  w: number;
  h: number;
  look: 'clean' | 'video';
}

export class PostStore extends ImageStore<PostMeta> {
  constructor(useIdb?: boolean) {
    super(`${STORAGE_PREFIX}sns`, (a, b) => b.postedAt - a.postedAt || b.id - a.id, useIdb);
  }

  /** 投稿した写真の id */
  async postedPhotoIds(): Promise<Set<number>> {
    return new Set((await this.list()).map((p) => p.photoId).filter((x): x is number => x !== null));
  }
}

const PLAYER_ID_KEY = `${STORAGE_PREFIX}playerId`;

/** この端末の遊ぶ人の id（初めて呼んだときに作って覚える。保存できなければ 'local'） */
export function localPlayerId(): string {
  try {
    const have = localStorage.getItem(PLAYER_ID_KEY);
    if (have) return have;
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(PLAYER_ID_KEY, id);
    return id;
  } catch {
    return 'local';
  }
}
