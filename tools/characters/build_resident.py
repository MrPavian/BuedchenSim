"""
Builds a resident figure in Blender (headless, `bpy`) and exports it as GLB for the game.

    python tools/characters/build_resident.py --resident guenter --out public/models/residents/n-002.glb

Requires the Blender Python module (`pip install bpy==5.3.0`, Python 3.13). The script is the source of the asset: it is
versioned, deterministic and can be handed to an artist later (the GLB contract is documented in
docs/VISUAL-BASELINE.md, "Figuren-Pipeline").

Construction (Auftrag 04.5, character prototype):
- Body: a joint graph turned into one organic mesh by the Skin modifier plus subdivision (no seams at the joints).
- Head: a separately shaped mesh (nose, brow, cheek bones, jaw, chin, eye sockets) with eyes, brows, ears, moustache
  and hair; rigidly parented to the head bone.
- Clothing: jacket as its own shell over the torso and arms (offset, folds by displacement, hem and cuffs), trousers
  and shoes as material zones of the body, plus cap, scarf and walking stick.
- Rig: hand-built armature with named bones, automatic weights; actions "idle", "walk", "talk".
- Orientation: the figure faces Blender -Y, which the glTF exporter turns into +Z (the game's front). 1 unit = 1 m,
  pivot at the feet.
"""

import argparse
import math
import random
import sys

import bpy  # noqa: I001 - bpy must be imported before bmesh
import bmesh
from mathutils import Matrix, Vector

# ---------------------------------------------------------------------------------------------------------------------
# Resident specifications (only Günter so far: the prototype; the others follow after acceptance).

RESIDENTS = {
    "guenter": {
        "name": "N-002 Guenter",
        "height": 1.72,
        "stoop": 0.10,  # forward lean of the upper body (rad)
        "skin": (0.80, 0.58, 0.47),
        "skin_shadow": (0.68, 0.45, 0.37),
        "hair": (0.86, 0.85, 0.82),
        "eyes": (0.33, 0.42, 0.50),
        "jacket": (0.42, 0.43, 0.43),
        "jacket_dark": (0.30, 0.31, 0.31),
        "shirt": (0.78, 0.76, 0.70),
        "trousers": (0.20, 0.21, 0.24),
        "shoes": (0.17, 0.12, 0.09),
        "cap": (0.40, 0.38, 0.27),
        "scarf": (0.62, 0.14, 0.12),
        "stick": (0.38, 0.24, 0.14),
        "seed": 2,
    }
}

# ---------------------------------------------------------------------------------------------------------------------
# Helpers


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = 30


def material(name, color, roughness=0.8, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def apply_modifiers(obj):
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj], selected_editable_objects=[obj]):
        for mod in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)


def smooth(obj):
    for poly in obj.data.polygons:
        poly.use_smooth = True


def ellipsoid(name, radii, location, segments=24, rings=16, mat=None):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=1.0)
    bmesh.ops.scale(bm, vec=Vector(radii), verts=bm.verts)
    bm.to_mesh(mesh)
    bm.free()
    obj = link(bpy.data.objects.new(name, mesh))
    obj.location = location
    smooth(obj)
    if mat:
        obj.data.materials.append(mat)
    return obj


def cylinder(name, radius, depth, location, rotation=(0, 0, 0), segments=16, mat=None, radius_top=None):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, segments=segments, radius1=radius, radius2=radius if radius_top is None else radius_top, depth=depth
    )
    bm.to_mesh(mesh)
    bm.free()
    obj = link(bpy.data.objects.new(name, mesh))
    obj.location = location
    obj.rotation_euler = rotation
    smooth(obj)
    if mat:
        obj.data.materials.append(mat)
    return obj


# ---------------------------------------------------------------------------------------------------------------------
# Skeleton (joint positions, metres, figure standing at the origin facing -Y)


