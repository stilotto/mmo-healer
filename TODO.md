# MMO Healer: to do

The ledger of plans. Nothing under "Open" is built until the owner says go.

## Built

- Central hub (Lanternrest): fountain plaza, inn, bank, auction hall, guild
  hall, market stalls, duelling ring, training dummies, city wall.
- Shown but not active: sealed gate to Greenhollow (newbie zone), three
  portals (dungeon, raid, battleground), airship that docks and leaves.
- Simulated players who wander, chat, duel, train, and arrive hurt.
- MMO-style controls: WASD, mouse steer and look, zoom into first person,
  tab targeting, click to target, action bar with Mend and Renew, cast bar,
  global cooldown, mana.
- XP and levels, loot drops in four rarities, seven gear slots, bag.
- Minimap, chat log, floating heal numbers, touch controls.
- Save in the browser.
- Look up and down: drag, or the up and down arrow keys. The view tips up to
  the sky even when the camera is resting on the ground.
- Card on stilotto.github.io.

## Sprint 1: built

- Mouse-look as an option (X, or the Mouse button): the mouse pivots the view
  with no button held, A and D strafe, Esc frees the cursor, a click on the
  world takes it back. Opening the bag frees it too. The choice is saved.
- Shift+Tab goes back a target. F (or the Hurt button) targets the most hurt
  person within range.
- Pim the Quartermaster at the red stall: four pieces of gear (restocked on
  level up or for a fee) and two bag upgrades of seven slots each.
- Mana regeneration raised a little. No hands-on balance pass yet: that
  needs the owner's feel for it.

## Sprint 2: built

- The north gate is open. Greenhollow lies beyond it: a road, the warden's
  quest camp, a pond, a farm, a wood, a bog and a ruined watchtower.
- Monsters: Bog Slimes, Bristle Boars, Hollow Wolves, and the elite Old Tusk
  by the watchtower. They ignore the healer.
- People take quests from Warden Hale, hunt monsters, sit to rest, hand in,
  sometimes level up ("ding!"), and walk to and from town through the gate.
- People die if nobody heals them. A body lies for 80 seconds, then the
  player "releases" and is gone.
- Revive on key 3: a 5 second cast on a dead player. Worth a full bar of XP.
- Minimap shows the zone, the road and monsters. Zone name changes as you
  cross the gate. Far-off figures are hidden to keep the frame rate up.

## Sprint 3: built

- Emberdeep: walk into the orange portal in town. Five rooms joined by
  corridors, three trash pulls (Cinder Slimes, Ash Hounds) and the boss,
  Cinderjaw. Blue portals at the entrance and behind the boss lead out.
- A party of five (tank and four damage dealers) runs it without a healer:
  they gather, pull room by room, sit to recover, ask for a rez, and chat in
  a [Party] channel. They notice when someone starts healing them.
- Cinderjaw: hard hits on the tank, a telegraphed Flame Breath that takes a
  fifth of everyone's health, and a frenzy at 25%.
- In tests, with no healer the party loses people on trash and wipes on the
  boss; with steady healing it wins.
- Boss loot: a guaranteed Rare or better (sometimes a second item) and 40%
  of a level in XP.
- Each visit is a fresh run. A wipe brings a new party after a few seconds.
- `?speed=N` runs the world N times faster (for tests).

## Sprint plan (proposed, not yet agreed)

Rewritten after sprint 3 from `fable notes.md`. The test for every sprint:
do they need me, do they notice me, did I get paid? Build whichever answer
is weakest. Sprints 4 to 8 are the game; 9 onward is more of it.

4. **The look: built.** Front-loaded so later sprints are
   built once in the final style. Art direction: Storybook (chosen); a new figure model (better proportions, faces, gear sockets,
   cheaper to draw); lighting (soft shadows, better sky, glow on fire,
   portals and spells); textures made in code, grass and props; Lanternrest
   polished as the reference scene; a frame-rate check at Chromebook size.
   Built: Storybook light, people and monsters rebuilt, combat text,
   textures, tiered firs, grass, town props, window frames and flower boxes,
   stone dungeon, frame-rate safety net, sparkles for spells, fires and
   portals. Owner checked the frame rate on the Chromebook: smooth, no
   step-down.
