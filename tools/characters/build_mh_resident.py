"""Builds a resident figure from the CC0 MakeHuman data (base mesh, targets, rig, weights, clothes) and exports a GLB.

Only data files are read; no MakeHuman or MPFB code is executed or bundled. Usage (Python 3.13 with `pip install
bpy==5.3.0`; the data folders are described in docs/VISUAL-BASELINE.md, section 8):

    tools/characters/fetch_mh_data.sh <data-folder>
    python tools/characters/build_mh_resident.py --resident guenter|derya|jonas|marlene \
        --mhdata <data-folder>/mpfb/data --assets <data-folder>/assets --out public/models/residents/<asset-id>.glb

Coordinates: MakeHuman data is Y-up in decimetres with the face towards +Z. It is converted to Blender (Z-up, metres)
with the face towards -Y, which the glTF exporter writes as +Z, the facing contract of the game.
"""

import bpy  # noqa: I001 - bpy must be imported before bmesh
import argparse
import gzip
import json
import math
import os
import sys

from mathutils import Matrix, Quaternion, Vector

# ---------------------------------------------------------------------------------------------------------------------
# Resident specifications. Macro values follow MakeHuman (0..1); age 0.5 = 25 years, 1.0 = 90 years.

RESIDENTS = {
    # N-002 Günter Wollny, 71, retired railway signalman: flat cap, walking stick (right hand), grey jacket, slight stoop.
    "guenter": {
        "name": "N-002",
        "macro": {"gender": 1.0, "age": 0.86, "muscle": 0.42, "weight": 0.58, "height": 0.42, "proportions": 0.5},
        "details": {
            "head/head-age-incr": 0.8,
            "head/head-fat-incr": 0.25,
            "head/head-rectangular": 0.35,
            "nose/nose-scale-vert-incr": 0.35,
            "nose/nose-scale-depth-incr": 0.35,
            "nose/nose-point-width-incr": 0.5,
            "nose/nose-hump-incr": 0.4,
            "nose/nose-volume-incr": 0.3,
            "ears/l-ear-scale-incr": 0.45,
            "ears/r-ear-scale-incr": 0.45,
            "ears/l-ear-lobe-incr": 0.5,
            "ears/r-ear-lobe-incr": 0.5,
            "chin/chin-jaw-drop-incr": 0.2,
            "neck/neck-double-incr": 0.3,
            "stomach/stomach-pregnant-incr": 0.35,
            "torso/measure-shoulder-dist-decr": 0.3,
            "eyebrows/eyebrows-angle-down": 0.3,
        },
        # CC0 items of the makehuman_system_assets pack (paths relative to the pack) and texture fixes.
        "skin": ("old_caucasian_male", "calm_skin"),
        "clothes": [
            ("suit", "clothes/male_casualsuit05/male_casualsuit05.mhclo", 0.9, "guenter_suit", 1024),
            ("shoes", "clothes/shoes01/shoes01.mhclo", 0.55, None, 512),
        ],
        "hair": ("hair/short02/short02.mhclo", "grey_hair_clean"),
        "eyebrows": ("eyebrows/eyebrow009/eyebrow009.mhclo", "grey_hair"),
        "eyelashes": "eyelashes/eyelashes02/eyelashes02.mhclo",
        "eyes": "brownlight",
        "headwear": ("cap", "clothes/fedora01/fedora_diffuse.png", (0.55, 0.50, 0.42)),
        "props": ["stick"],
        "pose": {
            "stoop": 0.16, "arm_down": 0.97, "arm_down_l": 0.84, "fore_l": -0.04, "fore_r": -0.34, "hand_in": 0.0, "hand_out": 0.25,
            "stride": 0.22, "swing_l": 0.30, "swing_r": 0.10, "knee": 0.42, "stance": 0.0, "bob": 0.012,
            "curl_l": 0.30, "curl_r": 1.1, "talk": "l",
        },
    },
    # N-003 Derya Aksoy, 38, carpenter: mustard work shirt, brown work trousers, tool belt, brown boots, dark ponytail.
    "derya": {
        "name": "N-003",
        "macro": {"gender": 0.0, "age": 0.60, "muscle": 0.66, "weight": 0.52, "height": 0.62, "proportions": 0.6},
        "details": {
            "torso/measure-shoulder-dist-incr": 0.35,
            "head/head-oval": 0.3,
            "nose/nose-hump-incr": 0.25,
            "nose/nose-scale-depth-incr": 0.15,
            "chin/chin-width-incr": 0.25,
            "chin/chin-prominent-incr": 0.2,
            "eyebrows/eyebrows-angle-down": 0.15,
            "cheek/l-cheek-bones-incr": 0.3,
            "cheek/r-cheek-bones-incr": 0.3,
        },
        "skin": ("middleage_caucasian_female", "warm_skin"),
        "clothes": [
            ("suit", "clothes/male_casualsuit01/male_casualsuit01.mhclo", 0.9, "derya_suit", 1024),
            ("shoes", "clothes/shoes03/shoes03.mhclo", 0.6, "brown_boots", 512),
        ],
        "hair": ("hair/ponytail01/ponytail01.mhclo", "dark_hair"),
        "eyebrows": ("eyebrows/eyebrow004/eyebrow004.mhclo", "dark_brows"),
        "eyelashes": "eyelashes/eyelashes03/eyelashes03.mhclo",
        "eyes": "brown",
        "headwear": None,
        "props": ["toolbelt"],
        "pose": {
            "stoop": 0.02, "arm_down": 0.90, "fore_l": -0.18, "fore_r": -0.18, "hand_in": 0.1,
            "stride": 0.32, "swing_l": 0.34, "swing_r": 0.34, "knee": 0.55, "stance": 0.06, "bob": 0.016,
            "curl_l": 0.4, "curl_r": 0.4, "talk": "r",
        },
    },
    # N-006 Jonas Pietrek, 17, bicycle courier: lime helmet, dark grey jacket, light grey trousers, white sneakers,
    # teal courier bag with a strap across the chest.
    "jonas": {
        "name": "N-006",
        "macro": {"gender": 1.0, "age": 0.32, "muscle": 0.42, "weight": 0.36, "height": 0.78, "proportions": 0.55},
        "details": {
            "head/head-oval": 0.25,
            "nose/nose-scale-horiz-decr": 0.2,
            "nose/nose-point-up": 0.2,
            "ears/l-ear-flap-incr": 0.25,
            "ears/r-ear-flap-incr": 0.25,
            "chin/chin-width-decr": 0.15,
            "eyebrows/eyebrows-angle-up": 0.15,
        },
        "skin": ("young_caucasian_male", "calm_skin"),
        "clothes": [
            ("suit", "clothes/male_casualsuit01/male_casualsuit01.mhclo", 0.85, "jonas_suit", 1024),
            ("shoes", "clothes/shoes05/shoes05.mhclo", 0.6, None, 512),
        ],
        "hair": ("hair/short04/short04.mhclo", "brown_hair"),
        "eyebrows": ("eyebrows/eyebrow006/eyebrow006.mhclo", "brown_brows"),
        "eyelashes": "eyelashes/eyelashes01/eyelashes01.mhclo",
        "eyes": "bluegreen",
        "headwear": ("helmet", None, (0.70, 0.85, 0.20)),
        "props": ["courier_bag"],
        "pose": {
            "stoop": 0.09, "arm_down": 0.92, "fore_l": -0.28, "fore_r": -0.28, "hand_in": 0.12,
            "stride": 0.36, "swing_l": 0.40, "swing_r": 0.40, "knee": 0.62, "stance": 0.0, "bob": 0.02,
            "curl_l": 0.45, "curl_r": 0.45, "talk": "both",
        },
    },
    # N-007 Marlene Hoffmann, 58, school secretary: plum top, camel skirt, dark tights, short silver-blonde hair,
    # red glasses, mint shopping bag in the left hand, upright posture.
    "marlene": {
        "name": "N-007",
        "macro": {"gender": 0.0, "age": 0.75, "muscle": 0.38, "weight": 0.64, "height": 0.36, "proportions": 0.5},
        "details": {
            "head/head-round": 0.35,
            "head/head-fat-incr": 0.2,
            "nose/nose-point-width-incr": 0.2,
            "nose/nose-scale-vert-decr": 0.15,
            "cheek/l-cheek-volume-incr": 0.3,
            "cheek/r-cheek-volume-incr": 0.3,
            "neck/neck-double-incr": 0.15,
            "eyebrows/eyebrows-angle-up": 0.1,
        },
        "skin": ("middleage_caucasian_female", "calm_skin"),
        "clothes": [
            ("suit", "clothes/female_elegantsuit01/female_elegantsuit01.mhclo", 0.9, "marlene_suit", 1024),
            ("shoes", "clothes/shoes04/shoes04.mhclo", 0.5, "plum_shoes", 512),
        ],
        "hair": ("hair/bob02/bob02.mhclo", "silver_blonde"),
        "eyebrows": ("eyebrows/eyebrow011/eyebrow011.mhclo", "light_brows"),
        "eyelashes": "eyelashes/eyelashes04/eyelashes04.mhclo",
        "eyes": "blue",
        "headwear": None,
        "props": ["tights", "glasses", "shopping_bag"],
        "pose": {
            "stoop": -0.03, "arm_down": 0.95, "fore_l": -0.55, "fore_r": -0.12, "hand_in": 0.15,
            "stride": 0.24, "swing_l": 0.06, "swing_r": 0.26, "knee": 0.45, "stance": 0.0, "bob": 0.01,
            "curl_l": 1.0, "curl_r": 0.4, "talk": "r",
        },
    },
}