def joints(spec):
    s = spec["height"] / 1.75  # proportions are designed for 1.75 m
    j = {
        "pelvis": (0, 0, 0.93),
        "spine": (0, 0.005, 1.10),
        "chest": (0, 0.015, 1.28),
        "neck": (0, 0.02, 1.47),
        "head": (0, 0.02, 1.53),
        "shoulder.L": (0.19, 0.03, 1.43),
        "elbow.L": (0.235, 0.05, 1.14),
        "wrist.L": (0.25, 0.02, 0.88),
        "hand.L": (0.255, 0.01, 0.785),
        "shoulder.R": (-0.19, 0.03, 1.43),
        "elbow.R": (-0.235, 0.05, 1.14),
        "wrist.R": (-0.25, 0.02, 0.88),
        "hand.R": (-0.255, 0.01, 0.785),
        "hip.L": (0.095, 0, 0.885),
        "knee.L": (0.105, -0.01, 0.49),
        "ankle.L": (0.11, 0.02, 0.09),
        "toe.L": (0.115, -0.13, 0.03),
        "hip.R": (-0.095, 0, 0.885),
        "knee.R": (-0.105, -0.01, 0.49),
        "ankle.R": (-0.11, 0.02, 0.09),
        "toe.R": (-0.115, -0.13, 0.03),
    }
    return {k: Vector(v) * s for k, v in j.items()}


# Body skeleton for the Skin modifier: (from, to) and the radius (x, y) per joint.
BODY_EDGES = [
    ("pelvis", "spine"), ("spine", "chest"), ("chest", "neck"),
    ("chest", "shoulder.L"), ("shoulder.L", "elbow.L"), ("elbow.L", "wrist.L"), ("wrist.L", "hand.L"),
    ("chest", "shoulder.R"), ("shoulder.R", "elbow.R"), ("elbow.R", "wrist.R"), ("wrist.R", "hand.R"),
    ("pelvis", "hip.L"), ("hip.L", "knee.L"), ("knee.L", "ankle.L"), ("ankle.L", "toe.L"),
    ("pelvis", "hip.R"), ("hip.R", "knee.R"), ("knee.R", "ankle.R"), ("ankle.R", "toe.R"),
]
RADII = {
    "pelvis": (0.155, 0.11), "spine": (0.15, 0.105), "chest": (0.165, 0.115), "neck": (0.055, 0.055),
    "shoulder.L": (0.066, 0.066), "elbow.L": (0.047, 0.047), "wrist.L": (0.032, 0.026), "hand.L": (0.036, 0.016),
    "shoulder.R": (0.066, 0.066), "elbow.R": (0.047, 0.047), "wrist.R": (0.032, 0.026), "hand.R": (0.036, 0.016),
    "hip.L": (0.098, 0.098), "knee.L": (0.07, 0.072), "ankle.L": (0.052, 0.055), "toe.L": (0.045, 0.034),
    "hip.R": (0.098, 0.098), "knee.R": (0.07, 0.072), "ankle.R": (0.052, 0.055), "toe.R": (0.045, 0.034),
}


def build_body(spec, J, mats):
    names = list(RADII.keys())
    index = {n: i for i, n in enumerate(names)}
    mesh = bpy.data.meshes.new("body")
    mesh.from_pydata([J[n] for n in names], [(index[a], index[b]) for a, b in BODY_EDGES], [])
    body = link(bpy.data.objects.new("Body", mesh))
    skin = body.modifiers.new("Skin", "SKIN")
    skin.use_smooth_shade = True
    skin.branch_smoothing = 0.6
    s = spec["height"] / 1.75
    for n, (rx, ry) in RADII.items():
        v = mesh.skin_vertices[0].data[index[n]]
        v.radius = (rx * s, ry * s)
        v.use_root = n == "pelvis"
    sub = body.modifiers.new("Subdivision", "SUBSURF")
    sub.levels = 2
    sub.render_levels = 2
    apply_modifiers(body)
    smooth(body)
    # Material zones of the body: trousers below the waist, shoes at the feet, skin at the hands, shirt elsewhere
    # (the shirt shows at the collar and the cuffs; the jacket shell covers the rest).
    for m in ("shirt", "trousers", "shoes", "skin"):
        body.data.materials.append(mats[m])
    order = {"shirt": 0, "trousers": 1, "shoes": 2, "skin": 3}
    hand_z = J["wrist.L"].z - 0.005
    for poly in body.data.polygons:
        c = poly.center
        if c.z < J["ankle.L"].z + 0.035:
            poly.material_index = order["shoes"]
        elif abs(c.x) > J["shoulder.L"].x and c.z < hand_z:
            poly.material_index = order["skin"]
        elif c.z < J["pelvis"].z + 0.02 and abs(c.x) < J["hip.L"].x + 0.12:
            poly.material_index = order["trousers"]
        else:
            poly.material_index = order["shirt"]
    return body


