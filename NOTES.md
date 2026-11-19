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
- The owner is the only player. A broken live site is not an emergency:
  fix it in the normal flow of work, without rushing or alarm. (Owner, sprint 4.)
- They talk a change through first. `TODO.md` is the ledger: build on a go.

## Where things stand (end of the first long session)

Sprints 1 to 8 in `TODO.md` are built and on `main`:
- Lanternrest (the hub), Greenhollow (the questing zone through the north
  gate) and Emberdeep (a dungeon through the orange portal), all in the
  Storybook look the owner chose.
- About 60 simulated players: town life, questing, dying, a dungeon party.
- Six spells: Mend, Renew, Revive, Flash (level 3), Ward (level 5), Fade
  (level 2). Unit frames, boss frame, drinking, threat, healer death and
  the ghost run.
- XP, levels, loot in four rarities, seven gear slots, a vendor (Pim).
- The owner has played it on their Chromebook: reached level 2, the frame
  rate is smooth with full effects (no step-down).

- Sprint 7: the roster, memory, fame, gossip, guilds, and the chat box with
  slash commands (the owner chose to fold the chat box into sprint 7).

- Sprint 8: loot in the world, Need or Greed, item effects, boss uniques,
  gear on the figure and the paper doll.

- The pond (after sprint 8): wading, swimming, fishing, and water as a
  reusable system.

- Talents: three sections (Mending, Grace, Shadow), Circle and Cleanse.

- Sprint 9, the clock: events board, tracker, four scheduled events, zone
  level bands.

Next: proposed only: sprint 10 (Crowds: the raid), the stats tab, and the
open ideas in `TODO.md` (graveyard, rival healer). Confirm with the owner,
then wait for their go. On a Chromebook, F1 to F6 need Search plus the top
row (or the "top-row keys as function keys" setting); the owner knows.
The owner liked the paper doll.
Nothing has had a hands-on balance pass beyond the owner's first play.

`fable notes.md` holds the longer-term plan and opinions it came from.

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

## The look (sprint 4)

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
- People (`makeFigure` in `figure.js`) are rounded shapes merged into six
  vertex-coloured meshes sharing one material: torso (with head, face, hat
  and robe), two legs, two arms. Merged shapes are cached by calling, skin,
  hair and tunic shade. `fig.sockets` has `head`, `handR` and `handL` groups
  for gear; weapons hang from the hands. Monsters use the same merged,
  cached build (`makeMob`).
- Combat text (`ui.js float`): yellow for hits on monsters, red for damage
  to people, green with + for heals. Pops, rises, drifts, fades; shrinks with
  distance and is hidden past 55 yards; capped at 60 on screen.
- `tools/figures.mjs <out-dir>` lines up every calling close to the camera.
- `js/textures.js` paints textures at start-up: grass, dirt, stone blocks,
  plaster with timber framing, shingles, planks. They are pale so one
  texture can be tinted per building by the material colour.
- Town props (benches, planters, barrels, crates, banners) are one merged
  mesh built in `world.js`; window boxes are merged per building. Firs are
  three stacked cones (`FIR`). Greenhollow grass is one instanced mesh of
  2,600 tufts, kept out of the shadow pass.
- `js/fx.js` (`Sparkles`): one pooled cloud of 1,600 additive particles.
  `fx.emit` for bursts (heal landing, Renew ticks, Revive, the staff while
  casting), `fx.source` for steady emitters (fires, portals, the fountain)
  that only run near the healer. Reduced motion cuts counts to a third.
- Frame-rate safety net in `look.js`: after a few seconds it measures the
  frame rate and, below 40 fps, steps down one notch at a time (glow, then
  shadows, then resolution), saying so in chat. `?quality=low` starts at the
  bottom; `?quality=high` never steps down (the look and figure tests use it,
  since the headless browser is slow).
- `tools/looks.mjs <out-dir> [look ...]` renders looks from the plaza, the
  gate and Greenhollow.
- The import map also maps `three/addons/`; tests serve the whole three
  package from `THREE_DIR`.

## The healer's hands (sprint 5)

- `meUnit` in `main.js` is the healer as a unit (F1 targets it). It has
  health from `stats().maxHp` but nothing damages it yet (sprint 6).
  Healing yourself gives no experience.
- Ward: `p.ward = { amt, t }`, soaked up first in `people.hurt`. A target
  cannot be warded again for 12 seconds (`wardLock`, keyed by unit).
- Damage over time: `p.dots` (bleeds), ticked in `people.update`.
- Frames: `ui.js frames()` takes the list from `main.js` (dungeon party, or
  nearby hurt and dead sorted by need) and keeps slots stable for a second
  at a time. `UI.frameUnits()` is what F2 to F6 pick from.
- Boss frame: `dungeon.bossInfo()` while Cinderjaw is fighting.
- Spells carry `lvl`; `G.knows(S, sp)` gates them. A level-up announces
  newly learned spells.
- `tools/sprint5.mjs` checks frames, keys, Flash, Ward, drinking, bleeds and
  the boss frame. The headless browser is slow, so it retries casts past the
  global cooldown and waits on `game.casting`.

