import sys, math; sys.path.insert(0, __file__.rsplit("/", 1)[0])
from lib import *
SH = "/tmp/claude-0/-home-user-GTA6-/27369861-5734-5d94-98ab-80fb98d1d089/scratchpad/shots/"
def station():
    reset()
    WHITE = mat("white", "#f2f2ee", rough=0.5); RED = mat("red", "#d62a3a", rough=0.45, clearcoat=0.4); DARK = mat("dark", "#2a2d34", metal=0.5, rough=0.5)
    GLASS = mat("glass", "#4a6a88", metal=0.2, rough=0.05, alpha=0.6); LIGHT = mat("light", "#fff4dc", emit=4); STEEL = mat("steel", "#9aa0a8", metal=0.8, rough=0.35)
    NEON = mat("neon", "#ff3cac", emit=8); YEL = mat("yellow", "#ffd23f", rough=0.5); CON = mat("concrete", "#bdb8ae", rough=0.9)
    p = [box("pad", 150, 110, 1, 0, 0, 0.5, CON)]
    # canopy on four columns with lights underneath
    p += [box("canopy", 100, 60, 6, -10, 0, 52, WHITE, bevel=0.5), box("band", 101, 61, 3, -10, 0, 50, RED)]
    for sx in (-1, 1):
        for sy in (-1, 1): p.append(box("col", 3, 3, 49, -10 + sx * 30, sy * 18, 24.5, STEEL))
    for k in range(4):
        for j in range(2): p.append(box("lamp", 14, 4, 0.4, -40 + k * 20, -12 + j * 24, 48.6, LIGHT))
    # pump islands
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = -10 + sx * 15, sy * 18
            p += [box("island", 22, 6, 1.6, x, y, 1.3, CON), box("pump", 5, 3.4, 16, x, y, 10, WHITE, bevel=0.3), box("pumptop", 5.4, 3.8, 3, x, y, 19.5, RED, bevel=0.3),
                  box("screen", 2.6, 3.6, 2, x, y, 13, mat("screen", "#2a6bff", emit=2)), cyl("hose", 0.3, 9, x + 2.4, y - 1.8, 9, DARK, seg=6)]
    # the shop behind: glass front, flat roof, neon sign
    p += [box("shop", 40, 50, 30, 52, 0, 15, WHITE, bevel=0.4), box("shoproof", 42, 52, 2, 52, 0, 31, DARK), box("front", 0.4, 34, 18, 31.8, 0, 11, GLASS),
          box("door", 0.6, 10, 20, 31.7, 0, 10, STEEL), box("shopband", 41, 51, 4, 52, 0, 26, RED)]
    p.append(text("neon", "24/7 SHOP", 5.5, 31.4, 0, 26, NEON, rot=(math.pi / 2, 0, -math.pi / 2)))
    p.append(text("brand", "SOLARA FUEL", 6, -10, -30.8, 52, WHITE, rot=(math.pi / 2, 0, 0)))
    p += [box("icebox", 10, 5, 9, 32.5 + 4, -22, 4.5, mat("ice", "#2a7bd8", rough=0.4)), cyl("bin", 2.2, 7, 33, 20, 3.5, DARK, seg=14)]
    # price sign on a pole
    p += [box("pole", 2, 2, 50, -70, -40, 25, STEEL), box("sign", 4, 18, 22, -70, -40, 58, RED, bevel=0.4)]
    for k, t in enumerate(("1.89", "1.99", "2.09")):
        p.append(text("price", t, 4, -72.1, -40, 64 - k * 6, mat("digits", "#ffd23f", emit=3), rot=(math.pi / 2, 0, -math.pi / 2)))
    o = join(p, "station"); smooth(o)
    export("out/gas_station.glb"); preview(SH + "b_gas_station.png", dist=230, target=(0, 0, 18), az=-2.4, elev=0.32)
def cash():
    reset()
    G = mat("bill", "#6f9a5a", rough=0.7); G2 = mat("bill2", "#5d8a4b", rough=0.7); BAND = mat("band", "#c9a227", rough=0.5)
    p = []
    for k in range(6):
        b = box("bill", 6.2, 2.8, 0.18, 0, 0, 0.1 + k * 0.2, G if k % 2 else G2); b.rotation_euler = (0, 0, (k - 3) * 0.03); p.append(b)
    p.append(box("band", 1.2, 2.9, 1.3, 0, 0, 0.65, BAND))
    o = join(p, "cash"); export("out/cash.glb"); preview(SH + "b_cash.png", dist=14, target=(0, 0, 0.5), elev=0.6)
{"station": station, "cash": cash}[sys.argv[-1]]()