def build_jacket(spec, J, body, mats):
    """Jacket shell: the body's torso and arm surface pushed out, folds displaced, open at the hem and cuffs."""
    jacket = body.copy()
    jacket.data = body.data.copy()
    jacket.name = "Jacket"
    link(jacket)
    bm = bmesh.new()
    bm.from_mesh(jacket.data)
    hem = J["pelvis"].z - 0.17
    cuff = J["wrist.L"].z + 0.03
    collar = J["neck"].z - 0.03

    def cut(z, keep_above):
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, z), plane_no=(0, 0, 1), clear_outer=not keep_above, clear_inner=keep_above)

    neck_hole = [f for f in bm.faces if f.calc_center_median().z > collar - 0.01 and math.hypot(f.calc_center_median().x, f.calc_center_median().y - J["neck"].y) < 0.062]
    bmesh.ops.delete(bm, geom=neck_hole, context="FACES")
    cut(hem, keep_above=True)  # remove below the hem
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, cuff), plane_no=(0, 0, 1))
    arms_below = [f for f in bm.faces if f.calc_center_median().z < cuff and abs(f.calc_center_median().x) > J["shoulder.L"].x - 0.03]
    bmesh.ops.delete(bm, geom=arms_below, context="FACES")
    rng = random.Random(spec["seed"])
    phases = [rng.uniform(0, 6.28) for _ in range(6)]
    for v in bm.verts:
        p = v.co
        # Coat-like volume: more room at chest and back, a little flare at the hem.
        offset = 0.016 + 0.01 * max(0.0, (J["chest"].z - p.z) / 0.4)
        # Folds: horizontal creases at the elbows and the waist, vertical drape lines at the hem.
        fold = 0.004 * math.sin(p.z * 70 + phases[0]) * math.exp(-((p.z - J["elbow.L"].z) / 0.06) ** 2) * (abs(p.x) > 0.17)
        fold += 0.003 * math.sin(math.atan2(p.y, p.x) * 9 + phases[1]) * max(0.0, (J["pelvis"].z - p.z) / 0.17)
        fold += 0.0025 * math.sin(p.z * 45 + phases[2]) * math.exp(-((p.z - J["spine"].z) / 0.05) ** 2)
        v.co = p + v.normal * (offset + fold)
    bm.to_mesh(jacket.data)
    bm.free()
    jacket.data.materials.clear()
    jacket.data.materials.append(mats["jacket"])
    solid = jacket.modifiers.new("Thickness", "SOLIDIFY")
    solid.thickness = 0.008
    solid.offset = -1
    apply_modifiers(jacket)
    smooth(jacket)
    # Placket line, pocket flaps and cuffs as darker cloth zones on the shell itself (they follow every fold).
    jacket.data.materials.append(mats["jacket_dark"])
    for poly in jacket.data.polygons:
        c = poly.center
        front = c.y < -0.06
        flap = front and 0.045 < abs(c.x) < 0.14 and abs(c.z - (J["pelvis"].z - 0.05)) < 0.018
        cuff = abs(c.x) > J["shoulder.L"].x - 0.03 and c.z < J["wrist.L"].z + 0.07
        if flap or cuff:
            poly.material_index = 1
    # Collar: a soft rolled band that hides the neck opening, and three buttons on the front surface.
    s = spec["height"] / 1.75
    ring = bpy.data.meshes.new("collar")
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=False, segments=32, radius1=0.128 * s, radius2=0.072 * s, depth=0.07 * s)
    bm.to_mesh(ring)
    bm.free()
    collar_obj = link(bpy.data.objects.new("Collar", ring))
    collar_obj.location = J["neck"] + Vector((0, 0.006, -0.05 * s))
    collar_obj.scale = (1.0, 0.86, 1.0)
    solid = collar_obj.modifiers.new("Thick", "SOLIDIFY")
    solid.thickness = 0.014 * s
    apply_modifiers(collar_obj)
    smooth(collar_obj)
    collar_obj.data.materials.append(mats["jacket_dark"])
    buttons = []
    verts = [jacket.matrix_world @ v.co for v in jacket.data.vertices]
    for i, z in enumerate((J["chest"].z - 0.02, J["spine"].z + 0.03, J["pelvis"].z + 0.04)):
        near = [v for v in verts if abs(v.z - z) < 0.012 and abs(v.x) < 0.02 and v.y < 0]
        if not near:
            continue
        front = min(near, key=lambda v: v.y)
        buttons.append(ellipsoid(f"Button.{i}", (0.009, 0.004, 0.009), (0, front.y - 0.002, z), 10, 6, mats["button"]))
    return jacket, [collar_obj] + buttons


