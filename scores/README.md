# Scores

A score is one YAML file: inputs, sounds, rules, clock — see `docs/02-composer-mode.md` §1.
Shared from day one (Dave, 2026-09-16). One folder per score, with the YAML and a README that says
what it is for and what you should hear.

| Score | What it is |
|---|---|
| [storefront-ambient](storefront-ambient/) | The starter score. Two mock feeds (traffic, errors), three voices, four rules. Ambient. |

To add yours: export from the composer (`export score`), make a folder, write the README, open a
pull request. To load one: `import` in the composer's header.
