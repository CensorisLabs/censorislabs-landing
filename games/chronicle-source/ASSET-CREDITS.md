# Third-party game assets

Chronicle Frontier uses the following selected CC0 assets. Attribution is optional under CC0; this file records provenance. Original models and textures are shipped only when their licenses are clear. The full source archives are not included in the browser build.

| Asset | Author | Source | License | Integrated files |
| --- | --- | --- | --- | --- |
| Ultimate Gun Pack / Low Poly Guns Pack, Assault Rifle 2 and Sniper Rifle 2 | Quaternius | [OpenGameArt pack](https://opengameart.org/content/low-poly-guns-pack) | CC0 1.0 Universal | `public/assets/models/cc0/quaternius/assault-rifle.glb`, `sniper-rifle.glb`, converted from the pack's FBX models with Blender |
| Blaster Kit, Blaster C | Kenney | [Kenney asset page](https://kenney.nl/assets/blaster-kit) | CC0 1.0 Universal | `public/assets/models/cc0/kenney-blaster/blaster-c.glb` and `Textures/colormap.png` |
| Blocky Characters, Character I | Kenney | [Kenney asset page](https://kenney.nl/assets/blocky-characters) | CC0 1.0 Universal | `public/assets/models/cc0/kenney-operator/character-i.glb` and `Textures/texture-i.png` |
| 3D Weapons Pack, MP5 | mehrasaur | [OpenGameArt asset page](https://opengameart.org/content/3d-weapons-pack) | CC0 1.0 Universal | `public/assets/models/cc0/opengameart/mp5.glb`, converted from `smg-mp5.obj` with its material |
| Building Kit, Wall and Barricade Doorway A | Kenney | [Kenney asset page](https://kenney.nl/assets/building-kit) | CC0 1.0 Universal | `public/assets/models/cc0/kenney-building/wall.glb`, `barricade-doorway-a.glb`, and `Textures/colormap.png` |

Quaternius and OpenGameArt weapon models are compact binary glTF exports. Kenney GLBs keep their referenced color atlas beside the model. Model and referenced texture bytes are checked against the SHA-256 values in `src/engine/assets.ts`; failed loads or verification continue to use the game's procedural fallback models.

The supplied Quaternius Modular Gun Pack link did not yield a usable archive in the earlier download attempt. The integrated Quaternius rifle and sniper are from the verified CC0 Low Poly Guns Pack distribution on OpenGameArt, rather than being represented as Modular Gun Pack models.

## Sources not imported

- The generic Sketchfab search tags in the supplied asset list do not identify an individual model or license, so no Sketchfab files are included.
- The supplied OpenGameArt voxel-character and modular-level links did not provide a verified downloadable asset with a clear license during this import, so they are not included.
- The requested [Kirka Community Hub repository](https://github.com/imnotkoolkid/KCH) was inspected as a reference. Its [terms](https://github.com/imnotkoolkid/KCH/blob/main/source/tos.html) state that third-party content remains the property of its owners and that the hub does not guarantee submitted content is properly licensed. No KCH models, textures, maps, or code are redistributed here.
- No Kirka, CS, or CoD proprietary game assets are included. The melee weapon continues to use the original procedural model.
