import * as THREE from 'three';
import { Atlas, rand } from '../../scenes/corridor/kit.ts';
import { notice, paper, scribble } from '../../scenes/corridor/tex.ts';
import type { SceneContext } from '../../scenes/types.ts';

/**
 * 掲示物・表示の図柄（1 枚のキャンバス）。参考画像の記号的な描き方（白い板・灰色のくねった線・少しの色）に合わせ、
 * 文字は大きい物（水深・部屋の名前・番号）だけ実際に書く。
 */
type G = CanvasRenderingContext2D;

/** 元の寸法（W0 × H0）で描く関数を、実際の領域（w × h）に縮めて描く */
function scaled(W0: number, H0: number, fn: (g: G, w: number, h: number) => void): (g: G, w: number, h: number) => void {
  return (g, w, h) => {
    g.save();
    g.scale(w / W0, h / H0);
    fn(g, W0, H0);
    g.restore();
  };
}
export type UV = [number, number, number, number];
/** 図柄 1 つ: どのアトラスの材質の、どの範囲か */
export interface Sign {
  mat: THREE.Material;
  glow: THREE.Material;
  uv: UV;
}

interface Page {
  atlas: Atlas;
  mat: THREE.Material;
  glow: THREE.Material;
}

export class Signs {
  private readonly pages: Page[] = [];
  private readonly cache = new Map<string, Sign>();
  constructor(readonly ctx: SceneContext) {}
  private page(): Page {
    const atlas = new Atlas(2048);
    const p: Page = {
      atlas,
      mat: this.ctx.mat({ color: '#ffffff', shade: '#c6d2c9', dark: '#9fb0a6', hi: '#ffffff', map: atlas.tex, line: 0.5 }),
      // 照明なし（光る表示: 非常口・案内の灯り・画面）
      glow: this.ctx.mat({ color: '#ffffff', unlit: true, map: atlas.tex, line: 0.3 }),
    };
    this.pages.push(p);
    return p;
  }
  private once(key: string, w: number, h: number, draw: (g: G, w: number, h: number) => void): Sign {
    let sg = this.cache.get(key);
    if (!sg) {
      let p = this.pages[this.pages.length - 1] ?? this.page();
      let uv: UV;
      try {
        uv = p.atlas.add(w, h, draw);
      } catch {
        p = this.page();
        uv = p.atlas.add(w, h, draw);
      }
      sg = { mat: p.mat, glow: p.glow, uv };
      this.cache.set(key, sg);
    }
    return sg;
  }
  done(): void {
    for (const p of this.pages) p.atlas.tex.needsUpdate = true;
  }

