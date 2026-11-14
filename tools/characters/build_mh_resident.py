"""Builds a resident figure from the CC0 MakeHuman data (base mesh, targets, rig, weights, clothes) and exports a GLB.

Only data files are read; no MakeHuman or MPFB code is executed or bundled. Usage (Python 3.13 with `pip install
bpy==5.3.0`; the data folders are described in docs/VISUAL-BASELINE.md, section 8):

    python tools/characters/build_mh_resident.py --resident guenter \
        --mhdata <mpfb>/data --assets <makehuman_system_assets> --out public/models/residents/n-002.glb

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
    "guenter": {
        "name": "N-002",
        "macro": {"gender": 1.0, "age": 0.86, "muscle": 0.42, "weight": 0.58, "height": 0.42, "proportions": 0.5},
        # Individual features (MakeHuman detail targets, value = weight).
        # CC0 items of the makehuman_system_assets pack (paths relative to the pack).
        "items": {
            "skin": "old_caucasian_male",
            "suit": "clothes/male_casualsuit05/male_casualsuit05.mhclo",
            "shoes": "clothes/shoes01/shoes01.mhclo",
            "hair": "hair/short02/short02.mhclo",
            "eyebrows": "eyebrows/eyebrow009/eyebrow009.mhclo",
            "eyelashes": "eyelashes/eyelashes02/eyelashes02.mhclo",
            "eyes": "brownlight",
            "cap_texture": "clothes/fedora01/fedora_diffuse.png",
        },
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
    },
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
    """Fits a MakeHuman clothes/proxy item to the shaped body, gives it the body's skin weights and its material."""
    info = load_mhclo(mhclo_path)
    folder = os.path.dirname(mhclo_path)
    _, iuvs, ifaces = load_obj(os.path.join(folder, info["obj"]))
    fitted = fit_mhclo(info, verts)
    obj, _ = build_mesh(name, fitted, iuvs, ifaces, {g for g, _ in ifaces})
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
    return obj, info


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


def trousers_and_watermark(px):
    """Suit texture: blue denim -> dark brown-grey cloth; the corner watermark outside the UV islands is cleared."""
    import numpy as np

    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    denim = (b > r + 0.06) & (b > g + 0.02)
    tone = np.array([0.42, 0.38, 0.34]) * 1.35
    for c in range(3):
        px[..., c] = np.where(denim, np.clip(0.18 + lum * 0.9, 0, 1) * tone[c], px[..., c])
    # Olive jacket cloth (low saturation, green slightly above red) -> lighter warm grey.
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    jacket = (~denim) & (mx - mn < 0.09) & (g >= r - 0.01) & (mx > 0.08)
    lum2 = 0.3 * px[..., 0] + 0.59 * px[..., 1] + 0.11 * px[..., 2]
    for c, k in enumerate((0.60, 0.58, 0.54)):
        px[..., c] = np.where(jacket, np.clip(lum2 * 1.75, 0, 1) * k / 0.58, px[..., c])
    h, w = px.shape[:2]
    px[int(h * 0.95):, int(w * 0.8):, :3] = 0.0
    return px


def calm_skin(px):
    """The MakeHuman skin is quite orange under the game's light: desaturate a little and lift it."""
    lum = 0.3 * px[..., 0] + 0.59 * px[..., 1] + 0.11 * px[..., 2]
    for c in range(3):
        px[..., c] = (lum + (px[..., c] - lum) * 0.72) * 1.06
    # The vertical project label in the lower right corner (outside the UV islands) is painted over with skin.
    h, w = px.shape[:2]
    px[: int(h * 0.26), int(w * 0.965):, :3] = px[int(h * 0.30), int(w * 0.95), :3]
    return px


def grey_hair(px):
    import numpy as np

    lum = 0.3 * px[..., 0] + 0.59 * px[..., 1] + 0.11 * px[..., 2]
    v = np.clip(0.45 + lum * 1.6, 0, 1)
    for c, k in enumerate((0.80, 0.79, 0.77)):
        px[..., c] = v * k
    return px


def grey_hair_clean(px):
    """Grey hair plus removal of the project URL in the lower right corner of the hair texture."""
    px = grey_hair(px)
    h, w = px.shape[:2]
    px[: int(h * 0.07), int(w * 0.7):, 3] = 0.0
    return px


