# Pokemon Binder Sorter

A static web app that shows you where to put each Pokémon TCG card in a grid sorter (3×3, 3×4, or a custom size).

## Sorting modes

- **Set breakdown**: each slot is a pile for one category: Grass, Fire, Water, Lightning, Psychic, Fighting, Darkness, Metal, Fairy, Dragon, Colorless, Trainer and Energy. Each pile shows a fan of its first cards, a card count and its number range. Click a pile to see every card in it, then jump straight to laying that pile out by number.
- **Type by type**: choose one type. Its cards fill the slots one per slot in collector-number order, a page at a time. Use the Prev/Next buttons or the ← → keys to change pages.

Slots are labeled `R<row> C<col>` so you can match the screen to your physical sorter.

## Filters

- **Include secret rares**: secret rares are cards numbered past the main set size (for example 201/198) and subset cards such as `TG01` or `GG01`.
- **Special cards**: the app shows a separate checkbox for each kind of special Pokémon found in the set (ex, EX, GX, V, VMAX, VSTAR, V-UNION, BREAK, LV.X, LEGEND, Radiant, Prism Star, Mega). Clear a box to leave that kind out of bulk sorting.

Dual-type Pokémon are sorted under their first type.

## Running it

It has no build step. Serve the folder with any static server:

```sh
cd random_coding
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly also works in most browsers.

## Data

Card data and images come from the free [TCGdex API](https://tcgdex.dev). The set list is cached in `localStorage` for one day. Each set is cached after its first load, which fetches one request per card, so later visits load instantly.

This is an unofficial fan tool. Pokémon and card images © Nintendo / Creatures / GAME FREAK / The Pokémon Company.
