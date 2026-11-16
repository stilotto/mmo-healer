# Fable notes: how to make MMO Healer great

Written at the end of the first session (hub, Greenhollow and Emberdeep are
built). This is a plan and a set of opinions for whoever builds next. Nothing
here is agreed with the owner unless `TODO.md` says so. Read `NOTES.md` first
for how the code fits together.

## 1. What the game is really about

The joke is the hook: everyone else is playing an MMO and you are the healer
nobody invited. The joke only stays funny if three things are true:

1. **They need you.** Things go visibly wrong when you are not there, and
   visibly right when you are.
2. **They notice you.** The world reacts to a stranger keeping it alive.
3. **You get paid.** Loot and levels arrive often and feel earned.

Today the game has the setting and a first pass at each of the three, but
healing is low-stakes: there is rarely more than one person to worry about,
you have two buttons, you cannot fail, and nobody remembers you. Fix those
four things before adding more places to go.

## 2. The five things that will matter most (in this order)

### 2.1 Triage: give the healer real decisions

Healing games are fun when you must choose who lives. That needs:

- **Frames.** Healers do not look at the world, they look at health bars. Add
  a column of small frames (left edge) for the people who matter right now:
  the dungeon party when inside, otherwise the five most hurt people within
  range. Click or tap a frame to target. Keys F1 to F5 select them. This one
  feature will change how the game feels more than any new zone.
- **Damage with shapes.** Right now damage is a steady drip. Add three
  shapes so a glance at the frames tells a story: a *spike* (tank takes a big
  hit), a *bleed or poison* that ticks until cleansed, and *group damage*
  (breath, explosions). Each shape has a right answer.
- **A kit with trade-offs.** Target kit, unlocked by level so the bar fills
  up over the first hour:
  - Mend: slow, cheap, big. (have)
  - Renew: heal over time. (have)
  - Flash: fast, expensive. The panic button. (level 3)
  - Ward: a shield that absorbs the next hit. Rewards watching the boss
    cast bar. (level 5)
  - Cleanse: removes a bleed or poison. (level 6)
  - Circle: heals everyone near the target. (level 8)
  - Second Wind: 3 minute cooldown, a huge instant heal. (level 10)
  - Revive. (have)
- **Mana is the pace.** Mana should run out about three quarters of the way
  through a boss if you spam the expensive heal, and last if you plan. Add
  "sit to drink" (hold still out of combat, fast regen) so downtime is short
  and deliberate.
- **Show what is coming.** Boss cast bar on the target-of-target, a marker
  over whoever a monster is about to hit, a faint "incoming heal" segment on
  bars while you cast. Good healers play one second ahead.

### 2.2 Stakes: the healer can lose

- Monsters must notice the healer (already agreed in `TODO.md`). The classic
  rule works and is funny here: healing generates threat on everything
  fighting your target. If the tank is not holding them, they come for you.
- The healer has health that matters, can heal themself (target self with a
  key), and can die.
- Death should cost time, not progress: you become a ghost at the nearest
  camp or dungeon entrance and run back. If you die in a dungeon the party
  probably wipes, which is the real punishment.
- Give one escape: Fade (drop all threat, 30 second cooldown).
- Keep the hub completely safe.

### 2.3 Memory: they remember you

This is the feature no other healing game has, and it is cheap because the
"players" are simulated.

- **A persistent cast.** Replace throwaway random names with a saved roster
  of about 60 characters (name, calling, guild, level, a temperament). The
  same people turn up in town, in Greenhollow and in dungeon parties. Each
  keeps a small record about you: times healed, times saved from near death,
  times revived, times you let them die while standing next to them.
- **Reactions scale with the record.** First heal: "who are you?". Tenth:
  they wave when you walk past. After a save: a whisper. After you let them
  die: sulking, or a rant in General chat. Temperaments make it varied:
  grateful, suspicious, entitled ("heal me, not him"), competitive.
- **Reputation as a second progress bar.** A fame meter from "Who?" through
  "That healer" to "The Lantern". Fame unlocks things money cannot: people
  ask for you by name in General ("is the ghost healer on?"), parties wait
  for you at the dungeon door, guilds send invites (pick one for a tabard
  and a perk), the inn gives you a room.
