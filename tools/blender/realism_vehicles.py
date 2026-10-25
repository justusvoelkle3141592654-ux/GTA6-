# Realism update: the special vehicles as Blender models (tank, tractor, forklift, mixer truck, small plane,
# seaplane, sailing boat, motor yacht, hovercraft). Run: python3 tools/blender/realism_vehicles.py <id> <out.glb> [preview.png]
# Node names the game looks for: wheel_* (spin and steer), turret (tank), prop (spins about the length axis), drum (mixer)
import sys, math; sys.path.insert(0, __file__.rsplit("/", 1)[0])
from lib import *

def two_sided(m):
    m.use_backface_culling = False
    return m

def wheel(name, r, w, x, y, z, rub, hub, rimcol=None, seg=20):
    """a wheel as its own node (tyre, rim, hub), origin at its centre, axle along y"""
    t = cyl(name + "_t", r, w, 0, 0, 0, rub, axis="y", seg=seg, bevel=min(0.6, r * 0.15))
    rim = cyl(name + "_r", r * 0.62, w + 0.2, 0, 0, 0, rimcol or hub, axis="y", seg=seg)
    h = cyl(name + "_h", r * 0.2, w + 0.4, 0, 0, 0, hub, axis="y", seg=10)
    o = join([t, rim, h], name); smooth(o)
    o.location = (x, y, z)
    return o

def tank():
    OLIVE = mat("olive", "#4f5a37", metal=0.25, rough=0.65); DARK = mat("dark", "#2c3022", metal=0.4, rough=0.6)
    TRACK = mat("track", "#1d1e1c", metal=0.5, rough=0.7); STEEL = mat("steel", "#5c5f58", metal=0.8, rough=0.4)
    GLASS = mat("glass", "#1c2a33", metal=0.3, rough=0.1); SAND = mat("sand", "#7a7350", rough=0.8)
    def ring(x, zb, zt, wb, wt):
        return [(x, wb, zb), (x, wt, zt), (x, -wt, zt), (x, -wb, zb)]
    hull = loft("hull", [ring(-34, 8, 16, 12, 14), ring(-33, 6, 17, 12.5, 15), ring(26, 6, 17, 12.5, 15), ring(36, 10, 13, 12, 13)], OLIVE)
    parts = [hull]
    for s in (-1, 1):
        # track run: upper and lower belts, rounded ends, skirts, road wheels
        parts.append(box("tr_top", 66, 7, 1.4, 0, s * 15.5, 10.6, TRACK))
        parts.append(box("tr_bot", 56, 7, 1.4, 0, s * 15.5, 0.7, TRACK))
        for x, r in ((-31, 5), (31, 5)):
            parts.append(cyl("tr_end", r, 7, x, s * 15.5, 6, TRACK, axis="y", seg=16))
        for k in range(6):
            parts.append(cyl("road", 3.8, 5.8, -24 + k * 9.6, s * 15.5, 4.6, DARK, axis="y", seg=14))
            parts.append(cyl("hubcap", 1.4, 6.2, -24 + k * 9.6, s * 15.5, 4.6, STEEL, axis="y", seg=10))
        parts.append(box("skirt", 64, 0.8, 6, 0, s * 19.2, 12.5, OLIVE, bevel=0.3))
        parts.append(box("store", 12, 3, 4, -20, s * 17.5, 18.5, SAND, bevel=0.3))
    for k in range(5): parts.append(box("grill", 1.2, 18, 0.5, -28 + k * 2.6, 0, 17.2, DARK))
    parts.append(box("driverhatch", 6, 6, 1.2, 24, 0, 17.4, DARK, bevel=0.3))
    body = join(parts, "body"); smooth(body)
    # turret with the gun (own node, turns about the vertical axis)
    tp = [loft("tur", [ring(-14, 17, 25, 12, 10), ring(-12, 17, 26, 13, 11), ring(8, 17, 26, 12.5, 10.5), ring(14, 17, 23, 9, 8)], OLIVE)]
    tp.append(cyl("mantlet", 3.2, 6, 15, 0, 21.5, DARK, axis="x", seg=16))
    tp.append(cyl("gun", 1.2, 46, 40, 0, 21.5, OLIVE, axis="x", seg=14))
    tp.append(cyl("muzzle", 1.7, 5, 63, 0, 21.5, DARK, axis="x", seg=14))
    tp.append(cyl("evac", 1.8, 7, 34, 0, 21.5, OLIVE, axis="x", seg=14))
    tp.append(cyl("cupola", 3, 3, -4, -5, 27, DARK, seg=14)); tp.append(cyl("hatch", 2.4, 1, -4, 5, 26.6, OLIVE, seg=14))
    tp.append(box("sight", 3, 2.4, 2.4, 6, 6, 27, DARK)); tp.append(box("sightglass", 0.2, 1.8, 1.4, 7.6, 6, 27, GLASS))
    tp.append(cyl("mg", 0.4, 9, 0, -5, 30, DARK, axis="x", seg=6)); tp.append(box("basket", 9, 18, 3, -17, 0, 21, DARK))
    tur = join(tp, "turret"); smooth(tur); origin_to(tur, 0, 0, 0)

