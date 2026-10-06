import * as THREE from "three";

/**
 * 一人称の移動と当たり判定。
 *
 * 見た目（スプラット）には一切触れず、透明な箱（Box3）だけを相手に判定する。
 * 判定は床面（XZ平面）上の「円と長方形」で行う簡易版。段差やジャンプはない。
 *
 * collider の形: { box: THREE.Box3, enabled?: boolean, name?: string }
 */
export class Player {
  constructor({
    camera,
    dom,
    getColliders,
    eyeHeight = 1.6,
    radius = 0.28,
    walkSpeed = 2.0,
    runSpeed = 3.8,
  }) {
    this.camera = camera;
    this.dom = dom;
    this.getColliders = getColliders;
    this.eyeHeight = eyeHeight;
    this.radius = radius;
    this.walkSpeed = walkSpeed;
    this.runSpeed = runSpeed;

    this.position = new THREE.Vector3(); // 足元の位置
    this.yaw = 0; // 0 で -Z 方向を向く
    this.pitch = 0;
    this.enabled = false;
    this.onInteract = null;

    this.keys = new Set();
    this.joy = new THREE.Vector2(); // x: 右, y: 前
    this.isTouch = window.matchMedia("(pointer: coarse)").matches;

    camera.rotation.order = "YXZ";
    this.#bindDesktop();
    this.#bindTouch();
  }

  get isPointerLocked() {
    return document.pointerLockElement === this.dom;
  }

  /** 視線の水平方向（単位ベクトル） */
  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  setPose(x, z, yaw = this.yaw) {
    this.position.set(x, 0, z);
    this.yaw = yaw;
    this.pitch = 0;
    this.#applyCamera();
  }

  update(dt) {
    if (this.enabled) {
      let fx = 0;
      let fz = 0;
      const k = this.keys;
      if (k.has("KeyW") || k.has("ArrowUp")) fz += 1;
      if (k.has("KeyS") || k.has("ArrowDown")) fz -= 1;
      if (k.has("KeyD") || k.has("ArrowRight")) fx += 1;
      if (k.has("KeyA") || k.has("ArrowLeft")) fx -= 1;
      fx += this.joy.x;
      fz += this.joy.y;
      const len = Math.hypot(fx, fz);
      if (len > 1) {
        fx /= len;
        fz /= len;
      }
      const running = k.has("ShiftLeft") || k.has("ShiftRight");
      const speed = running ? this.runSpeed : this.walkSpeed;
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      // 前 = (-sin, -cos), 右 = (cos, -sin)
      this.position.x += (cos * fx - sin * fz) * speed * dt;
      this.position.z += (-sin * fx - cos * fz) * speed * dt;
      this.#resolveCollisions();
    }
    this.#applyCamera();
  }

  #applyCamera() {
    this.camera.position.set(this.position.x, this.eyeHeight, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  #resolveCollisions() {
    const p = this.position;
    const r = this.radius;
    const colliders = this.getColliders();
    for (let iter = 0; iter < 4; iter++) {
      let pushed = false;
      for (const c of colliders) {
        if (c.enabled === false) continue;
        const b = c.box;
        // 体の高さ（0〜1.7m）と重ならない箱は無視（ドアの上の壁など）
        if (b.max.y < 0.05 || b.min.y > 1.7) continue;
        const cx = Math.min(Math.max(p.x, b.min.x), b.max.x);
        const cz = Math.min(Math.max(p.z, b.min.z), b.max.z);
        const dx = p.x - cx;
        const dz = p.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2);
          p.x += (dx / d) * (r - d);
          p.z += (dz / d) * (r - d);
        } else {
          // 中心が箱の中に入り込んだ場合は一番近い面へ押し出す
          const left = p.x - b.min.x;
          const right = b.max.x - p.x;
          const back = p.z - b.min.z;
          const front = b.max.z - p.z;
          const m = Math.min(left, right, back, front);
          if (m === left) p.x = b.min.x - r;
          else if (m === right) p.x = b.max.x + r;
          else if (m === back) p.z = b.min.z - r;
          else p.z = b.max.z + r;
        }
        pushed = true;
      }
      if (!pushed) break;
    }
  }

  #look(dx, dy, sensitivity) {
    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
  }

  #bindDesktop() {
    this.dom.addEventListener("click", () => {
      if (this.enabled && !this.isTouch && !this.isPointerLocked) {
        this.dom.requestPointerLock?.();
      }
    });
    document.addEventListener("mousemove", (e) => {
      if (this.isPointerLocked) this.#look(e.movementX, e.movementY, 0.0022);
    });
    window.addEventListener("keydown", (e) => {
      if (e.target instanceof HTMLInputElement) return;
      this.keys.add(e.code);
      if (e.code === "KeyE" && this.enabled && !e.repeat) this.onInteract?.();
      if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
  }

  #bindTouch() {
    const base = document.createElement("div");
    const knob = document.createElement("div");
    base.className = "joy-base";
    knob.className = "joy-knob";
    base.hidden = knob.hidden = true;
    document.body.append(base, knob);

    const JOY_RADIUS = 56;
    let joyId = null;
    let lookId = null;
    const joyOrigin = new THREE.Vector2();
    const lookLast = new THREE.Vector2();

    const onStart = (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (joyId === null && t.clientX < window.innerWidth * 0.45) {
          joyId = t.identifier;
          joyOrigin.set(t.clientX, t.clientY);
          base.style.left = knob.style.left = `${t.clientX}px`;
          base.style.top = knob.style.top = `${t.clientY}px`;
          base.hidden = knob.hidden = false;
        } else if (lookId === null) {
          lookId = t.identifier;
          lookLast.set(t.clientX, t.clientY);
        }
      }
    };
    const onMove = (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          let dx = t.clientX - joyOrigin.x;
          let dy = t.clientY - joyOrigin.y;
          const len = Math.hypot(dx, dy);
          if (len > JOY_RADIUS) {
            dx = (dx / len) * JOY_RADIUS;
            dy = (dy / len) * JOY_RADIUS;
          }
          knob.style.left = `${joyOrigin.x + dx}px`;
          knob.style.top = `${joyOrigin.y + dy}px`;
          this.joy.set(dx / JOY_RADIUS, -dy / JOY_RADIUS);
        } else if (t.identifier === lookId) {
          this.#look(t.clientX - lookLast.x, t.clientY - lookLast.y, 0.0048);
          lookLast.set(t.clientX, t.clientY);
        }
      }
    };
    const onEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          joyId = null;
          this.joy.set(0, 0);
          base.hidden = knob.hidden = true;
        } else if (t.identifier === lookId) {
          lookId = null;
        }
      }
    };
    this.dom.addEventListener("touchstart", onStart, { passive: false });
    this.dom.addEventListener("touchmove", onMove, { passive: false });
    this.dom.addEventListener("touchend", onEnd);
    this.dom.addEventListener("touchcancel", onEnd);
  }
}