# Dezent facial expressions as shape keys (MakeHuman expression units, value = weight). "blink" closes the eyes.
EXPRESSIONS = {
    "friendly": {
        "mouth-corner-puller": 0.70, "mouth-elevation": 0.15, "eye-left-slit": 0.25, "eye-right-slit": 0.25,
        "eyebrows-left-extern-up": 0.12, "eyebrows-right-extern-up": 0.12,
    },
    "thoughtful": {
        "eyebrows-left-down": 0.45, "eyebrows-right-down": 0.45, "eyebrows-left-inner-up": 0.25,
        "eyebrows-right-inner-up": 0.25, "mouth-compression": 0.45, "mouth-depression": 0.15,
    },
    "blink": {"eye-left-closure": 1.0, "eye-right-closure": 1.0},
}

# ---------------------------------------------------------------------------------------------------------------------
# Reading MakeHuman data


def mh_to_blender(v):
    """MakeHuman (x, y-up, z-front) in decimetres -> Blender (x, -z, y) in metres."""
    return Vector((v[0] * 0.1, -v[2] * 0.1, v[1] * 0.1))


def load_obj(path):
    verts, uvs, faces = [], [], []
    group = None
    with open(path) as f:
        for line in f:
            if line.startswith("v "):
                verts.append([float(x) for x in line.split()[1:4]])
            elif line.startswith("vt "):
                uvs.append([float(x) for x in line.split()[1:3]])
            elif line.startswith("g "):
                group = line.split()[1]
            elif line.startswith("f "):
                corners = []
                for c in line.split()[1:]:
                    parts = c.split("/")
                    corners.append((int(parts[0]) - 1, int(parts[1]) - 1 if len(parts) > 1 and parts[1] else -1))
                faces.append((group, corners))
    return verts, uvs, faces


def load_target(path):
    out = []
    opener = gzip.open if path.endswith(".gz") else open
    with opener(path, "rt") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            p = line.split()
            out.append((int(p[0]), float(p[1]), float(p[2]), float(p[3])))
    return out


def apply_target(verts, path, weight):
    if abs(weight) < 1e-4:
        return
    for i, dx, dy, dz in load_target(path):
        v = verts[i]
        v[0] += dx * weight
        v[1] += dy * weight
        v[2] += dz * weight


def two_sided(v, low, mid, high):
    """Weights of the low/mid/high variants of a macro value (MakeHuman's piecewise linear blend)."""
    if v < 0.5:
        return {low: 1 - 2 * v, mid: 2 * v}
    return {mid: 1 - 2 * (v - 0.5), high: 2 * (v - 0.5)}


def macro_factors(m):
    age = m["age"]
    if age < 0.1875:
        ages = {"baby": 1 - age / 0.1875, "child": age / 0.1875}
    elif age < 0.5:
        c = (0.5 - age) / 0.3125
        ages = {"child": c, "young": 1 - c}
    else:
        ages = {"young": 1 - (age - 0.5) * 2, "old": (age - 0.5) * 2}
    h = m["height"]
    p = m["proportions"]
    return {
        "race": {"caucasian": 1.0},
        "gender": {"female": 1 - m["gender"], "male": m["gender"]},
        "age": ages,
        "muscle": two_sided(m["muscle"], "minmuscle", "averagemuscle", "maxmuscle"),
        "weight": two_sided(m["weight"], "minweight", "averageweight", "maxweight"),
        "height": {"minheight": max(0.0, 1 - 2 * h)} if h < 0.5 else {"maxheight": max(0.0, 2 * (h - 0.5))},
        "proportions": {"uncommonproportions": max(0.0, 1 - 2 * p)} if p < 0.5 else {"idealproportions": 2 * (p - 0.5)},
    }


def apply_macros(verts, data, m):
    f = macro_factors(m)
    base = os.path.join(data, "targets", "macrodetails")
    for race, wr in f["race"].items():
        for g, wg in f["gender"].items():
            for a, wa in f["age"].items():
                apply_target(verts, os.path.join(base, f"{race}-{g}-{a}.target.gz"), wr * wg * wa)
    for g, wg in f["gender"].items():
        for a, wa in f["age"].items():
            for mu, wm in f["muscle"].items():
                for we, ww in f["weight"].items():
                    w = wg * wa * wm * ww
                    if w < 1e-4:
                        continue
                    stem = f"{g}-{a}-{mu}-{we}"
                    apply_target(verts, os.path.join(base, f"universal-{stem}.target.gz"), w)
                    for hn, wh in f["height"].items():
                        apply_target(verts, os.path.join(base, "height", f"{stem}-{hn}.target.gz"), w * wh)
                    for pn, wp in f["proportions"].items():
                        apply_target(verts, os.path.join(base, "proportions", f"{stem}-{pn}.target.gz"), w * wp)


def apply_details(verts, data, details):
    for name, value in details.items():
        apply_target(verts, os.path.join(data, "targets", name + ".target.gz"), value)


def group_centres(verts, faces):
    """Mean position (MakeHuman space) of every helper group, e.g. the joint cubes."""
    acc = {}
    for group, corners in faces:
        s = acc.setdefault(group, set())
        for vi, _ in corners:
            s.add(vi)
    out = {}
    for g, idx in acc.items():
        n = len(idx)
        out[g] = [sum(verts[i][k] for i in idx) / n for k in range(3)]
    return out


# ---------------------------------------------------------------------------------------------------------------------
# Scene building


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 30


