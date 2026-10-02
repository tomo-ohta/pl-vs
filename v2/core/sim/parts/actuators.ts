/**
 * 起きること（Actuator）の基本の部品。
 * - door: 開き戸。E / タップで開閉（入力 open を配線したら、その値に従う）。閉じている間だけ当たり判定。
 *         誰も近くにいなければ autoCloseSec 秒で閉まる（v1 と同じ 4 秒）。扉の中に人がいる間は閉まらない
 * - lamp: 照明の入切。LightSpec.lampId と、Box.kind 'lamp:<id>' の発光箱が従う（描画はクライアント）
 * - button: 調べると押せる箱。pressed（押した tick だけ）と on（押すたびに反転）
 * - reveal: 出現型の隠しの組（Box.revealGroup）を、入力 show が入ったら現す（一度現れたら戻らない）
 * - forceZone: 押し流すゾーン（動く歩道・風）。入力 enable が入っている間だけ効く
 * - checkpoint: 区画に入ったら、落ちたときに戻る位置をここにする
 * - respawnZone: 区画に入ったら（穴に落ちたら）戻す。to があればそこ、無ければチェックポイント
 */
import { aabbCenter, aabbExpand } from '../../math/aabb.ts';
import { approach, distXZ, type Vec3 } from '../../math/vec.ts';
import { definePart, pAabb, pBool, pNum, playerIn, pStr, pVec } from '../part.ts';

const ON = 0.5;

definePart<{ angle: number; target: number; idle: number }>({
  type: 'door',
  outputs: ['open', 'angle'],
  inputs: ['open', 'lock'],
  init(ctx) {
    const panel = pAabb(ctx.spec, 'panel');
    const open = pBool(ctx.spec, 'startOpen', false) ? 1 : 0;
    ctx.setInteractable(aabbExpand(panel, 0.05));
    if (!open) ctx.setCollider('panel', panel);
    return { angle: open, target: open, idle: 0 };
  },
  step(s, ctx) {
    const panel = pAabb(ctx.spec, 'panel');
    const locked = ctx.wired('lock') ? ctx.input('lock') > ON : pBool(ctx.spec, 'locked', false);
    const center = aabbCenter(panel);
    const prevTarget = s.target;
    if (ctx.wired('open')) {
      s.target = ctx.input('open') > ON ? 1 : 0;
    } else {
      const who = ctx.interactedBy();
      if (who) {
        if (locked) ctx.cue('door.locked', center);
        else s.target = s.target > ON ? 0 : 1;
      }
      // 自動で閉まる: 近くに誰もいない時間が autoCloseSec 秒（0 で閉まらない）
      const autoClose = pNum(ctx.spec, 'autoCloseSec', 4);
      if (s.target > ON && autoClose > 0) {
        const near = ctx.players.some((p) => distXZ(p.pos, center) < 1.6);
        s.idle = near ? 0 : s.idle + ctx.dt;
        if (s.idle >= autoClose) { s.target = 0; s.idle = 0; }
      } else s.idle = 0;
    }
    // 開いている（閉まりかけの）扉は、扉の中に人がいる間は閉めない（挟まない）。閉じている扉はそのまま
    if (s.target < ON && s.angle > 0.02 && ctx.players.some((p) => playerIn(p, aabbExpand(panel, 0.4)))) s.target = 1;
    if (s.target !== prevTarget) ctx.cue(s.target > ON ? 'door.open' : 'door.close', center, { mat: pStr(ctx.spec, 'mat', 'doorWood') });
    s.angle = approach(s.angle, s.target, ctx.dt / pNum(ctx.spec, 'openSec', 0.6));
    ctx.setCollider('panel', s.angle < ON ? panel : null);
    ctx.output('open', s.angle >= ON ? 1 : 0);
    ctx.output('angle', s.angle);
  },
});