def tractor():
    GREEN = mat("green", "#2f7d32", metal=0.2, rough=0.45, clearcoat=0.3); YEL = mat("yellow", "#e8c21a", metal=0.3, rough=0.4)
    DARK = mat("dark", "#24262a", metal=0.4, rough=0.6); RUB = mat("rubber", "#151517", rough=0.95); GLASS = mat("glass", "#3a5a70", metal=0.2, rough=0.05, alpha=0.55)
    STEEL = mat("steel", "#8a8f96", metal=0.8, rough=0.35); LAMP = mat("lamp", "#fff4d8", emit=3)
    parts = []
    parts.append(box("frame", 34, 7, 4, 2, 0, 7.5, DARK))
    hood = loft("hood", [[(18, -4.2, 7), (18, 4.2, 7), (18, 3.6, 15.5), (18, -3.6, 15.5)], [(2, -4.6, 7), (2, 4.6, 7), (2, 4.4, 16.5), (2, -4.4, 16.5)]], GREEN); parts.append(hood)
    parts.append(box("grille", 0.6, 7, 7, 18.2, 0, 11, DARK))
    for s in (-1, 1): parts.append(box("hl", 0.6, 1.6, 1.2, 18.4, s * 2.6, 14.6, LAMP))
    # cab: floor, four posts, roof, glass all round
    parts.append(box("cabfloor", 16, 16, 1, -7, 0, 10, DARK))
    for x in (0.5, -14.5):
        for s in (-1, 1): parts.append(box("post", 1, 1, 16, x, s * 7.5, 18.5, DARK))
    parts.append(box("roof", 18, 17, 1.4, -7, 0, 27, GREEN, bevel=0.4))
    for g in (box("gf", 0.3, 14, 14, 0.5, 0, 18.5, GLASS), box("gb", 0.3, 14, 14, -14.5, 0, 18.5, GLASS), box("gl", 14, 0.3, 14, -7, 7.5, 18.5, GLASS), box("gr", 14, 0.3, 14, -7, -7.5, 18.5, GLASS)): parts.append(g)
    parts.append(box("seat", 5, 5, 2, -9, 0, 12.5, DARK)); parts.append(box("seatb", 1.5, 5, 6, -11.5, 0, 15, DARK))
    parts.append(cyl("wheelst", 2.3, 0.4, -3, 0, 17, DARK, seg=14))
    parts.append(cyl("exhaust", 0.6, 14, 6, 3.4, 22, STEEL, seg=8))
    for s in (-1, 1):
        parts.append(box("fender", 14, 4.5, 1, -9, s * 10.5, 18.2, GREEN, bevel=0.3))
        parts.append(box("step", 4, 2, 0.6, -2, s * 7, 6, DARK))
    parts.append(box("hitch", 4, 3, 2, -20, 0, 7, YEL))
    body = join(parts, "body"); smooth(body)
    for s in (-1, 1):
        wheel(f"wheel_f{'l' if s > 0 else 'r'}", 4.6, 3.2, 12, s * 7.4, 4.6, RUB, DARK, YEL)
        wheel(f"wheel_r{'l' if s > 0 else 'r'}", 8.8, 5.6, -9, s * 10.5, 8.8, RUB, DARK, YEL, seg=24)