def build_mesh(name, verts, uvs, faces, groups, to_blender=mh_to_blender):
    """A mesh from the faces of the given groups; returns (object, old vertex index -> new index)."""
    used = [f for f in faces if f[0] in groups]
    remap = {}
    co = []
    for _, corners in used:
        for vi, _ in corners:
            if vi not in remap:
                remap[vi] = len(co)
                co.append(to_blender(verts[vi]))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(co, [], [[remap[vi] for vi, _ in c] for _, c in used])
    if uvs:
        layer = mesh.uv_layers.new(name="UVMap")
        li = 0
        for _, corners in used:
            for _, ti in corners:
                layer.data[li].uv = uvs[ti] if ti >= 0 else (0, 0)
                li += 1
    mesh.validate()
    for p in mesh.polygons:
        p.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj, remap


def build_rig(data, centres, verts, rig_name="game_engine"):
    spec = json.load(open(os.path.join(data, "rigs", "standard", f"rig.{rig_name}.json")))
    arm = bpy.data.armatures.new("rig")
    rig = bpy.data.objects.new("rig", arm)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")

    def point(p):
        if p["strategy"] == "CUBE":
            return mh_to_blender(centres[p["cube_name"]])
        idx = p["vertex_indices"]
        return mh_to_blender([sum(verts[i][k] for i in idx) / len(idx) for k in range(3)])

    for name, b in spec.items():
        eb = arm.edit_bones.new(name)
        eb.head = point(b["head"])
        eb.tail = point(b["tail"])
        if (eb.tail - eb.head).length < 1e-4:
            eb.tail = eb.head + Vector((0, 0, 0.02))
        eb.roll = b["roll"]
    for name, b in spec.items():
        if b["parent"]:
            arm.edit_bones[name].parent = arm.edit_bones[b["parent"]]
            arm.edit_bones[name].use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    return rig


def apply_weights(obj, data, remap, rig, rig_name="game_engine"):
    weights = json.load(open(os.path.join(data, "rigs", "standard", f"weights.{rig_name}.json")))["weights"]
    for bone, pairs in weights.items():
        vg = obj.vertex_groups.new(name=bone)
        for vi, w in pairs:
            ni = remap.get(vi)
            if ni is not None:
                vg.add([ni], w, "REPLACE")
    obj.parent = rig
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = rig


def parse_index_list(tokens):
    out = []
    i = 0
    while i < len(tokens):
        if i + 2 < len(tokens) and tokens[i + 1] == "-":
            out.extend(range(int(tokens[i]), int(tokens[i + 2]) + 1))
            i += 3
        else:
            out.append(int(tokens[i]))
            i += 1
    return out


def load_mhclo(path):
    """MakeHuman clothes/proxy fitting file: each item vertex is bound to three base vertices plus a scaled offset."""
    info = {"scale": {}, "delete": [], "refs": [], "material": None, "obj": None}
    mode = None
    with open(path) as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            p = line.split()
            key = p[0]
            if key in ("x_scale", "y_scale", "z_scale"):
                info["scale"][key[0]] = (int(p[1]), int(p[2]), float(p[3]))
                mode = None
            elif key == "obj_file":
                info["obj"] = p[1]
            elif key == "material":
                info["material"] = p[1]
            elif key == "delete_verts":
                mode = "delete"
                info["delete"].extend(parse_index_list(p[1:]))
            elif key == "verts":
                mode = "verts"
            elif mode == "verts" and key[0].isdigit():
                if len(p) == 1:
                    info["refs"].append(((int(p[0]), int(p[0]), int(p[0])), (1.0, 0.0, 0.0), (0.0, 0.0, 0.0)))
                else:
                    info["refs"].append(
                        (tuple(int(x) for x in p[0:3]), tuple(float(x) for x in p[3:6]), tuple(float(x) for x in p[6:9]))
                    )
            elif mode == "delete" and key[0].isdigit():
                info["delete"].extend(parse_index_list(p))
            elif key[0].isalpha():
                mode = None
    return info


def fit_mhclo(info, verts):
    """Positions (MakeHuman space) of the item's vertices on the shaped base mesh."""
    scale = []
    for axis, k in (("x", 0), ("y", 1), ("z", 2)):
        if axis in info["scale"]:
            a, b, d = info["scale"][axis]
            scale.append(abs(verts[a][k] - verts[b][k]) / d)
        else:
            scale.append(1.0)
    out = []
    for (i, j, k), (wi, wj, wk), (dx, dy, dz) in info["refs"]:
        out.append(
            [
                wi * verts[i][n] + wj * verts[j][n] + wk * verts[k][n] + (dx, dy, dz)[n] * scale[n]
                for n in range(3)
            ]
        )
    return out


def load_mhmat(path):
    mat = {}
    if not path or not os.path.exists(path):
        return mat
    with open(path) as f:
        for line in f:
            p = line.strip().split(None, 1)
            if len(p) == 2 and not p[0].startswith("#"):
                mat[p[0]] = p[1]
    return mat


def load_image(path, max_size=1024):
    img = bpy.data.images.load(path)
    img.pack()
    w, h = img.size
    if max(w, h) > max_size:
        f = max_size / max(w, h)
        img.scale(int(w * f), int(h * f))
    return img


def build_item(name, mhclo_path, verts, rig, weights_from, roughness=0.85, mhmat=None, fix=None, max_tex=1024):
    """Fits a MakeHuman clothes/proxy item to the shaped body, gives it the body's skin weights and its material.

    Returns (object, mhclo info, base-vertex-order -> mesh-vertex index), the last two for expression shape keys.
    """
    info = load_mhclo(mhclo_path)
    folder = os.path.dirname(mhclo_path)
    _, iuvs, ifaces = load_obj(os.path.join(folder, info["obj"]))
    fitted = fit_mhclo(info, verts)
    obj, remap = build_mesh(name, fitted, iuvs, ifaces, {g for g, _ in ifaces})
    mat_path = mhmat or (os.path.join(folder, info["material"]) if info["material"] else None)
    mat = load_mhmat(mat_path)
    mat_dir = os.path.dirname(mat_path) if mat_path else folder
    image = None
    tex = mat.get("diffuseTexture")
    if tex and os.path.exists(os.path.join(mat_dir, tex)):
        image = load_image(os.path.join(mat_dir, tex), max_tex)
        if fix:
            recolor(image, fix)
    transparent = mat.get("transparent", "False").lower() == "true"
    color = (1.0, 1.0, 1.0) if image else tuple(float(x) for x in mat.get("diffuseColor", "0.8 0.8 0.8").split()[:3])
    obj.data.materials.append(material(name, color, roughness, image, alpha_mask=transparent))
    transfer_weights(weights_from, obj, rig)
    return obj, info, remap


def transfer_weights(src, dst, rig):
    for vg in src.vertex_groups:
        if vg.name not in dst.vertex_groups:
            dst.vertex_groups.new(name=vg.name)
    mod = dst.modifiers.new("wt", "DATA_TRANSFER")
    mod.object = src
    mod.use_vert_data = True
    mod.data_types_verts = {"VGROUP_WEIGHTS"}
    mod.vert_mapping = "POLYINTERP_NEAREST"
    mod.layers_vgroup_select_src = "ALL"
    mod.layers_vgroup_select_dst = "NAME"
    bpy.context.view_layer.objects.active = dst
    bpy.ops.object.modifier_apply(modifier=mod.name)
    dst.parent = rig
    arm = dst.modifiers.new("Armature", "ARMATURE")
    arm.object = rig


