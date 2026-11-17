# Handoff notes

Read this, `CLAUDE.md` and `TODO.md` before changing anything.
`fable notes.md` is a longer plan for where to take the game next (opinions,
not agreed work).

## The idea (owner's words, condensed)

"MMO Healer": you run around and heal people. They go about their MMO lives:
questing, moving through towns, attending guild events. You select and heal
them at will. You do not have to be in their party. You can walk into
dungeons, find the party and start healing. You can find raids and PvP events
and be a rogue element. You gain levels and gear like any other MMO player.
Loot drops are key to the fun.

## Decisions so far

- Interface follows the big-MMO standard everyone knows: third person with a
  first-person option, activated abilities on an action bar, tab targeting.
  Not top down. Not click-to-heal (clicking a person only targets them).
- Start small: only the central hub. Doors, portals, the airship and the gate
  to the newbie zone are shown but do not take the player anywhere yet.
- Two heals to start: Mend (2 s cast) and Renew (instant heal over time).

- Owner's direction on controls: the current scheme works on a Chromebook,
  but eventually the default should be the standard one where the mouse
  pivots the view and WASD moves (sprint 1 in `TODO.md`).
- Arrow keys look (left and right turn, up and down tilt); WASD moves.
- Mouse-look (`S.look`, key X) uses pointer lock. It is off by default
  until the owner has tried it. While locked, a click targets whatever is
  under the centre dot. Esc both frees the cursor and reaches our key
  handler, so `main.js` ignores Esc for a moment after an unlock.
- Pim the vendor is created in `main.js`; shop rules are at the end of
  `game.js`; the shop is a section of the bag panel (`ui.js drawShop`).

## How the owner likes to work

- Short replies; they read on a small Chromebook (about 1366 by 600).
- If they mention a screenshot or file that is not attached, ask whether they
  forgot it before doing anything.
- They review on the live site, so every push goes to `main`.
- They talk a change through first. `TODO.md` is the ledger: build on a go.

## Where things stand (first build)

The hub city, Lanternrest, is playable. About 22 to 34 simulated players
wander between the inn, bank, auction hall, guild hall, stalls and fountain;
pair off to duel in the ring; train on dummies; arrive hurt from the three
portals; and come and go by airship. Healing them gives XP, and now and then
they toss you an item or a tip. Progress saves in localStorage (`mmoHealer1`).

## How the pieces fit

- `index.html`: all CSS and the HUD markup. The import map is written by
  `bump.sh` (three.js URL and a `?v=` for every module).
- `js/game.js`: rules. Spells, stats, XP curve, loot rolls, bag. No DOM.
- `js/world.js`: builds the hub. Exports `colliders` (circles and rotated
  boxes), `POI` (where people stand), `spots` (walk-up messages for things
  that are not open yet) and `mapShapes` (minimap).
- `js/figure.js`: blocky people per calling, the walk and cast animations,
  and the name plate sprite (repainted only when health changes).
- `js/people.js`: the simulated players. A small state machine each (idle,
  walk, duel), plus timers for duels, portal parties, airship arrivals, chat.
- `js/player.js`: input and camera. Yaw 0 faces +z (south); a bigger yaw
  turns left. Zoom 0 is first person.
- `js/ui.js`: frames, action bar, cast bar, chat, minimap, bag, floating
  numbers, sounds made in code.
- `js/main.js`: boot, frame loop, targeting, casting, rewards.
- `window.game` exposes state for tests. `?go` skips the title screen.

## Greenhollow (sprint 2)

- One continuous world: the zone is north of the wall (`ZONE` in
  `world.js`), joined to the city only by the gate passage. `collide`
  handles both sides; `inGreen(p)` says which side a point is on.
- `js/mobs.js`: monsters live in `CAMPS`, fight whoever hits them, sometimes
  jump a passer-by, and respawn in place. Models are in `figure.js`.
- Each person has `zone` ('hub' or 'green'). Green people loop: quest from
  the warden, hunt (`state: 'hunt'`, `p.mob`), rest (`p.resting`), hand in.
  `people.through(p, toGreen)` walks someone through the gate on a path.
- Death: `people.kill` and `people.revive`. Heals do nothing to the dead;
  Revive only works on the dead (`cast` and `land` in `main.js`).
- /say lines and duel news are only shown when the speaker is within 60
  yards; deaths are only announced while the healer is in Greenhollow.
- Figures further than 150 yards from the healer are hidden.
- `tools/sprint2.mjs` walks out the gate, watches the zone and tests Revive.
  The headless browser runs slow, so game time lags real time in tests.

## Emberdeep (sprint 3)

- The dungeon is built 1000 yards east (`DX`) in the same scene. `DUN` in
  `world.js` holds its rooms as rectangles (corridors overlap rooms by two
  yards so the collision has no seams), the waypoints, the room contents and
  the exits. Anything with `x > 500` is in the dungeon.
- `js/dungeon.js`: `buildDungeon` draws it (walls are one instanced mesh, and
  also block the camera). `Dungeon` is the run controller: phases gather,
  move, pull, fight, rest, then done or wipe. Its monsters have `owner` set
  so `people.js` sends their damage to the right place.
- Party members are ordinary people with `zone: 'dungeon'`; the controller
  steers them. The tank has `armor` 0.55 and 1.6 times the health.
- `world.mood(true)` switches sky, fog and light for the cave.
- Mistake already made: a translucent exit portal between the camera and the
  healer tinted the whole view. Keep portals flat against walls.
- `tools/sprint3.mjs` plays a run with no healer, then one with healing.

## The look (sprint 4, in progress)

- Owner's choice: **Storybook throughout** (golden hour, warm low sun, soft
  shadows, ACES tone mapping, a gentle bloom on lights). It is the default;
  `?look=original` shows the first build's flat style.
- Rejected samples, with the owner's reasons: Dusk (the glow around lights
  was too strong, and it ran choppy on the Chromebook: eleven point lights
  plus strong bloom); Toon (not chosen). Lessons: keep bloom subtle, avoid
  many real point lights, fake lamp light instead.
- `js/look.js` sets light, sky, fog, shadows (the sun's shadow box follows
  the healer), saturation and bloom. It sweeps the scene once a second so
  newcomers get shadows and glow. Cave mood in the dungeon still comes from
  `world.mood`.
- `tools/looks.mjs <out-dir> [look ...]` renders looks from the plaza, the
  gate and Greenhollow.
- The import map also maps `three/addons/`; tests serve the whole three
  package from `THREE_DIR`.

## Things worth knowing

- Coordinates: x east, z south, y up, one unit about a yard. The wall radius
  is 62; the north gate is at z = -62.
- Loot is paced by "full health bars healed" (`lootMeter` in `game.js`), so
  overhealing earns nothing.
- Simulated players are levelled around the healer's own level so heals stay
  meaningful. Nothing has had a human balance pass.
- The sandbox cannot reach the CDN; `tools/shot.mjs` serves three.js from a
  local npm copy (the whole `build/` folder, since the module imports
  `three.core.js`).
- Coins have no use yet. Bag is 14 slots; overflow is auto-sold.
