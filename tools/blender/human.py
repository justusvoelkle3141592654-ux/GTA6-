# Realism update: people as Blender models. A male and a female body, each in two levels of detail
# (lod0: the player and people close by, with single fingers; lod1: the crowd), modelled on the game's
# skeleton (characters/human.ts, 54 bones) in its rest pose and skinned to it with automatic weights.
# Clothing, hair and shoes are added in the game (colour zones and extra parts), so the body is bare.
# Run: python3 tools/blender/human.py m|f <out.glb> [preview.png]
# Units: 10 = 1 m. The game's frame is x forward, y up, z to the right; Blender: x forward, y left, z up.
import sys, math; sys.path.insert(0, __file__.rsplit("/", 1)[0])
from lib import *
import bpy, bmesh
from mathutils import Vector

SEX = sys.argv[1] if len(sys.argv) > 1 else "m"
F = SEX == "f"
K = 0.94 if F else 1.0

# ------------------------------------------------------------------ skeleton (same numbers as skeletonDefs in human.ts)
FINGERS = ["thumb", "index", "middle", "ring", "pinky"]
def skeleton_defs():
    sh = 1.75 if F else 2.05; hipW = 1.0 if F else 0.92
    B = [["root", "", 0, 0, 0], ["hips", "root", 0, 9.5 * K, 0], ["spine", "hips", 0, 1.1 * K, 0], ["spine1", "spine", 0, 1.5 * K, 0], ["spine2", "spine1", 0, 1.6 * K, 0],
         ["neck", "spine2", 0.05, 1.55 * K, 0], ["head", "neck", 0.1, 0.85 * K, 0], ["jaw", "head", 0.35, -0.25, 0], ["eyeL", "head", 0.94, 0.95, -0.31], ["eyeR", "head", 0.94, 0.95, 0.31]]
    a = 0.2; up = 2.9 * K; fo = 2.55 * K
    for s, S in ((-1, "L"), (1, "R")):
        B += [[f"shoulder{S}", "spine2", -0.05, 1.05 * K, s * 0.55], [f"upperArm{S}", f"shoulder{S}", 0, -0.1, s * (sh - 0.55)]]
        B += [[f"foreArm{S}", f"upperArm{S}", 0, -up * math.cos(a), s * up * math.sin(a)], [f"hand{S}", f"foreArm{S}", 0.05, -fo * math.cos(a), s * fo * math.sin(a)]]
        B += [[f"thumb1{S}", f"hand{S}", 0.32, -0.32, -s * 0.12], [f"thumb2{S}", f"thumb1{S}", 0.12, -0.32, 0]]
        for i, x in enumerate((0.24, 0.08, -0.08, -0.24)):
            n = FINGERS[i + 1]; l = (0.36, 0.4, 0.37, 0.3)[i] * K
            B += [[f"{n}1{S}", f"hand{S}", x, -0.88 * K, 0], [f"{n}2{S}", f"{n}1{S}", 0, -l, 0], [f"{n}3{S}", f"{n}2{S}", 0, -l * 0.8, 0]]
        B += [[f"upLeg{S}", "hips", 0, -0.35, s * hipW], [f"leg{S}", f"upLeg{S}", 0.05, -4.45 * K, 0], [f"foot{S}", f"leg{S}", -0.1, -4.15 * K, 0], [f"toe{S}", f"foot{S}", 1.55 * K, -0.45, 0]]
    return B
DEFS = skeleton_defs()
G = {}  # bone name -> game position (x fwd, y up, z right)
PARENT = {}
for n, par, x, y, z in DEFS:
    p = G[par] if par else Vector((0, 0, 0))
    G[n] = p + Vector((x, y, z)); PARENT[n] = par
def bl(v): return Vector((v[0], -v[2], v[1]))  # game -> Blender
def P(n): return bl(G[n])

# ------------------------------------------------------------------ shapes
def ring_pts(c, side, front, rs, rf_front, rf_back, n=28, q=2.3, side_bias=0.0):
    """a cross-section ring around centre c: side axis (half width rs), front axis (depth front / back);
    q: superellipse exponent (2 = ellipse, higher = squarer)"""
    pts = []
    for i in range(n):
        t = i / n * math.tau
        cs, sn = math.cos(t), math.sin(t)
        x = math.copysign(abs(cs) ** (2 / q), cs) * rs * (1 + side_bias * (sn > 0))
        rf = rf_front if sn > 0 else rf_back
        y = math.copysign(abs(sn) ** (2 / q), sn) * rf
        pts.append(c + side * x + front * y)
    return pts