def material(name, color, roughness=0.8, image=None, alpha_mask=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nodes, links = m.node_tree.nodes, m.node_tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    if image:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = image
        links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if alpha_mask:
            # A Round node on the alpha is exported as glTF alphaMode MASK (cutoff 0.5): no sorting problems.
            rnd = nodes.new("ShaderNodeMath")
            rnd.operation = "ROUND"
            links.new(tex.outputs["Alpha"], rnd.inputs[0])
            links.new(rnd.outputs[0], bsdf.inputs["Alpha"])
    return m


def recolor(image, fn):
    """Applies fn(rgba array h x w x 4) -> array to an image's pixels (numpy ships with bpy)."""
    import numpy as np

    w, h = image.size
    px = np.empty(w * h * 4, dtype=np.float32)
    image.pixels.foreach_get(px)
    px = fn(px.reshape(h, w, 4))
    image.pixels.foreach_set(px.astype(np.float32).ravel())
    image.update()


def _np():
    import numpy as np

    return np


def _lum(px):
    return 0.3 * px[..., 0] + 0.59 * px[..., 1] + 0.11 * px[..., 2]


def _paint(px, mask, colour, gain=1.0, base=0.0):
    """Recolours the masked pixels: keeps the cloth structure (luminance) and applies a new colour."""
    np = _np()
    v = np.clip(base + _lum(px) * gain, 0, 1)
    for c in range(3):
        px[..., c] = np.where(mask, v * colour[c], px[..., c])
    return px


def _clear_rect(px, rows, cols, alpha=False):
    """Clears a texture rectangle (fractions; rows count from the bottom as in Blender's pixel order)."""
    h, w = px.shape[:2]
    r0, r1 = int(h * rows[0]), int(h * rows[1])
    c0, c1 = int(w * cols[0]), int(w * cols[1])
    if alpha:
        px[r0:r1, c0:c1, 3] = 0.0
    else:
        px[r0:r1, c0:c1, :3] = px[max(0, r0 - 2), max(0, c0 - 2), :3]
    return px


# -- skins -------------------------------------------------------------------------------------------------------------


def calm_skin(px):
    """MakeHuman skins are quite orange under the game's light: desaturate a little and lift. Also removes the project
    label in the lower right corner and tones down the saturated red of the nostril and mouth interiors, which showed
    as red dots beside the nose."""
    np = _np()
    lum = _lum(px)
    for c in range(3):
        px[..., c] = (lum + (px[..., c] - lum) * 0.72) * 1.06
    h, w = px.shape[:2]
    px[: int(h * 0.26), int(w * 0.965):, :3] = px[int(h * 0.30), int(w * 0.95), :3]
    r, g = px[..., 0], px[..., 1]
    red = (r - g > 0.30) & (r > 0.5)
    for c, k in enumerate((0.40, 0.25, 0.21)):
        px[..., c] = np.where(red, k, px[..., c])
    return px


def warm_skin(px):
    px = calm_skin(px)
    for c, k in enumerate((1.0, 0.93, 0.84)):
        px[..., c] *= k * 0.97
    return px


# -- hair --------------------------------------------------------------------------------------------------------------


def _hair(px, colour, gain, base):
    np = _np()
    v = np.clip(base + _lum(px) * gain, 0, 1)
    for c, k in enumerate(colour):
        px[..., c] = v * k
    return px


def grey_hair(px):
    return _hair(px, (0.80, 0.79, 0.77), 1.6, 0.45)


def grey_hair_clean(px):
    """Grey hair plus removal of the project URL in the lower right corner of the hair texture."""
    px = grey_hair(px)
    return _clear_rect(px, (0.0, 0.07), (0.7, 1.0), alpha=True)


def dark_hair(px):
    return _clear_rect(_hair(px, (0.30, 0.21, 0.17), 1.1, 0.04), (0.0, 0.07), (0.7, 1.0), alpha=True)


def dark_brows(px):
    return _hair(px, (0.24, 0.17, 0.14), 1.0, 0.02)


def brown_hair(px):
    return _clear_rect(_hair(px, (0.52, 0.38, 0.27), 1.3, 0.06), (0.0, 0.07), (0.7, 1.0), alpha=True)


def brown_brows(px):
    return _hair(px, (0.42, 0.31, 0.23), 1.1, 0.04)


def silver_blonde(px):
    return _clear_rect(_hair(px, (0.86, 0.82, 0.70), 1.3, 0.42), (0.0, 0.07), (0.7, 1.0), alpha=True)


def light_brows(px):
    return _hair(px, (0.62, 0.56, 0.47), 1.2, 0.18)


# -- clothes -----------------------------------------------------------------------------------------------------------


def guenter_suit(px):
    """Suit 05: blue denim -> dark brown-grey cloth, olive jacket -> warm grey; corner label cleared."""
    np = _np()
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    denim = (b > r + 0.06) & (b > g + 0.02)
    px = _paint(px, denim, np.array([0.42, 0.38, 0.34]) * 1.35, 0.9, 0.18)
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    jacket = (~denim) & (mx - mn < 0.09) & (g >= r - 0.01) & (mx > 0.08)
    px = _paint(px, jacket, (0.60 / 0.58, 1.0, 0.54 / 0.58), 1.75)
    return _clear_rect(px, (0.95, 1.0), (0.8, 1.0))


def _suit01(px, shirt, shirt_gain, trousers, trousers_gain, trousers_base):
    """Suit 01 (shirt + trousers): the trousers occupy the middle column of the texture, the shirt the sides."""
    np = _np()
    h, w = px.shape[:2]
    cols = np.zeros((h, w), dtype=bool)
    cols[:, int(w * 0.35): int(w * 0.71)] = True
    px = _paint(px, cols, trousers, trousers_gain, trousers_base)
    px = _paint(px, ~cols, shirt, shirt_gain)
    return _clear_rect(px, (0.965, 1.0), (0.0, 0.16))


def derya_suit(px):
    return _suit01(px, (0.86, 0.63, 0.22), 2.2, (0.40, 0.29, 0.20), 1.5, 0.06)


def jonas_suit(px):
    return _suit01(px, (0.30, 0.32, 0.36), 1.5, (0.60, 0.62, 0.66), 1.5, 0.12)


def marlene_suit(px):
    """Elegant suit: the skirt occupies the upper half of the texture (camel), the striped blouse becomes a plum knit."""
    np = _np()
    h, w = px.shape[:2]
    skirt = np.zeros((h, w), dtype=bool)
    skirt[int(h * 0.5): int(h * 0.96), : int(w * 0.86)] = True
    px = _paint(px, skirt, (0.69, 0.55, 0.37), 1.9, 0.1)
    # Soft plum knit: stripes reduced to a faint rib.
    v = np.clip(0.55 + (_lum(px) - 0.25) * 0.45, 0, 1)
    for c, k in enumerate((0.50, 0.23, 0.36)):
        px[..., c] = np.where(~skirt, v * k, px[..., c])
    return _clear_rect(px, (0.0, 0.035), (0.72, 0.9))


def brown_boots(px):
    return _paint(px, _lum(px) >= 0, (0.42, 0.27, 0.16), 1.6, 0.05)


def plum_shoes(px):
    return _paint(px, _lum(px) >= 0, (0.32, 0.17, 0.22), 1.5, 0.04)


FIXES = {
    f.__name__: f
    for f in (
        calm_skin, warm_skin, grey_hair, grey_hair_clean, dark_hair, dark_brows, brown_hair, brown_brows,
        silver_blonde, light_brows, guenter_suit, derya_suit, jonas_suit, marlene_suit, brown_boots, plum_shoes,
    )
}


def rigid_part(obj, rig, bone):
    obj.parent = rig
    vg = obj.vertex_groups.new(name=bone)
    vg.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = rig


def new_object(name, bm, smooth=True):
    mesh = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    for p in mesh.polygons:
        p.use_smooth = smooth
    return obj


def bvh(obj):
    from mathutils.bvhtree import BVHTree

    me = obj.data
    return BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [tuple(p.vertices) for p in me.polygons])


def solidify(obj, thickness):
    mod = obj.modifiers.new("solid", "SOLIDIFY")
    mod.thickness = thickness
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


