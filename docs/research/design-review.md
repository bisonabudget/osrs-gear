# Design review: making BiS on a Budget look hand-made

Date: 2026-10-27. Scope: visual design only (`src/styles.css`, `src/main.tsx`, `src/ui/*`). No code changed.
Viewed locally with `npx vite` at desktop (~1330px) and mobile (375px) widths, dark theme.

## What the site looks like now

Three columns (monster / budget+gear / results) in bordered `--card` panels on a slate background,
teal (`#4fd1b5` dark, `#0b7a6b` light) for every heading, link, focus ring, chip and big number,
Roboto Condensed for everything. The equipment/stats area already uses an OSRS "stone" look
(`--stone*`, `--osrs-orange`, `--osrs-text`, styles.css:17-24, 700-800), so the page is two
design languages stitched together: game-UI panels inside generic dashboard panels.

The last two commits (dc8db6a "flat slate panels, a teal accent and no icon glow", 53fd5e3 "accent
top edge") moved the outer shell *towards* the generic look.

## The "AI-made" tells, with locations

1. **Dark slate + teal accent palette.** styles.css:35-48 and 53-67 (`--bg #1d2831`, `--card #263540`,
   `--accent #4fd1b5`). Desaturated blue-grey with a single mint/teal accent is the default palette of
   most generated dashboards. Nothing about it says RuneScape.
2. **Accent top border on every panel.** styles.css:225 (`.col { border-top: 2px solid var(--accent) }`).
   The coloured-top-edge card is a stock template move; repeated on all three columns it reads as decoration, not meaning.
3. **One accent colour doing every job.** `var(--accent)` is used for section labels (99), brand hover (126),
   focus (149, 281), monster name (383), stat highlights (445, 470, 483), switches (548, 563), chips (598),
   buttons (659, 690). When everything is teal, nothing is emphasised, and the result is "theme-coloured" rather than designed.
4. **Uniform cards, uniform radius, uniform spacing.** `--radius: 3px` on ~20 rules; `.col` padding 16px, gaps 16-18px everywhere
   (styles.css:214-229). Same box at every level of hierarchy.
5. **Duplicated theme blocks.** The dark palette is pasted twice (35-48 and 53-67): a typical generated-code smell, and a sign the palette
   was produced as a set rather than tuned.
6. **Big-number "KPI tile" hero.** `.hero` in src/ui/Results.tsx:182 renders DPS `9.48` in large teal next to Max hit / Accuracy / Kill time,
   the same metric-card layout as every SaaS analytics template.
7. **Single condensed sans for display and body.** styles.css:27-28 both point at Roboto Condensed; the Anton display face was dropped in dc8db6a.
   No typographic contrast between the monster name, section labels and body text other than size/colour.
8. **Inconsistent game flavour.** Stone panels and orange labels in `.stats`/`.slot` (757-798), but section labels outside
   them are teal (95-100). The game-styled bits look pasted in, which is exactly what makes the rest look generic.

What is already good and personal: real item sprites from the Wiki, OSRS stat icons, the coins icon in the brand, the live
"Search 2,035 monsters" placeholder, the dice button, plain specific copy ("Fire spells get 40% more accuracy and damage."). Keep all of that.

## What the sources say

- **The OSRS Wiki's own look** is the domain reference players know: parchment/tan light theme and brown dark theme, serif-free text,
  bordered infobox tables with header cells in a darker tone, not cards. Its colour variables live in the site CSS:
  https://oldschool.runescape.wiki/w/MediaWiki:Gadget-dark-mode.css and https://oldschool.runescape.wiki/w/MediaWiki:Vector.css ;
  infobox styling: https://oldschool.runescape.wiki/w/Template:Infobox_Item . Borrowing that family (warm browns, tan, gold) makes a
  tool feel native to the community instead of "a dashboard about OSRS".
- **Game UI fonts.** The in-game RuneScape fonts (`RuneScape Plain 11/12`, `RuneScape Bold 12`, `RuneScape Quill` for titles)
  are documented at https://oldschool.runescape.wiki/w/Fonts . The Wiki and RuneLite community recreations are bitmap-style;
  use one sparingly (title, numbers on the stats panel), never for body text.
- **Hierarchy through weight and colour, not just size/colour accents**, and "use fewer borders": Refactoring UI,
  https://www.refactoringui.com/ (sections "Hierarchy is everything", "Use fewer borders", "Don't use grey text on coloured backgrounds").
  Directly relevant to tells 2-4.
- **Pair a distinctive display face with a readable text face; avoid one-font-for-everything; body text 15-25px.**
  Butterick's Practical Typography: https://practicaltypography.com/font-recommendations.html ,
  https://practicaltypography.com/point-size.html , https://practicaltypography.com/system-fonts.html .
- **Self-host fonts with `font-display: swap` and subset**: https://web.dev/articles/font-best-practices . Fontsource already does this.
- **Tabular numbers for columns of stats/prices**: MDN `font-variant-numeric`,
  https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric . Fixes ragged stat columns and makes figures look deliberate.
- **Contrast**: any new warm palette must still meet WCAG AA 4.5:1 for text, https://web.dev/articles/color-and-contrast-accessibility .
- **Light/dark via `color-scheme` and one token set**: https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme .

(Sources cited from known stable URLs; they were not re-fetched during this review.)

## Prioritised changes

### Quick wins (an evening)

1. **Remove the accent top edge.** styles.css:225. Revert 53fd5e3. Single most template-looking line on the page.
2. **Replace teal with an OSRS-derived palette.** styles.css:1-67. Swap the slate/teal tokens for the warm set already defined
   at 17-24: dark theme `--bg` near `--stone-edge #1f1a14`, `--card` near `--stone-dark #2e271e`, `--line` a brown, accent
   `--osrs-orange #ff981f` (headings) and gold/yellow for key numbers; light theme in Wiki parchment tones. Check contrast (web.dev link).
   Why: makes the outer shell and the stone panels one language (tells 1, 8).
3. **Give the accent fewer jobs.** Keep orange for section titles and the one number that matters (DPS); make focus rings, switches
   and chips use `--ink`/`--line`; links underlined in a muted gold. styles.css lines listed in tell 3.
4. **De-duplicate the dark theme block** (styles.css:35-48 vs 53-67) into one selector list, so tuning the palette is done once.
5. **Tabular numerals** on `.stats`, `.figures`, cost/bill and slot lists: `font-variant-numeric: tabular-nums` (styles.css:757-860, plus `.hero`).
6. **Section labels in the game style.** `.label` (styles.css:95-100) to match `.stats .label` (766): orange, small caps feel, so every
   heading on the page uses the same, game-native voice.

### Medium (a weekend)

7. **Bring back a display face, used in one or two places.** Re-add a characterful title font (Anton was removed in dc8db6a, or a
   RuneScape-style bitmap font per https://oldschool.runescape.wiki/w/Fonts) only for the brand, the monster name (`.monster-name`
   styles.css:378-388) and the DPS figure. Keep Roboto Condensed for body. Files: `src/main.tsx` (font import), styles.css:27-28.
8. **Turn the results "KPI tile" into an in-game style readout.** src/ui/Results.tsx:182 + `.hero` styles: present DPS/max hit/accuracy/kill
   time as a stone panel table like the existing stats panel (or a Wiki-infobox style table) instead of a big teal number plus metric list.
9. **Vary panel treatment by role.** Inputs (monster, budget) as quiet, borderless areas on the page background; the gear/equipment
   area as the stone "interface"; results as the focal panel. Refactoring UI "use fewer borders" / hierarchy. Files: styles.css:214-229 `.col`.
10. **Unequal spacing scale.** Introduce `--space-1..6` (4/8/12/16/24/40) and use tighter spacing inside groups, wider between groups.

### Bigger

11. **Signature imagery.** A header strip or empty-state using the monster's Wiki render at larger size, or a texture taken from the
    OSRS interface (subtle stone/parchment background), already sourced through `src/data/wiki-images.json`. Gives the page a face.
12. **Light theme as Wiki parchment.** Rework the light palette (styles.css:2-14) towards the Wiki's tan/brown so it feels like a sibling of
    https://oldschool.runescape.wiki rather than a generic grey-blue.
13. **Small personality in copy and states**: loading/empty/error messages in game voice (e.g. GE-style "Offer" wording), keeping the
    current plain, specific tone.

## Top 5 in one line each
1. Delete the accent top border (styles.css:225).
2. Swap slate+teal for the OSRS stone/orange/gold palette already in the file (styles.css:1-67).
3. Use the accent for only titles and DPS; neutral focus/chips/switches.
4. One display face for brand, monster name and DPS; tabular numerals for all stats.
5. Rebuild the results hero as an in-game stats readout instead of a KPI tile (src/ui/Results.tsx:182).
