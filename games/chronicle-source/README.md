# Chronicle Frontier

Three.js is the browser engine because the game must run inside the existing React/Vite site without a launcher.
The main site already includes Three.js, so the game reuses the browser WebGL stack instead of shipping a second runtime.
Procedural voxel arenas, an armory of 76 selectable gun blueprints, 1,018 original firearm finishes, 75 earned knife finishes, 48 unlockable operator looks, and local bot matches fit this web-first approach.

Run `npm install` and `npm run dev` for local development. `npm run build` produces the static browser game in `dist/`. Copy the contents of `dist/` to the main site's `public/games/chronicle/` folder when publishing an updated build.

The operator rewards use original voxel colors and geometry; the game does not bundle Minecraft skins or third-party game assets.
