# pNODE Antibiotic Explorer (new model) — static build for GitHub Pages

A 100%-static build of the explorer running the **new time-independent pNODE**
from `../model/` (136 genera, 15 drug classes — no antifungals/antivirals/
miscellaneous). The forecast runs entirely in the browser (`web/engine.js`), so
`web/` can be served by GitHub Pages with no backend.

## What's different from the earlier build

- **Model:** the collaborator's `pnode_notime_rep0.state.pth` (`pNODEGenusNoTime`),
  integrated as gauge-recentered forward Euler (dt = 0.5), matching
  `../model/pnode_notime.simulate()`.
- **Genera:** 136 individual genera (Enterococcus is a single genus, idx 36), not
  the old grouped BSI heads. Compositions are wrangled from the clinical counts into
  this exact panel (named genera exact; residual mass → `<not present>`).
- **Drug classes:** the new 15 (quinolones, aztreonam, glycopeptide_antibiotics,
  sulfonamides, cephalosporins, macrolide_derivatives, metronidazole, carbapenems,
  oxazolidinone_antibiotics, penicillins, aminoglycosides, glycylcyclines,
  lincomycin_derivatives, tetracyclines, leprostatics). Antifungals/antivirals/
  miscellaneous/etc. are dropped; aztreonam & metronidazole are recovered by drug
  name from the old "miscellaneous" bucket.
- **BSI heads:** Enterococcus BSI = the Enterococcus genus; Gram-negative BSI =
  Escherichia-Shigella + Serratia (Enterobacteriaceae BSI agents present in the panel).
- **Risk tiers** were recomputed from the new model over the cohort (Enterococcus
  domination-days tertiles); per-tier 180-day BSI incidence is monotonic
  (LOW 6.6% / MED 10.0% / HIGH 17.1%).

## TaxUMAP view

The composition panel has a third toggle, **"View taxUMAP"** (next to "View observed
abundances"), that drops down the fixed TaxUMAP community map: the reference cloud
(`../taxumap/reference_data/taxumap_knn_reference.npz`, 10,346 real samples at
ASV-derived coordinates) drawn as a backdrop colored by dominant taxonomic class, with a
bright dot at the **pNODE-predicted location**. The dot is placed by the kNN projector
(Bray-Curtis genus+family distance → weighted average of the 30 nearest reference
coords, ported to JS in `engine.js`), and it **traverses the map as you drag the readout
cursor** (on the antibiotic timeline or a sparkline); a faint line traces the whole
predicted trajectory. Editing antibiotics re-projects the path live.

`web/taxumap.json` (~2.3 MB, base64 typed arrays) holds the backdrop + the **full
10,346-sample kNN reference at float32 precision** (no subsampling, no quantization), so
the browser reproduces the scipy map exactly. It loads lazily the first time the toggle
is used, so the base explorer stays fast. Built by `build_taxumap.py` (run automatically
by `build_static.py`), which validates the JS projector against the collaborator's scipy
`TaxUMAPProjectorKNN(ref_cap=None)`.

## Validated

- Browser forecast reproduces `pnode_notime.simulate()` to **max 7.9e-6** (6 patients
  × actual + edited schedules).
- Composition reconstruction matches the collaborator's reference cloud (named-genus
  column-mean correlation **0.998**).
- 15/15 headless-browser UI checks pass; adding aminoglycosides blooms Enterococcus,
  matching the model's demo.
- TaxUMAP: browser projection matches the scipy projector to **~1e-9** (full-precision,
  full 10,346-sample reference); 15/15 TaxUMAP UI checks pass (dot moves with the readout,
  path re-projects on edits).

## Deploy (pick one)

All fetches are relative, so it works at `you.github.io/` or `you.github.io/repo/`.

```bash
# Option 1 — docs/ folder on main:
mkdir -p docs && cp -r pnode_explorer/web/. docs/
git add docs && git commit -m "pNODE explorer (new model)" && git push
# then Settings → Pages → main / docs
```
Or push the contents of `web/` to a `gh-pages` branch, or to a `<you>.github.io` repo.

## Local preview
```bash
cd pnode_explorer/web && python3 -m http.server 8080   # open http://localhost:8080
```

## Rebuild (after model/data changes)
```bash
/home/aeriab/miniforge3/envs/pnode/bin/python pnode_explorer/build_static.py
```
Reads `../model/` + the clinical CSVs and regenerates `web/`. The composition/drug
wrangling and its validation live in `build_static.py`.

## Note on data exposure
Patient genus compositions ship as static JSON in `web/patients/`. That's the same
data the app displays, but it's directly downloadable from the public site. Host
privately if that's a concern.