def loft_rings(name, rings, caps=True):
    bm = bmesh.new(); rr = [[bm.verts.new(p) for p in r] for r in rings]; n = len(rings[0])
    for a, b in zip(rr, rr[1:]):
        for i in range(n): bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    if caps: bm.faces.new(list(reversed(rr[0]))); bm.faces.new(rr[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return from_bm(bm, name, None)

def ellipsoid(name, c, r, seg=24):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=1)
    for v in bm.verts: v.co = Vector((v.co.x * r[0], v.co.y * r[1], v.co.z * r[2])) + c
    return from_bm(bm, name, None)

def tube(name, pts, radii, n=20, caps=True, fronts=None, round_ends=False, round_start=None, round_end=None):
    """a tube along points (Blender coords) with radii [(side, front, back)]; round_*: closes that end with a dome"""
    rs_, re_ = (round_ends if round_start is None else round_start), (round_ends if round_end is None else round_end)
    pts = list(pts); radii = list(radii)
    d0 = (pts[0] - pts[1]).normalized(); d1 = (pts[-1] - pts[-2]).normalized()
    r0, r1 = radii[0], radii[-1]
    for k, f in ((0.55, 0.82), (0.35, 0.45)):
        if rs_: pts.insert(0, pts[0] + d0 * r0[0] * k); radii.insert(0, tuple(v * f for v in r0))
        if re_: pts.append(pts[-1] + d1 * r1[0] * k); radii.append(tuple(v * f for v in r1))
    rings = []
    for i, p in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        ref = Vector((1, 0, 0)) if abs(d.x) < 0.9 else Vector((0, 0, 1))
        side = d.cross(ref).normalized(); front = side.cross(d).normalized()
        if front.x < 0: front = -front; side = -side
        rs, rf, rb = radii[i]
        rings.append(ring_pts(p, side, front, rs, rf, rb, n=n, q=2.0))
    return loft_rings(name, rings, caps)

def lerpv(a, b, t): return a + (b - a) * t

# ------------------------------------------------------------------ the body (torso, neck, limbs, head) merged by a voxel remesh
SIDE = Vector((0, -1, 0)); FRONT = Vector((1, 0, 0))  # Blender: -y is the right side
def torso():
    # height (game y), half width, depth front, depth back, centre x  (real measures: chest ~100 cm, waist ~85, hips ~100)
    if F:
        T = [(8.55, 0.7, 0.5, 0.6, -0.05), (8.85, 1.35, 0.85, 1.05, -0.05), (9.2, 1.85, 1.02, 1.3, -0.06), (9.65, 1.92, 1.0, 1.3, -0.04), (10.1, 1.66, 0.92, 1.05, 0),
             (10.55, 1.36, 0.86, 0.84, 0), (11.0, 1.3, 0.88, 0.8, 0), (11.6, 1.42, 0.96, 0.84, 0), (12.2, 1.55, 1.0, 0.9, 0), (12.8, 1.62, 1.0, 0.92, 0),
             (13.35, 1.68, 0.92, 0.94, -0.02), (13.75, 1.7, 0.8, 0.86, -0.04), (14.05, 1.3, 0.66, 0.72, -0.04), (14.3, 0.8, 0.52, 0.58, -0.02), (14.5, 0.55, 0.46, 0.52, 0)]
    else:
        T = [(9.0, 0.7, 0.5, 0.6, -0.05), (9.3, 1.32, 0.88, 1.0, -0.05), (9.65, 1.72, 1.04, 1.24, -0.06), (10.1, 1.72, 1.0, 1.15, -0.04), (10.6, 1.56, 0.98, 0.98, 0),
             (11.15, 1.5, 1.0, 0.92, 0), (11.8, 1.56, 1.06, 0.94, 0), (12.5, 1.72, 1.15, 1.0, 0.02), (13.2, 1.82, 1.2, 1.05, 0.02), (13.9, 1.86, 1.12, 1.08, 0),
             (14.45, 1.9, 0.95, 1.02, -0.03), (14.8, 1.7, 0.78, 0.9, -0.05), (15.1, 1.1, 0.64, 0.74, -0.04), (15.35, 0.66, 0.56, 0.62, 0)]
    rings = [ring_pts(bl(Vector((cx, y, 0))), SIDE, FRONT, hw, df * 1.12, db * 1.1, n=36, q=2.2) for y, hw, df, db, cx in T]
    o = loft_rings("torso", rings); parts = [o]
    if F:  # breasts
        for s in (-1, 1): parts.append(ellipsoid("breast", bl(Vector((0.62, 12.2, s * 0.7))), (0.55, 0.66, 0.56)))
    else:  # flat pectorals, the six-pack area a little forward
        for s in (-1, 1): parts.append(ellipsoid("pec", bl(Vector((0.84, 13.1, s * 0.8))), (0.32, 0.55, 0.82)))
    for s in (-1, 1):
        parts.append(ellipsoid("glute", bl(Vector((-0.5, (9.25 if F else 9.6), s * 0.8))), (0.8, 0.85, 0.92)))
        parts.append(ellipsoid("blade", bl(Vector((-0.6, 13.7 * K, s * 0.95))), (0.48, 0.8, 0.85)))
        # trapezius: from the neck down to the shoulder
        nb, sh = G["neck"], G[f"upperArm{'L' if s < 0 else 'R'}"]
        parts.append(tube("trap", [bl(lerpv(nb, sh, t) + Vector((-0.12, 0.1 - t * 0.12, 0))) for t in (0.0, 0.5, 0.95)], [(0.55, 0.45, 0.55), (0.5, 0.42, 0.5), (0.5, 0.45, 0.45)], n=14, round_ends=True))
    return parts

def neck_head():
    nk, hd = G["neck"], G["head"]
    pts = [bl(lerpv(nk, hd, t) + Vector((0.02, -0.35, 0))) for t in (0.0, 0.5, 1.0)] + [bl(hd + Vector((0.05, 0.25, 0)))]
    nr = 0.55 if F else 0.64
    neck = tube("neck", pts, [(nr * 1.12, nr * 0.95, nr * 1.05), (nr, nr * 0.95, nr), (nr * 0.95, nr * 0.9, nr), (nr * 0.9, nr * 0.85, nr)], n=24)
    # the head from horizontal slices (relative to the centre of the skull c0, at ear height; x forward):
    # height, half width, depth to the front, depth to the back (real proportions of a head 23 cm high, 19.5 long, 15.5 wide)
    c0 = hd + Vector((0.12, 0.85, 0))
    wf = 0.94 if F else 1.0
    H = [(1.2, 0.08, 0.08, 0.1), (1.12, 0.42, 0.42, 0.5), (1.0, 0.6, 0.66, 0.74), (0.8, 0.73, 0.84, 0.92), (0.55, 0.78, 0.96, 1.0), (0.32, 0.79, 1.02, 1.0),
         (0.14, 0.79, 0.94, 0.97), (-0.06, 0.78, 0.98, 0.9), (-0.28, 0.73 * wf, 0.98, 0.78), (-0.48, 0.67 * wf, 0.95, 0.6), (-0.66, 0.6 * wf, 0.9, 0.42),
         (-0.82, 0.48 * wf, 0.84, 0.26), (-0.95, 0.3 * wf, 0.72, 0.1), (-1.02, 0.1, 0.5, 0.0)]
    rings = []
    for y, w, f, b in H:
        rings.append(ring_pts(bl(c0 + Vector((0, y, 0))), SIDE, FRONT, w, f, b, n=40, q=2.35))
    parts = [loft_rings("skull", rings)]
    E = lambda c, r: ellipsoid("h", bl(c0 + Vector(c)), (r[0], r[2], r[1]))  # radii given as (x, y, z) in game axes
    parts += [
        E((0.84, -0.86, 0), (0.18, 0.16, 0.24 * wf)),                                                       # chin
        E((0.95, -0.55, 0), (0.08, 0.06, 0.24 * wf)), E((0.93, -0.66, 0), (0.08, 0.06, 0.22 * wf)),          # lips
        E((0.84, 0.3, 0.3), (0.16, 0.08, 0.26)), E((0.84, 0.3, -0.3), (0.16, 0.08, 0.26)),                   # brows
        E((0.96, -0.4, 0.11), (0.1, 0.07, 0.08)), E((0.96, -0.4, -0.11), (0.1, 0.07, 0.08)),                 # nostrils
    ]
    # nose: a ridge from between the eyes to the tip
    rings = []
    for t in (0.0, 0.3, 0.6, 0.85, 1.0):
        y = 0.14 - t * 0.52; x = 0.9 + t * (0.26 if not F else 0.22); wd = 0.07 + t * 0.06 - (0.04 if t == 1.0 else 0); d = 0.06 + t * 0.05
        rings.append(ring_pts(bl(c0 + Vector((x, y, 0))), SIDE, FRONT, max(0.02, wd), max(0.02, d), 0.16, n=12, q=2.4))
    parts.append(loft_rings("nose", rings))
    return [neck], parts, c0

def cut_sockets(o, c0):
    """eye sockets: subtract two spheres where the eyes sit"""
    for s in (-1, 1):
        sp = ellipsoid("sock", bl(c0 + Vector((1.0, 0.1, s * 0.31))), (0.16, 0.14, 0.12), seg=20)
        md = o.modifiers.new("cut", "BOOLEAN"); md.operation = "DIFFERENCE"; md.object = sp; md.solver = "MANIFOLD" if hasattr(md, "solver") else "EXACT"
        try:
            bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier=md.name)
        except Exception:
            md.solver = "EXACT"; bpy.ops.object.modifier_apply(modifier=md.name)
        bpy.data.objects.remove(sp)

