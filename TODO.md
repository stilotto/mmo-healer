# MMO Healer: to do

The ledger of plans. Nothing is built until the owner says go. How the
built pieces work is in `NOTES.md`; this file keeps only a line each.
The test for every sprint: do they need me, do they notice me, did I get
paid? Build whichever answer is weakest.

## The plan (agreed order, after sprint 10; Speed added as 13)

11. **Help and settings: built.** A help window with every control (keys,
    mouse, touch, spells, slash commands): H, the ? button, or /help. A
    settings section in it: graphics Auto, High or Low (saved, applied at
    once; also /graphics auto|high|low; `?quality=` in the address still
    wins) and mouse-look on or off. Shift+1 to 6 do what F1 to F6 do, for
    Chromebooks.
12. **Sides: built.** The Bloodsand Pit through the red portal (no level
    gate; people follow your level). Sunward (gold, south) and Duskward
    (crimson, north), six a side: a guard, two runners, three fighters.
    Capture the flag: first to 3, or the most in 8 minutes. People really
    fight each other; the fallen rise at their base after 12 seconds unless
    you revive them first. Whom you heal is watched: a side's anger is the
    healing you gave its enemies (less half what you gave it, cooling
    slowly); past one, two and four full bars it sends one, two or three
    hunters after you, and a side that likes you sends a fighter to guard
    you. Fade shakes hunters off. A scoreboard (score, clock, flags, how
    each side sees you) and team frames in two columns. If the side you
    healed most wins: 30% of a level, fame 4 and gossip. After the match (owner's
    ask): a recap window (result, score, time, each player's kills, deaths
    and flags, top killer and carrier, your healing to each side, revives,
    deaths, hunters, your reward), then back to town after 20 seconds, or
    "Stay for the next match".
13. **Speed: built (first pass; check on the Chromebook).** Measured with
    `?prof` (a corner box: ms per part of the frame, draw calls, triangles):
    the game logic is about 2 ms a frame; drawing is the cost. Still scenery
    is baked into a few big meshes per 48-yard square; people far away are one
    mesh instead of seven; name plates only within 55 yards (or targeted);
    the HUD only touches the page when a value changes; sparkles skip work
    when there are none. Low also: no antialiasing (from the next load),
    a third of the grass, half the sparkles, detail and plates closer in,
    people hidden past 110 yards. Draw calls on Low went from about 200-490
    to 90-220. Next if still jerky: the owner runs `/speedtest` on the Chromebook
    (docked and not) and pastes the report.
14. **Polish.** The stats tab: a tab in the character window with lifetime
    numbers (total healed, saves, revives, bosses and raid kills, fish
    caught, Old Glimmerfins, people met, friends, grudges, uniques found,
    deaths, time played). The graveyard: ghosts rise in a small Greenhollow
    churchyard (and one near Lanternrest) instead of at the quest camp or
    fountain, with a spirit keeper, headstones and a soft light; maybe the
    keeper brings you back on the spot for a cost. (small)
15. **The rival.** A rival healer who runs with a party properly and
    resents you. (medium)
16. **More world, part 1.** The airship works: a flight to a second zone.
    (big)
17. **More world, part 2.** A second dungeon, with the Emberdeep extras
    folded in (a second boss, patrols, a party that waits for the healer's
    mana, a boss kill count), and item sets. (big)
18. **Town services.** A working inn, bank and auction hall, and guild
    perks beyond the small ones from sprint 7. (medium)

## Waiting on the owner

- Hands-on balance pass: XP curve, loot pace, mana, raid difficulty. Send
  notes from play at any time.

## Ideas (not placed)

- `tools/sprint6.mjs`: the Emberdeep check (tank takes a monster back)
  rarely passes, on old code too: trash dies before threat builds. Needs a
  sturdier test, not a game change.
- Groundwork when it is needed: a Node balance sim with a scripted healer on
  real mana; splitting `people.js` per zone; cheaper figures.

## Built (one line each; details in `NOTES.md`)

- First build: Lanternrest, simulated players, MMO controls, Mend and Renew,
  XP, loot, gear, bag, minimap, chat, touch controls, save, card on the site.
- Sprint 1: mouse-look option (X), Shift+Tab, F for the most hurt, Pim the
  Quartermaster (gear and bags).
- Sprint 2: Greenhollow through the north gate, monsters, questing people
  who die, Revive.
- Sprint 3: Emberdeep, a five-person dungeon run with Cinderjaw.
- Sprint 4: the Storybook look (light, figures, textures, sparkles, frame-rate
  safety net). The owner chose Storybook over Dusk and Toon.
- Sprint 5: unit frames, Flash, Ward, drinking, damage shapes, boss frame.
- Sprint 6: threat, the healer can be hurt and die, ghost run, Fade, safe town.
- Sprint 7: the roster that remembers you, fame, gossip, guilds, chat box and
  slash commands.
- Sprint 8: loot on the ground with beams, Need or Greed, item effects, boss
  uniques, gear on the figure, paper doll.
- The pond: wading, swimming, fishing (Old Glimmerfin), water as a system
  (`addWater`).
- Talents: Mending, Grace, Shadow; Circle and Cleanse (from talents, the
  owner's choice); Deep Well and Calm Mind (owner's asks); free respec;
  F includes you.
- Sprint 9, the clock: events board and tracker, Emberdeep runs, Old Tusk
  hunts, duelling tournaments, Spire raids; zone level bands (Greenhollow
  1 to 6, Emberdeep 5 to 10).
- Sprint 10, crowds: the Shattered Spire raid from level 5 (twenty raiders,
  the Shardwarden and the Hollow Regent, raid frames, four uniques).
- Sprint 11: help window, graphics and mouse-look settings, Shift+1 to 6.
- Sprint 13, speed: `?prof`, baked scenery, far people as one mesh, a
  lighter HUD, a lighter Low.
- Sprint 12, sides: the Bloodsand Pit, capture the flag, hunters and guards;
  a recap window after each match, then back to town.
- Decided: mouse-look stays off by default. The owner tried a real mouse and
  the current scheme (hold a button to steer) matches their muscle memory.