def forklift():
    YEL = mat("yellow", "#f2b200", metal=0.25, rough=0.45, clearcoat=0.2); DARK = mat("dark", "#22252a", metal=0.5, rough=0.5)
    RUB = mat("rubber", "#151517", rough=0.95); STEEL = mat("steel", "#9aa0a8", metal=0.85, rough=0.3); LAMP = mat("lamp", "#fff4d8", emit=3)
    ORANGE = mat("beacon", "#ff8a1f", emit=4)
    parts = [box("chassis", 22, 11, 6, -1, 0, 6.5, YEL, bevel=0.6), box("weight", 7, 11.5, 9, -11, 0, 9, DARK, bevel=1.2)]
    parts.append(box("seat", 4, 5, 2, -4, 0, 11, DARK)); parts.append(box("seatb", 1.2, 5, 6, -6.4, 0, 14, DARK))
    for x in (4, -8):
        for s in (-1, 1): parts.append(box("cage", 0.8, 0.8, 17, x, s * 5, 17.5, DARK))
    parts.append(box("cageroof", 13.5, 11, 0.8, -2, 0, 26, DARK))
    parts.append(cyl("beacon", 0.9, 1.6, -6, 0, 27.2, ORANGE, seg=10))
    parts.append(cyl("wheelst", 1.8, 0.4, 2, 0, 15, DARK, seg=12))
    # mast and forks at the front
    for s in (-1, 1): parts.append(box("mast", 1.2, 1.4, 30, 11.5, s * 3.5, 16, STEEL))
    parts.append(box("carriage", 1.2, 9, 4, 12.6, 0, 6, DARK))
    for s in (-1, 1): parts.append(box("fork", 11, 1.2, 0.6, 18.5, s * 2.6, 3.8, STEEL)); parts.append(box("forkup", 0.6, 1.2, 6, 13.2, s * 2.6, 6.5, STEEL))
    parts.append(box("hl", 0.4, 1.6, 1.2, 4.4, 4.2, 24, LAMP))
    body = join(parts, "body"); smooth(body)
    for s in (-1, 1):
        wheel(f"wheel_f{'l' if s > 0 else 'r'}", 3.4, 2.8, 7, s * 5.4, 3.4, RUB, DARK, STEEL)
        wheel(f"wheel_r{'l' if s > 0 else 'r'}", 2.8, 2.4, -9, s * 5.2, 2.8, RUB, DARK, STEEL)

def mixer():
    CAB = mat("cab", "#e8e8ec", metal=0.3, rough=0.4, clearcoat=0.3); DRUM = mat("drum", "#f2a21a", metal=0.3, rough=0.45)
    DARK = mat("dark", "#22252a", metal=0.5, rough=0.55); RUB = mat("rubber", "#151517", rough=0.95); STEEL = mat("steel", "#9aa0a8", metal=0.85, rough=0.3)
    GLASS = mat("glass", "#1c3550", metal=0.2, rough=0.05, alpha=0.8); LAMP = mat("lamp", "#fff4d8", emit=3); TAIL = mat("tail", "#ff2020", emit=2)
    parts = [box("chassis", 78, 10, 3, -1, 0, 7, DARK)]
    cab = loft("cab", [[(39, -12, 6), (39, 12, 6), (39, 11.5, 22), (39, -11.5, 22)], [(36, -12.5, 6), (36, 12.5, 6), (34, 12, 29), (34, -12, 29)], [(22, -12.5, 6), (22, 12.5, 6), (22, 12.2, 30), (22, -12.2, 30)]], CAB)
    parts.append(cab)
    parts.append(box("ws", 0.4, 20, 8, 36.4, 0, 24.5, GLASS)); parts.append(box("grille", 0.5, 16, 8, 39.2, 0, 12, DARK))
    for s in (-1, 1):
        parts.append(box("win", 8, 0.3, 7, 29, s * 12.6, 23, GLASS)); parts.append(box("hl", 0.5, 4, 2, 39.3, s * 8, 10, LAMP))
        parts.append(box("tl", 0.5, 2.5, 1.5, -39.3, s * 9, 9, TAIL)); parts.append(box("mirror", 1.2, 1, 4, 37, s * 14, 24, DARK))
    parts.append(box("bumper", 2, 25, 3, 39.5, 0, 6, DARK))
    for x in (-4, -36): parts.append(box("stand", 3, 10, 14, x, 0, 15, DARK))
    parts.append(box("chute", 10, 3, 1, -40, 0, 16, STEEL)); parts.append(box("hopper", 5, 7, 5, -36, 0, 28, STEEL))
    parts.append(box("water", 6, 6, 9, 17, 0, 14, CAB))
    body = join(parts, "body"); smooth(body)
    # the drum (own node, turns about the length axis)
    secs = []
    for x, r in ((-37, 4), (-34, 8.5), (-26, 11.5), (-12, 12.2), (2, 11), (10, 7), (14, 4)):
        secs.append([(x, math.cos(a) * r, math.sin(a) * r) for a in [i / 20 * math.tau for i in range(20)]])
    d = loft("drum_shell", secs, DRUM); smooth(d)
    fins = [box("fin", 3, 0.6, 24, -12 + k * 0.1, 0, 0, STEEL) for k in range(1)]
    for f, a in zip(fins, [0.0]): f.rotation_euler = (0.6, 0, 0)
    stripes = [cyl("stripe", 12.35, 1.2, -18 + k * 9, 0, 0, DARK, axis="x", seg=24) for k in range(3)]
    drum = join([d] + stripes, "drum"); smooth(drum)
    drum.location = (0, 0, 0); origin_to(drum, 0, 0, 0)
    drum.location = (-11, 0, 24)
    for k, x in enumerate((30, -14, -26)):
        for s in (-1, 1): wheel(f"wheel_{k}{'l' if s > 0 else 'r'}", 4.8, 3.6, x, s * 10.8, 4.8, RUB, DARK, STEEL)

