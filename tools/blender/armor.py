import sys, math; sys.path.insert(0, __file__.rsplit("/", 1)[0])
from lib import *
reset()
NAVY = mat("navy", "#1a2440", metal=0.35, rough=0.45, clearcoat=0.3)
BLACK = mat("black", "#15171c", metal=0.3, rough=0.55)
DARK = mat("dark", "#2a2e36", metal=0.6, rough=0.4)
RUB = mat("rubber", "#121214", rough=0.9)
HUB = mat("hub", "#5a5f68", metal=0.8, rough=0.35)
WHITE = mat("white", "#f2f4f8", rough=0.4)
GLASS = mat("glass", "#1c3550", metal=0.2, rough=0.05, alpha=0.85)
RED = mat("red", "#ff1838", emit=6)
BLUE = mat("blue", "#2a5bff", emit=6)
HEAD = mat("headlight", "#fff6e0", emit=5)
TAIL = mat("taillight", "#ff2020", emit=3)
YEL = mat("yellow", "#ffc21a", rough=0.5)

# hull: lofted armour body, flat panels like a real APC (x forward, z up, units: 10 = 1 m)
def ring(x, zb, zm, zt, wb, wm, wt):
    return [(x, wb, zb), (x, wm, zm), (x, wt, zt), (x, -wt, zt), (x, -wm, zm), (x, -wb, zb)]
hull = loft("hull", [
    ring(-31, 5, 10, 20, 9, 14, 12),
    ring(-29, 4, 10, 22, 9.5, 14.2, 12.4),
    ring(18, 4, 10, 22, 9.5, 14.2, 12.4),
    ring(24, 5, 10, 18.5, 9, 14, 12),
    ring(30, 7, 10.5, 12.5, 8, 13.4, 11.6),
    ring(31.5, 8.5, 10.5, 11, 6, 12.2, 10.6),
], NAVY)
# dark lower hull and wheel arches (fenders over each wheel pair)
skirt = box("skirt", 58, 26, 4, -0.5, 0, 6.5, BLACK, bevel=0.6)
parts = [hull, skirt]
AX = [-22, -9, 7, 20]
for x in AX:
    for s in (-1, 1):
        parts.append(box("fender", 15, 2.2, 1.2, x, s * 14.8, 13.4, BLACK, bevel=0.3))
# armoured windscreen on the glacis, vision slits on the sides
for s in (-1, 1):
    g = box("ws", 0.6, 9, 5.2, 26.6, s * 5.2, 16.2, GLASS); g.rotation_euler = (0, -0.62, 0); parts.append(g)
    parts.append(box("frame", 0.8, 0.8, 6, 26.2, 0, 16.2, BLACK))
    for x in (12, 0, -12):
        parts.append(box("slit", 7, 0.4, 1.1, x, s * 13.25, 18, GLASS))
        parts.append(box("slitframe", 8, 0.3, 2.0, x, s * 13.1, 18, BLACK))
    # side door outline, hand rails, storage boxes, POLICE lettering
    parts.append(box("door", 0.3, 0.3, 9, -3, s * 14.25, 14.5, BLACK)); parts.append(box("door2", 0.3, 0.3, 9, 9, s * 14.25, 14.5, BLACK))
    parts.append(box("rail", 20, 0.5, 0.5, 0, s * 12.6, 22.6, DARK))
    parts.append(box("store", 9, 2, 4, -22, s * 14.6, 17, BLACK, bevel=0.3))
    t = text("police", "POLICE", 4.2, 2, s * 14.32, 14.2, WHITE, rot=(math.pi / 2, 0, 0 if s < 0 else math.pi))
    parts.append(t)
    parts.append(box("stripe", 46, 0.25, 0.9, 1, s * 14.3, 11.2, mat("stripeblue", "#2a6bff", rough=0.4)))
    # mirrors
    parts.append(box("mirror", 1.2, 3.2, 2.4, 24, s * 15.5, 17, BLACK, bevel=0.2))