# -- headwear ----------------------------------------------------------------------------------------------------------


def build_headwear(kind, rig, hair, body, brows, texture, colour):
    """Flat cap ("Schiebermütze") or cycling helmet fitted to the head.

    The crown is a shell sampled from the actual skull and hair surfaces (rays from the head centre), so it follows the
    head. Cap: low on the forehead, lower at the back, upper part pulled forward over a short brim. Helmet: a rounder,
    thicker shell with a short visor. Hair under the shell is removed.
    """
    import bmesh

    body_t, hair_t = bvh(body), bvh(hair)
    hco = [v.co for v in hair.data.vertices]
    cx = (min(c.x for c in hco) + max(c.x for c in hco)) / 2
    cy = (min(c.y for c in hco) + max(c.y for c in hco)) / 2
    brow_z = sum(v.co.z for v in brows.data.vertices) / len(brows.data.vertices)
    centre = Vector((cx, cy + 0.012, brow_z - 0.005))
    helmet = kind == "helmet"

    def band_elevation(a):
        front = max(0.0, -math.sin(a))
        back = max(0.0, math.sin(a))
        if helmet:
            return math.radians(14.0 + 14.0 * front - 4.0 * back)
        return math.radians(2.0 + 22.0 * front - 6.0 * back)

    def surface(d):
        hb = body_t.ray_cast(centre, d)[0]
        hh = hair_t.ray_cast(centre, d)[0]
        rb = (hb - centre).length if hb else 0.09
        rh = (hh - centre).length if hh else rb
        if helmet:
            return max(rb + 0.032, min(rh, rb + 0.03) + 0.012)
        # On the skull, lying on flattened hair: never inside the head, never as far out as loose hair.
        return max(rb + 0.013, min(rh * 0.97, rb + 0.024))

    seg, rings = 64, 12
    grid = []
    for k in range(seg):
        a = 2 * math.pi * k / seg
        e0 = band_elevation(a)
        row = []
        for r in range(rings + 1):
            t = r / rings
            e = e0 + (math.radians(88.0) - e0) * t
            d = Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e)))
            p = centre + d * surface(d)
            lift = t * t
            if helmet:
                # Slightly elongated towards the back like a road helmet.
                p.y += 0.018 * lift * max(0.0, math.sin(a))
            else:
                # Flat-cap profile: crown pulled forward and widened above the band, top flattened.
                p.y -= 0.045 * lift
                p.x = cx + (p.x - cx) * (1.0 + 0.10 * math.sin(math.pi * min(1.0, t * 1.2)))
                p.z -= 0.024 * lift * (1.0 + 0.6 * max(0.0, math.sin(a)))
                # Shaping must not push the crown into the skull (the scalp would show through at the back).
                dd = p - centre
                hit = body_t.ray_cast(centre, dd.normalized())[0]
                if hit is not None and dd.length < (hit - centre).length + 0.008:
                    p = centre + dd.normalized() * ((hit - centre).length + 0.008)
            row.append(p)
        grid.append(row)

    bm = bmesh.new()
    vs = [[bm.verts.new(p) for p in row] for row in grid]
    apex = bm.verts.new(sum((row[-1] for row in grid), Vector()) / seg)
    for k in range(seg):
        k2 = (k + 1) % seg
        for r in range(rings):
            bm.faces.new((vs[k][r], vs[k2][r], vs[k2][r + 1], vs[k][r + 1]))
        bm.faces.new((vs[k][rings], vs[k2][rings], apex))
    # Brim / visor: from the front part of the band, out and slightly down; smooth (smoothstep) towards the ends so
    # the edge runs out cleanly instead of ending in steps.
    length, drop, start = (0.030, 0.010, 0.55) if helmet else (0.052, 0.016, 0.30)
    brim = []
    for k in range(seg):
        a = 2 * math.pi * k / seg
        front = -math.sin(a)
        if front <= start:
            brim.append(None)
            continue
        x = (front - start) / (1.0 - start)
        w = x * x * (3 - 2 * x)
        base = grid[k][0]
        out = Vector((base.x - cx, base.y - cy, 0.0)).normalized()
        brim.append(bm.verts.new(base + out * (0.004 + length * w) + Vector((0, 0, -drop * w))))
    for k in range(seg):
        k2 = (k + 1) % seg
        if brim[k] is not None and brim[k2] is not None:
            bm.faces.new((vs[k][0], brim[k], brim[k2], vs[k2][0]))
    obj = new_object("helmet" if helmet else "cap", bm)
    mesh = obj.data
    uv = mesh.uv_layers.new(name="UVMap")
    zmin = min(v.co.z for v in mesh.vertices)
    for poly in mesh.polygons:
        for li in poly.loop_indices:
            c = mesh.vertices[mesh.loops[li].vertex_index].co
            a = math.atan2(c.y - cy, c.x - cx)
            uv.data[li].uv = (0.10 + 0.28 * (a + math.pi) / (2 * math.pi), 0.30 + 0.40 * (c.z - zmin) / 0.14)
    solidify(obj, 0.012 if helmet else 0.004)

    def under_shell(co):
        d = co - centre
        a = math.atan2(d.y, d.x)
        front = max(0.0, -math.sin(a))
        return math.atan2(d.z, math.hypot(d.x, d.y)) > band_elevation(a) + math.radians(3.0 - 7.0 * front)

    hb = bmesh.new()
    hb.from_mesh(hair.data)
    gone = [f for f in hb.faces if any(under_shell(v.co) for v in f.verts)]
    bmesh.ops.delete(hb, geom=gone, context="FACES")
    hb.to_mesh(hair.data)
    hb.free()

    if helmet:
        obj.data.materials.append(material("helmet", colour, 0.45))
    else:
        img = load_image(texture, 512)
        recolor(img, lambda px: _tint(px, colour, 1.25))
        obj.data.materials.append(material("cap", (1.0, 1.0, 1.0), 0.95, img))
    rigid_part(obj, rig, "head")
    return obj


def _tint(px, colour, gain):
    lum = _lum(px)
    for c in range(3):
        px[..., c] = (lum * gain).clip(0, 1) * colour[c] / max(colour)
    return px


# -- props -------------------------------------------------------------------------------------------------------------


def posed_bone(rig, bone):
    """(posed matrix, rest matrix) of a bone at frame 1 of the idle clip, for props held in a hand."""
    rig.animation_data.action = bpy.data.actions["idle"]
    bpy.context.scene.frame_set(1)
    pb = rig.pose.bones[bone]
    posed = rig.matrix_world @ pb.matrix
    rest = rig.matrix_world @ rig.data.bones[bone].matrix_local
    return pb, posed.copy(), rest.copy()


def release_pose(rig):
    rig.animation_data.action = None
    bpy.context.scene.frame_set(1)


def cylinder_between(bm, a, b, radius, segments=8):
    import bmesh

    axis = b - a
    m = (
        Matrix.Translation((a + b) / 2)
        @ axis.to_track_quat("Z", "Y").to_matrix().to_4x4()
        @ Matrix.Diagonal((1, 1, axis.length, 1))
    )
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius, radius2=radius, depth=1.0, matrix=m)


