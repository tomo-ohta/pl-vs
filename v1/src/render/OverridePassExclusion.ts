import type * as THREE from 'three';

/**
 * scene.overrideMaterial で全 Mesh を描く補助パス（GTAO の法線 / 深度、LensPass の自前の深度）から外すもの。
 * 切り抜き（alphaTest）の板（麦）は override の材質では板全体が不透明に写り、AO の暗い矩形・DoF / かすみ / 懐中電灯の距離の誤りになる。
 * InstancedMesh の onBeforeRender は InstanceLighting が使うので、ここでは visible を一時的に落とす（登録は RoomBuilder、部屋の破棄で自然に外れる）
 */
const excluded = new Set<THREE.Object3D>();

export function excludeFromOverridePasses(o: THREE.Object3D): void {
  excluded.add(o);
}

/** 登録済みのものを隠し、戻す関数を返す（シーンから外れたものは登録を消す） */
export function hideOverrideExcluded(): () => void {
  const hidden: THREE.Object3D[] = [];
  for (const o of excluded) {
    if (!o.parent) { excluded.delete(o); continue; }
    if (o.visible) { o.visible = false; hidden.push(o); }
  }
  return () => { for (const o of hidden) o.visible = true; };
}