def paint(obj, fn):
    """Per-vertex colour (multiplied with the material colour in the game): age, warmth, shading of the face."""
    attr = obj.data.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    for i, v in enumerate(obj.data.vertices):
        attr.data[i].color = (*fn(v.co), 1.0)
    obj.data.color_attributes.active_color = attr


def white(obj):
    paint(obj, lambda co: (1.0, 1.0, 1.0))


def shape_head(spec, J, mats):
    """Head with readable, individual features (71, weathered, broad nose, heavy brows). Local origin = head centre."""
    s = spec["height"] / 1.75
    mesh = bpy.data.meshes.new("head")
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=34, radius=1.0)
    for v in bm.verts:
        x, y, z = v.co
        front = max(0.0, -y)  # -Y is the face side
        # Skull: rounder back, squarer jaw of an older man, slightly broad cheeks.
        sx = 0.079 * (1 + 0.05 * math.exp(-((z + 0.15) / 0.3) ** 2)) * (1 - 0.10 * max(0.0, -z - 0.45))
        sy = 0.094 * (1 - 0.10 * max(0.0, y) ** 2)
        sz = 0.112
        px, py, pz = x * sx, y * sy, z * sz
        # Brow ridge (heavy) and eye sockets (deep).
        py -= 0.011 * front ** 3 * math.exp(-((z - 0.30) / 0.10) ** 2) * math.exp(-(x / 0.6) ** 2)
        for ex in (-0.37, 0.37):
            py += 0.013 * front * math.exp(-(((x - ex) / 0.16) ** 2 + ((z - 0.14) / 0.10) ** 2))
        # Nose: bridge, broad bulbous tip, nostril wings.
        bridge = math.exp(-((x / 0.10) ** 2)) * math.exp(-(((z - 0.05) / 0.17) ** 2)) * front ** 6
        tip = math.exp(-((x / 0.17) ** 2 + ((z + 0.12) / 0.09) ** 2)) * front ** 6
        wings = sum(math.exp(-(((x - wx) / 0.09) ** 2 + ((z + 0.15) / 0.06) ** 2)) for wx in (-0.17, 0.17)) * front ** 5
        py -= 0.024 * bridge + 0.030 * tip + 0.010 * wings
        # Cheek bones and age: slight jowls beside the mouth, nasolabial folds.
        for cx in (-0.6, 0.6):
            py -= 0.006 * front * math.exp(-(((x - cx) / 0.2) ** 2 + ((z - 0.02) / 0.1) ** 2))
            py -= 0.005 * front * math.exp(-(((x - cx * 0.75) / 0.15) ** 2 + ((z + 0.5) / 0.12) ** 2))
            py += 0.003 * front * math.exp(-(((x - cx * 0.45) / 0.05) ** 2 + ((z + 0.28) / 0.14) ** 2))
        # Mouth recess and a firm chin.
        py += 0.005 * front * math.exp(-((x / 0.32) ** 2 + ((z + 0.43) / 0.05) ** 2))
        py -= 0.012 * front ** 2 * math.exp(-((x / 0.26) ** 2 + ((z + 0.67) / 0.11) ** 2))
        v.co = Vector((px * s, py * s, pz * s))
    bm.to_mesh(mesh)
    bm.free()
    head = link(bpy.data.objects.new("Head", mesh))
    smooth(head)
    head.data.materials.append(mats["skin"])

    def face_colour(co):
        x, y, z = co.x / s, co.y / s, co.z / s
        red = 0.0
        red += 0.55 * math.exp(-((x / 0.022) ** 2 + ((z + 0.012) / 0.02) ** 2)) * (y < -0.07)  # nose tip
        for cx in (-0.045, 0.045):
            red += 0.35 * math.exp(-(((x - cx) / 0.022) ** 2 + ((z + 0.01) / 0.02) ** 2)) * (y < -0.05)  # cheeks
        shade = 0.82 + 0.18 * min(1.0, max(0.0, (0.035 - z) / 0.02)) if y < -0.06 and abs(x) < 0.05 and 0.02 < z < 0.05 else 1.0
        stubble = 0.9 if z < -0.045 and y < -0.04 else 1.0  # grey-ish shaved jaw
        return (min(1.0, (1.0 + 0.10 * red) * shade * stubble), (1.0 - 0.18 * red) * shade * stubble * 0.98, (1.0 - 0.2 * red) * shade * stubble)

    paint(head, face_colour)
    parts = [head]
    # Eyes set into the sockets, heavy upper lids of age.
    for side in (-1, 1):
        x = side * 0.030 * s
        white_ = ellipsoid(f"Eye.{side}", (0.0115 * s, 0.0095 * s, 0.0085 * s), (x, -0.073 * s, 0.016 * s), 16, 10, mats["eye_white"])
        iris = ellipsoid(f"Iris.{side}", (0.0055 * s, 0.0025 * s, 0.0055 * s), (x, -0.0815 * s, 0.0155 * s), 12, 8, mats["iris"])
        lid = ellipsoid(f"Lid.{side}", (0.0128 * s, 0.0105 * s, 0.0075 * s), (x, -0.0735 * s, 0.0205 * s), 16, 8, mats["skin"])
        brow = ellipsoid(f"Brow.{side}", (0.020 * s, 0.0045 * s, 0.0050 * s), (x + side * 0.002 * s, -0.0785 * s, 0.0335 * s), 12, 8, mats["brow"])
        brow.rotation_euler = (0, side * -0.12, 0)
        ear = ellipsoid(f"Ear.{side}", (0.009 * s, 0.020 * s, 0.032 * s), (side * 0.080 * s, 0.006 * s, 0.0 * s), 14, 10, mats["skin"])
        ear.rotation_euler = (0, 0, side * 0.25)
        parts += [white_, iris, lid, brow, ear]
    lip = ellipsoid("LowerLip", (0.019 * s, 0.006 * s, 0.0045 * s), (0, -0.0835 * s, -0.050 * s), 14, 8, mats["lips"])
    moustache = ellipsoid("Moustache", (0.031 * s, 0.010 * s, 0.0095 * s), (0, -0.0865 * s, -0.036 * s), 18, 10, mats["hair"])
    # Hair: white fringe at the sides and the back below the cap.
    hair = ellipsoid("Hair", (0.084 * s, 0.096 * s, 0.05 * s), (0, 0.010 * s, 0.03 * s), 30, 14, mats["hair"])
    bm = bmesh.new()
    bm.from_mesh(hair.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().y < -0.04 * s], context="FACES")
    bm.to_mesh(hair.data)
    bm.free()
    neck = cylinder("Neck", 0.047 * s, 0.11 * s, (0, 0.012 * s, -0.12 * s), (0.1, 0, 0), 20, mats["skin"], radius_top=0.043 * s)
    parts += [lip, moustache, hair, neck]
    # Flat cap (Schiebermütze): crown pulled forward over a short stiff brim, a seam line on top.
    crown = ellipsoid("Cap", (0.093 * s, 0.108 * s, 0.045 * s), (0, -0.004 * s, 0.072 * s), 36, 14, mats["cap"])
    bm = bmesh.new()
    bm.from_mesh(crown.data)
    for v in bm.verts:
        if v.co.z < 0:
            v.co.z *= 0.25
        v.co.y -= 0.024 * s * max(0.0, v.co.z / (0.045 * s))
        v.co.z -= 0.006 * s * max(0.0, -v.co.y / (0.1 * s))  # crown droops over the brim
    bm.to_mesh(crown.data)
    bm.free()
    brim = ellipsoid("CapBrim", (0.068 * s, 0.048 * s, 0.006 * s), (0, -0.098 * s, 0.058 * s), 22, 8, mats["cap"])
    brim.rotation_euler = (0.22, 0, 0)
    band = cylinder("CapBand", 0.0905 * s, 0.012 * s, (0, -0.002 * s, 0.058 * s), (0, 0, 0), 36, mats["cap_dark"])
    band.scale = (1.0, 1.17, 1.0)
    parts += [crown, brim, band]
    return parts