def box(bm, centre, size, rot=None):
    import bmesh

    m = Matrix.Translation(centre)
    if rot is not None:
        m = m @ rot.to_4x4()
    m = m @ Matrix.Diagonal((size[0], size[1], size[2], 1))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def build_stick(rig):
    """Walking stick held in the right hand: built in the idle pose, then mapped back into the bind pose."""
    import bmesh

    pb, posed, rest = posed_bone(rig, "hand_r")
    grip = posed @ Vector((0, pb.length * 0.55, 0))
    tip = Vector((grip.x - 0.08, grip.y - 0.16, 0.0))
    bm = bmesh.new()
    axis = (grip - tip).normalized()
    cylinder_between(bm, tip, grip + axis * 0.04, 0.012, 10)
    # Crook handle: a short bent piece forward over the hand.
    cylinder_between(bm, grip + axis * 0.04, grip + axis * 0.05 + Vector((0, -0.07, 0.01)), 0.012, 10)
    obj = new_object("stick", bm)
    obj.data.transform(rest @ posed.inverted())
    obj.data.materials.append(material("stick", (0.36, 0.22, 0.12), 0.55))
    rigid_part(obj, rig, "hand_r")
    release_pose(rig)
    return obj


def surface_point(tree, origin, target, offset):
    """Point on a surface along the ray from origin through target, pushed outwards by offset."""
    d = (target - origin).normalized()
    hit = tree.ray_cast(origin, d)[0]
    return (hit if hit is not None else target) + d * offset


def build_strap(rig, suit, full, path, width, colour, name):
    """A flat strap following the outside of the clothes along a path of (inside point, outward target) pairs."""
    import bmesh

    tree = bvh(suit)
    pts = [surface_point(tree, o, t, 0.007) for o, t in path]
    bm = bmesh.new()
    rows = []
    for i, p in enumerate(pts):
        tan = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        out = (path[i][1] - path[i][0]).normalized()
        side = tan.cross(out).normalized() * (width / 2)
        rows.append((bm.verts.new(p - side), bm.verts.new(p + side)))
    for (a1, b1), (a2, b2) in zip(rows, rows[1:]):
        bm.faces.new((a1, b1, b2, a2))
    obj = new_object(name, bm)
    solidify(obj, 0.004)
    obj.data.materials.append(material(name, colour, 0.7))
    transfer_weights(full, obj, rig)
    return obj


def joint(rig, bone, tail=False):
    b = rig.data.bones[bone]
    return (b.tail_local if tail else b.head_local).copy()


def build_courier_bag(rig, suit, full):
    """Teal courier bag at the back of the left hip; yellow strap from the right shoulder across the chest."""
    import bmesh

    sh = joint(rig, "clavicle_r", tail=True)
    hip = joint(rig, "thigh_l")
    chest_axis_y = joint(rig, "spine_03").y
    top = sh + Vector((0.02, 0.0, 0.04))
    front, back = [], []
    for i in range(15):
        s = i / 14
        p = top.lerp(hip + Vector((0.05, 0, 0.10)), s)
        axis = Vector((0.0, chest_axis_y, p.z))
        front.append((axis, p + Vector((0, -0.4, 0))))
        back.append((axis, p + Vector((0, 0.4, 0))))
    build_strap(rig, suit, full, front, 0.045, (0.93, 0.85, 0.30), "strap_front")
    build_strap(rig, suit, full, back, 0.045, (0.93, 0.85, 0.30), "strap_back")
    tree = bvh(suit)
    centre_hip = Vector((hip.x * 0.6, chest_axis_y, hip.z + 0.06))
    back_pt = surface_point(tree, centre_hip, centre_hip + Vector((0.0, 0.5, 0)), 0.07)
    bm = bmesh.new()
    box(bm, back_pt, (0.36, 0.13, 0.28))
    obj = new_object("courier_bag", bm, smooth=False)
    obj.data.materials.append(material("courier_bag", (0.08, 0.55, 0.56), 0.75))
    rigid_part(obj, rig, "pelvis")
    bm = bmesh.new()
    box(bm, back_pt + Vector((0, 0.005, 0.09)), (0.37, 0.14, 0.11))
    flap = new_object("courier_flap", bm, smooth=False)
    flap.data.materials.append(material("courier_flap", (0.05, 0.42, 0.43), 0.75))
    rigid_part(flap, rig, "pelvis")
    return obj


def build_toolbelt(rig, suit, full):
    """Leather tool belt around the hips with a pouch on the right and a hammer on the left hip."""
    import bmesh

    tree = bvh(suit)
    hip_l, hip_r = joint(rig, "thigh_l"), joint(rig, "thigh_r")
    cz = (hip_l.z + hip_r.z) / 2 + 0.07
    cy = joint(rig, "pelvis").y
    centre = Vector((0.0, cy, cz))
    bm = bmesh.new()
    seg = 48
    lo, hi = [], []
    for k in range(seg):
        a = 2 * math.pi * k / seg
        d = Vector((math.cos(a), math.sin(a), 0.0))
        p = surface_point(tree, centre, centre + d, 0.008)
        lo.append(bm.verts.new(p - Vector((0, 0, 0.024))))
        hi.append(bm.verts.new(p + Vector((0, 0, 0.024))))
    for k in range(seg):
        k2 = (k + 1) % seg
        bm.faces.new((lo[k], lo[k2], hi[k2], hi[k]))
    belt = new_object("toolbelt", bm)
    solidify(belt, 0.005)
    belt.data.materials.append(material("toolbelt", (0.45, 0.30, 0.17), 0.65))
    transfer_weights(full, belt, rig)
    # Pouch (right front hip) and hammer (left hip), rigid on the pelvis.
    right = surface_point(tree, centre, centre + Vector((-0.8, -0.6, 0)).normalized(), 0.03)
    left = surface_point(tree, centre, centre + Vector((1.0, 0.1, 0)).normalized(), 0.02)
    bm = bmesh.new()
    box(bm, right + Vector((0, 0, -0.06)), (0.12, 0.05, 0.14))
    pouch = new_object("pouch", bm, smooth=False)
    pouch.data.materials.append(material("pouch", (0.34, 0.22, 0.12), 0.7))
    rigid_part(pouch, rig, "pelvis")
    bm = bmesh.new()
    cylinder_between(bm, left + Vector((0, 0, -0.02)), left + Vector((0.005, 0, -0.27)), 0.013, 8)
    hammer_handle = new_object("hammer_handle", bm)
    hammer_handle.data.materials.append(material("hammer_handle", (0.70, 0.50, 0.28), 0.6))
    rigid_part(hammer_handle, rig, "pelvis")
    bm = bmesh.new()
    box(bm, left + Vector((0.0, 0.0, 0.0)), (0.03, 0.10, 0.03))
    hammer_head = new_object("hammer_head", bm, smooth=False)
    hammer_head.data.materials.append(material("hammer_head", (0.45, 0.47, 0.50), 0.4))
    rigid_part(hammer_head, rig, "pelvis")
    return belt


def build_glasses(rig, eyes):
    """Red-framed glasses: two rounded frames in front of the eyes, a bridge and temples back to the ears."""
    import bmesh

    co = [v.co for v in eyes.data.vertices]
    left = [c for c in co if c.x > 0]
    right = [c for c in co if c.x <= 0]
    bm = bmesh.new()
    front_y = min(c.y for c in co) - 0.012
    inner = []
    for side in (left, right):
        ex = sum(c.x for c in side) / len(side)
        ez = sum(c.z for c in side) / len(side)
        ring = []
        for k in range(20):
            a = 2 * math.pi * k / 20
            # Soft rectangle (superellipse) 50 x 34 mm.
            ca, sa = math.cos(a), math.sin(a)
            x = math.copysign(abs(ca) ** 0.6, ca) * 0.026
            z = math.copysign(abs(sa) ** 0.6, sa) * 0.017
            ring.append(Vector((ex + x, front_y + 0.002 * abs(x) / 0.026, ez + z - 0.002)))
        for a, b in zip(ring, ring[1:] + ring[:1]):
            cylinder_between(bm, a, b, 0.0022, 5)
        inner.append((ex, ez))
        outer_x = ex + math.copysign(0.026, ex)
        cylinder_between(bm, Vector((outer_x, front_y, ez + 0.006)), Vector((outer_x * 1.25, front_y + 0.10, ez)), 0.0022, 5)
    (lx, lz), (rx, rz) = inner
    cylinder_between(bm, Vector((lx - 0.026, front_y, lz + 0.004)), Vector((rx + 0.026, front_y, rz + 0.004)), 0.0022, 5)
    obj = new_object("glasses", bm)
    obj.data.materials.append(material("glasses", (0.55, 0.10, 0.14), 0.4))
    rigid_part(obj, rig, "head")
    return obj