def plane(sea=False):
    WHITE = mat("white", "#f4f4f6", metal=0.2, rough=0.35, clearcoat=0.4); BLUE = mat("stripe", "#1d4e89", metal=0.3, rough=0.4)
    DARK = mat("dark", "#2a2d33", metal=0.5, rough=0.5); RUB = mat("rubber", "#151517", rough=0.95); STEEL = mat("steel", "#9aa0a8", metal=0.85, rough=0.3)
    GLASS = mat("glass", "#28425c", metal=0.3, rough=0.04, alpha=0.7); RED = mat("red", "#ff2a2a", emit=5); GREEN = mat("green", "#2aff6a", emit=5)
    FLOAT = mat("float", "#e8e8ec", metal=0.3, rough=0.4)
    Y = 15 if sea else 9  # height of the fuselage axis
    def ell(x, w, h, zc, n=16):
        return [(x, math.cos(a) * w, zc + math.sin(a) * h) for a in [i / n * math.tau for i in range(n)]]
    fus = loft("fus", [ell(38, 2.4, 2.6, Y), ell(33, 4.4, 4.8, Y + 0.5), ell(20, 5.4, 6.4, Y + 1.5), ell(4, 5.6, 6.6, Y + 1.8), ell(-10, 4.4, 5, Y + 1.5),
                       ell(-28, 2.4, 2.8, Y + 2.2), ell(-41, 0.8, 1.4, Y + 3.4)], WHITE); smooth(fus)
    parts = [fus]
    parts.append(sphere("cowl", 2.4, 38, 0, Y, DARK, sx=0.6))
    # windows: a band along the cabin, windscreen
    for s in (-1, 1): parts.append(box("win", 14, 0.4, 3.6, 12, s * 5.5, Y + 4, GLASS)); parts.append(box("band", 60, 0.3, 1.2, 2, s * 5.0, Y - 0.5, BLUE))
    ws = box("ws", 0.5, 9, 5, 22, 0, Y + 5.2, GLASS); ws.rotation_euler = (0, -0.9, 0); parts.append(ws)
    # high wing on struts, tailplane, fin
    parts.append(prism("wing", [(18, -56), (24, -56), (24, 56), (18, 56)], 1.2, WHITE, axis="z", off=Y + 8.8))
    for s in (-1, 1):
        st = box("strut", 0.8, 22, 0.6, 18, s * 13, Y + 3, STEEL); st.rotation_euler = (s * 0.42, 0, 0); parts.append(st)
        parts.append(box("tip", 2, 0.8, 1, 21, s * 56, Y + 8.8, GREEN if s > 0 else RED))
    parts.append(prism("tailplane", [(-32, -16), (-26, -16), (-26, 16), (-32, 16)], 0.8, WHITE, axis="z", off=Y + 3))
    parts.append(prism("fin", [(-41, 0), (-30, 0), (-38, 14), (-42, 14)], 0.8, BLUE, axis="y", off=0)); parts[-1].location = (0, 0, Y + 3)
    parts.append(text("reg", "D-ESOL", 2.4, -6, 5.3, Y + 1.2, DARK, rot=(math.pi / 2, 0, math.pi)))
    parts.append(text("reg2", "D-ESOL", 2.4, -6, -5.3, Y + 1.2, DARK, rot=(math.pi / 2, 0, 0)))
    if sea:
        # floats on struts instead of wheels
        for s in (-1, 1):
            fl = loft("float", [ell(30, 0.6, 0.6, 3.2), ell(26, 2.6, 2.4, 3.4), ell(10, 3, 2.8, 3), ell(-14, 2.6, 2.2, 3), ell(-24, 0.8, 0.8, 3.6)], FLOAT); smooth(fl)
            fl.location = (0, s * 10, 0); parts.append(fl)
            for x in (16, -4):
                st = box("fstrut", 0.8, 0.8, 11, x, s * 7.5, 9, STEEL); st.rotation_euler = (s * 0.42, 0, 0); parts.append(st)
    body = join(parts, "body"); smooth(body)
    if not sea:
        g = [cyl("leg", 0.4, 7, 28, 0, Y - 4.5, STEEL, seg=8)]
        for s in (-1, 1): sl = box("sleg", 0.6, 9, 0.6, 2, s * 6, Y - 5, STEEL); sl.rotation_euler = (s * 0.7, 0, 0); g.append(sl)
        for gx, gy, r in ((28, 0, 2.2), (2, -9.5, 2.6), (2, 9.5, 2.6)): g.append(cyl("tyre", r, 1.6, gx, gy, r, RUB, axis="y", seg=16, bevel=0.4))
        gear = join(g, "fixedgear"); smooth(gear)
    # propeller (own node, spins about x)
    pp = [box("blade", 0.4, 1.4, 19, 0, 0, 0, DARK), sphere("spinner", 1.3, 1, 0, 0, STEEL, sx=1.4)]
    prop = join(pp, "prop"); origin_to(prop, 0, 0, 0); prop.location = (40.4, 0, Y)

