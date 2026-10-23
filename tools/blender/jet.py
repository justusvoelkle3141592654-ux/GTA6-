import sys, math; sys.path.insert(0, __file__.rsplit("/", 1)[0])
from lib import *
reset()
POLICE = "police" in sys.argv[-1]
BODY = mat("body", "#1e2c52" if POLICE else "#7f8b98", metal=0.5, rough=0.4, clearcoat=0.4)
BELLY = mat("belly", "#e8ecf2" if POLICE else "#a8b2bc", metal=0.4, rough=0.45)
DARK = mat("dark", "#2a2d34", metal=0.6, rough=0.4)
NOZ = mat("nozzle", "#45484f", metal=0.9, rough=0.3)
GLASS = mat("canopy", "#2a3c55", metal=0.4, rough=0.04, alpha=0.75)
WHITE = mat("white", "#f2f4f8", rough=0.4)
MIS = mat("missile", "#e6e8ec", metal=0.3, rough=0.4)
RED = mat("red", "#ff2a2a", emit=5); GREEN = mat("green", "#2aff6a", emit=5); STROBE = mat("strobe", "#ffffff", emit=6)
RUB = mat("rubber", "#121214", rough=0.9)
Y = 10  # height of the fuselage axis above the ground (wheels down)

# fuselage: elliptic sections from the nose (x 40) to the nozzle (x -34)
def ell(x, w, h, zc=Y, n=16, flat=0.0):
    return [(x, math.cos(a) * w, zc + math.sin(a) * h * (1 - flat * (math.sin(a) < 0))) for a in [i / n * math.tau for i in range(n)]]
fus = loft("fuselage", [
    ell(41, 0.3, 0.3), ell(38, 1.4, 1.3), ell(33, 2.6, 2.4), ell(26, 3.4, 3.2), ell(18, 4.0, 3.6),
    ell(8, 4.4, 3.8), ell(-6, 4.6, 3.8), ell(-20, 4.4, 3.4), ell(-30, 3.8, 3.0), ell(-33, 3.5, 2.8),
], BODY); smooth(fus)
parts = [fus]
# canopy and the spine behind it
parts.append(sphere("canopy", 3.2, 20, 0, Y + 2.8, GLASS, sx=3.0, sy=0.85, sz=0.8))
parts.append(loft("spine", [ell(14, 1.6, 1.0, Y + 3.6), ell(4, 1.8, 1.2, Y + 3.8), ell(-24, 1.2, 0.8, Y + 3.2)], BODY))
# intakes on both sides
for s in (-1, 1):
    parts.append(loft("intake", [[(12, s * 3.6, Y - 1.5), (12, s * 6.4, Y - 1.5), (12, s * 6.4, Y + 1.6), (12, s * 3.6, Y + 1.6)],
                                  [(-8, s * 3.8, Y - 1.8), (-8, s * 6.0, Y - 1.8), (-8, s * 6.0, Y + 1.4), (-8, s * 3.8, Y + 1.4)]], BODY))
    parts.append(box("intakehole", 0.3, 2.4, 2.8, 12.1, s * 5.0, Y, DARK))
# wings, tailplanes, twin fins (outlines in x/y, thin along z)
def plate(name, pts, th, z, m):
    return prism(name, pts, th, m, axis="z", off=z)
for s in (-1, 1):
    parts.append(plate("wing", [(10, s * 4), (-12, s * 27), (-19, s * 27), (-20, s * 4)], 1.0, Y - 0.6, BODY))
    parts.append(plate("tailplane", [(-22, s * 3.5), (-31, s * 13), (-35, s * 13), (-34, s * 3.5)], 0.7, Y - 0.3, BODY))
    fin = prism("fin", [(-20, 0), (-30, 14), (-35, 14), (-34, 0)], 0.8, BODY, axis="y", off=0)
    fin.location = (0, s * 3.0, Y + 2.0); fin.rotation_euler = (s * -0.3, 0, 0); parts.append(fin)
    # missiles on rails under the wings
    parts.append(cyl("missile", 0.9, 13, -6, s * 15, Y - 2.6, MIS, axis="x", seg=12))
    parts.append(cyl("mhead", 0.9, 2.2, 1.5, s * 15, Y - 2.6, MIS, axis="x", seg=12, r2=0.05))
    parts.append(box("pylon", 6, 0.5, 1.4, -6, s * 15, Y - 1.4, DARK))
    for k in (-1, 1): parts.append(box("mfin", 2, 0.2, 2.4, -12, s * 15 + k * 0.0, Y - 2.6, MIS))
    parts.append(box("wlight", 1.2, 0.6, 0.6, -15, s * 27.2, Y - 0.6, GREEN if s > 0 else RED))
    # police livery: white band on the wings, POLICE on top of each wing
    ACC = mat("accent", "#ff8a1f", rough=0.4)
    if not POLICE:
        parts.append(plate("band", [(4, s * 6.5), (-6.5, s * 16), (-9, s * 16), (-1.5, s * 6.5)], 1.1, Y - 0.55, ACC))
        parts.append(box("finstripe", 6, 0.3, 4, -30, s * 4.6, Y + 9, ACC))
    if POLICE:
        parts.append(plate("band", [(4, s * 6.5), (-6.5, s * 16), (-9, s * 16), (-1.5, s * 6.5)], 1.1, Y - 0.55, WHITE))
        t = text("police", "POLICE", 3.0, -13, s * 15.5, Y - 0.0, WHITE, rot=(0, 0, -math.pi / 2), extrude=0.04)
        t.rotation_euler = (0, 0, -math.pi / 2 if s > 0 else math.pi / 2); parts.append(t)
        parts.append(box("finstripe", 6, 0.3, 4, -30, s * 4.6, Y + 9, WHITE))
parts.append(cyl("nozzle", 3.2, 4, -35, 0, Y, NOZ, axis="x", r2=2.6, seg=20))
parts.append(cyl("nozzlein", 2.4, 4.2, -35.2, 0, Y, DARK, axis="x", seg=20))
parts.append(sphere("tailstrobe", 0.5, -34.5, 0, Y + 15, STROBE))
parts.append(cyl("probe", 0.2, 6, 43, 0, Y, DARK, axis="x", seg=6))
if POLICE:
    for s in (-1, 1):
        t = text("pside", "POLICE", 2.2, 26, s * 3.45, Y - 0.6, WHITE, rot=(math.pi / 2, 0, 0 if s < 0 else math.pi)); parts.append(t)
if not POLICE:
    for s in (-1, 1): parts.append(text("num", "SB-01", 2.0, 24, s * 3.5, Y - 0.6, DARK, rot=(math.pi / 2, 0, 0 if s < 0 else math.pi)))
body = join(parts, "body"); smooth(body)
# landing gear: own node (hidden in the air by the game)
gp = []
for gx, gy in ((24, 0), (-8, -5.5), (-8, 5.5)):
    gp.append(cyl("strut", 0.45, Y - 4, gx, gy, (Y - 4) / 2 + 2.2, DARK, seg=8))
    gp.append(cyl("wheel", 2.0, 1.4, gx, gy, 2.0, RUB, axis="y", seg=16, bevel=0.4))
gear = join(gp, "gear"); smooth(gear)
out = sys.argv[-1] if sys.argv[-1].endswith(".glb") else "out/jet.glb"
export(out)
preview(f"/tmp/claude-0/-home-user-GTA6-/27369861-5734-5d94-98ab-80fb98d1d089/scratchpad/shots/b_{out.split('/')[-1][:-4]}.png", dist=115, target=(0, 0, 8), elev=0.55, az=-2.3)