def build_props(spec, J, mats):
    s = spec["height"] / 1.75
    # Scarf: a soft roll around the neck, its ends tucked into the jacket opening.
    ring = bpy.data.meshes.new("scarf")
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=False, segments=24, radius1=0.070 * s, radius2=0.060 * s, depth=0.05 * s)
    bm.to_mesh(ring)
    bm.free()
    scarf = link(bpy.data.objects.new("Scarf", ring))
    scarf.location = J["neck"] + Vector((0, -0.004, -0.028 * s))
    solid = scarf.modifiers.new("Thick", "SOLIDIFY")
    solid.thickness = 0.022 * s
    apply_modifiers(scarf)
    smooth(scarf)
    scarf.data.materials.append(mats["scarf"])
    tail = ellipsoid("ScarfTail", (0.026 * s, 0.012 * s, 0.065 * s), J["chest"] + Vector((0.03 * s, -0.115 * s, 0.11 * s)), 12, 10, mats["scarf"])
    tail.rotation_euler = (0.15, 0, 0.18)
    stick = cylinder("Stick", 0.011, J["hand.R"].z - 0.02, Vector((J["hand.R"].x - 0.005, J["hand.R"].y - 0.035, (J["hand.R"].z - 0.02) / 2)), (0, 0, 0), 10, mats["stick"])
    handle = cylinder("StickHandle", 0.012, 0.11, Vector((J["hand.R"].x - 0.005, J["hand.R"].y - 0.08, J["hand.R"].z - 0.005)), (math.pi / 2, 0, 0), 10, mats["stick"])
    tip = cylinder("StickTip", 0.012, 0.03, Vector((J["hand.R"].x - 0.005, J["hand.R"].y - 0.035, 0.015)), (0, 0, 0), 10, mats["shoes"])
    return scarf, tail, stick, handle, tip