def sailboat():
    HULL = mat("hull", "#f4f4f6", metal=0.15, rough=0.3, clearcoat=0.5); NAVY = mat("navy", "#1d2f52", metal=0.2, rough=0.4)
    DECK = mat("deck", "#b48a5a", rough=0.7); DARK = mat("dark", "#2a2d33", metal=0.5, rough=0.5); STEEL = mat("steel", "#c9ced8", metal=0.85, rough=0.25)
    SAIL = two_sided(mat("sail", "#f6f2e8", rough=0.8)); GLASS = mat("glass", "#1c3550", metal=0.3, rough=0.05, alpha=0.8)
    def sec(x, w, top, keel):
        return [(x, 0, keel), (x, w * 0.55, keel * 0.4 + top * 0.2), (x, w, top - 2), (x, w * 0.98, top), (x, -w * 0.98, top), (x, -w, top - 2), (x, -w * 0.55, keel * 0.4 + top * 0.2)]
    hull = loft("hull", [sec(-42, 9, 7, 3), sec(-30, 12, 7.5, -1), sec(-5, 13.5, 8, -3), sec(20, 11, 8.6, -2), sec(36, 5, 9.4, 1), sec(45, 0.4, 10, 5)], HULL); smooth(hull)
    parts = [hull]
    parts.append(prism("deck", [(-41, -8.6), (-5, -13), (20, -10.6), (36, -4.6), (44, 0), (36, 4.6), (20, 10.6), (-5, 13), (-41, 8.6)], 0.6, DECK, axis="z", off=8.2))
    for s in (-1, 1): parts.append(box("stripe", 70, 0.2, 1, -3, s * 12.7, 6, NAVY))
    parts.append(box("cabin", 26, 14, 5, 4, 0, 11, HULL, bevel=1.2))
    for s in (-1, 1): parts.append(box("port", 14, 0.3, 1.6, 4, s * 7.05, 11.5, GLASS))
    parts.append(box("keel", 16, 1.4, 16, -2, 0, -9, NAVY)); parts.append(box("bulb", 12, 3, 3, -3, 0, -17, DARK))
    parts.append(box("rudder", 4, 1, 10, -38, 0, -2, NAVY))
    parts.append(cyl("mast", 0.8, 120, 8, 0, 70, STEEL, seg=10)); parts.append(cyl("boom", 0.6, 34, -9, 0, 18, STEEL, axis="x", seg=8))
    # mainsail behind the mast, jib in front (thin two-sided plates)
    parts.append(prism("main", [(7.5, 19), (-25, 19), (7.5, 126)], 0.2, SAIL, axis="y", off=0))
    parts.append(prism("jib", [(9, 12), (40, 10), (9, 110)], 0.2, SAIL, axis="y", off=0))
    for s in (-1, 1): parts.append(box("rail", 64, 0.3, 0.3, -2, s * 11, 13, STEEL))
    parts.append(cyl("wheelst", 3, 0.4, -30, 0, 13, DARK, axis="x", seg=16))
    body = join(parts, "body"); smooth(body)