def rigid_part(obj, rig, bone):
    obj.parent = rig
    vg = obj.vertex_groups.new(name=bone)
    vg.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = rig


def build_cap(rig, hair, body, brows, texture):
    """Flat cap ("Schiebermütze") fitted to the head.

    The crown is a shell sampled from the actual skull and hair surfaces (rays from the head centre), so it follows
    the head; it sits low on the forehead and lower at the back, the upper part is pulled forward over a short brim.
    Hair under the cap is removed.
    """
    import bmesh
    from mathutils.bvhtree import BVHTree

    def tree(obj):
        me = obj.data
        return BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [tuple(p.vertices) for p in me.polygons])

    body_t, hair_t = tree(body), tree(hair)
    hco = [v.co for v in hair.data.vertices]
    cx = (min(c.x for c in hco) + max(c.x for c in hco)) / 2
    cy = (min(c.y for c in hco) + max(c.y for c in hco)) / 2
    brow_z = sum(v.co.z for v in brows.data.vertices) / len(brows.data.vertices)
    centre = Vector((cx, cy + 0.012, brow_z - 0.005))

    def surface(d):
        hb = body_t.ray_cast(centre, d)[0]
        hh = hair_t.ray_cast(centre, d)[0]
        rb = (hb - centre).length if hb else 0.09
        rh = (hh - centre).length if hh else rb
        # On the skull, lying on flattened hair: never inside the head, never as far out as loose hair.
        return max(rb + 0.013, min(rh * 0.97, rb + 0.024))

    seg, rings = 40, 12
    grid = []
    for k in range(seg):
        a = 2 * math.pi * k / seg
        front = max(0.0, -math.sin(a))  # 1 at the face (-Y), 0 at the sides and back
        e0 = math.radians(2.0 + 22.0 * front - 6.0 * max(0.0, math.sin(a)))
        row = []
        for r in range(rings + 1):
            t = r / rings
            e = e0 + (math.radians(88.0) - e0) * t
            d = Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e)))
            p = centre + d * surface(d)
            # Flat-cap profile: the crown is pulled forward and slightly widened above the band, the top flattened.
            lift = t * t
            p.y -= 0.045 * lift
            p.x = cx + (p.x - cx) * (1.0 + 0.10 * math.sin(math.pi * min(1.0, t * 1.2)))
            p.z -= 0.024 * lift * (1.0 + 0.6 * max(0.0, math.sin(a)))
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
    # Brim: from the front part of the band, out and slightly down.
    brim = []
    for k in range(seg):
        a = 2 * math.pi * k / seg
        front = -math.sin(a)
        if front < 0.35:
            brim.append(None)
            continue
        w = (front - 0.35) / 0.65
        base = grid[k][0]
        out = Vector((base.x - cx, base.y - cy, 0.0)).normalized()
        tip = base + out * (0.052 * w ** 0.6) + Vector((0, 0, -0.016 * w))
        brim.append(bm.verts.new(tip))
    for k in range(seg):
        k2 = (k + 1) % seg
        if brim[k] is not None and brim[k2] is not None:
            bm.faces.new((vs[k][0], brim[k], brim[k2], vs[k2][0]))
    bm.normal_update()
    mesh = bpy.data.meshes.new("cap")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("cap", mesh)
    bpy.context.scene.collection.objects.link(obj)
    uv = mesh.uv_layers.new(name="UVMap")
    zmin = min(v.co.z for v in mesh.vertices)
    for poly in mesh.polygons:
        poly.use_smooth = True
        for li in poly.loop_indices:
            c = mesh.vertices[mesh.loops[li].vertex_index].co
            a = math.atan2(c.y - cy, c.x - cx)
            uv.data[li].uv = (0.05 + 0.40 * (a + math.pi) / (2 * math.pi), 0.2 + 0.6 * (c.z - zmin) / 0.14)
    solid = obj.modifiers.new("solid", "SOLIDIFY")
    solid.thickness = 0.004
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=solid.name)

    # Remove the hair under the cap: every face with a vertex above the band (in the direction seen from the centre).
    def under_cap(co):
        d = co - centre
        a = math.atan2(d.y, d.x)
        front = max(0.0, -math.sin(a))
        e0 = math.radians(2.0 + 22.0 * front - 6.0 * max(0.0, math.sin(a)))
        return math.atan2(d.z, math.hypot(d.x, d.y)) > e0 + math.radians(3.0)

    hb = bmesh.new()
    hb.from_mesh(hair.data)
    gone = [f for f in hb.faces if any(under_cap(v.co) for v in f.verts)]
    bmesh.ops.delete(hb, geom=gone, context="FACES")
    hb.to_mesh(hair.data)
    hb.free()

    img = load_image(texture, 512)
    recolor(img, lambda px: _tint(px, (0.55, 0.50, 0.42), 1.25))
    obj.data.materials.append(material("cap", (1.0, 1.0, 1.0), 0.95, img))
    rigid_part(obj, rig, "head")
    return obj