def arm(S):
    s = -1 if S == "L" else 1
    sh, el, wr = G[f"upperArm{S}"], G[f"foreArm{S}"], G[f"hand{S}"]
    m = 0.88 if F else 1.0
    pts, rad = [], []
    for t, r, rf in ((0.0, 0.6, 0.6), (0.06, 0.6, 0.6), (0.18, 0.56, 0.58), (0.35, 0.52, 0.56), (0.47, 0.42, 0.44), (0.52, 0.41, 0.42), (0.6, 0.46, 0.47), (0.72, 0.44, 0.42), (0.86, 0.36, 0.33), (0.97, 0.3, 0.25), (1.0, 0.29, 0.24)):
        p = lerpv(sh, el, t / 0.5) if t <= 0.5 else lerpv(el, wr, (t - 0.5) / 0.5)
        pts.append(bl(p)); rad.append((r * m, rf * m, rf * m * (1.05 if t < 0.5 else 0.95)))
    parts = [tube("arm" + S, pts, rad, n=22, round_start=False, round_end=True)]
    parts.append(ellipsoid("delt" + S, bl(sh + Vector((0.02, -0.2, s * 0.02))), (0.64 * m, 0.6 * m, 0.82 * m)))
    return parts

def leg(S):
    hp, kn, an = G[f"upLeg{S}"], G[f"leg{S}"], G[f"foot{S}"]
    pts, rad = [], []
    fw = 1.04 if F else 1.0
    for t, r, rf, rb in ((-0.04, 1.02, 1.0, 1.05), (0.1, 0.95, 0.92, 0.98), (0.24, 0.84, 0.82, 0.86), (0.38, 0.68, 0.66, 0.66), (0.46, 0.55, 0.56, 0.54), (0.5, 0.5, 0.52, 0.48),
                         (0.56, 0.5, 0.48, 0.52), (0.65, 0.52, 0.45, 0.66), (0.75, 0.46, 0.4, 0.55), (0.86, 0.36, 0.34, 0.38), (0.95, 0.3, 0.3, 0.3), (1.0, 0.3, 0.32, 0.3)):
        p = lerpv(hp, kn, t / 0.5) if t <= 0.5 else lerpv(kn, an, (t - 0.5) / 0.5)
        if t < 0: p = hp + (hp - kn).normalized() * 0.3
        pts.append(bl(p)); k = fw if t < 0.4 else 1.0
        rad.append((r * k, rf * k, rb * k))
    parts = [tube("leg" + S, pts, rad, n=22, round_ends=True)]
    parts.append(ellipsoid("knee", bl(kn + Vector((0.3, 0.05, 0))), (0.24, 0.28, 0.27)))
    # foot: heel to toes along +x, sole at the ground
    sole = an.y - 0.62
    fs = []
    for x, w, h in ((-0.45, 0.24, 0.5), (-0.25, 0.3, 0.7), (0.2, 0.34, 0.62), (0.75, 0.38, 0.48), (1.25, 0.4, 0.34), (1.7, 0.36, 0.26), (1.98, 0.26, 0.18)):
        c = Vector((an.x + x, sole + h / 2 + 0.02, an.z))
        fs.append(ring_pts(bl(c), SIDE, Vector((0, 0, 1)), w * (0.92 if F else 1), h / 2, h / 2, n=20, q=2.6))
    parts.append(loft_rings("foot" + S, fs))
    return parts

