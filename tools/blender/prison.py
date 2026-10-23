import sys, math; sys.path.insert(0, __file__.rsplit("/", 1)[0])
from lib import *
CON = lambda: mat("concrete", "#a39d92", rough=0.85)
CON2 = lambda: mat("concrete2", "#8c867c", rough=0.9)
STEEL = lambda: mat("steel", "#5c6168", metal=0.8, rough=0.4)
DARK = lambda: mat("dark", "#2a2d34", metal=0.5, rough=0.5)
GLASS = lambda: mat("glass", "#3a5470", metal=0.2, rough=0.05, alpha=0.8)
YEL = lambda: mat("yellow", "#f2c12e", rough=0.5)
LAMP = lambda: mat("lamp", "#fff6e0", emit=6)
WIRE = lambda: mat("wire", "#9aa0a8", metal=0.9, rough=0.3)
SH = "/tmp/claude-0/-home-user-GTA6-/27369861-5734-5d94-98ab-80fb98d1d089/scratchpad/shots/"

def razor(parts, x0, x1, y, z):
    # razor wire: a row of rings on posts along x
    n = int((x1 - x0) / 3)
    for k in range(n):
        r = cyl("coil", 1.6, 0.25, x0 + k * 3 + 1.5, y, z, WIRE(), axis="x", seg=10); parts.append(r)
    for k in range(int((x1 - x0) / 20) + 1):
        parts.append(box("post", 0.5, 0.5, 4, x0 + k * 20, y, z - 1.5, STEEL()))

def wall():
    reset()
    p = [box("wall", 100, 6, 60, 0, 0, 30, CON(), bevel=0.4), box("cap", 100, 8, 2, 0, 0, 61, CON2())]
    for k in range(5): p.append(box("pillar", 4, 8, 60, -40 + k * 20, 0, 30, CON2(), bevel=0.3))
    razor(p, -50, 50, 0, 64)
    o = join(p, "wall"); smooth(o)
    export("out/prison_wall.glb"); preview(SH + "b_prison_wall.png", dist=140, target=(0, 0, 30))

