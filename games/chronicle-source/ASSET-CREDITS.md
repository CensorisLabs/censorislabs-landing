# Third-party game assets

These are selected assets used by Chronicle Frontier. All models were converted, scaled, reoriented, or recolored for the original game. The Blender source archives are not shipped.

| Asset | Author | Source | License | Integrated files |
| --- | --- | --- | --- | --- |
| 50+ Lowpoly Guns, Assault Rifle 1 | Quaternius | [itch.io asset page](https://quaternius.itch.io/50-lowpoly-guns) | CC0 1.0 Universal | `public/assets/models/cc0/quaternius/assault-rifle.glb`, converted from `AssaultRifle_1.fbx` |
| Blaster Kit, Blaster C | Kenney | [Kenney asset page](https://kenney.nl/assets/blaster-kit) | CC0 1.0 Universal | `public/assets/models/cc0/kenney-blaster/blaster-c.glb` and `Textures/colormap.png` |
| Blocky Characters, Character I | Kenney | [Kenney asset page](https://kenney.nl/assets/blocky-characters) | CC0 1.0 Universal | `public/assets/models/cc0/kenney-operator/character-i.glb` and `Textures/texture-i.png` |
| 3D Weapons Pack, MP5 | mehrasaur | [OpenGameArt asset page](https://opengameart.org/content/3d-weapons-pack) | CC0 1.0 Universal | `public/assets/models/cc0/opengameart/mp5.glb`, converted from `smg-mp5.obj` with its material |
| Voxel Weapons, Sword 2 | Texnist | [itch.io asset page](https://technistguru.itch.io/voxel-weapons) | CC0 1.0 Universal | `public/assets/models/cc0/texnist/sword2.glb`, exported from the supplied Blend model with its palette color map |

Kenney's GLB files refer to their texture PNGs by relative path, so the matching `Textures/` files are kept beside the models. The Quaternius, OpenGameArt, and Texnist source models were converted to compact binary glTF with Blender. The Texnist palette material was simplified to a nearest-filtered base-color texture for reliable browser rendering. Model and referenced Kenney texture files are checked against SHA-256 digests before use.

The game checks each shipped GLB against the SHA-256 digest recorded in `src/engine/assets.ts`. Missing files or failed verification fall back to the original procedural viewmodels and operators.
