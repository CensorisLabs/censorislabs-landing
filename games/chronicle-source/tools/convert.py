"""Convert a selected FBX, OBJ, or Blend source to binary glTF with Blender.

Run from the game source folder:
  F:\\blender.exe --background --python tools\\convert.py -- input.fbx public\\assets\\models\\converted\\model.glb

For Blend files, the whole saved scene is exported. Remove unrelated objects in a copy
of the source file before conversion when it contains more than the intended asset.
"""

from __future__ import annotations

import os
import sys

import bpy


def arguments() -> tuple[str, str]:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if len(argv) != 2:
        raise SystemExit("Expected: -- <input.fbx|input.obj|input.blend> <output.glb>")
    return os.path.abspath(argv[0]), os.path.abspath(argv[1])


def import_model(source: str) -> None:
    suffix = os.path.splitext(source)[1].lower()
    if suffix == ".blend":
        bpy.ops.wm.open_mainfile(filepath=source)
    elif suffix == ".fbx":
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.fbx(filepath=source)
    elif suffix == ".obj":
        bpy.ops.wm.read_factory_settings(use_empty=True)
        if hasattr(bpy.ops.wm, "obj_import"):
            bpy.ops.wm.obj_import(filepath=source)
        else:
            bpy.ops.import_scene.obj(filepath=source)
    else:
        raise SystemExit(f"Unsupported input format: {suffix or '(no extension)'}")


def export_model(output: str) -> None:
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise SystemExit("The input scene contains no mesh objects")

    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type in {"MESH", "ARMATURE"}:
            obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]

    os.makedirs(os.path.dirname(output), exist_ok=True)
    supported = {prop.identifier for prop in bpy.ops.export_scene.gltf.get_rna_type().properties}
    options = {
        "filepath": output,
        "export_format": "GLB",
        "use_selection": True,
        "export_materials": "EXPORT",
        "export_animations": True,
        "export_skins": True,
    }
    if "export_apply" in supported:
        options["export_apply"] = True
    if "export_cameras" in supported:
        options["export_cameras"] = False
    if "export_lights" in supported:
        options["export_lights"] = False
    bpy.ops.export_scene.gltf(**{key: value for key, value in options.items() if key in supported})


def main() -> None:
    source, output = arguments()
    if not os.path.isfile(source):
        raise SystemExit(f"Input file not found: {source}")
    import_model(source)
    export_model(output)
    print(f"Converted {source} -> {output}")


if __name__ == "__main__":
    main()