5. **The healer's hands: built.** Frames down the left (Emberdeep's party
   inside; otherwise the five nearby who most need you), class-coloured,
   with Renew, Ward and bleed icons and an incoming-heal segment. Click or
   F2 to F6 to target; F1 or a click on your own frame targets yourself.
   Flash (key 4, level 3) and Ward (key 5, level 5), locked on the bar until
   learned. Drink (Z or the Drink button): about 12 seconds from empty.
   Emberdeep damage shapes: crushing blows on the tank, bleeding bites from
   hounds and Cinderjaw, Cinder Slimes that burst when they die. A boss
   frame with Cinderjaw's Flame Breath cast bar.
6. **They bite back: built.** Healing someone a monster is fighting adds
   to its threat on you (half the healing done); past 60% of its health it
   turns on you (100% when a tank is up, and the tank taunts it back after 4
   seconds). Monsters may also jump a healer who wanders close, in
   Greenhollow and in Emberdeep. Cinderjaw's breath and bursting slimes hit
   you too. The town is safe: monsters give up at the wall. You have real
   health, regenerate out of combat, cannot drink in combat, and your frame
   glows red while something is on you. Death: Release Spirit, run back as
   a ghost (grey world, faster) to the pillar of light over your body, and
   Return to Life at half health and mana. Fade (key 6, level 2): monsters
   forget you and go back to their old target; 30 second cooldown.
   The original idea and the agreed item above are covered by this sprint.
7. **They remember: built.** A saved roster of 64 people (calling, guild,
   temperament, looks) who reappear in town, Greenhollow and Emberdeep
   parties. Each remembers heals, saves from near death, revives, deaths you
   watched, and emotes. They thank you, call your name when hurt, wave as you
   pass, whisper after a save, sulk or rant after you let them die, forgive
   you later. A fame meter under the minimap (Who?, Some healer, That healer,
   The mystery healer, The Lantern); General chat gossips about your recent
   deeds and asks for you by name; parties that know you count you in at
   once; guilds invite you (Join button or /accept) with a small perk each,
   and guild chat. Owner chose to fold the chat box in here:
   Enter opens it (tap the panel on phones), Enter sends, Esc closes, up
   arrow recalls. Tabs: All, General, Zone, Party, Combat. Commands: /say,
   /yell, /w, /r, /g, /wave, /cheer, /bow, /dance, /sit, /laugh, /thank,
   /who, /who <name> (shows their record), /target, /roll, /fame,
   /leave and /join general or zone, /gquit, /help. People nearby answer.
   Not built from the original idea: the rival healer and the inn room.
8. **Loot that matters.** Drops in the world with a beam per rarity, picked
   up by walking over them. Need or greed rolls you can crash. Rare and
   above carry an effect that changes play. Gear shows on the character.
   A boss uniques checklist.
   Paper doll (owner, after sprint 6): the character window shows the
   healer in 3D in the middle, slowly turning (drag to spin). Slots around
   the figure in the genre's usual layout: head, robe, trinket on the left;
   gloves, boots, ring on the right; staff below. Hovering a bag item
   previews it on the figure. Stats beside it (power, spirit, mana regen,
   haste, average item level). Slot borders in rarity colours.
9. **The clock.** An events board by the fountain and a tracker under the
   minimap: parties forming, Old Tusk hunts, duelling tournaments, raid
   pulls. Events run whether you go or not, and report how they went.
   Zones get fixed level bands instead of matching the healer's level.
10. **Crowds.** The Shattered Spire: a 20-person raid with two bosses, raid
   frames, Circle (group heal) and Cleanse.
11. **Sides.** Bloodsand Pit: two teams, flags, heal one side or both; the
    other side hunts you.
12. **More world.** Working airship to a second zone, a second dungeon,
    item sets, guild perks, working inn, bank and auction hall.

Groundwork to fold into the sprints as needed: a Node balance sim with a
scripted healer on real mana (sprint 5), the save version number (done in
sprint 7), splitting `people.js` per zone (before sprint 9), cheaper
figures (sprint 4).

## Open (ideas, not yet placed)

- A rival healer who runs with a party properly and resents you (from the
  sprint 7 idea, not built).
- `tools/sprint6.mjs`: the Emberdeep check (tank takes a monster back)
  rarely passes, on old code too: trash dies before threat builds. Needs a
  sturdier test, not a game change.

- Make mouse-look the default once it has been tried on a real mouse.
- Emberdeep extras: a second boss, patrols, a party that waits for the
  healer's mana, a boss kill count.
- Hands-on balance pass: XP curve, loot pace, mana. Needs the owner's play.
