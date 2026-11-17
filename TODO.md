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

## Agreed, not yet built

- Monsters must not ignore the healer (owner, after sprint 3). Today every
  monster in Greenhollow and Emberdeep acts as if the healer is not there.
  Still to settle before building: what draws them (healing aggro, standing
  too close, or both), and what happens when the healer dies.

## Sprint plan (proposed, not yet agreed)

Rewritten after sprint 3 from `fable notes.md`. The test for every sprint:
do they need me, do they notice me, did I get paid? Build whichever answer
is weakest. Sprints 4 to 8 are the game; 9 onward is more of it.

4. **The look (agreed, in progress).** Front-loaded so later sprints are
   built once in the final style. Art direction: Storybook (chosen); a new figure model (better proportions, faces, gear sockets,
   cheaper to draw); lighting (soft shadows, better sky, glow on fire,
   portals and spells); textures made in code, grass and props; Lanternrest
   polished as the reference scene; a frame-rate check at Chromebook size.
5. **The healer's hands.** Health-bar frames down the left edge (the
   dungeon party inside, the five most hurt nearby outside), click or F1 to
   F5 to target, self-target key. Flash (fast, costly) at level 3 and Ward
   (a shield) at 5, filling the locked slots. Sit to drink. Damage with
   shapes in Emberdeep: tank spikes, a bleed, group damage. A cast bar for
   Flame Breath.
6. **They bite back.** The agreed item above: healing draws threat from
   whatever is fighting your target. The healer has real health, can die,
   and runs back as a ghost to the camp or dungeon door. Fade (drop threat)
   as the one escape. The hub stays safe.
7. **They remember.** A saved roster of about 60 characters who reappear
   in town, the zone and parties, each keeping a record of what you did for
   them. Reactions that grow with it (waves, whispers, sulks), a fame meter,
   guild invites, and General chat gossip about what you just did.
8. **Loot that matters.** Drops in the world with a beam per rarity, picked
   up by walking over them. Need or greed rolls you can crash. Rare and
   above carry an effect that changes play. Gear shows on the character.
   A boss uniques checklist.
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
scripted healer on real mana (sprint 5), a save version number (before
sprint 7), splitting `people.js` per zone (before sprint 9), cheaper
figures (sprint 4).

## Open (ideas, not yet placed)

- Make mouse-look the default once it has been tried on a real mouse.
- Emberdeep extras: a second boss, patrols, a party that waits for the
  healer's mana, a boss kill count.
- Hands-on balance pass: XP curve, loot pace, mana. Needs the owner's play.
