import sys, math; sys.path.insert(0, __file__.rsplit("/", 1)[0])
from lib import *
reset()
POLICE = "police" in sys.argv[-1]
BODY = mat("body", "#1e2c52" if POLICE else "#ff3cac", metal=0.4, rough=0.35, clearcoat=0.5)
TOP = mat("top", "#f2f4f8" if POLICE else "#2a2d34", metal=0.3, rough=0.4)
DARK = mat("dark", "#2a2d34", metal=0.6, rough=0.4)
GLASS = mat("glass", "#22344a", metal=0.3, rough=0.04, alpha=0.8)
WHITE = mat("white", "#f2f4f8", rough=0.4)
RED = mat("red", "#ff2a2a", emit=5); BLUE = mat("blue", "#2a5bff", emit=5); LAMP = mat("lamp", "#fff6e0", emit=6)
def ell(x, w, h, zc, n=18):
    return [(x, math.cos(a) * w, zc + math.sin(a) * h) for a in [i / n * math.tau for i in range(n)]]
# cabin: a teardrop body, glass nose, engine cowling, tail boom with fin and stabiliser
cab = loft("cabin", [ell(19, 0.5, 0.5, 12), ell(17, 4, 4.5, 12.5), ell(12, 7, 8, 14), ell(4, 8, 9, 15), ell(-6, 7.5, 8.5, 15.5), ell(-12, 5, 6, 16), ell(-16, 2.5, 3, 17)], BODY); smooth(cab)
parts = [cab]
parts.append(sphere("nose", 6.6, 11, 0, 13.5, GLASS, sx=1.35, sy=1.0, sz=1.05))
for s in (-1, 1):
    parts.append(sphere("window", 4.2, 0, s * 6.2, 16.8, GLASS, sx=1.5, sy=0.55, sz=0.85))
    parts.append(box("seam", 0.3, 0.3, 9, -6, s * 8.0, 13.5, DARK)); parts.append(box("seam2", 0.3, 0.3, 9, 6, s * 8.1, 13.5, DARK))
parts.append(loft("cowl", [ell(4, 4, 3, 23), ell(-10, 3.5, 2.6, 22.5)], TOP)); 
parts.append(loft("boom", [ell(-14, 2.4, 2.4, 17), ell(-40, 1.0, 1.2, 18.5)], BODY))
parts.append(prism("fin", [(-36, 18), (-44, 30), (-47, 30), (-46, 18)], 0.6, TOP, axis="y"))
parts.append(prism("stab", [(-34, -6), (-38, -6), (-38, 6), (-34, 6)], 0.5, TOP, axis="z", off=18.5))
for s in (-1, 1):
    # skids and their struts
    parts.append(cyl("skid", 0.7, 30, 0, s * 8, 1.5, DARK, axis="x", seg=10))
    parts.append(cyl("skidtip", 0.7, 4, 16.5, s * 8, 2.6, DARK, axis="x", seg=10)); parts[-1].rotation_euler = (0, math.pi / 2 - 0.5, 0)
    for x in (7, -7):
        st = cyl("strut", 0.6, 9, x, s * 7, 6, DARK, seg=8); st.rotation_euler = (s * 0.35, 0, 0); parts.append(st)
    if POLICE:
        parts.append(text("pol", "POLICE", 2.6, -26, s * 2.0, 18, WHITE, rot=(math.pi / 2, 0, 0 if s < 0 else math.pi)))
        parts.append(box("stripe", 22, 0.3, 1.2, 0, s * 8.6, 9.5, WHITE))
parts.append(cyl("mast", 1.2, 4, 0, 0, 25.5, DARK, seg=10))
parts.append(sphere("beacon", 0.6, -46, 0, 30.5, RED))
if POLICE:
    parts.append(cyl("searchlight", 1.8, 3, 14, 0, 7.5, DARK, axis="x", seg=14))
    parts.append(cyl("searchglass", 1.6, 0.4, 15.6, 0, 7.5, LAMP, axis="x", seg=14))
    parts.append(box("lb1", 1, 3, 1, 4, 3, 23.8, RED)); parts.append(box("lb2", 1, 3, 1, 4, -3, 23.8, BLUE))
body = join(parts, "body"); smooth(body)
# main rotor (own node, spins about z) and tail rotor (own node, spins about y)
rp = [cyl("hub", 1.8, 1.4, 0, 0, 27.8, DARK, seg=12)]
for k in range(4):
    b = box("blade", 40, 2.6, 0.35, 21, 0, 27.8, DARK); b.rotation_euler = (0.06, 0, 0)
    origin_to(b, 0, 0, 27.8); b.rotation_euler = (0.06, 0, k * math.pi / 2); rp.append(b)
rot = join(rp, "rotor"); origin_to(rot, 0, 0, 27.8)
tp = [cyl("thub", 0.7, 1, -45, 1.2, 24, DARK, axis="y", seg=8)]
for k in range(2):
    b = box("tblade", 0.8, 0.25, 11, -45, 1.6, 24, DARK); origin_to(b, -45, 1.6, 24); b.rotation_euler = (0, k * math.pi / 2, 0); tp.append(b)
tr = join(tp, "tailrotor"); origin_to(tr, -45, 1.4, 24)
out = sys.argv[-1] if sys.argv[-1].endswith(".glb") else "out/heli.glb"
export(out)
preview(f"/tmp/claude-0/-home-user-GTA6-/27369861-5734-5d94-98ab-80fb98d1d089/scratchpad/shots/b_{out.split('/')[-1][:-4]}.png", dist=120, target=(-8, 0, 14), elev=0.3, az=-0.9)