# ---------------------------------------------------------------------------------------------------------------------
# Armature

BONES = [
    # name, head joint, tail joint, parent
    ("hips", "pelvis", "spine", None),
    ("spine", "spine", "chest", "hips"),
    ("chest", "chest", "neck", "spine"),
    ("neck", "neck", "head", "chest"),
    ("head", "head", None, "neck"),
    ("upper_arm.L", "shoulder.L", "elbow.L", "chest"),
    ("forearm.L", "elbow.L", "wrist.L", "upper_arm.L"),
    ("hand.L", "wrist.L", "hand.L", "forearm.L"),
    ("upper_arm.R", "shoulder.R", "elbow.R", "chest"),
    ("forearm.R", "elbow.R", "wrist.R", "upper_arm.R"),
    ("hand.R", "wrist.R", "hand.R", "forearm.R"),
    ("thigh.L", "hip.L", "knee.L", "hips"),
    ("shin.L", "knee.L", "ankle.L", "thigh.L"),
    ("foot.L", "ankle.L", "toe.L", "shin.L"),
    ("thigh.R", "hip.R", "knee.R", "hips"),
    ("shin.R", "knee.R", "ankle.R", "thigh.R"),
    ("foot.R", "ankle.R", "toe.R", "shin.R"),
]


def build_armature(spec, J):
    arm_data = bpy.data.armatures.new("Rig")
    rig = link(bpy.data.objects.new("Rig", arm_data))
    with bpy.context.temp_override(object=rig, active_object=rig, selected_objects=[rig], selected_editable_objects=[rig]):
        bpy.context.view_layer.objects.active = rig
        bpy.ops.object.mode_set(mode="EDIT")
        for name, a, b, parent in BONES:
            bone = arm_data.edit_bones.new(name)
            bone.head = J[a]
            bone.tail = J[b] if b else J[a] + Vector((0, 0, 0.18 * spec["height"] / 1.75))
            if parent:
                bone.parent = arm_data.edit_bones[parent]
                bone.use_connect = False
        bpy.ops.object.mode_set(mode="OBJECT")
    return rig


def skin_to(rig, meshes):
    for obj in meshes:
        obj.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    with bpy.context.temp_override(object=rig, active_object=rig, selected_objects=meshes + [rig], selected_editable_objects=meshes + [rig]):
        bpy.ops.object.parent_set(type="ARMATURE_AUTO")