def _tint(px, colour, gain):
    lum = 0.3 * px[..., 0] + 0.59 * px[..., 1] + 0.11 * px[..., 2]
    for c in range(3):
        px[..., c] = (lum * gain).clip(0, 1) * colour[c] / max(colour)
    return px


def build_stick(rig):
    """Walking stick held in the right hand: built in the idle pose, then mapped back into the bind pose."""
    rig.animation_data.action = bpy.data.actions["idle"]
    bpy.context.scene.frame_set(1)
    pb = rig.pose.bones["hand_r"]
    posed = rig.matrix_world @ pb.matrix
    rest = rig.matrix_world @ rig.data.bones["hand_r"].matrix_local
    grip = posed @ Vector((0, pb.length * 0.55, 0))
    tip = Vector((grip.x - 0.10, grip.y - 0.16, 0.0))
    mesh = bpy.data.meshes.new("stick")
    import bmesh

    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.011, radius2=0.013, depth=1.0)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("stick", mesh)
    bpy.context.scene.collection.objects.link(obj)
    axis = grip - tip
    length = axis.length + 0.04
    mid = (grip + tip) / 2 + axis.normalized() * 0.02
    m = Matrix.Translation(mid) @ axis.to_track_quat("Z", "Y").to_matrix().to_4x4() @ Matrix.Diagonal((1, 1, length, 1))
    to_bind = rest @ posed.inverted()
    mesh.transform(to_bind @ m)
    for p in mesh.polygons:
        p.use_smooth = True
    obj.data.materials.append(material("stick", (0.36, 0.22, 0.12), 0.55))
    rigid_part(obj, rig, "hand_r")
    rig.animation_data.action = None
    bpy.context.scene.frame_set(1)
    return obj


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


def build_actions(rig, stoop=0.16):
    fps = 30
    fingers = [f"{n}_0{i}_{s}" for n in ("index", "middle", "ring", "pinky") for i in (1, 2, 3) for s in ("l", "r")]

    def relaxed_hands(r, curl=0.35, stick_curl=1.1):
        for b in fingers:
            side = b[-1]
            # Positive X rotation in armature space curls the fingers forward and in for both hands.
            r[b] = [("local_x", stick_curl if side == "r" else curl)]

    def base():
        r = {}
        # Arms from the A-pose down to the sides (rotation about the forward axis).
        r["upperarm_l"] = [(Y, 0.85)]
        r["upperarm_r"] = [(Y, -0.85)]
        relaxed_hands(r)
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
        r["lowerarm_l"] = [(X, -0.12)]
        r["lowerarm_r"] = [(X, -0.30)]
        r["thigh_l"] = [(Y, 0.02 * shift)]
        r["thigh_r"] = [(Y, 0.02 * shift)]
        return r, (0.01 * shift, 0, 0)

    def walk(f):
        t = (f - 1) / fps * 2 * math.pi
        sw = math.sin(t)
        r = base()
        r["thigh_l"] = [(X, -0.22 * sw)]
        r["thigh_r"] = [(X, 0.22 * sw)]
        r["calf_l"] = [(X, 0.42 * max(0.0, -math.sin(t + 0.6)))]
        r["calf_r"] = [(X, 0.42 * max(0.0, math.sin(t + 0.6)))]
        r["foot_l"] = [(X, -0.15 * math.sin(t + 0.3))]
        r["foot_r"] = [(X, 0.15 * math.sin(t + 0.3))]
        r["upperarm_l"] += [(X, 0.30 * sw)]
        r["upperarm_r"] += [(X, -0.12 * sw)]
        r["lowerarm_l"] = [(X, -0.2 - 0.1 * sw)]
        r["lowerarm_r"] = [(X, -0.35)]
        r["spine_01"] = [(X, stoop * 0.6), (Z, 0.05 * sw)]
        r["spine_03"] = [(X, stoop * 0.4), (Z, -0.07 * sw)]
        r["neck_01"] = [(X, -stoop * 0.5)]
        return r, (0, 0, -0.012 * abs(math.cos(t)))

    def talk(f):
        t = (f - 1) / fps
        r, root = idle(f)
        g = math.sin(t * 2 * math.pi / 2.0)
        r["upperarm_l"] = [(Y, 0.6), (X, -0.45 - 0.12 * g)]
        r["lowerarm_l"] = [(X, -1.0 - 0.18 * math.sin(t * 2 * math.pi / 1.0))]
        r["hand_l"] = [(Z, 0.25 * g)]
        r["head"] = [(X, 0.07 * math.sin(t * 2 * math.pi / 1.5)), (Z, 0.10 * math.sin(t * 2 * math.pi / 3.0))]
        return r, root

    make_action(rig, "idle", list(range(1, 241, 6)) + [241], idle)
    make_action(rig, "walk", list(range(1, 32, 2)), walk)
    make_action(rig, "talk", list(range(1, 92, 3)), talk)


