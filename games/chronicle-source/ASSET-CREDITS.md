# Game asset provenance

Chronicle's imported 3D models and map geometry use the KCH files supplied for this project. The site owner states that they hold the licenses needed to use and distribute these files. This record reflects that statement; the licenses have not been independently re-audited here.

| Asset group | Runtime location | Use |
| --- | --- | --- |
| KCH character, arms, and weapon models | `public/assets/models/kch/` | Player and first-person equipment models |
| KCH maps | `public/assets/maps/kch/` | Playable map geometry and layout |

The runtime model registry in `src/engine/assets.ts` references only `assets/models/kch/*.glb`. The map registry references only `assets/maps/kch/*.json`. Model and map files are checked against their SHA-256 digests before use; failed loads retain the game's procedural fallback.

The browser UI and HUD are implemented in the Chronicle source using the KCH-inspired visual references supplied for this project. No other imported 3D model packs are part of the shipped game bundle.