## They bite back (sprint 6)

- Threat lives on each monster as `m.ht`; `addThreat(unit, amount)` in
  `main.js` is called after every heal, Renew tick and Ward. Constants are in
  `game.js` (`THREAT_*`, `TAUNT_BACK`). Monsters chase `meUnit` like anyone
  else; `people.hurt` hands damage on `meUnit` to `hurtMe` in `main.js`.
- Mobs drop a target inside the town wall (`mobs.js`), and the dungeon tank
  takes a turned monster back after `TAUNT_BACK` seconds (`dungeon.js`).
- Death: `die`, `release`, `returnToLife` in `main.js`; `UI.death(state)`
  shows the panel ('dead', 'ghost', 'body'). Ghost spots: the dungeon
  entrance, the Greenhollow camp, or the fountain. The healer's figure swaps
  to a see-through material while a ghost (`setGhost`).
- Spells can be `self` (no target) and have their own `cd` (`cds` in
  `main.js`, shown on the slot).
- Mistake already made: `look.js` called `look.onLower` before `look` was
  defined, so `?quality=low` crashed at start. Fixed.
- `tools/sprint6.mjs` checks threat, Fade, death and the ghost run, the safe
  town, and the tank taking a monster back.

## They remember (sprint 7)

- `js/memory.js` (rules, no DOM): `NAMES`, `GUILDS` with perks, `FAME`
  tiers, `makeRoster`, `rec(S, name)` (h heals, s saves, r revives, d deaths
  watched, w emotes), `bond` and `mood` (stranger, met, knows, friend,
  grudge), `deed` (the gossip log), `LINES` by event and temperament, and
  `upgrade` (save version 2: `S.v`, `S.roster`, `S.rec`, `S.fame`,
  `S.chan`, `S.guild`, `S.declined`). `G.load` and `G.newState` run it.
- People are spawned from `S.roster` (`p.who`); `makeFigure` gets the
  roster seed so a person looks the same every time. Strangers with
  throwaway names appear only if the whole cast is out.
- `js/social.js` (`Social`): reactions (`healed`, `revived`, `died`,
  `cry`), waves as you pass, General gossip (`general`), Emberdeep parties
  that know you (`party`), fame and tier-ups, guild invites and guild chat,
  and the answers to chat commands. It keeps its own delay queue on game
  time (`later`), so `?speed=N` applies; avoid new `setTimeout`s.
- Saves count from casts only: a heal that lands on someone under 25% who
  was hit in the last 5 seconds. Renew and Ward count as heals; Renew
  ticks do not. Emotes add goodwill once a minute, at most 6 in all.
- Fame: first heal of a person 1, save 2, revive 4, boss kill when the
  party saw you 6. Guild perks are applied in `game.js` (`perk`,
  `manaCost`) and `addFame`.
- `js/chat.js`: the log (160 lines kept, 40 shown), tabs, the chat box and
  the command parser. `ui.js` re-exports `chat` and `chatHtml`. A line's
  channel comes from its class and text (`channel`); system lines and
  whispers show on every tab. Buttons in chat lines use `data-act`.
- `figure.js animate` has `wave`, `bow` and `dance`. `p.pause` stops a
  person walking while they wave or dance; `emo` in `main.js` is the
  healer's emote (`/sit` lasts until you move).
- `tools/sprint7.mjs` checks the roster, records, waves, the chat box,
  commands, whispers, tabs, gossip, the guild invite and letting someone die.

## Loot that matters (sprint 8)

- `js/loot.js` (`Loot`): `drop(x, z, item)` puts a sack and beam in the
  world; `update` sparkles, expires (300 s) and picks up within 1.7 yards
  through `ctx.take` (`pickup` in `main.js`, which also records uniques in
  `S.uniques`). `G.reward` items now go to `loot.drop`, not the bag.
- Rolls: `startRoll(item, party, from)` queues one; `choose(kind)` is the
  healer's pick (the #roll panel or /need, /greed, /pass). Party picks come
  in over a few seconds; Need beats Greed. A healer Need win adds `n` to
  the record of each person who needed (in `bond`, -2 each).
  Hooks: `dungeon.ctx.roomLoot` after each pack (60%), `bossLoot` for
  Cinderjaw's unique, `mobs.ctx.killed` for Old Tusk.