- **A rival.** One simulated healer who is in a party properly and resents
  you. Occasionally you both heal the same run and the party compares you.
- **Rumours.** General chat should talk about what you actually did in the
  last ten minutes. Three or four templates fed by real events is enough.

### 2.4 Loot: make every drop a moment

The owner said loot is key to the fun. Right now loot is a line of chat.

- **A loot beam and a sound per rarity.** The item should appear in the
  world (a glowing bundle at the giver's feet, or a chest after a boss) and
  be picked up by walking over it. Epics get a pillar of light.
- **Rolls.** When a boss dies the party rolls need or greed in chat. Let the
  healer roll too, though not in the party. Winning starts an argument.
  Losing sometimes gets you a pity gift from someone you saved.
- **Items that change how you play**, not only bigger numbers. Examples:
  "Renew also jumps to a second person", "Mend is instant after a Revive",
  "your heals on people below a quarter health cost nothing". Put one such
  effect on every Rare and above. Five or six effects is enough to start.
- **Named uniques per boss** with a small drop chance, shown as a checklist
  in the character panel. Collecting is a strong reason to re-run.
- **Gear shows on the character.** Staff, hood and robe change colour and
  shape by rarity. It is a third-person game: let people see their loot.
- **Sets** later: three pieces from Emberdeep give a bonus.
- Cadence to aim for: something drops every 2 to 3 minutes of active
  healing, a real upgrade about every 10, an Epic about once a session.

### 2.5 A world with a clock: always somewhere to be needed

The strategic layer of the game should be "where am I needed most?".

- **An events board** by the fountain (and a small tracker under the
  minimap): what is happening now and what starts soon. For example: a party
  forming for Emberdeep in 2 minutes, Old Tusk hunt in Greenhollow now, a
  duelling tournament in the ring, a raid pulling the second boss, a
  battleground at half time.
- Events run on a schedule whether you attend or not, and report how they
  went. "Wipe Club wiped on Cinderjaw again" is content. So is going to help
  them next time.
- You cannot be everywhere. That is the point: choosing is the game, and
  the chat makes you feel the ones you skipped.
- Sessions should work at 10 to 20 minutes: arrive in town, check the
  board, pick an event, heal it, get paid, log off.

## 3. A fixed world, not one that levels with you

Today every person and monster is created near the healer's level. That kept
the first build simple but it makes levelling invisible. Change it:

- Zones have level bands: Greenhollow 1 to 6, Emberdeep 5 to 8, the next
  zone 7 to 12, and so on. People in a zone are in its band.
- When you out-level a zone your heals are huge there and the rewards are
  small. That is the classic, satisfying feeling of coming back strong, and
  it pushes you onward.
- Gates by level or fame, shown plainly at the portal or the airship.

## 4. Suggested sprint order from here

This replaces my earlier list in `TODO.md` if the owner agrees. Each sprint
is small enough for one sitting and leaves the game better on its own.

| Sprint | Name | What ships | Why now |
|---|---|---|---|
| 4 | The healer's hands | Frames for the party or the nearby hurt; Flash and Ward; sit to drink; spike, bleed and group damage in Emberdeep; boss cast bar | Biggest change in feel for the least work |
| 5 | They bite back | Healing threat; healer health, self-heal, death and ghost run; Fade | Already agreed; needs the frames first so you can see it coming |
| 6 | They remember | Persistent roster with records; reactions and whispers; fame meter; rumours in chat | The game's unique hook |
| 7 | Loot that matters | World drops and beams; rolls; item effects; gear shown on the character; boss uniques checklist | Owner's stated key to fun |
| 8 | The clock | Events board and tracker; scheduled events with outcomes; fixed level bands | Turns three places into one world |
| 9 | Crowds | The Shattered Spire raid (20 people, two bosses), Circle and Cleanse, raid frames | Needs frames, kit and bands first |
| 10 | Sides | Bloodsand Pit: two teams, flags, you heal either or both; the other side hunts you | Needs threat and death first |
| 11 | More world | Second zone by airship, second dungeon, sets, guild perks | Content, once the systems hold |

If time is short, sprints 4 to 7 are the game. Everything after is more of it.

## 5. Numbers to aim for

Use these as targets when tuning, then trust the owner's hands over them.

- A trash pull lasts 15 to 25 seconds; a boss 60 to 90.
- In a dungeon, a healer casting sensibly should out-heal about 90% of
  incoming damage. The missing tenth is where saves and deaths come from.
- Spamming the expensive heal empties mana in about 35 seconds. Drinking
  from empty takes about 12.
- Without a healer, a party should lose someone on the second pull and wipe
  on the boss before it reaches half health.
- Level 2 within 3 minutes of first play, level 5 within 25, level 10 in
  about 2 hours. A new button at 3, 5, 6, 8 and 10.
- First item within 60 seconds of the first heal (already true; keep it).

**Build a headless balance sim** like the arena repo has: a Node script that
runs a dungeon with a scripted healer who has real mana and cast times, 200
times, and prints win rate, deaths per pull and mana at boss death. The
current tests heal by setting health directly, so they say nothing about
whether a real level 1 healer can win. To do it, move the remaining rules
out of `people.js`, `mobs.js` and `dungeon.js` so they run without three.js
(pass in a tiny stand-in for figures), the way `game.js` already does.

## 6. Feel: cheap things that add a lot

- A soft chime rising in pitch as a bar nears full; a heartbeat when someone
  on your frames is under a fifth.
- Bars that slide instead of jump, with a white flash on a critical heal.
- A glow in the healer's hand while casting and a streak of light from staff
  to target when it lands. The current beam is a start.
- Party chat lines that reference the last five seconds ("nice Ward").
- Ambient sound per zone made in code: wind, fire crackle, town murmur.
- A low drone and a red vignette during Flame Breath.
- Respect `prefers-reduced-motion` for flashes and screen shake.

## 7. Code advice and known debts

- **Movement is straight lines with push-out.** People get stuck on corners
  and give up after 3 seconds. Before the raid, add a small waypoint graph
  per zone (the dungeon already has one in `DUN.way`).
- **`people.js` is doing three jobs.** Split it into the shared person
  (spawn, hurt, heal, kill, revive, draw) and one behaviour file per zone.
  A new zone should be a new file, not more branches.
- **Draw calls.** Each person is about a dozen meshes. Past 80 people on a
  Chromebook this will hurt. Merge each figure into two meshes (body, limbs
  animated in a vertex shader or just four limb meshes), or instance by
  body part across all people. Far figures are already hidden at 150 yards.
- **Hacks to clean up:** `bossLoot` in `main.js` calls `earn(0.0001, ...)`
  only to trigger the level-up check, so split that check out; chat lines
  use `setTimeout`, which ignores `?speed=N`, so use game time instead;
  monsters and people are levelled from `S.level` at spawn (see section 3).
- **Saves.** Add a version number to the save now, before the roster and
  item effects make old saves awkward.
- **Zones as data.** `DUN` is a good pattern. Do the same for the raid and
  the battleground: rectangles, waypoints, contents, exits.
- **Keep the tests.** One script per sprint in `tools/`, each printing a
  line of JSON and an error list. Run them all before every push. Add
  `?speed=N` to any test that waits.
- **Touch.** The phone layout works but has had the least attention. Frames
  will help it most: tapping a frame is far easier than tapping a person.

## 8. Things I would not do

- Do not give the healer an attack. The whole identity is that you only
  heal. Fade, Ward and running away are the only self-defence.
- Do not make the party controllable or let the healer join it. Uninvited
  is the joke; "do NOT kick the healer" only works if they could not.
- Do not add a quest log for the healer. If goals are needed, make them
  requests from people who remember you ("come to the Spire at eight").
- Do not go wide before deep. Three places that react to you beat ten that
  do not.
- Do not copy names, creatures, art or text from any published game. The
  interface conventions are fair to follow; the content must stay original.

## 9. One-hour wins, if a session is short

1. Target yourself with a key and show your own health honestly.
2. Frames for the dungeon party only (the smallest version of 2.1).
3. A boss cast bar for Flame Breath.
4. Loot beam and pickup for boss drops.
5. People you have healed before wave when you pass (a flag per name in
   the save is enough to start the roster).
6. An events line under the minimap: "Emberdeep: a party is at the second
   pull" while you are in town.

Good luck. The idea is a strong one: keep asking "do they need me, do they
notice me, did I get paid?" and build whichever answer is weakest.