def rigid_skin(rig, parts):
    """Joins rigid parts (head, props) into one mesh whose vertices are weighted 100 % to one bone each, deformed by
    the same armature as the body. Robust in glTF (one skinned mesh) and keeps every part exactly where it was built."""
    objs = []
    for obj, bone in parts:
        if not obj.data.color_attributes:
            white(obj)  # one shared colour attribute after joining (the head carries the face colouring)
        group = obj.vertex_groups.new(name=bone)
        group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
        objs.append(obj)
    target = objs[0]
    with bpy.context.temp_override(object=target, active_object=target, selected_objects=objs, selected_editable_objects=objs):
        bpy.ops.object.join()
    target.name = "Rigid"
    mod = target.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    target.parent = rig
    return target


# ---------------------------------------------------------------------------------------------------------------------
# Animation

def key_pose(rig, frame, rotations, hips_offset=(0, 0, 0)):
    for name, euler in rotations.items():
        pb = rig.pose.bones[name]
        pb.rotation_mode = "XYZ"
        pb.rotation_euler = euler
        pb.keyframe_insert("rotation_euler", frame=frame)
    hips = rig.pose.bones["hips"]
    hips.location = hips_offset
    hips.keyframe_insert("location", frame=frame)


def rest(names):
    return {n: (0.0, 0.0, 0.0) for n in names}


ALL = [b[0] for b in BONES]


def make_action(rig, name, frames, pose_at):
    rig.animation_data_create()
    action = bpy.data.actions.new(name)
    rig.animation_data.action = action
    for f in frames:
        rot, hips = pose_at(f)
        key_pose(rig, f, rot, hips)
    # Push the action into its own NLA track so the glTF exporter writes every clip.
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, int(frames[0]), action)
    rig.animation_data.action = None
    return action


def build_actions(spec, rig):
    stoop = spec["stoop"]
    fps = 30

    def walk(f):
        # One stride cycle per second (two steps), short steps for a 71-year-old with a stick.
        t = (f - 1) / fps * 2 * math.pi
        sw = math.sin(t)
        r = rest(ALL)
        r["thigh.L"] = (0.20 * sw, 0, 0)
        r["thigh.R"] = (-0.20 * sw, 0, 0)
        r["shin.L"] = (-0.35 * max(0.0, -math.sin(t + 0.6)), 0, 0)
        r["shin.R"] = (-0.35 * max(0.0, math.sin(t + 0.6)), 0, 0)
        r["foot.L"] = (0.18 * math.sin(t + 0.3), 0, 0)
        r["foot.R"] = (-0.18 * math.sin(t + 0.3), 0, 0)
        r["upper_arm.L"] = (-0.28 * sw, 0, 0.06)
        r["upper_arm.R"] = (0.10 * sw, 0, -0.06)  # stick hand swings less
        r["forearm.L"] = (0.25 + 0.12 * sw, 0, 0)
        r["forearm.R"] = (0.35, 0, 0)
        r["spine"] = (stoop * 0.6, 0.06 * sw, 0)
        r["chest"] = (stoop * 0.4, -0.08 * sw, 0.02 * sw)
        r["neck"] = (-stoop * 0.5, 0, 0)
        bob = 0.012 * abs(math.cos(t))
        return r, (0, 0, -bob)

    def idle(f):
        t = (f - 1) / fps
        breath = math.sin(t * 2 * math.pi / 4.0)
        shift = math.sin(t * 2 * math.pi / 8.0)
        r = rest(ALL)
        r["spine"] = (stoop * 0.6 + 0.012 * breath, 0, 0.02 * shift)
        r["chest"] = (stoop * 0.4 + 0.015 * breath, 0, -0.015 * shift)
        r["neck"] = (-stoop * 0.5, 0.18 * math.sin(t * 2 * math.pi / 8.0 + 1.0), 0)
        r["head"] = (0.02 * breath, 0.08 * math.sin(t * 2 * math.pi / 8.0 + 2.0), 0)
        r["upper_arm.L"] = (0.02 * breath, 0, 0.08)
        r["upper_arm.R"] = (0.25, 0, -0.08)  # leans on the stick
        r["forearm.L"] = (0.15, 0, 0)
        r["forearm.R"] = (0.45, 0, 0)
        r["thigh.L"] = (0, 0, 0.02 * shift)
        r["thigh.R"] = (0, 0, 0.02 * shift)
        return r, (0.012 * shift, 0, 0)

    def talk(f):
        t = (f - 1) / fps
        r, hips = idle(f)
        gesture = math.sin(t * 2 * math.pi / 2.0)
        r["upper_arm.L"] = (-0.55 - 0.15 * gesture, 0.0, 0.25)
        r["forearm.L"] = (0.95 + 0.2 * math.sin(t * 2 * math.pi / 1.0), 0, 0)
        r["hand.L"] = (0.0, 0.3 * gesture, 0)
        r["head"] = (0.08 * math.sin(t * 2 * math.pi / 1.5), 0.10 * math.sin(t * 2 * math.pi / 3.0), 0)
        return r, hips

    make_action(rig, "idle", list(range(1, 241, 6)) + [241], idle)
    make_action(rig, "walk", list(range(1, 32, 2)), walk)
    make_action(rig, "talk", list(range(1, 92, 3)), talk)


