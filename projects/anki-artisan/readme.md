# 🃏 Anki Artisan — Craft Anki Decks from Nature Observations

A CLI tool that generates [Anki](https://apps.ankiweb.net/) flashcard decks from [iNaturalist](https://www.inaturalist.org/) observations and [eBird](https://ebird.org/) region data. It fetches species photos, audio, and taxonomy to automatically build study-ready decks for learning birds, plants, and other wildlife.

**Source:** [github.com/robert-bryson/anki-artisan](https://github.com/robert-bryson/anki-artisan)

## 🎴 Card Types

- **Visual ID** — photo → identify the species
- **Nomenclature** — common name ↔ scientific name (bidirectional)
- **Sound ID** — audio → identify the species
- **Confusion Species** — side-by-side comparison of lookalikes

## ✨ Features

- Pulls species from iNaturalist observations and/or eBird region checklists
- Fetches taxon photos, audio, and full taxonomy from iNaturalist
- Frequency-based filtering via eBird to drop vagrants/rarities
- Interactive `ebird add-region` command to search and add regions by name
- Higher-taxa cards for families, orders, etc. alongside species
- SQLite-backed caching for API responses, taxa, and media
- Change tracking — knows which cards are new, updated, or unchanged
- Request tracking with per-domain summaries and cache hit reporting

## 🛠 Tech Stack

| Component | Technology |
|-----------|------------|
| CLI | [Click](https://click.palletsprojects.com/) |
| Anki deck generation | [genanki](https://github.com/kerrickstaley/genanki) |
| iNaturalist API | [pyinaturalist](https://github.com/pyinat/pyinaturalist) |
| eBird API | Direct HTTP via [requests](https://requests.readthedocs.io/) |
| State & caching | SQLite (stdlib) |
| Config | TOML (stdlib `tomllib`) |

## 🚀 Usage

```bash
# Interactive setup
anki-artisan init

# Build a deck
anki-artisan build

# Add an eBird region by name
anki-artisan ebird add-region "Missouri"
anki-artisan ebird add-region "St. Louis" --country US
```

## 📂 Project Structure

```
src/anki_artisan/
├── cli.py              # Click CLI with build, init, ebird commands
├── config.py           # TOML config loading + CLI override merging
├── models.py           # Data classes for cards, decks, media
├── state.py            # SQLite state DB (caching, change tracking)
├── media.py            # Throttled media download manager
├── tracker.py          # HTTP request counting
├── anki/
│   ├── builder.py      # genanki deck assembly
│   └── templates.py    # Card model/template definitions
└── extractors/
    ├── ebird.py        # eBird CSV parser, region API, frequency data
    └── inaturalist.py  # iNaturalist observation + taxonomy extraction
```