def hand(S, detail):
    """palm and fingers (lod0: single fingers; lod1: the fingers as one part), not remeshed"""
    s = -1 if S == "L" else 1
    m = 0.9 if F else 1.0
    h = G[f"hand{S}"]
    parts = []
    palm = [ring_pts(bl(h + Vector((0.02, -t, 0))), Vector((1, 0, 0)), SIDE, r1 * m, r2 * m, r2 * m, n=16, q=2.6) for t, r1, r2 in ((-0.05, 0.3, 0.2), (0.45, 0.4, 0.17), (0.88, 0.38, 0.14))]
    parts.append(loft_rings("palm" + S, palm))
    if detail == 0:
        for fn in FINGERS:
            segs = [f"thumb1{S}", f"thumb2{S}"] if fn == "thumb" else [f"{fn}1{S}", f"{fn}2{S}", f"{fn}3{S}"]
            pts = [G[x] for x in segs]
            tip = pts[-1] + (pts[-1] - pts[-2]) * 0.75
            allp = ([h + Vector((0.22, -0.2, -s * 0.08))] if fn == "thumb" else []) + pts + [tip]
            rr = (0.12 if fn == "thumb" else 0.08 if fn == "pinky" else 0.095) * m
            parts.append(tube(fn + S, [bl(p) for p in allp], [(rr, rr * 0.9, rr * 0.9)] * len(allp), n=10))
    else:
        m1, m3 = G[f"middle1{S}"], G[f"middle3{S}"]
        pts = [m1 + Vector((0, 0.1, 0)), G[f"middle2{S}"], m3, m3 + Vector((0, -0.3, 0))]
        parts.append(tube("fingers" + S, [bl(p) for p in pts], [(0.36 * m, 0.12, 0.12), (0.35 * m, 0.11, 0.11), (0.3 * m, 0.1, 0.1), (0.2 * m, 0.08, 0.08)], n=12))
        tp = [h + Vector((0.22, -0.2, -s * 0.08)), G[f"thumb1{S}"], G[f"thumb2{S}"], G[f"thumb2{S}"] + Vector((0.1, -0.25, 0))]
        parts.append(tube("thumb" + S, [bl(p) for p in tp], [(0.11, 0.1, 0.1)] * 4, n=8))
    return parts

