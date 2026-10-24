# Chronicle Frontier

Three.js is the browser engine because the game must run inside the existing React/Vite site without a launcher.
The main site already includes Three.js, so the game reuses the browser WebGL stack instead of shipping a second runtime.
Procedural voxel arenas, an armory of 76 selectable gun blueprints, 1,018 original firearm finishes, 75 earned knife finishes, 48 unlockable operator looks, and local bot matches fit this web-first approach.

The site embeds the game at `/games/chronicle/`; players open it in a normal browser with no installer or launcher. The current offline build offers Free for All, Team Deathmatch, Domination, Hardpoint, Capture the Standard, Search & Defuse, Frontier Royale, and Aim Range. Bot difficulty is selectable. Team modes offer 1v1, 4v4, or 5v5 bot-filled matches and shrink the arena with team size. Royale offers 30, 50, 60, or 100 total combatants, with bots filling the field.

The online server, party/lobby flow, large streamed 4 km world, destructive voxel terrain, and the remaining advanced tactical/hero systems are not included in this browser build yet. Those require separate server and world-engine work; the current release is a local browser game against bots.

Run `npm install` and `npm run dev` for local development. `npm run build` produces the static browser game in `dist/`. Copy the contents of `dist/` to the main site's `public/games/chronicle/` folder when publishing an updated build.

The operator rewards use original voxel colors and geometry; the game does not bundle Minecraft skins or third-party game assets.
