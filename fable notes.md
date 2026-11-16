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