def ears():
    hd = G["head"]; out = []
    for s in (-1, 1):
        c = hd + Vector((0.12 - 0.05, 0.9, s * 0.84))
        e = ellipsoid("ear", bl(c), (0.2, 0.08, 0.32), seg=14)
        out.append(e)
    return out

def eyes():
    out = []
    for S in ("L", "R"):
        e = ellipsoid("eye" + S, P(f"eye{S}") + Vector((-0.04, 0, 0)), (0.13, 0.13, 0.13), seg=16)
        out.append(e)
    return out

def remesh(o, voxel):
    md = o.modifiers.new("rm", "REMESH"); md.mode = "VOXEL"; md.voxel_size = voxel; md.adaptivity = 0
    bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier=md.name)
    sm = o.modifiers.new("sm", "CORRECTIVE_SMOOTH"); sm.iterations = 6; sm.factor = 0.5; sm.use_only_smooth = True
    bpy.ops.object.modifier_apply(modifier=sm.name)

def decimate(o, faces):
    n = len(o.data.polygons)
    if n > faces:
        md = o.modifiers.new("dec", "DECIMATE"); md.ratio = faces / n
        bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier=md.name)

# regions for the game (u of the second UV map, times 10): 0 body skin, 1 head skin, 2 lips, 3 brows, 4 eye white,
# 5 iris, 6 lower face (stubble / beard), 7 hands, 8 ears
REG = {"body": 0, "head": 1, "lips": 2, "brow": 3, "eye": 4, "iris": 5, "lowface": 6, "hand": 7}
def set_regions(o, fn):
    me = o.data
    uv = me.uv_layers.new(name="region")
    for poly in me.polygons:
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (fn(v, poly) * 0.1 + 0.05, 0.5)