- Effects: `G.EFFECTS`, `G.hasFx(S, id)` (one of each counts). Most are
  applied in `main.js` (`land`, `procs`, `cast`, the cast loop, drinking,
  Fade, `addThreat`); `swiftrez` and `beacon` in `game.js`; `bloom` is a
  flag on the hot (`people.js` and the healer's own hots); `stride` sets
  `player.gearSpeed`. `G.UNIQUES` and `G.makeUnique(id, ilvl)`.
- `figure.js dress(fig, equip)` adds gear meshes to the sockets, body and
  legs (`fig.gear`); `dressed()` in `main.js` redresses the healer.
- `js/doll.js`: a second small WebGL renderer for the paper doll, created
  the first time the window opens and drawn only while it is open.
- `tools/sprint8.mjs` checks drops and pick-up, a heal's drop, uniques,
  gear meshes and stride, crashing a roll, the doll window and Old Tusk.

## The pond (water and fishing)

- `js/water.js` is the water system. `addWater(scene, spec, mapShapes)`
  takes a circle `{ x, z, r }` or a rectangle `{ x0, z0, x1, z1 }`, plus
  `wade` (width of the shallow band; make it wider than the body for water
  that is shallow all through) and `fish`. It draws the surface, the bank,
  the drifting glints and the minimap shape, and for fishing water it makes
  bank `spots`. Only the pond uses it so far (`buildZone` in `world.js`).
- `waterAt(x, z)` gives `{ b, d, mode: 'wade' | 'swim', sink }` or null.
  `world.collide` calls `keepOut` for anyone without `swims` (people and
  monsters walk round water); the player has `swims: true`.
- `player.js` sets `player.water`, `player.sink` (eased) and slows you;
  `main.js` lowers the figure by `sink`, picks the `swim`/`tread`/`fish`
  animations, blocks casting (and drinking, eating) in deep water, and makes
  splashes and rings (`ripple`). `mobs.js` drops anyone who is `swimming`.
- Water surfaces carry `userData.noShade` (no shadows on water) and flat
  ground pieces carry `userData.flat` (they cast none); `look.js` reads both.
  A fir's shadow on the pond was the owner's "dark triangle".
- `js/fishing.js` (`Fishing`): the healer's rod (left hand), float and line;
  states `cast`, `wait`, `bite`; `reel()`; `blocked` comes from `main.js`.
  It also draws the tackle for people who fish: `people.js` sends a few
  green people to bank spots (`goFish`, `sitFish`, `stopFish`), two start
  there, and `fishBite` makes them cheer or talk.
- Catches are rules in `game.js` (`fishCatch`, `FISH`, `GLIMMERFIN`).
  Fish and junk are bag items with `kind` ('fish' or 'junk') and `slot`
  'Fish' or 'Junk'; they never equip. Clicking a fish eats it (`eat` in
  `main.js`: a `meal` adds mana while you sit); clicking junk sells it.
  `S.fishCaught` and `S.glimmer` are counted for the stats tab later.
  Landing Old Glimmerfin calls `social.fished` (fame 3, a `fish` deed).
- `tools/pond.mjs` checks all of it.

## Talents

- Rules in `game.js`: `TREES` (each talent has `tier`, `max`, `desc(rank)`),
  `rank(S, id)`, `pointsFree`, `cantLearn`, `learn`, `resetTalents`;
  `S.talents` is `{ id: rank }`. Points: level minus 2. `TIER_COST` 3.
- Spells with `talent` (Circle, Cleanse) are known only once learned
  (`knows`); their bar slots stay hidden until then. Keys 7 and 8.
- Where each talent acts: `castTime`, `healAmount`, `stats` (Deep Well) in
  `game.js`; `addThreat` (Quiet Hands), `land` (Overflow as an `overflow`
  hot, Quickening, Circle, Cleanse), the mana line (Calm Mind, using
  `lastCast`), `hurtMe` (Last Breath, `cds.breath`), `release` (Swift
  Spirit), `secondWind` (`cds.wind`, the death panel's second button) in
  `main.js`; `player.waterborne` in `player.js`. `fadeAway()` is Fade
  without the cost, shared with Last Breath.
- `ui.js`: `toggleTalents`, `drawTalents`; the window is `#talents`.
- `hurtTarget` (F) includes `meUnit` and uses 40 yards.
- `tools/talents.mjs` checks it all.

## The clock (sprint 9)

- `js/clock.js` (`Clock`): `EVENTS` (kind, timers, gather and run length),
  each event goes `soon` → `gather` → `on` → `done` on game time (so
  `?speed` applies). `gather` books people (`p.event`), `begin` starts it,
  `finish` records `results` (8 kept), posts `[Events]` lines and plans the
  next of that kind. `crowd(n)` tops up town folk with newcomers.
- Emberdeep: `booked()` hands the event's party to `dungeon.start` (by
  roster name, `people.spawn(x, z, frac, kind, name)`) when the healer goes
  in while it is under way; `runOver` reports a real clear or wipe.
- Tusk hunt and tournament are real fights: hunters get `p.mob` = Old Tusk;
  the bracket uses `people.duelPair`, and `endDuel` sets `p.duelResult`.
- `people.free()` skips anyone with `p.event`; event people are held in
  place by keeping their `wait` up.
- Bands: `G.BANDS`, `G.bandLevel(zone, S, extra)`, `people.relevel(p, zone)`
  when someone enters or leaves Greenhollow or joins the dungeon. Greenhollow
  dings stop at the top of the band. The zone toast shows the band.
- UI: `#tracker` under the fame meter, `#events` window (`toggleEvents`,
  `drawEvents` twice a second). The board is `world.board` (`buildWorld`).
- `main.js` renamed its frame timer to `frameClock`; `clock` is the events.
- `tools/clock.mjs` checks it all.

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
- Coins buy gear and bags from Pim. Bag is 14 slots; a drop stays on the
  ground while the bag is full.
