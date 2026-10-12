# BiS on a Budget

Finds the gear with the highest DPS against a chosen monster that a player can afford at today's Grand Exchange prices, and what to buy next.

## Language

### The player

**Character**:
A saved RSN with its levels, quests and diaries, kept in the browser.
_Avoid_: Account, profile, user

**Requirement**:
A level, quest or diary a Character needs before they can wear an item.
_Avoid_: Prerequisite, unlock condition

**Unlocked**:
An item whose Requirements the player's levels meet. Levels are 99 until an RSN is loaded or they are changed by hand. Quests and diaries count as done until they can be checked. With "Only gear I can use" off, every item is Unlocked.
_Avoid_: Available, owned

### Gear and prices

**Setup**:
One item per gear slot, plus the prayers, potion and spell used with them. The prayers are the best the player's Prayer and Defence levels allow, which can be none. The spell must be one the weapon can autocast and the player's Magic level allows.
_Avoid_: Loadout, build, kit, gear set

**Price**:
An item's Grand Exchange instant-buy price, or its 1-hour average when the instant-buy price is stale.
_Avoid_: Value, cost

**Untradeable**:
An item that can't be bought on the Grand Exchange. One made from GE items or sold in a shop for coins (Avernic treads, Ferocious gloves, Barrows gloves) costs the cheapest of those ways at today's Prices. One that is only earned in game (a fire cape, a defender) is an Earned item.
_Avoid_: Unbuyable

**Earned item**:
An Untradeable got from a drop, a reward or points, with no GP to pay. It adds 0 GP to a Setup and is assumed owned unless the player switches Untradeables off, which also leaves out any Untradeable that needs one (an Avernic defender needs a dragon defender).
_Avoid_: Free item

**Budget**:
The most a whole Setup may cost: the Prices of all its items plus its Ammo cost.
_Avoid_: Funds, gold, cash stack

**Ammo cost**:
The Price of one hour of the ammo, darts, runes or charges a Setup uses against the chosen Monster.

**Best setup**:
The Setup with the highest DPS against the chosen Monster that fits the Budget, using only Unlocked items. When fortified (f) armour attacks the same as the plain version, like Masori, the fortified one is shown if the Budget still covers it, as that is what most players wear. Elite void is shown over plain void in the same way.
_Avoid_: BiS, optimal gear

**Upgrade**:
One item changed in the Best setup that raises DPS, at any Price. The three that add the most DPS for each GP spent are shown. One that another item for the same slot beats on both DPS and Price is never shown, so items with the same stats (the god d'hide boots) appear once, as the cheapest.
_Avoid_: Improvement, next item

**Comparison**:
Two Setups side by side against one Monster: one the player kept and the one on show now. The kept Setup stays when the Monster, levels or Budget change, and is worked out again against the Monster picked.

### Monsters

**Monster**:
Anything a player can attack and kill, picked by name. Hunter creatures, implings, scenery, things that can't be damaged and anything with 1 hitpoint are left out.
_Avoid_: NPC, mob, enemy

**Version**:
A separate fight against the same Monster with different stats, such as one of Zulrah's forms. Each is its own search result; quest and cutscene copies are left out.
_Avoid_: Variant, form

**Custom monster**:
A Monster whose stats the player sets, for a new Monster or for theorycrafting. It starts as a copy of a Monster's stats, but only those stats count: the copied Monster's mechanics and Protection don't come with it. A player has one, kept between visits.
_Avoid_: Custom boss, custom mob

**Random pick**:
A Monster chosen at random from every Monster.

**Elemental weakness**:
An element (air, water, earth or fire) and a percentage. Spells of that element get that much more accuracy and damage against the Monster. Other attacks don't benefit.
_Avoid_: Weakness (on its own), vulnerability

**Attribute**:
What kind of creature a Monster is, such as dragon, demon or undead. Some items do more against certain Attributes, like a salve amulet against undead.
_Avoid_: Type, category, race

**Easiest to hit with**:
The kind of attack (stab, slash, crush, magic or light, standard or heavy ranged) the Monster defends worst against. It comes from its defence bonus together with its Defence level, or its Magic level for magic, so a big magic bonus on a Monster with a low Magic level can still be the easiest.
_Avoid_: Weakest style

**On task**:
Whether the player is on a slayer task for the chosen Monster, which decides whether slayer helm bonuses apply. Assumed for slayer Monsters and not for bosses, unless the player changes it.
_Avoid_: Slayer mode, task toggle

**Protection**:
An item a Monster's mechanics demand in one gear slot so the player survives or can damage it, such as a nose peg or slayer helmet at aberrant spectres or a mirror shield at basilisks. Every Setup against that Monster wears one of the items allowed, so there is no Setup when the player's levels allow none of them. Antifire is assumed, so dragonfire needs no item.
_Avoid_: Required gear, safety item