def build_shopping_bag(rig):
    """Mint shopping bag with a dark green stripe, hanging from the left hand (built in the idle pose)."""
    import bmesh

    pb, posed, rest = posed_bone(rig, "hand_l")
    grip = posed @ Vector((0, pb.length * 0.6, 0))
    top = grip + Vector((0.0, 0.0, -0.13))
    bm = bmesh.new()
    box(bm, top + Vector((0.01, 0, -0.15)), (0.08, 0.30, 0.30))
    for dy in (-0.07, 0.07):
        cylinder_between(bm, top + Vector((0.01, dy, 0)), grip + Vector((0, dy * 0.2, 0)), 0.006, 6)
    bag = new_object("shopping_bag", bm, smooth=False)
    bag.data.transform(rest @ posed.inverted())
    bag.data.materials.append(material("shopping_bag", (0.60, 0.80, 0.68), 0.8))
    rigid_part(bag, rig, "hand_l")
    bm = bmesh.new()
    box(bm, top + Vector((0.01, 0, -0.10)), (0.085, 0.305, 0.04))
    stripe = new_object("shopping_bag_stripe", bm, smooth=False)
    stripe.data.transform(rest @ posed.inverted())
    stripe.data.materials.append(material("shopping_bag_stripe", (0.30, 0.54, 0.40), 0.8))
    rigid_part(stripe, rig, "hand_l")
    release_pose(rig)
    return bag


def build_tights(rig, verts, faces, full):
    """Dark tights: MakeHuman's helper-tights layer (a thin shell around the legs), visible below the skirt."""
    obj, remap = build_mesh("tights", verts, [], faces, {"helper-tights"})
    obj.data.materials.append(material("tights", (0.20, 0.17, 0.23), 0.7))
    transfer_weights(full, obj, rig)
    return obj, remap


# -- expressions -------------------------------------------------------------------------------------------------------


def add_expressions(data, verts, targets):
    """Adds the EXPRESSIONS as shape keys to the body and the fitted face items (eyebrows, eyelashes).

    targets: list of (object, kind, info-or-None, remap); kind "base" maps base-mesh vertices directly, "item" refits a
    MakeHuman item with fit_mhclo.
    """
    unit_dir = os.path.join(data, "targets", "expression", "units", "caucasian")
    for name, units in EXPRESSIONS.items():
        moved = [list(v) for v in verts]
        for unit, w in units.items():
            apply_target(moved, os.path.join(unit_dir, unit + ".target.gz"), w)
        for obj, kind, info, remap in targets:
            if obj.data.shape_keys is None:
                obj.shape_key_add(name="Basis", from_mix=False)
            key = obj.shape_key_add(name=name, from_mix=False)
            pos = moved if kind == "base" else fit_mhclo(info, moved)
            for old, new in remap.items():
                key.data[new].co = mh_to_blender(pos[old])
            key.value = 0.0


# ---------------------------------------------------------------------------------------------------------------------
# Animation: rotations are given about armature-space axes (x = figure's left->right, y = back->front is -Y, z = up)
# and converted into each bone's local frame.


def local_quat(rig, bone, axis_angles):
    rest = rig.data.bones[bone].matrix_local.to_3x3()
    q = Quaternion()
    local = Quaternion()
    for axis, angle in axis_angles:
        if axis == "local_x":
            local = Quaternion(Vector((1, 0, 0)), angle) @ local
        else:
            q = Quaternion(Vector(axis), angle) @ q
    m = rest.inverted() @ q.to_matrix() @ rest
    return m.to_quaternion() @ local


def make_action(rig, name, frames, pose_at):
    rig.animation_data_create()
    action = bpy.data.actions.new(name)
    rig.animation_data.action = action
    for f in frames:
        rots, root = pose_at(f)
        for pb in rig.pose.bones:
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = local_quat(rig, pb.name, rots.get(pb.name, []))
            pb.keyframe_insert("rotation_quaternion", frame=f)
        pel = rig.pose.bones["pelvis"]
        rest = rig.data.bones["pelvis"].matrix_local.to_3x3()
        pel.location = rest.inverted() @ Vector(root)
        pel.keyframe_insert("location", frame=f)
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, int(frames[0]), action)
    rig.animation_data.action = None


X = (1, 0, 0)
Y = (0, 1, 0)
Z = (0, 0, 1)


def build_actions(rig, P):
    """idle (8 s), walk (one stride cycle, 1 s) and talk (3 s) from the figure's pose parameters P."""
    fps = 30
    stoop = P["stoop"]
    fingers = [f"{n}_0{i}_{s}" for n in ("index", "middle", "ring", "pinky") for i in (1, 2, 3) for s in ("l", "r")]
    thumbs = [f"thumb_0{i}_{s}" for i in (2, 3) for s in ("l", "r")]

    def base():
        r = {}
        # Arms from the A-pose down to the sides (about the forward axis), hands turned in towards the thighs.
        r["upperarm_l"] = [(Y, P.get("arm_down_l", P["arm_down"]))]
        r["upperarm_r"] = [(Y, -P.get("arm_down_r", P["arm_down"]))]
        # Hands turned in towards the thighs (twist) and tilted out to hang beside them, not in front.
        r["hand_l"] = [(Z, -P["hand_in"]), (Y, -P.get("hand_out", 0.0))]
        r["hand_r"] = [(Z, P["hand_in"]), (Y, P.get("hand_out", 0.0))]
        for b in fingers:
            r[b] = [("local_x", P["curl_r"] if b.endswith("r") else P["curl_l"])]
        for b in thumbs:
            r[b] = [("local_x", 0.25)]
        return r

    def idle(f):
        t = (f - 1) / fps
        breath = math.sin(t * 2 * math.pi / 4.0)
        shift = math.sin(t * 2 * math.pi / 8.0)
        r = base()
        r["spine_01"] = [(X, stoop * 0.5 + 0.01 * breath), (Y, 0.02 * shift)]
        r["spine_03"] = [(X, stoop * 0.5 + 0.015 * breath)]
        r["neck_01"] = [(X, -stoop * 0.6), (Z, 0.15 * math.sin(t * 2 * math.pi / 8.0 + 1.0))]
        r["head"] = [(X, 0.02 * breath), (Z, 0.06 * math.sin(t * 2 * math.pi / 8.0 + 2.0))]
        r["lowerarm_l"] = [(X, P["fore_l"])]
        r["lowerarm_r"] = [(X, P["fore_r"])]
        r["thigh_l"] = [(Y, 0.02 * shift + P["stance"])]
        r["thigh_r"] = [(Y, 0.02 * shift - P["stance"])]
        r["foot_l"] = [(Y, -P["stance"])]
        r["foot_r"] = [(Y, P["stance"])]
        return r, (0.01 * shift, 0, 0)

    def walk(f):
        t = (f - 1) / fps * 2 * math.pi
        sw = math.sin(t)
        r = base()
        st = P["stride"]
        r["thigh_l"] = [(X, -st * sw)]
        r["thigh_r"] = [(X, st * sw)]
        r["calf_l"] = [(X, P["knee"] * max(0.0, -math.sin(t + 0.6)))]
        r["calf_r"] = [(X, P["knee"] * max(0.0, math.sin(t + 0.6)))]
        r["foot_l"] = [(X, -0.15 * math.sin(t + 0.3))]
        r["foot_r"] = [(X, 0.15 * math.sin(t + 0.3))]
        r["upperarm_l"] += [(X, P["swing_l"] * sw)]
        r["upperarm_r"] += [(X, -P["swing_r"] * sw)]
        r["lowerarm_l"] = [(X, P["fore_l"] - 0.1 * max(0.0, sw) * (P["swing_l"] > 0.1))]
        r["lowerarm_r"] = [(X, P["fore_r"] - 0.1 * max(0.0, -sw) * (P["swing_r"] > 0.1))]
        r["spine_01"] = [(X, stoop * 0.6), (Z, 0.05 * sw)]
        r["spine_03"] = [(X, stoop * 0.4), (Z, -0.07 * sw)]
        r["neck_01"] = [(X, -stoop * 0.5)]
        return r, (0, 0, -P["bob"] * abs(math.cos(t)))

    def talk(f):
        t = (f - 1) / fps
        r, root = idle(f)
        g = math.sin(t * 2 * math.pi / 2.0)
        sides = {"l": ["l"], "r": ["r"], "both": ["l", "r"]}[P["talk"]]
        for i, s in enumerate(sides):
            sign = 1 if s == "l" else -1
            gi = math.sin(t * 2 * math.pi / 2.0 + i * 1.3)
            r[f"upperarm_{s}"] = [(Y, sign * 0.6), (X, -0.45 - 0.12 * gi)]
            r[f"lowerarm_{s}"] = [(X, -1.0 - 0.18 * math.sin(t * 2 * math.pi / 1.0 + i))]
            r[f"hand_{s}"] = [(Z, sign * 0.25 * gi)]
            for b in fingers:
                if b.endswith(s):
                    r[b] = [("local_x", 0.25)]
        r["head"] = [(X, 0.07 * math.sin(t * 2 * math.pi / 1.5)), (Z, 0.10 * math.sin(t * 2 * math.pi / 3.0))]
        r["spine_03"] = r.get("spine_03", []) + [(Z, 0.03 * g)]
        return r, root

    make_action(rig, "idle", list(range(1, 241, 6)) + [241], idle)
    make_action(rig, "walk", list(range(1, 32, 2)), walk)
    make_action(rig, "talk", list(range(1, 92, 3)), talk)


