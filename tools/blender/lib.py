# small modelling helpers for bpy (Blender as a Python module); 1 Blender unit = 1 game unit (10 = 1 m)
# axes: x forward, y left, z up  (glTF export: three x = x, three y = z, three z = -y -> +z three = right side)
import bpy, bmesh, math
from mathutils import Vector

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

_mats = {}
def mat(name, col, metal=0.0, rough=0.5, emit=0.0, alpha=1.0, clearcoat=0.0):
    if name in _mats: return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    c = tuple(int(col[i:i + 2], 16) / 255 for i in (1, 3, 5))
    lin = tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)
    b.inputs["Base Color"].default_value = (*lin, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    if clearcoat: b.inputs["Coat Weight"].default_value = clearcoat
    if emit:
        b.inputs["Emission Color"].default_value = (*lin, 1)
        b.inputs["Emission Strength"].default_value = emit
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
        m.surface_render_method = "BLENDED"
    _mats[name] = m
    return m

def _obj(mesh, name, m):
    o = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(o)
    if m: o.data.materials.append(m)
    return o

def from_bm(bm, name, m):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return _obj(me, name, m)

def box(name, sx, sy, sz, x, y, z, m, bevel=0.0, rot=(0, 0, 0)):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz))
    o = from_bm(bm, name, m); o.location = (x, y, z); o.rotation_euler = rot
    if bevel: bev(o, bevel)
    return o

def bev(o, w, seg=2):
    md = o.modifiers.new("bev", "BEVEL"); md.width = w; md.segments = seg; md.limit_method = "ANGLE"
    return o

def cyl(name, r, h, x, y, z, m, axis="z", seg=24, r2=None, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    o = from_bm(bm, name, m)
    if axis == "x": o.rotation_euler = (0, math.pi / 2, 0)
    if axis == "y": o.rotation_euler = (math.pi / 2, 0, 0)
    o.location = (x, y, z)
    if bevel: bev(o, bevel)
    return o

def sphere(name, r, x, y, z, m, sx=1, sy=1, sz=1, seg=24):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=r)
    for v in bm.verts: v.co = Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz))
    o = from_bm(bm, name, m); o.location = (x, y, z); smooth(o)
    return o

def loft(name, sections, m, cap=True):
    """sections: list of rings (same vertex count), each ring a list of (x, y, z)"""
    bm = bmesh.new(); rings = []
    for ring in sections: rings.append([bm.verts.new(p) for p in ring])
    n = len(rings[0])
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    if cap:
        bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return from_bm(bm, name, m)

def prism(name, outline, depth, m, axis="y", off=0.0):
    """extrude a 2D outline [(u, v)] by depth; axis y: outline in x/z plane, centred at y=off"""
    bm = bmesh.new(); vs = []
    for u, v in outline:
        p = (u, off - depth / 2, v) if axis == "y" else ((u, v, off - depth / 2) if axis == "z" else (off - depth / 2, u, v))
        vs.append(bm.verts.new(p))
    f = bm.faces.new(vs)
    vec = (0, depth, 0) if axis == "y" else ((0, 0, depth) if axis == "z" else (depth, 0, 0))
    r = bmesh.ops.extrude_face_region(bm, geom=[f])
    bmesh.ops.translate(bm, vec=vec, verts=[e for e in r["geom"] if isinstance(e, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return from_bm(bm, name, m)

def text(name, s, size, x, y, z, m, rot=(math.pi / 2, 0, 0), extrude=0.05, align="CENTER"):
    cu = bpy.data.curves.new(name, "FONT"); cu.body = s; cu.size = size; cu.extrude = extrude; cu.align_x = align; cu.align_y = "CENTER"
    o = bpy.data.objects.new(name, cu); bpy.context.collection.objects.link(o)
    o.location = (x, y, z); o.rotation_euler = rot
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.convert(target="MESH"); o.select_set(False)
    o.data.materials.clear(); o.data.materials.append(m)
    return o

def smooth(o, angle=40):
    for p in o.data.polygons: p.use_smooth = True
    try:
        md = o.modifiers.new("ws", "WEIGHTED_NORMAL"); md.keep_sharp = True
    except Exception: pass
    return o

def mirror_y(o):
    md = o.modifiers.new("mir", "MIRROR"); md.use_axis = (False, True, False); return o

def join(objs, name):
    """apply modifiers and join into one object (keeps materials as slots)"""
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True); bpy.context.view_layer.objects.active = o
        bpy.ops.object.convert(target="MESH")
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1: bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active; o.name = name
    return o

def parent(child, par):
    child.parent = par
    child.matrix_parent_inverse = par.matrix_world.inverted()

def origin_to(o, x, y, z):
    """move the object's origin to (x, y, z) without moving its geometry"""
    bpy.context.scene.cursor.location = (x, y, z)
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")

def apply_all():
    for o in list(bpy.context.scene.objects):
        if o.type == "MESH" and o.modifiers:
            bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
            for md in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)
    # bake rotation and scale into the meshes: every node in the file is only moved (wheels and rotors spin about clean axes)
    for o in list(bpy.context.scene.objects):
        if o.type == "MESH":
            bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); bpy.context.view_layer.objects.active = o
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

def export(path):
    apply_all()
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_apply=True, export_yup=True, export_materials="EXPORT")
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type == "MESH")
    print("exported", path, "triangles", tris)

def preview(path, dist=1.0, target=(0, 0, 10), elev=0.35, az=-0.8, res=(800, 450), samples=24):
    """quick Cycles render (CPU, no GPU here) with a sun and a sky colour, on a grey ground"""
    sc = bpy.context.scene
    cam = bpy.data.cameras.new("cam"); co = bpy.data.objects.new("cam", cam); sc.collection.objects.link(co)
    t = Vector(target)
    co.location = t + Vector((math.cos(az) * math.cos(elev), math.sin(az) * math.cos(elev), math.sin(elev))) * dist
    d = t - co.location; co.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    cam.lens = 40; cam.clip_end = 10000
    sc.camera = co
    sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 4; so = bpy.data.objects.new("sun", sun); sc.collection.objects.link(so); so.rotation_euler = (0.7, 0.2, 0.9)
    gm = bpy.data.meshes.new("ground"); g = bpy.data.objects.new("ground", gm); sc.collection.objects.link(g)
    import bmesh as _b
    bm = _b.new(); _b.ops.create_grid(bm, x_segments=1, y_segments=1, size=2000); bm.to_mesh(gm); bm.free()
    gm.materials.append(mat("ground", "#8a8a86", rough=0.9))
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.7, 0.9, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.8
    sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = samples; sc.cycles.use_denoising = True
    sc.view_settings.view_transform = "AgX"
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    for o in (co, so, g): bpy.data.objects.remove(o)