definePart<{ on: number; level: number }>({
  type: 'lamp',
  outputs: ['on', 'level'],
  inputs: ['on'],
  init: (ctx) => {
    const on = pBool(ctx.spec, 'on', true) ? 1 : 0;
    return { on, level: on };
  },
  step(s, ctx) {
    if (ctx.wired('on')) {
      const want = ctx.input('on') > ON ? 1 : 0;
      if (want !== s.on) ctx.cue(want ? 'lamp.on' : 'lamp.off', ctx.spec.params.pos ? pVec(ctx.spec, 'pos') : undefined);
      s.on = want;
    }
    s.level = approach(s.level, s.on, ctx.dt * pNum(ctx.spec, 'rate', 8));
    ctx.output('on', s.on);
    ctx.output('level', s.level);
  },
});

definePart<{ on: number; pressedAt: number }>({
  type: 'button',
  outputs: ['pressed', 'on'],
  init(ctx) {
    const b = pAabb(ctx.spec, 'box');
    ctx.setInteractable(aabbExpand(b, 0.08), pNum(ctx.spec, 'range', 2.6));
    if (pBool(ctx.spec, 'solid', false)) ctx.setCollider('box', b);
    return { on: pBool(ctx.spec, 'initial', false) ? 1 : 0, pressedAt: -1 };
  },
  step(s, ctx) {
    const pressed = !!ctx.interactedBy();
    if (pressed) {
      s.on = s.on ? 0 : 1;
      s.pressedAt = ctx.tick;
      ctx.cue('button.press', aabbCenter(pAabb(ctx.spec, 'box')));
    }
    ctx.output('pressed', pressed ? 1 : 0);
    ctx.output('on', s.on);
  },
});

definePart<{ shown: number; at: number }>({
  type: 'reveal',
  outputs: ['shown'],
  inputs: ['show'],
  init: () => ({ shown: 0, at: -1 }),
  step(s, ctx) {
    if (!s.shown && ctx.input('show') > ON) {
      s.shown = 1;
      s.at = ctx.tick;
      ctx.reveal(pStr(ctx.spec, 'group', ctx.id));
      ctx.cue('reveal', ctx.spec.params.pos ? pVec(ctx.spec, 'pos') : undefined, { style: pStr(ctx.spec, 'style', 'fadeIn') });
    }
    ctx.output('shown', s.shown);
  },
});

definePart<{ on: number }>({
  type: 'forceZone',
  outputs: ['on'],
  inputs: ['enable'],
  init: () => ({ on: 0 }),
  step(s, ctx) {
    const on = ctx.wired('enable') ? (ctx.input('enable') > ON ? 1 : 0) : 1;
    if (on !== s.on) {
      const aabb = pAabb(ctx.spec, 'aabb');
      ctx.setZone('force', on ? { kind: 'force', aabb, vector: pVec(ctx.spec, 'vector'), params: { speed: pNum(ctx.spec, 'speed', 1.2) } } : null);
      s.on = on;
    }
    ctx.output('on', s.on);
  },
});

definePart<{ used: number }>({
  type: 'checkpoint',
  outputs: ['reached'],
  init: () => ({ used: 0 }),
  step(s, ctx) {
    const a = pAabb(ctx.spec, 'aabb');
    const pos = pVec(ctx.spec, 'pos', aabbCenter(a));
    for (const p of ctx.players) {
      if (!playerIn(p, a)) continue;
      ctx.setRespawn(p, { pos, yaw: pNum(ctx.spec, 'yaw', p.yaw) });
      s.used = 1;
    }
    ctx.output('reached', s.used);
  },
});

definePart({
  type: 'respawnZone',
  outputs: ['count'],
  init: () => ({ count: 0 }),
  step(s, ctx) {
    const a = pAabb(ctx.spec, 'aabb');
    const to = ctx.spec.params.to ? { pos: pVec(ctx.spec, 'to') as Vec3, yaw: pNum(ctx.spec, 'toYaw', 0) } : undefined;
    for (const p of ctx.players) {
      if (!playerIn(p, a)) continue;
      ctx.respawn(p, to);
      s.count = (s.count as number) + 1;
    }
    ctx.output('count', s.count as number);
  },
});

