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

## Sprints (proposed, not yet agreed)

4. **Crowds.** A raid in progress and a battleground to drop in on, with
   area heals unlocked at levels 5 and 10.
5. **Town life.** Guild events, reputation as the mystery healer, working
   airship and doors.

## Open (from the original idea)

- Raids in progress to drop in on.
- PvP events to heal one side of (or both).
- Guild events in town.
- Working airship and doors (inn, bank, auction hall).

## Open (ideas from the build, not yet agreed)

- More heals unlocked by level (two locked slots are on the bar at 5 and 10).
- Make mouse-look the default once it has been tried on a real mouse.
- Emberdeep extras: a second boss, patrols, things to stand out of, a
  party that waits for the healer's mana, a boss kill count on the frame.
- Quests for the healer ("keep five questers alive", "revive three").
- People reacting more to the mystery healer: whispers, guild invites, a
  reputation.
- Hands-on balance pass: XP curve, loot pace, mana.