# front: push bar, grille, headlights, small POLICE
parts += [box("bumper", 2, 24, 3, 32.3, 0, 8, BLACK, bevel=0.4), box("grille", 0.5, 12, 3, 31.4, 0, 11.6, DARK)]
for s in (-1, 1):
    parts.append(box("headl", 0.6, 3.4, 1.8, 31.2, s * 8.5, 11.2, HEAD)); parts.append(box("hook", 2, 1.4, 1.4, 33, s * 9, 8, YEL))
    parts.append(box("tail", 0.6, 2.4, 1.6, -31.3, s * 9.5, 15, TAIL))
t = text("policef", "POLICE", 2.4, 30.2, 0, 13.2, WHITE, rot=(math.pi / 2, 0, math.pi / 2)); t.rotation_euler = (math.pi / 2 - 0.0, 0, math.pi / 2); parts.append(t)
# rear: door, spare wheel, ladder
parts += [box("rdoor", 0.4, 12, 12, -31.2, 0, 13, BLACK)]
parts.append(cyl("spare", 5.4, 3, -33.4, 7, 14, RUB, axis="x", bevel=0.6)); parts.append(cyl("sparehub", 2.6, 3.4, -33.4, 7, 14, HUB, axis="x"))
for k in range(5): parts.append(box("ladder", 0.4, 4, 0.4, -31.7, -8, 7 + k * 2.6, DARK))
# roof: light bar, hatches, antennas
parts += [box("barbase", 4, 14, 1, 14, 0, 22.6, BLACK)]
for i in range(6):
    parts.append(box("bar", 3, 2, 1.4, 14, -5 + i * 2, 23.6, RED if i < 3 else BLUE))
for x in (-16, -6):
    parts.append(cyl("hatch", 3, 0.8, x, 6, 22.4, DARK, seg=16))
for s in (-1, 1): parts.append(cyl("ant", 0.2, 14, -26, s * 9, 29, BLACK, seg=6))
body = join(parts, "body"); smooth(body)

# turret (own node: the game turns it towards the target)
tparts = [
    cyl("tbase", 7, 2, 0, 0, 23.5, DARK, seg=28),
    loft("tbody", [ring(-7, 24, 26, 29.5, 6.5, 7.5, 6), ring(5, 24, 26, 29.5, 6.5, 7.5, 6), ring(8, 24.5, 26, 28.5, 5, 6.5, 5)], NAVY),
    cyl("mantlet", 2.2, 3, 9, 0, 26.6, BLACK, axis="x"),
    cyl("barrel", 0.9, 22, 20, 0, 26.6, DARK, axis="x", seg=12),
    cyl("muzzle", 1.4, 3, 31, 0, 26.6, BLACK, axis="x", seg=12),
    box("hatcht", 4, 4, 0.8, -3, 2.5, 29.9, BLACK, bevel=0.3),
    box("light", 1.2, 2.4, 1.6, 6, -5, 28.6, HEAD),
]
for s in (-1, 1):
    for k in range(3): tparts.append(cyl("smoke", 0.7, 2.6, 0, s * 6.8, 26.5 + k * 1.3, BLACK, axis="y", seg=8))
tur = join(tparts, "turret"); smooth(tur); origin_to(tur, 0, 0, 24)

# wheels: own nodes so they can spin (axis y), named wheel_<i>
for i, x in enumerate(AX):
    for j, s in enumerate((-1, 1)):
        t = cyl("tyre", 6, 4.4, x, s * 13.4, 6, RUB, axis="y", seg=28, bevel=1.2)
        h = cyl("rim", 3.4, 4.6, x, s * 13.5, 6, HUB, axis="y", seg=16)
        hub = cyl("cap", 1.2, 4.8, x, s * 13.6, 6, DARK, axis="y", seg=8)
        w = join([t, h, hub], f"wheel_{i * 2 + j}"); smooth(w); origin_to(w, x, s * 13.4, 6)
export(sys.argv[-1] if sys.argv[-1].endswith(".glb") else "out/armor.glb")
preview("/tmp/claude-0/-home-user-GTA6-/27369861-5734-5d94-98ab-80fb98d1d089/scratchpad/shots/b_armor.png", dist=110, target=(0, 0, 14))