def tower():
    reset()
    p = []
    for sx in (-1, 1):
        for sy in (-1, 1): p.append(box("leg", 3, 3, 90, sx * 8, sy * 8, 45, CON(), bevel=0.3))
    p += [box("shaft", 12, 12, 80, 0, 0, 40, CON2(), bevel=0.4), box("deck", 28, 28, 3, 0, 0, 91.5, CON(), bevel=0.4)]
    p += [box("cabin_lo", 22, 22, 6, 0, 0, 96, CON2()), box("roof", 30, 30, 2, 0, 0, 113, DARK(), bevel=0.4)]
    for k in range(4):
        a = k * math.pi / 2
        g = box("glass", 20, 0.4, 10, math.cos(a) * 11, math.sin(a) * 11, 104, GLASS()); g.rotation_euler = (0, 0, a + math.pi / 2); p.append(g)
        c = box("corner", 1.2, 1.2, 12, math.cos(a + math.pi / 4) * 15.4, math.sin(a + math.pi / 4) * 15.4, 105, DARK()); p.append(c)
    for k in range(4):
        a = k * math.pi / 2
        r = box("rail", 28, 0.5, 0.5, math.cos(a) * 13.8, math.sin(a) * 13.8, 97, STEEL()); r.rotation_euler = (0, 0, a + math.pi / 2); p.append(r)
    # stairs up the shaft, searchlight on the roof
    for k in range(14):
        p.append(box("step", 6, 3, 0.8, 9 if (k // 7) % 2 == 0 else -9, -6 + (k % 7) * 2, 6 + k * 6, STEEL()))
    p.append(cyl("slight", 2.2, 4, 10, 0, 117, DARK(), axis="x", seg=16)); p.append(cyl("slens", 2, 0.4, 12.2, 0, 117, LAMP(), axis="x", seg=16))
    p.append(box("slbase", 3, 3, 3, 8, 0, 115, DARK()))
    o = join(p, "tower"); smooth(o)
    export("out/prison_tower.glb"); preview(SH + "b_prison_tower.png", dist=230, target=(0, 0, 60), elev=0.25)

def gate():
    reset()
    p = [box("pierL", 16, 14, 70, -46, 0, 35, CON2(), bevel=0.5), box("pierR", 16, 14, 70, 46, 0, 35, CON2(), bevel=0.5),
         box("lintel", 108, 14, 12, 0, 0, 76, CON(), bevel=0.5)]
    # sliding steel gate (own node: the game slides it open)
    gp = [box("gateframe", 76, 2, 54, 0, 0, 28, STEEL())]
    for k in range(18): gp.append(box("gbar", 1.2, 2.6, 52, -36 + k * 4.2, 0, 28, DARK()))
    for z in (8, 28, 48): gp.append(box("gcross", 76, 2.8, 2, 0, 0, z, DARK()))
    for k in range(9): gp.append(box("stripe", 4, 3, 4, -32 + k * 8, 0, 3, YEL() if k % 2 == 0 else DARK()))
    gte = join(gp, "gate")
    # booth with a window, sign, floodlights, wire on top
    p += [box("booth", 22, 18, 30, 66, 14, 15, CON(), bevel=0.4), box("boothroof", 26, 22, 2, 66, 14, 31, DARK()),
          box("bwin", 14, 0.4, 9, 66, 4.8, 18, GLASS()), box("barrier", 30, 1.2, 1.2, 66 - 26, 14 + 8, 10, YEL())]
    p.append(text("sign", "HAFTANSTALT SOLARA BAY", 5, 0, -7.2, 76, mat("white", "#f2f4f8", rough=0.4), rot=(math.pi / 2, 0, 0)))
    for sx in (-1, 1):
        p.append(cyl("flood", 2.2, 3, sx * 46, -7, 74, DARK(), axis="y", seg=12)); p.append(cyl("fglass", 2, 0.4, sx * 46, -8.6, 74, LAMP(), axis="y", seg=12))
    razor(p, -54, 54, 0, 85)
    o = join(p, "frame"); smooth(o)
    export("out/prison_gate.glb"); preview(SH + "b_prison_gate.png", dist=200, target=(10, 0, 35), az=-1.2)

def block():
    reset()
    # three storey cell block: concrete, rows of small barred windows, entrance with canopy
    L, W, H = 160, 60, 96
    p = [box("blk", L, W, H, 0, 0, H / 2, CON(), bevel=0.6), box("roof", L + 4, W + 4, 3, 0, 0, H + 1.5, CON2())]
    for fl in range(3):
        z = 14 + fl * 30
        p.append(box("band", L + 1, W + 1, 1.6, 0, 0, z + 12, CON2()))
        for k in range(12):
            x = -66 + k * 12
            for sy in (-1, 1):
                p.append(box("win", 4, 0.6, 8, x, sy * (W / 2 + 0.1), z, mat("winbg", "#1c2128", rough=0.6)))
                for b in range(3): p.append(box("wbar", 0.4, 0.8, 8.4, x - 1.3 + b * 1.3, sy * (W / 2 + 0.3), z, STEEL()))
    p += [box("door", 20, 1, 22, 0, -W / 2 - 0.2, 11, STEEL()), box("canopy", 34, 10, 1.6, 0, -W / 2 - 5, 24, DARK())]
    p.append(text("bsign", "ZELLENBLOCK A", 6, 0, -W / 2 - 0.5, 34, mat("white", "#f2f4f8", rough=0.4), rot=(math.pi / 2, 0, 0)))
    for k in range(3): p.append(cyl("vent", 3, 6, -50 + k * 50, 12, H + 4, STEEL(), seg=12))
    o = join(p, "block"); smooth(o)
    export("out/prison_block.glb"); preview(SH + "b_prison_block.png", dist=300, target=(0, 0, 40), az=-1.9)

{"wall": wall, "tower": tower, "gate": gate, "block": block}[sys.argv[-1]]()