def yacht():
    WHITE = mat("white", "#f6f6f8", metal=0.2, rough=0.25, clearcoat=0.6); DARK = mat("tint", "#1a2230", metal=0.6, rough=0.08)
    TEAK = mat("teak", "#9a6a3a", rough=0.7); STEEL = mat("steel", "#c9ced8", metal=0.9, rough=0.2); NAVY = mat("navy", "#16233d", metal=0.3, rough=0.35)
    LAMP = mat("lamp", "#fff4d8", emit=3)
    def sec(x, w, top, keel):
        return [(x, 0, keel), (x, w * 0.7, keel * 0.5 + 2), (x, w, top - 6), (x, w * 1.02, top), (x, -w * 1.02, top), (x, -w, top - 6), (x, -w * 0.7, keel * 0.5 + 2)]
    hull = loft("hull", [sec(-70, 20, 13, 2), sec(-40, 22, 13.5, -4), sec(0, 22.5, 14, -6), sec(36, 18, 15.5, -4), sec(58, 9, 17, 0), sec(70, 0.5, 18.5, 8)], WHITE); smooth(hull)
    parts = [hull]
    for s in (-1, 1): parts.append(box("band", 120, 0.3, 4, -6, s * 22.4, 6, NAVY)); parts.append(box("portholes", 50, 0.3, 1.6, -10, s * 22.5, 10.5, DARK))
    parts.append(prism("deck", [(-69, -19.5), (0, -22), (36, -17.6), (58, -8.6), (68, 0), (58, 8.6), (36, 17.6), (0, 22), (-69, 19.5)], 0.6, TEAK, axis="z", off=13.6))
    # main deck saloon, upper deck, flybridge with radar arch
    sal = loft("saloon", [[(-50, -17, 13), (-50, 17, 13), (-50, 16, 25), (-50, -16, 25)], [(30, -17, 13), (30, 17, 13), (22, 15.5, 25), (22, -15.5, 25)]], WHITE); parts.append(sal)
    for s in (-1, 1): parts.append(box("salwin", 60, 0.3, 7, -12, s * 16.6, 19.5, DARK))
    ws = box("salws", 0.5, 28, 9, 26, 0, 19.5, DARK); ws.rotation_euler = (0, -0.6, 0); parts.append(ws)
    up = loft("upper", [[(-40, -14, 25), (-40, 14, 25), (-40, 13, 33), (-40, -13, 33)], [(12, -14, 25), (12, 14, 25), (6, 12.5, 33), (6, -12.5, 33)]], WHITE); parts.append(up)
    for s in (-1, 1): parts.append(box("upwin", 36, 0.3, 5, -16, s * 13.6, 29.5, DARK))
    parts.append(box("flybridge", 26, 22, 1, -18, 0, 33.5, WHITE)); parts.append(box("helm", 6, 8, 5, -8, 0, 36.5, WHITE))
    arch = loft("arch", [[(-26, -11, 33), (-26, 11, 33), (-22, 9, 44), (-22, -9, 44)], [(-30, -11, 33), (-30, 11, 33), (-27, 9, 44), (-27, -9, 44)]], WHITE); parts.append(arch)
    parts.append(cyl("radar", 3, 0.8, -24, 0, 45, DARK, seg=16)); parts.append(cyl("mastlamp", 0.5, 4, -24, 0, 48, STEEL, seg=8)); parts.append(sphere("toplamp", 0.6, -24, 0, 50, LAMP))
    for s in (-1, 1): parts.append(box("rail", 80, 0.4, 0.4, 20, s * 19, 18.5, STEEL))
    parts.append(box("swimdeck", 10, 36, 1, -73, 0, 6, TEAK))
    for k in range(3): parts.append(box("sun", 8, 4, 1, 46 + k * 0, -8 + k * 8, 15, NAVY))
    body = join(parts, "body"); smooth(body)