  /** 部屋の名前・案内の板（白地・濃い青緑の字・矢印） */
  label(text: string, arrow: '' | '←' | '→' | '↑' = '', bg = '#eef4ec', ink = '#2f5a5a'): Sign {
    return this.once(`label:${text}:${arrow}:${bg}`, 384, 96, scaled(512, 384, scaled(512, 128, (g, w, h) => {
      paper(g, w, h, bg, ink, 6);
      g.fillStyle = ink;
      g.font = `bold ${Math.round(h * 0.48)}px "Hiragino Sans", sans-serif`;
      g.textBaseline = 'middle';
      g.textAlign = 'center';
      g.fillText(arrow ? `${text}  ${arrow}` : text, w / 2, h / 2 + 2);
    })));
  }
  /** 水深の表示（タイルの縁に貼る。青緑の字） */
  depth(m: number): Sign {
    return this.once(`depth:${m}`, 160, 80, scaled(256, 128, (g, w, h) => {
      paper(g, w, h, '#f4f7ef');
      g.fillStyle = '#2b6a6c';
      g.font = `bold ${Math.round(h * 0.55)}px "Hiragino Sans", sans-serif`;
      g.textBaseline = 'middle';
      g.textAlign = 'center';
      g.fillText(`${m.toFixed(1)}m`, w / 2, h / 2 + 3);
    }));
  }
  /** 注意の板（赤い丸に斜線の絵 + くねった線） */
  caution(seed: number, kind: 'dive' | 'run' | 'general' = 'general'): Sign {
    return this.once(`caution:${seed}:${kind}`, 192, 240, scaled(256, 320, (g, w, h) => {
      paper(g, w, h, '#f3f6ee', '#c8655f', 6);
      const cx = w / 2;
      const cy = h * 0.34;
      const r = w * 0.3;
      g.strokeStyle = '#c8655f';
      g.lineWidth = 14;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
      // 人の形（記号）
      g.fillStyle = '#3b5654';
      g.beginPath();
      g.arc(cx - 8, cy - r * 0.45, 12, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 10;
      g.strokeStyle = '#3b5654';
      g.beginPath();
      if (kind === 'dive') {
        g.moveTo(cx - 40, cy + 30);
        g.lineTo(cx + 30, cy - 20);
      } else {
        g.moveTo(cx - 8, cy - r * 0.3);
        g.lineTo(cx - 4, cy + 20);
        g.moveTo(cx - 4, cy + 20);
        g.lineTo(cx - 28, cy + 48);
        g.moveTo(cx - 4, cy + 20);
        g.lineTo(cx + 22, cy + 46);
      }
      g.stroke();
      g.strokeStyle = '#c8655f';
      g.lineWidth = 14;
      g.beginPath();
      g.moveTo(cx - r * 0.7, cy - r * 0.7);
      g.lineTo(cx + r * 0.7, cy + r * 0.7);
      g.stroke();
      scribble(g, w * 0.14, h * 0.68, w * 0.72, h * 0.26, { color: '#7d8a85', row: 22, width: 4, seed });
    }));
  }
  /** 掲示（白い紙・見出しの帯・くねった線） */
  notice(seed: number, head = '#5f8f8a'): Sign {
    return this.once(`notice:${seed}:${head}`, 160, 212, (g, w, h) => notice(g, w, h, { head, seed, bg: '#f2f5ec', row: 13, lw: 3 }));
  }
  /** 掲示板（コルクの代わりの淡い青緑の板に紙が数枚） */
  board(seed: number): Sign {
    return this.once(`board:${seed}`, 400, 250, scaled(512, 320, (g, w, h) => {
      const r = rand(seed);
      paper(g, w, h, '#a9c4ba', '#6f8f86', 8);
      for (let i = 0; i < 5; i++) {
        const pw = 80 + r() * 50;
        const ph = 100 + r() * 60;
        const x = 20 + i * 96 + r() * 10;
        const y = 24 + r() * (h - ph - 40);
        g.save();
        g.translate(x, y);
        notice(g, pw, ph, { head: r() < 0.5 ? '#5f8f8a' : '#c08a6a', seed: seed * 7 + i, bg: '#f4f6ee', row: 9, lw: 2 });
        g.restore();
      }
    }));
  }
  /** 非常口（緑の地に白い人と扉。光る） */
  exit(): Sign {
    return this.once('exit', 288, 96, scaled(384, 128, (g, w, h) => {
      paper(g, w, h, '#3f9a6a');
      g.fillStyle = '#f4fbf2';
      g.fillRect(w * 0.62, h * 0.16, w * 0.22, h * 0.68);
      g.fillStyle = '#3f9a6a';
      g.fillRect(w * 0.66, h * 0.22, w * 0.14, h * 0.56);
      g.fillStyle = '#f4fbf2';
      g.beginPath();
      g.arc(w * 0.3, h * 0.26, 11, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#f4fbf2';
      g.lineWidth = 10;
      g.beginPath();
      g.moveTo(w * 0.29, h * 0.4);
      g.lineTo(w * 0.36, h * 0.62);
      g.lineTo(w * 0.3, h * 0.86);
      g.moveTo(w * 0.36, h * 0.62);
      g.lineTo(w * 0.47, h * 0.8);
      g.moveTo(w * 0.22, h * 0.5);
      g.lineTo(w * 0.42, h * 0.46);
      g.stroke();
    }));
  }
  /** 番号の札（ロッカー・下足箱） */
  number(n: number, bg = '#f3f6ef', ink = '#40615e'): Sign {
    return this.once(`num:${n % 48}:${bg}`, 64, 40, (g, w, h) => {
      paper(g, w, h, bg);
      g.fillStyle = ink;
      g.font = `bold ${Math.round(h * 0.6)}px "Hiragino Sans", sans-serif`;
      g.textBaseline = 'middle';
      g.textAlign = 'center';
      g.fillText(String(n), w / 2, h / 2 + 2);
    });
  }
  /** 券売機・自動販売機の面（画面・ボタンの列） */
  machine(kind: 'ticket' | 'drink' | 'water' | 'panel'): Sign {
    return this.once(`machine:${kind}`, 192, 384, scaled(256, 512, (g, w, h) => {
      if (kind === 'ticket') {
        paper(g, w, h, '#e8eee6');
        g.fillStyle = '#2f4a4c';
        g.fillRect(w * 0.12, h * 0.08, w * 0.76, h * 0.26);
        g.fillStyle = '#7fb6c2';
        g.fillRect(w * 0.15, h * 0.1, w * 0.7, h * 0.22);
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
          g.fillStyle = i === 0 ? '#c8655f' : '#6f9a95';
          g.fillRect(w * (0.14 + j * 0.25), h * (0.4 + i * 0.07), w * 0.2, h * 0.05);
        }
        g.fillStyle = '#3b5654';
        g.fillRect(w * 0.3, h * 0.72, w * 0.4, h * 0.04);
        g.fillRect(w * 0.25, h * 0.85, w * 0.5, h * 0.06);
      } else if (kind === 'drink' || kind === 'water') {
        paper(g, w, h, kind === 'drink' ? '#d4e6e2' : '#e9f0ea');
        g.fillStyle = '#f4f7f2';
        g.fillRect(w * 0.08, h * 0.06, w * 0.84, h * 0.5);
        const r = rand(kind === 'drink' ? 5 : 9);
        for (let i = 0; i < 3; i++) for (let j = 0; j < 5; j++) {
          const cs = ['#6aa39a', '#c8655f', '#e3c06a', '#4f7f9a', '#9fbf8a'];
          g.fillStyle = cs[Math.floor(r() * cs.length)];
          g.fillRect(w * (0.12 + j * 0.16), h * (0.1 + i * 0.15), w * 0.1, h * 0.11);
          g.fillStyle = '#3b5654';
          g.fillRect(w * (0.12 + j * 0.16), h * (0.22 + i * 0.15), w * 0.1, h * 0.012);
        }
        g.fillStyle = '#3b5654';
        g.fillRect(w * 0.7, h * 0.6, w * 0.16, h * 0.1);
        g.fillRect(w * 0.15, h * 0.82, w * 0.7, h * 0.08);
      } else {
        paper(g, w, h, '#cfd9d4', '#6f8580', 4);
        const r = rand(13);
        for (let i = 0; i < 6; i++) {
          g.fillStyle = r() < 0.3 ? '#c8655f' : r() < 0.6 ? '#7fb08a' : '#e3c06a';
          g.beginPath();
          g.arc(w * (0.2 + (i % 3) * 0.3), h * (0.12 + Math.floor(i / 3) * 0.08), 9, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = '#2f4a4c';
        g.fillRect(w * 0.12, h * 0.3, w * 0.76, h * 0.18);
        g.fillStyle = '#8fc3b5';
        g.fillRect(w * 0.15, h * 0.32, w * 0.4, h * 0.05);
        scribble(g, w * 0.12, h * 0.55, w * 0.76, h * 0.35, { color: '#6f8580', row: 22, width: 4, seed: 4 });
      }
    }));
  }
  /** 時計の文字盤 */
  clock(): Sign {
    return this.once('clock', 192, 192, scaled(256, 256, (g, w, h) => {
      g.fillStyle = '#f6f8f2';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#3b5654';
      g.lineWidth = 10;
      g.beginPath();
      g.arc(w / 2, h / 2, w * 0.45, 0, Math.PI * 2);
      g.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        g.lineWidth = i % 3 === 0 ? 10 : 5;
        g.beginPath();
        g.moveTo(w / 2 + Math.sin(a) * w * 0.36, h / 2 - Math.cos(a) * h * 0.36);
        g.lineTo(w / 2 + Math.sin(a) * w * 0.42, h / 2 - Math.cos(a) * h * 0.42);
        g.stroke();
      }
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(w / 2, h / 2);
      g.lineTo(w / 2 + w * 0.2, h / 2 - h * 0.12);
      g.moveTo(w / 2, h / 2);
      g.lineTo(w / 2 - w * 0.05, h / 2 - h * 0.33);
      g.stroke();
    }));
  }
  /** 流れの向きの矢印（壁のタイルに描いた） */
  flow(): Sign {
    return this.once('flow', 384, 96, scaled(512, 128, (g, w, h) => {
      paper(g, w, h, '#e8f0ea', '#6aa39a', 5);
      g.fillStyle = '#4f8f8a';
      for (let i = 0; i < 3; i++) {
        const x = w * (0.18 + i * 0.27);
        g.beginPath();
        g.moveTo(x, h * 0.25);
        g.lineTo(x + w * 0.12, h * 0.5);
        g.lineTo(x, h * 0.75);
        g.lineTo(x + w * 0.04, h * 0.5);
        g.closePath();
        g.fill();
      }
    }));
  }
  /** 案内図（館内の図。四角と通路の線） */
  map(seed: number): Sign {
    return this.once(`map:${seed}`, 384, 288, (g, w, h) => {
      const r = rand(seed);
      paper(g, w, h, '#eef3ea', '#4f7f7a', 8);
      g.fillStyle = '#2f5a5a';
      g.font = 'bold 34px "Hiragino Sans", sans-serif';
      g.fillText('館内案内', 24, 48);
      const cs = ['#9cc9c0', '#c9dcc8', '#d9d0b4', '#b4cbd9'];
      for (let i = 0; i < 9; i++) {
        g.fillStyle = cs[i % cs.length];
        g.fillRect(30 + (i % 3) * 150 + r() * 10, 80 + Math.floor(i / 3) * 95 + r() * 8, 120 + r() * 20, 70 + r() * 10);
      }
      g.fillStyle = '#c8655f';
      g.beginPath();
      g.arc(w * 0.62, h * 0.7, 10, 0, Math.PI * 2);
      g.fill();
    });
  }
}