# ---------------------------------------------------------------------------------------------------------------------


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser()
    parser.add_argument("--resident", default="guenter")
    parser.add_argument("--out", required=True)
    args = parser.parse_args(argv)
    spec = RESIDENTS[args.resident]
    reset_scene()
    J = joints(spec)
    mats = {
        "skin": material("skin", spec["skin"], 0.62),
        "skin_shadow": material("skin_shadow", spec["skin_shadow"], 0.7),
        "hair": material("hair", spec["hair"], 0.85),
        "eye_white": material("eye_white", (0.92, 0.9, 0.86), 0.35),
        "iris": material("iris", spec["eyes"], 0.3),
        "jacket": material("jacket", spec["jacket"], 0.9),
        "jacket_dark": material("jacket_dark", spec["jacket_dark"], 0.9),
        "shirt": material("shirt", spec["shirt"], 0.85),
        "trousers": material("trousers", spec["trousers"], 0.9),
        "shoes": material("shoes", spec["shoes"], 0.55),
        "cap": material("cap", spec["cap"], 0.95),
        "brow": material("brow", tuple(c * 0.78 for c in spec["hair"]), 0.9),
        "cap_dark": material("cap_dark", tuple(c * 0.7 for c in spec["cap"]), 0.95),
        "button": material("button", (0.12, 0.10, 0.09), 0.4),
        "lips": material("lips", (0.62, 0.38, 0.34), 0.55),
        "scarf": material("scarf", spec["scarf"], 0.9),
        "stick": material("stick", spec["stick"], 0.6),
    }
    body = build_body(spec, J, mats)
    jacket, jacket_parts = build_jacket(spec, J, body, mats)
    head_parts = shape_head(spec, J, mats)
    scarf, tail, stick, handle, stick_tip = build_props(spec, J, mats)
    rig = build_armature(spec, J)
    skin_to(rig, [body, jacket])
    head_pivot = J["head"]
    for obj in head_parts:
        obj.location = obj.location + head_pivot + Vector((0, 0, 0.075 * spec["height"] / 1.75))
    # Bake object transforms into the vertices before joining.
    for obj in head_parts + jacket_parts + [scarf, tail, stick, handle, stick_tip]:
        obj.data.transform(obj.matrix_basis)
        obj.matrix_basis = Matrix.Identity(4)
    rigid_skin(
        rig,
        [(o, "head") for o in head_parts]
        + [(o, "chest") for o in jacket_parts + [scarf, tail]]
        + [(stick, "hand.R"), (handle, "hand.R"), (stick_tip, "hand.R")],
    )
    build_actions(spec, rig)
    rig.name = spec["name"]
    bpy.ops.export_scene.gltf(
        filepath=args.out,
        export_format="GLB",
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_skins=True,
        export_apply=False,
        export_yup=True,
        export_vertex_color="ACTIVE",
    )
    tris = sum(len(o.data.loop_triangles) if o.type == "MESH" and o.data.calc_loop_triangles() is None else 0 for o in bpy.data.objects)
    print(f"exported {args.out}: objects {len(bpy.data.objects)}, triangles {tris}")


main()
