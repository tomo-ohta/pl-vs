"""
比べるための試作: 見本の部屋のクマ（gen/plush.ts の bear と同じ寸法・配色）を Blender のスクリプトで作る。
- 形: メタボール（部位どうしが滑らかにつながる。手続きの楕円体の組み合わせとの違いを見る）→ メッシュ
- 色: 頂点の色（地の毛色・お腹と口元と耳の内側の明るい布）。目・鼻はつやのある別の材質。首にリボン
- 出力: GLB（glTF。Y が上・正面 +Z）と、確認用の画像（Cycles）

使い方: /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python blender_bear.py -- <出力の.glb> <確認画像の.png>
座標: ゲームの (x, y上, z前) を Blender の (x, -z, y) に置く（glTF 書き出しで元に戻る）
"""
import sys
import time
import math
import bpy
import bmesh
from mathutils import Vector, Matrix, Euler

t0 = time.time()
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out_glb = argv[0] if len(argv) > 0 else "/tmp/bear.glb"
out_png = argv[1] if len(argv) > 1 else "/tmp/bear.png"

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def g2b(p):
    """ゲームの座標 → Blender の座標"""
    return Vector((p[0], -p[2], p[1]))


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexcol(h):
    return (srgb_to_lin(((h >> 16) & 255) / 255), srgb_to_lin(((h >> 8) & 255) / 255), srgb_to_lin((h & 255) / 255), 1.0)


FUR, PATCH, RIBBON = 0x9B6A43, 0xD9B88F, 0xB4232C

# ---------------------------------------------------------------- 体（メタボール）
mb = bpy.data.metaballs.new("bear")
mb.resolution = 0.006
mb.render_resolution = 0.004
mb.threshold = 0.35
obj = bpy.data.objects.new("bear", mb)
scene.collection.objects.link(obj)


def ell(c, r, rot=(0.0, 0.0), stiff=4.0):
    """楕円体の要素（中心 c・半径 r はゲームの座標。rot はゲームの x・z 軸まわり）"""
    e = mb.elements.new(type="ELLIPSOID")
    e.co = g2b(c)
    # 見える大きさ: 1 要素の場は stiffness × (1 − d²)³（d は size で割った距離）。しきい値 t の面は d = √(1 − (t / s)^(1/3))。
    # 見える半径が r になるように size を広げる（広がった分で隣の部位と滑らかにつながる）
    k = 1.0 / math.sqrt(1.0 - (mb.threshold / stiff) ** (1.0 / 3.0))
    e.radius = 1.0
    e.size_x, e.size_y, e.size_z = r[0] * k, r[2] * k, r[1] * k
    e.stiffness = stiff
    ax, az = rot
    # ゲームの x 軸まわり ax → Blender の x 軸まわり（向きはそのまま）、ゲームの z 軸まわり az → Blender の -y 軸まわり
    e.rotation = (Euler((ax, 0.0, 0.0)).to_matrix() @ Euler((0.0, -az, 0.0)).to_matrix()).to_quaternion()
    return e


ell((0, 0.14, 0), (0.11, 0.13, 0.095))                       # 胴
ell((0, 0.31, 0.01), (0.09, 0.083, 0.08))                     # 頭
ell((0, 0.292, 0.078), (0.042, 0.032, 0.03), stiff=6)         # 口元
for sx in (-1, 1):
    ell((sx * 0.064, 0.378, 0), (0.033, 0.031, 0.016), (0, sx * -0.3), stiff=6)        # 耳
    ell((sx * 0.105, 0.17, 0.035), (0.034, 0.068, 0.034), (-0.5, sx * 0.35), stiff=5)  # 腕
    ell((sx * 0.06, 0.045, 0.07), (0.042, 0.06, 0.04), (-1.35, 0), stiff=5)            # 脚

# メッシュにする
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
bpy.ops.object.convert(target="MESH")
body = bpy.context.view_layer.objects.active
body.name = "bear_body"
bpy.ops.object.shade_smooth()

# 頂点の色: 胴の前の下（お腹）・口元・耳の前・足の裏を明るい布に
me = body.data
attr = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")
fur, patch = hexcol(FUR), hexcol(PATCH)
def inside(p, c, r, k=1.0):
    return ((p[0] - c[0]) / (r[0] * k)) ** 2 + ((p[1] - c[1]) / (r[1] * k)) ** 2 + ((p[2] - c[2]) / (r[2] * k)) ** 2 < 1.0