# ---------------------------------------------------------------------------------------------------------------------


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument("--resident", default="guenter")
    ap.add_argument("--mhdata", required=True, help="MPFB 'data' folder (base mesh, targets, rigs; CC0)")
    ap.add_argument("--assets", default=None, help="makehuman_system_assets folder (skins, clothes, eyes; CC0)")
    ap.add_argument("--out", required=True)
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
    items = spec["items"]
    deleted = set()
    for key in ("suit", "shoes"):
        deleted.update(load_mhclo(os.path.join(A, items[key]))["delete"])

    # Full body as the weight source for everything fitted onto it; the visible body loses the hidden faces.
    full, full_remap = build_mesh("weights_src", verts, uvs, faces, {"body"})
    rig = build_rig(args.mhdata, centres, verts)
    apply_weights(full, args.mhdata, full_remap, rig)
    visible = [f for f in faces if f[0] == "body" and not any(vi in deleted for vi, _ in f[1])]
    body, remap = build_mesh("body", verts, uvs, visible, {"body"})
    skin_dir = os.path.join(A, "skins", items["skin"])
    skin_mat = load_mhmat(os.path.join(skin_dir, items["skin"] + ".mhmat"))
    skin_img = load_image(os.path.join(skin_dir, skin_mat["diffuseTexture"]), 1024)
    recolor(skin_img, calm_skin)
    body.data.materials.append(material("skin", (1.0, 1.0, 1.0), 0.62, skin_img))
    apply_weights(body, args.mhdata, remap, rig)

    build_item("suit", os.path.join(A, items["suit"]), verts, rig, full, 0.9, fix=trousers_and_watermark)
    build_item("shoes", os.path.join(A, items["shoes"]), verts, rig, full, 0.55, max_tex=512)
    build_item("hair", os.path.join(A, items["hair"]), verts, rig, full, 0.8, fix=grey_hair_clean, max_tex=512)
    build_item("eyes", os.path.join(A, "eyes", "low-poly", "low-poly.mhclo"), verts, rig, full, 0.3,
               mhmat=os.path.join(A, "eyes", "materials", items["eyes"] + ".mhmat"), max_tex=256)
    build_item("eyebrows", os.path.join(A, items["eyebrows"]), verts, rig, full, 0.9, fix=grey_hair, max_tex=256)
    build_item("eyelashes", os.path.join(A, items["eyelashes"]), verts, rig, full, 0.9, max_tex=256)
    bpy.data.objects.remove(full)

    build_actions(rig)
    hair = bpy.data.objects["hair"]
    build_cap(rig, hair, body, bpy.data.objects["eyebrows"], os.path.join(A, items["cap_texture"]))
    build_stick(rig)
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
