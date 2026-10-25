# several Cycles views of a GLB in one picture (front, side, three quarter, a close-up of the head)
# python3 tools/blender/preview_views.py in.glb out.png [object name]
import sys, math; sys.path.insert(0, __file__.rsplit("/", 1)[0])
from lib import *
import bpy
from mathutils import Vector
src, out = sys.argv[1], sys.argv[2]
only = sys.argv[3] if len(sys.argv) > 3 else None
reset()
bpy.ops.import_scene.gltf(filepath=src)
for o in bpy.context.scene.objects:
    if only and o.type == "MESH" and o.name != only: o.hide_render = True
sc = bpy.context.scene
cam = bpy.data.cameras.new("cam"); co = bpy.data.objects.new("cam", cam); sc.collection.objects.link(co); sc.camera = co
sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 3.5; so = bpy.data.objects.new("sun", sun); sc.collection.objects.link(so); so.rotation_euler = (0.8, 0.1, 0.6)
fill = bpy.data.lights.new("fill", "SUN"); fill.energy = 1.2; fo = bpy.data.objects.new("fill", fill); sc.collection.objects.link(fo); fo.rotation_euler = (1.2, 0, -2.4)
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.6, 0.65, 0.7, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.6
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 12; sc.cycles.use_denoising = True; sc.view_settings.view_transform = "AgX"
views = [(-math.pi / 2 + 0.0001, 0.05, 26, 9.3, 300, 640), (0.0001, 0.05, 26, 9.3, 300, 640), (-0.75, 0.15, 26, 9.3, 300, 640), (-0.5, 0.1, 5.5, 16.8, 300, 640)]
import os
if os.environ.get("HEAD"):
    hz = float(os.environ.get("HEAD"))
    views = [(0.0001, 0.05, 7, hz, 400, 480), (-math.pi / 2 + 0.0001, 0.05, 7, hz, 400, 480), (-0.6, 0.12, 7, hz, 400, 480)]
# az measured from +x (front of the figure); the figure looks along +x
paths = []
for i, (az, el, dist, tz, rx, ry) in enumerate(views):
    t = Vector((0, 0, tz))
    co.location = t + Vector((math.cos(az + math.pi / 2) * 0 + math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el))) * dist
    d = t - co.location; co.rotation_euler = d.to_track_quat("-Z", "Y").to_euler(); cam.lens = 50
    sc.render.resolution_x, sc.render.resolution_y = rx, ry
    p = out + f".{i}.png"; sc.render.filepath = p; bpy.ops.render.render(write_still=True); paths.append(p)
from PIL import Image
ims = [Image.open(p) for p in paths]
o = Image.new("RGB", (sum(i.width for i in ims), max(i.height for i in ims)), (255, 255, 255)); x = 0
for im in ims: o.paste(im, (x, 0)); x += im.width
o.save(out)