def hovercraft():
    RED = mat("red", "#c0392b", metal=0.25, rough=0.4, clearcoat=0.3); WHITE = mat("white", "#f2f2f4", metal=0.2, rough=0.35)
    RUB = mat("skirt", "#1a1b1e", rough=0.9); DARK = mat("dark", "#2a2d33", metal=0.5, rough=0.5); GLASS = mat("glass", "#1c3550", metal=0.3, rough=0.05, alpha=0.8)
    STEEL = mat("steel", "#9aa0a8", metal=0.85, rough=0.3); LAMP = mat("lamp", "#fff4d8", emit=3)
    def sec(x, w, zb, zt):
        return [(x, w * 0.9, zb), (x, w, (zb + zt) / 2), (x, w * 0.92, zt), (x, -w * 0.92, zt), (x, -w, (zb + zt) / 2), (x, -w * 0.9, zb)]
    skirt = loft("skirt", [sec(-25, 11, 0, 7), sec(-24, 13, 0, 7.5), sec(20, 13, 0, 7.5), sec(25, 9, 0, 7), sec(26.5, 5, 1, 7)], RUB); smooth(skirt)
    parts = [skirt, box("deck", 48, 24, 2, 0, 0, 8.5, RED, bevel=0.6)]
    cab = loft("cab", [[(14, -9, 9), (14, 9, 9), (12, 8, 18), (12, -8, 18)], [(-10, -9.5, 9), (-10, 9.5, 9), (-8, 8.5, 18.5), (-8, -8.5, 18.5)]], WHITE); parts.append(cab)
    ws = box("ws", 0.4, 15, 6, 13, 0, 14.5, GLASS); ws.rotation_euler = (0, -0.35, 0); parts.append(ws)
    for s in (-1, 1): parts.append(box("win", 18, 0.3, 5, 2, s * 9.2, 14.5, GLASS)); parts.append(box("hl", 0.4, 2, 1, 24.8, s * 6, 9, LAMP))
    # two fan ducts at the back with rudders
    for s in (-1, 1):
        duct = cyl("duct", 6.4, 3, -19, s * 6.2, 16, RED, axis="x", seg=24); parts.append(duct)
        parts.append(cyl("ductin", 5.6, 3.2, -19, s * 6.2, 16, DARK, axis="x", seg=24))
        parts.append(box("rudder", 3, 0.5, 11, -22, s * 6.2, 16, WHITE))
        parts.append(box("pylon", 4, 2, 6, -18, s * 6.2, 11, DARK))
    body = join(parts, "body"); smooth(body)
    for s, nm in ((-1, "prop_r"), (1, "prop_l")):
        pp = [box("blade", 0.4, 1.2, 11, 0, 0, 0, DARK), box("blade2", 0.4, 11, 1.2, 0, 0, 0, DARK), sphere("hub", 1, 0, 0, 0, STEEL)]
        p = join(pp, nm); origin_to(p, 0, 0, 0); p.location = (-18, s * 6.2, 16)

BUILD = {"tank": tank, "tractor": tractor, "forklift": forklift, "mixer": mixer, "plane": plane, "seaplane": lambda: plane(True),
         "sailboat": sailboat, "yacht": yacht, "hovercraft": hovercraft}
VIEW = {"tank": (150, 12), "tractor": (75, 10), "forklift": (60, 10), "mixer": (150, 14), "plane": (180, 10), "seaplane": (180, 12),
        "sailboat": (260, 40), "yacht": (220, 16), "hovercraft": (95, 10)}
if __name__ == "__main__":
    mid, out = sys.argv[1], sys.argv[2]
    reset()
    BUILD[mid]()
    export(out)
    if len(sys.argv) > 3:
        d, z = VIEW[mid]
        preview(sys.argv[3], dist=d, target=(0, 0, z), elev=0.35, az=-0.8, samples=12, res=(640, 360))