for i, v in enumerate(me.vertices):
    p = (v.co.x, v.co.z, -v.co.y)            # ゲームの座標
    n = (v.normal.x, v.normal.z, -v.normal.y)  # ゲームの向き
    t = 0.0
    # お腹: 胴の前の下で、前を向いた面
    if p[1] < 0.235 and abs(p[0]) < 0.075 and n[2] > 0.35:
        t = max(t, min(1.0, (n[2] - 0.35) * 3))
    # 口元
    if inside(p, (0, 0.292, 0.078), (0.042, 0.032, 0.03), 1.35) and n[2] > 0.1:
        t = 1.0
    # 耳の内側（耳の前を向いた面だけ）
    for sx in (-1, 1):
        if inside(p, (sx * 0.064, 0.378, 0), (0.033, 0.031, 0.016), 1.6) and n[2] > 0.45 and p[1] > 0.36:
            t = 1.0
    # 足の裏（脚の先の前を向いた面）
    for sx in (-1, 1):
        if abs(p[0] - sx * 0.06) < 0.04 and p[1] < 0.1 and p[2] > 0.09 and n[2] > 0.6:
            t = 1.0
    c = [fur[k] * (1 - t) + patch[k] * t for k in range(3)]
    attr.data[i].color = (c[0], c[1], c[2], 1.0)


def material(name, color=None, rough=0.9, metal=0.0, use_vcol=False, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if coat:
        bsdf.inputs["Coat Weight"].default_value = coat
    if use_vcol:
        vc = m.node_tree.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = "Col"
        m.node_tree.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    elif color:
        bsdf.inputs["Base Color"].default_value = color
    return m


body.data.materials.append(material("fabric", rough=0.95, use_vcol=True))

# ---------------------------------------------------------------- 目・鼻・リボン
def sphere(name, c, r, mat, seg=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=1.0, location=g2b(c))
    o = bpy.context.active_object
    o.name = name
    o.scale = (r[0], r[2], r[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.shade_smooth()
    o.data.materials.append(mat)
    return o


glossy_black = material("eye", hexcol(0x0C0A09), rough=0.08, coat=1.0)
nose_mat = material("nose", hexcol(0x2A1B14), rough=0.6)
ribbon_mat = material("ribbon", hexcol(RIBBON), rough=0.35)
parts = [body]
for sx in (-1, 1):
    parts.append(sphere(f"eye{sx}", (sx * 0.032, 0.326, 0.083), (0.009, 0.009, 0.0072), glossy_black))
parts.append(sphere("nose", (0, 0.302, 0.104), (0.015, 0.0105, 0.008), nose_mat))
# リボン: 首の輪（トーラスを楕円に）と、前の蝶結び（平たい楕円体 2 つ + 結び目）
bpy.ops.mesh.primitive_torus_add(major_radius=1.0, minor_radius=0.09, major_segments=48, minor_segments=10, location=g2b((0, 0.262, 0.005)))
tor = bpy.context.active_object
tor.scale = (0.083, 0.078, 0.08)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bpy.ops.object.shade_smooth()
tor.data.materials.append(ribbon_mat)
parts.append(tor)
for sx in (-1, 1):
    o = sphere(f"bow{sx}", (sx * 0.03, 0.262, 0.088), (0.03, 0.02, 0.008), ribbon_mat)
    o.rotation_euler = Euler((0, sx * 0.35, 0))
    parts.append(o)
parts.append(sphere("knot", (0, 0.258, 0.092), (0.011, 0.012, 0.008), ribbon_mat))

# まとめて 1 つに
bpy.ops.object.select_all(action="DESELECT")
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
bpy.ops.object.join()
bear = bpy.context.active_object
bear.name = "bear_blender"
# 結合で頂点の色を持っていなかった部品（目・鼻・リボン）は黒になるので白にする（glTF では地の色 × 頂点の色）
col = bear.data.color_attributes["Col"]
for poly in bear.data.polygons:
    if poly.material_index != 0:
        for vi in poly.vertices:
            col.data[vi].color = (1.0, 1.0, 1.0, 1.0)
tris = sum(len(p.vertices) - 2 for p in bear.data.polygons)
build_s = time.time() - t0

# ---------------------------------------------------------------- 書き出し
bpy.ops.export_scene.gltf(filepath=out_glb, export_format="GLB", use_selection=True, export_apply=True, export_vertex_color="ACTIVE")

# ---------------------------------------------------------------- 確認の画像（Cycles）
cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 60
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
cam.location = g2b((0.35, 0.42, 0.75))
direction = g2b((0, 0.2, 0)) - cam.location
cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
scene.camera = cam
light = bpy.data.objects.new("key", bpy.data.lights.new("key", "AREA"))
light.data.energy = 60
light.data.size = 0.6
light.location = g2b((0.6, 1.2, 0.8))
light.rotation_euler = (g2b((0, 0.2, 0)) - light.location).to_track_quat("-Z", "Y").to_euler()
scene.collection.objects.link(light)
world = bpy.data.worlds.new("w")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.05, 0.05, 0.055, 1)
scene.world = world
scene.render.engine = "CYCLES"
scene.cycles.samples = 48
scene.cycles.device = "CPU"
scene.render.resolution_x = scene.render.resolution_y = 560
scene.render.filepath = out_png
bpy.ops.render.render(write_still=True)

print(f"[blender_bear] tris={tris} build={build_s:.2f}s total={time.time() - t0:.2f}s glb={out_glb}")
