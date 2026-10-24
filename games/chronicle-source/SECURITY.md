# Game security boundary

Chronicle Frontier currently runs matches locally in the browser against bots. It has no multiplayer transport, authenticated match session, or game server. The browser therefore cannot provide server-authoritative movement, hit, reload, or economy checks; a modified client can change its own local state.

The current client applies bounded validation to imported custom maps and verifies each shipped GLB and its referenced Kenney textures with SHA-256 before use. A missing or mismatched model or texture is discarded with the model, and the built-in procedural model is used. These checks catch malformed map input and damaged or changed asset files, but client-side checksums cannot stop a player who modifies the game code.

Competitive online play needs a dedicated authoritative match service with authenticated sessions, server-owned player state, weapon timing and hit validation, and server-owned progression. The site currently has no such service, so the local modes do not claim cheat-resistant online competition.