# ---------------------------------------------------------------------------------------------------------------------


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument("--resident", default="guenter", choices=sorted(RESIDENTS))
    ap.add_argument("--mhdata", required=True, help="MPFB 'data' folder (base mesh, targets, rigs; CC0)")
    ap.add_argument("--assets", required=True, help="makehuman_system_assets folder (skins, clothes, eyes; CC0)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--no-expressions", action="store_true", help="export without facial expression shape keys")
    args = ap.parse_args(argv)
    spec = RESIDENTS[args.resident]
    reset_scene()

    verts, uvs, faces = load_obj(os.path.join(args.mhdata, "3dobjs", "base.obj"))
    apply_macros(verts, args.mhdata, spec["macro"])
    apply_details(verts, args.mhdata, spec["details"])
    # Feet on the ground: shift so the lowest body vertex is at y = 0 (MakeHuman space).
    body_idx = {vi for g, c in faces if g == "body" for vi, _ in c}
    ground = min(verts[i][1] for i in body_idx)
    for v in verts:
        v[1] -= ground
    centres = group_centres(verts, faces)

    A = args.assets
    deleted = set()
    for _, path, *_ in spec["clothes"]:
        deleted.update(load_mhclo(os.path.join(A, path))["delete"])

    # Full body as the weight source for everything fitted onto it; the visible body loses the hidden faces.
    full, full_remap = build_mesh("weights_src", verts, uvs, faces, {"body"})
    rig = build_rig(args.mhdata, centres, verts)
    apply_weights(full, args.mhdata, full_remap, rig)
    visible = [f for f in faces if f[0] == "body" and not any(vi in deleted for vi, _ in f[1])]
    body, remap = build_mesh("body", verts, uvs, visible, {"body"})
    skin_name, skin_fix = spec["skin"]
    skin_dir = os.path.join(A, "skins", skin_name)
    skin_mat = load_mhmat(os.path.join(skin_dir, skin_name + ".mhmat"))
    skin_img = load_image(os.path.join(skin_dir, skin_mat["diffuseTexture"]), 1024)
    recolor(skin_img, FIXES[skin_fix])
    body.data.materials.append(material("skin", (1.0, 1.0, 1.0), 0.62, skin_img))
    apply_weights(body, args.mhdata, remap, rig)

    objects = {}
    for key, path, rough, fix, max_tex in spec["clothes"]:
        objects[key] = build_item(key, os.path.join(A, path), verts, rig, full, rough, fix=FIXES.get(fix), max_tex=max_tex)
    hair_path, hair_fix = spec["hair"]
    objects["hair"] = build_item("hair", os.path.join(A, hair_path), verts, rig, full, 0.8, fix=FIXES[hair_fix], max_tex=512)
    objects["eyes"] = build_item(
        "eyes", os.path.join(A, "eyes", "low-poly", "low-poly.mhclo"), verts, rig, full, 0.3,
        mhmat=os.path.join(A, "eyes", "materials", spec["eyes"] + ".mhmat"), max_tex=256,
    )
    brow_path, brow_fix = spec["eyebrows"]
    objects["eyebrows"] = build_item("eyebrows", os.path.join(A, brow_path), verts, rig, full, 0.9, fix=FIXES[brow_fix], max_tex=256)
    objects["eyelashes"] = build_item("eyelashes", os.path.join(A, spec["eyelashes"]), verts, rig, full, 0.9, max_tex=256)
    if "tights" in spec["props"]:
        build_tights(rig, verts, faces, full)

    if not args.no_expressions:
        add_expressions(
            args.mhdata, verts,
            [(body, "base", None, remap)]
            + [(objects[k][0], "item", objects[k][1], objects[k][2]) for k in ("eyebrows", "eyelashes")],
        )

    build_actions(rig, spec["pose"])
    hair = objects["hair"][0]
    eyebrows = objects["eyebrows"][0]
    suit = objects["suit"][0]
    if spec["headwear"]:
        kind, tex, colour = spec["headwear"]
        build_headwear(kind, rig, hair, body, eyebrows, os.path.join(A, tex) if tex else None, colour)
    for prop in spec["props"]:
        if prop == "stick":
            build_stick(rig)
        elif prop == "courier_bag":
            build_courier_bag(rig, suit, full)
        elif prop == "toolbelt":
            build_toolbelt(rig, suit, full)
        elif prop == "glasses":
            build_glasses(rig, objects["eyes"][0])
        elif prop == "shopping_bag":
            build_shopping_bag(rig)
    bpy.data.objects.remove(full)
    rig.name = spec["name"]

    bpy.ops.export_scene.gltf(
        filepath=args.out,
        export_format="GLB",
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_skins=True,
        export_yup=True,
        export_image_format="WEBP",
        export_image_quality=80,
        export_morph=True,
        export_morph_normal=False,
        export_try_sparse_sk=True,
    )
    tris = 0
    for o in bpy.data.objects:
        if o.type == "MESH":
            o.data.calc_loop_triangles()
            tris += len(o.data.loop_triangles)
    h = max((rig.matrix_world @ v.co).z for v in body.data.vertices)
    print(f"exported {args.out}: {tris} triangles, height {h:.3f} m")


if __name__ == "__main__":
    main()