def head_region(v, poly):
    g = Vector((v.x, v.z, -v.y))  # game coordinates
    hc = G["head"] + Vector((0.12, 0.85, 0)); d = g - hc
    if g.y < G["neck"].y + 0.35: return REG["body"]
    if d.x > 0.72 and abs(d.z) < 0.3 and -0.74 < d.y < -0.49: return REG["lips"]
    if d.x > 0.62 and 0.24 < d.y < 0.4 and 0.1 < abs(d.z) < 0.56: return REG["brow"]
    if d.y < -0.25 and d.x > -0.1 + 0.5 * (abs(d.z) > 0.75): return REG["lowface"]
    return REG["head"]

def build(detail):
    neck, head, c0 = neck_head()
    parts = torso() + neck + head + arm("L") + arm("R") + leg("L") + leg("R")
    body = join(parts, "body%d" % detail)
    remesh(body, 0.045 if detail == 0 else 0.07)
    cut_sockets(body, c0)
    decimate(body, 7000 if detail == 0 else 2400)
    set_regions(body, head_region)
    extras = hand("L", detail) + hand("R", detail) + ears()
    ex = join(extras, "extras"); set_regions(ex, lambda v, p: REG["hand"] if v.z < G["upperArmL"].y - 3 else REG["head"])
    ey = join(eyes(), "eyes")
    # iris: the front cap of each eye
    def eye_reg(v, poly):
        for S in ("L", "R"):
            c = P(f"eye{S}") + Vector((-0.04, 0, 0))
            if (v - c).length < 0.2 and v.x - c.x > 0.085: return REG["iris"]
        return REG["eye"]
    set_regions(ey, eye_reg)
    o = join([body, ex, ey], "lod%d" % detail)
    for p in o.data.polygons: p.use_smooth = True
    return o

def armature():
    ad = bpy.data.armatures.new("skel"); ao = bpy.data.objects.new("skel", ad); bpy.context.collection.objects.link(ao)
    bpy.context.view_layer.objects.active = ao; bpy.ops.object.mode_set(mode="EDIT")
    kids = {}
    for n, par, *_ in DEFS: kids.setdefault(par, []).append(n)
    for n, par, *_ in DEFS:
        b = ad.edit_bones.new(n); b.head = P(n)
        ch = [c for c in kids.get(n, []) if not c.startswith("eye") and c != "jaw" and not c.startswith("shoulder") and not c.startswith("upLeg")]
        if n == "hips": ch = ["spine"]
        if n == "spine2": ch = ["neck"]
        tail = P(ch[0]) if ch else None
        if tail is None or (tail - b.head).length < 0.05:
            d = (b.head - P(par)) if par else Vector((0, 0, 1))
            tail = b.head + (d.normalized() if d.length > 0 else Vector((0, 0, 1))) * (0.3 if "1" in n or "2" in n or "3" in n or n.startswith("eye") else 0.8)
        b.tail = tail
        if par: b.parent = ad.edit_bones[par]
        b.use_deform = n != "root"
    bpy.ops.object.mode_set(mode="OBJECT")
    return ao

def skin(o, arm):
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    # the eyes follow their eye bones only (blinking squashes them)
    vg = {g.name: g for g in o.vertex_groups}
    for S in ("L", "R"):
        c = P(f"eye{S}") + Vector((-0.04, 0, 0))
        ids = [v.index for v in o.data.vertices if (v.co - c).length < 0.15]
        for g in o.vertex_groups: g.remove(ids)
        vg[f"eye{S}"].add(ids, 1.0, "REPLACE")
    # weights per vertex: at most 4, normalised (glTF)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="WEIGHT_PAINT")
    bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)
    bpy.ops.object.mode_set(mode="OBJECT")

if __name__ == "__main__":
    out = sys.argv[2]
    reset()
    SKIN = mat("skin", "#c99572", rough=0.55)
    rig = armature()
    for d in (0, 1):
        o = build(d); o.data.materials.append(SKIN)
        skin(o, rig)
        print("lod", d, "faces", len(o.data.polygons))
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_yup=True, export_skins=True, export_animations=False, export_materials="EXPORT", export_texcoords=True, export_normals=True, export_apply=False)
    print("exported", out)
    if len(sys.argv) > 3:
        bpy.data.objects["lod1"].hide_render = True
        preview(sys.argv[3], dist=34, target=(0, 0, 9.5), elev=0.12, az=-1.1, samples=16, res=(600, 700))
