/**
 * What has changed about the way a run plays, newest first.
 *
 * A wave count is only worth keeping while it means the same thing. Every time
 * the balance moves, `BALANCE` goes up, the bests kept under the old version are
 * dropped, and the entry that did it is at the top of this list, so a run that
 * has lost its best can read why. Add an entry and raise the number together;
 * one without the other is how a wave count quietly starts lying about itself.
 */
export const CHANGES = [
  {
    version: 11,
    title: "A campaign that can be finished, and two boards that are absurd instead of impossible",
    lines: [
      "Nothing finished the campaign. Driven through all fifty waves on every route by a scripted player, a run died in the teens on easy and normal and earlier on hard: the purse never caught up with the road. Kill gold is a share of what walks in, so it is worth almost nothing while the waves are small and a fortune once they are enormous, and the run is decided in the teens.",
      "Clearing a wave pays a settling-in sum over the opening waves now, about two thousand gold across the first thirteen and all but gone by twenty. A leak still takes what the difficulty says of it.",
      "The last boss on hard could not be beaten at any budget. What it becomes on hard was handed on to the two titans it breaks into, and they took shape where it died, on the doorstep and past every tower on the board. A mutation can be heirless now, and a boss throws its pieces back up the road as it comes apart, never more than a fifth of the route.",
      "#Pain is a sixteen-cell board with five-cell arms, and five cells inside each elbow are left clear, the only ground with a view of a road. Wave counts kept on the old board go with it.",
      "A fourth difficulty, Ruin. It is hard's campaign, cube for cube, and harder only in what it takes away: five towers to bring and fourteen to stand, no mint, unseen cubes from wave eight and Coursers heading the first rush, eight lives, and a last boss whose road is drawn rather than dealt. Past hard the numbers stop being the lever; cells, sight and choice are what sink a good kit. Having no mint, its opening is paid for by a deeper settling-in sum. Exactly the right five towers finish it about one campaign in ten, on a few lives; nothing else finishes it at all.",
    ],
  },
  {
    version: 10,
    title: "Something boss-sized leads the rushes, and the column comes shelled",
    lines: [
      "Every heavy on the road lumbered. A board built to grind one down slowly answered all of them, and a rush of quick cubes was a different problem with a different answer. Never both at once.",
      "The Courser is both. It is boss-sized and boss-priced, most towers cannot see it at all, and it crosses the board in two fifths of the time a Titan takes. It asks for 1,800 damage a second where a Titan asks 1,584, and gives far less of it.",
      "They come as a pack and inside a second of each other: three on wave 28, then four, five and six. One at a time is a boss a single tower picks off; three at once is the rush. Four lives each at the door, so six through is worse than any Titan and one getting past is a wound rather than the run.",
      "Something that can see hidden cubes is no longer optional late on. Ten of the twenty towers can, and a sniper reaches it on the second step of its rapid fire path.",
      "Geodes walk in from 19: mostly shell, holding two and a half times what the body behind it does, and nothing touches the body until the outside gives. Crack one and three runners come out, already past whatever was slowly working through the shell.",
      "They are the best gold on the road for the trouble (a fifth of a gold a point where a tank pays a seventh), and part of the armoured column comes shelled instead of arriving on top of it, so a wave is a different problem rather than a longer one.",
      "What a kill pays wanes a little further on normal and hard to make room for them, so a campaign earns what it did before they existed. Easy pays the listed reward as always, and so earns more.",
    ],
  },
  {
    version: 9,
    title: "A cube is worth less the later it walks in",
    lines: [
      "A wave pays for the board that answers it, so gold kept arriving long after there was anything worth spending it on. A hard run reached wave 44 holding fifty thousand it had no use for: about two thirds of everything it had earned that run.",
      "What a kill pays now falls away over a campaign: on hard a cube on wave 30 is worth just over half what the same cube is worth on wave one, stopping at 45%. Normal wanes more gently to 60%. Easy pays the listed reward all campaign, as it always has.",
      "Clearing a wave is not waned with it. A run that is struggling kills less and so earns less already, and the bonus for holding a wave is the part of a purse it can still count on.",
    ],
  },
  {
    version: 8,
    title: "A mutation pays a boss the share of it a boss takes",
    lines: [
      "A mutation only partly takes on a boss (a gilded devourer has 1.7 times the health of a plain one where a gilded runner has 2.4), but it was paid as though it had taken all of it. That devourer was worth 6,860 gold from a single kill, which is two maxed snipers for one shot fired.",
      "What a mutation is worth is softened the same way its health is now. The gilded devourer pays 3,920, the colossus 2,100 and the titan 903. An ordinary cube is untouched: a gilded runner is still worth seven of a plain one.",
      "How many lives a changed cube takes at the door is softened the same way, for the same reason.",
    ],
  },
  {
    version: 7,
    title: "A hard run meets the cubes that punish, not the ones that pay",
    lines: [
      "Every mutation raises what a cube is worth, some of them enormously: a gilded one is fat, turns nothing aside and pays seven times over. A changed cube paid two and a half times a plain one, so sending more of them made a wave harder and richer at once, which is most of why meeting them sooner never bit.",
      "Which mutation is rolled now leans by what it does to a board rather than what it pays for being killed. On hard, chrome and void are the commonest things you meet and gilded has gone from one changed cube in twelve to one in fifty; neon and glass thin out with it.",
      "Nothing about any mutation has changed. A gilded cube is exactly the gilded cube it always was. There are fewer of them on a hard road, and more of what turns your guns aside.",
    ],
  },
  {
    version: 6,
    title: "A changed cube bites the board, not just the road",
    lines: [
      "A bomber or a charged cube knocked a tower out for two seconds whatever was being played, and a molten one baked what it walked past by the same amount on every difficulty.",
      "How hard that lands is the difficulty's now. Hard knocks a tower out for 3.2 seconds rather than 2, and a molten cube there takes over half a tower's pace instead of a third; normal sits between. However hard it bites, a baked tower always keeps a quarter of its pace.",
      "This is the one kind of pressure a purse cannot answer (a stunned tower is stunned however many stand behind it), and changed cubes grow commoner every wave, so a hard campaign now loses about 67 seconds of tower to it on wave 50 against 4 on wave 10. On easy that curve peaks in the forties and falls back.",
    ],
  },
  {
    version: 5,
    title: "A harder difficulty is a steeper campaign",
    lines: [
      "Hard was easy times 1.8 from wave one to wave thirty-five. All of its weight sat in a flat multiplier on health, so it hit hardest when the board was a tower and a half and meant nothing by the time the board was finished. Steep to start and no steeper after.",
      "Each difficulty now has a climb of its own as well as a height. Hard starts at a tenth over easy rather than a third, and pulls away wave after wave: half again by wave one, twice over by wave thirty, and nearly three times by the last.",
      "Normal climbs a little too, so the middle of the ladder is a middle at both ends of a campaign rather than only at the start.",
      "Easy is untouched. Its health curve is the one the waves were tuned on and a test holds it there.",
    ],
  },
  {
    version: 4,
    title: "A beacon lifts, it does not double",
    lines: [
      "Beacons used to add up flat and stop at double damage, so two maxed ones turned every gun they reached into two of itself. A maxed sniper hit for 1,250 where it hits for 625 alone, and one beacon over six guns bought four guns' worth of damage for less than one gun's price.",
      "A second beacon over the same tower now counts for half of what the best one gives it, a third for a quarter, and no tower is lifted past half again its damage. One beacon is most of the gain, a second is worth building, a fourth is worth nothing.",
      "The lift itself is smaller: a maxed beacon gives a third more damage rather than two thirds. That sniper tops out at 906 now, and its damage a second drops from 1,000 to 589.",
      "A tower that leaks and ends the run is shown on the loss screen, so a road that ran out to something it never saw can say what it was.",
    ],
  },
  {
    version: 3,
    title: "The three difficulties are a ladder",
    lines: [
      "Every difficulty now decides its own campaign, not just the health on the cubes. Easy is exactly where it was and is still what the waves were tuned on.",
      "Hard sends changed cubes from wave seven rather than twelve, and two in three of them by the last wave. The whole roster is met by wave 22 instead of 36.",
      "Hard keeps half the late-wave thinning, so the end is long as well as heavy: 193 cubes on wave 50 against easy's 115. A leak costs the whole wave's bonus, and selling hands back a third.",
      "Normal takes the middle of it: changed cubes from wave ten, one in two by the end, the roster met by 29, and half your gold back on a sale.",
      "Upgrades are priced by difficulty. Building a tower costs the same everywhere; taking one to the top costs a fifth less on easy and a third more on hard.",
    ],
  },
  {
    version: 2,
    title: "The mint is an investment, not an economy",
    lines: [
      "However many mints stand, only the best cut and the best dividend on the board count. They used to multiply each other, and fifty clean waves ended somewhere past a hundred thousand gold.",
      "A bare mint is cheaper and pays for itself in about five waves. Every step up costs roughly twice the step below, so standing one up is easy and growing one is the decision.",
      "The prism's Consecrate and Ascension are the dearest upgrades in the game. Absorbing turns a neighbour's whole cost into power where selling would return a fraction of it, and the price now says so.",
      "The sandbox opens on a route once its fifty waves have been held at that difficulty, rather than being a switch anyone can throw.",
    ],
  },
  {
    version: 1,
    title: "The road as it first stood",
    lines: ["Twenty routes, twenty towers, twenty-six cubes and fifty waves."],
  },
];

/** The version every best is kept against. Bests from any other are dropped. */
export const BALANCE = CHANGES[0].version;
