# LLM Council Transcript — 30 May 2026

## Question
What should we work on with ~1 day left before the 7th semester Bahuraksha demo?

---

## Framed Question

We are building Bahuraksha, a flood + landslide early warning web app for Nepal's Bagmati basin. We have ~1 day left before a live university demo.

### Completed
- Frontend: React SPA, all pages, maps (Leaflet), auth (Supabase), RBAC (5 roles), mobile responsive, skeletons, error boundaries, mock fallback
- Backend: Unified FastAPI with STAC + CSV data sources, rate limiting, API key auth, cache, structured logging
- Models: Flood (ROC-AUC 0.994) + landslide (ROC-AUC 0.987) XGBoost, saved in models/
- Training scripts: train_flood_model.py + train_landslide_model.py with 19 TDD tests passing
- CI/CD: GitHub Actions (5 parallel jobs) + Dockerfile + render.yaml
- E2E: 12 Playwright tests passing
- Backend tests: 28/28 passing
- ML Pipeline: 39 tests passing
- Frontend tests: 22 tests passing

### Possible Next Steps
1. Retrain models using new training scripts
2. Integration tests: train → save → load → predict end-to-end + add to CI
3. Demo prep: demo script, slide deck, pre-recorded backup video
4. Bug hunt & edge case polish
5. Performance optimization (lazy loading, bundle size)

### Constraints
- 1 person, ~1 day left
- Live demo at university
- Reliability is critical

---

## Advisor Responses

### The Contrarian
You're all missing the landmine: your current .pkl files came from an old branch, and your new training scripts have never been validated end-to-end. Zero confidence they produce models with the same feature columns (order matters for XGBoost), same preprocessing, or that the API's feature_columns attribute even exists after retraining. If you retrain the morning of the demo and the output doesn't match the API's expectations, your backend silently returns garbage or crashes. That's your demo-ending failure mode.

What you should do: (1) Run ONE full integration pass — train_flood_model.py → save → load_model() → predict() on real features. Fix mismatches. Takes ~30 minutes. (2) Do NOT retrain. Your current models are 0.994/0.987 ROC-AUC — near-perfect. Retraining risks regression for zero demo-relevant gain. Use the old .pkl files that actually work. (3) Skip everything else. Bug hunt, perf, slide deck, video — none of it matters if the core prediction pipeline breaks on stage.

### The First Principles Thinker
Strip away everything. What's the fundamental goal? A live demo that convinces professors and classmates the system works for flood/landslide early warning. Not code quality. Not test coverage. Not model AUC scores.

Now ask: what actually threatens that goal?

1. Models are from an old branch. If you retrain now, you introduce variance — the demo model might behave differently than the one you tuned prompts around. Worse, if training breaks or produces worse metrics, you spend time debugging instead of rehearsing. Freeze the models. The old .pkl files work. Your demo audience won't know the difference.

2. The demo will fail because of something stupid. Network request timeout. Missing env var. Wrong URL. Auth token expired. Map tile layer not loading. JSON parse error because the API returned HTML. These are the things that crater demos — not subtle logic bugs.

3. You have 1 person × 1 day. The highest-leverage activity is demo prep + risk mitigation, in that order.

Morning: Run the entire app flow manually, end-to-end, on a clean machine. Fix every papercut. Record a backup video of the full walkthrough immediately after it works once. Afternoon: Write a tight 8-slide deck with screenshots from that working run. Create a written demo script with fallback steps ("if the API fails, click this mock data toggle"). Evening: Three full dry runs with a timer. No code changes after 5 PM.

### The Expansionist
Retraining models with 0.99 AUC buys nothing — professors can't tell 0.994 from 0.997. You're optimizing the wrong axis. The real upside: build ONE unforgettable demo moment. A live simulation cockpit: rainfall slider, river gauge slider, and watch the flood polygons animate in real-time on the Leaflet map. Let a professor say "what happens if it rains 200mm in 6 hours?" and you drag a slider and the map moves. That's the knockout punch.

Also build a before/after comparison overlay for a real 2024 Bagmati flood event. Show satellite imagery from before, then overlay your model's prediction vs what actually happened. Proves your model works without saying a word.

A 5-minute video of exactly this slider demo with voiceover, pre-recorded and edited, as your backup weapon. Not a boring screen recording — this is your actual demo weapon.

Workplan for 1 day: 4 hours building the simulation slider UI + integrating with the existing model API, 1 hour recording that video, 1 hour slides, 2 hours buffer. Skip everything else. The 0.994 model isn't the star — the experience is.

### The Outsider
As an outsider with zero context: the .pkl files are from an "older branch" and you have "new training scripts." That's a red flag. If the old models don't match the new code's expected feature columns, preprocessing, or output format, your demo WILL crash on the most impressive part — the live predictions. All your tests pass because they test either mock data or the old pipeline. The one thing you haven't tested is the actual path the demo takes.

Everything else (E2E tests, lazy loading, slide deck) is noise if the core demo moment — clicking a map point and seeing a risk prediction — fails. You have 101 passing tests but zero that train a model, save it, load it in the API, and hit the predict endpoint. That's your Demo Day gap.

Do this: Pick 1 basin. Retrain both models using the new scripts. Immediately run the exact predict flow you'll demo. If it works, record that as your backup video, then spend remaining time on the demo script. If it breaks, you found the day-before bug that would have been catastrophic.

### The Executor
Priority: 1. Retrain models. 2. Demo prep. 3. Nothing else.

Here's the Monday morning plan: The current .pkl files are from an old branch. You don't know they work with the new code. If the API loads a stale model with mismatched features, it silently serves garbage probabilities or crashes.

Step 1 (Hours 0-4): Retrain both models using train_flood_model.py and train_landslide_model.py. Verify predict returns sane values. Run the 28 backend tests + 39 pipeline tests. If anything breaks, you have 4 hours of buffer. If nothing breaks, you're on fresh models.

Step 2 (Hours 4-8): Three full dry-run rehearsals from cold boot — no dev server, no hot reload. Kill everything, start the API, start the frontend, walk through the demo flow start to finish. Note every glitch, timeout, and UI weirdness. Fix only the showstoppers. Rehearse again.

Step 3 (Hours 8-10): Pre-record the backup demo video. This is your insurance policy.

Skip: Integration tests in CI (you ran them locally), performance optimization (no one will notice 200ms vs 50ms in a live demo), bug hunt (you catch bugs in the dry runs).

---

## Peer Reviews

### Reviewer 1
1. Strongest: The Contrarian. Surgically identifies the one untested path that could kill the demo (train → save → load → predict), proposes a 30-min fix, and correctly warns against retraining (regression risk with near-perfect scores).

2. Biggest blind spot: The Expansionist. Ignores the model pipeline entirely. A beautiful slider UI is worthless if the API returns garbage because feature columns don't match.

3. All five missed: Data availability (are satellite feeds returning current data?), no internet fallback (venue WiFi), demo environment logistics (laptop, projector).

### Reviewer 2
1. Strongest: The Contrarian. Only one that distinguishes "retrain for the sake of it" from "validate the pipeline." Correctly flags retraining regression risk at 0.99 AUC, prescribes minimal integration pass.

2. Biggest blind spot: The Expansionist. Building a whole new slider UI the day before demo while core pipeline never validated end-to-end is reckless.

3. All five missed: Frontend deployment validation (does npm run build work?), WiFi for map tiles, Supabase reachability, hardware contingency.

### Reviewer 3
1. Strongest: The First Principles Thinker. Correctly identifies fundamental goal, prioritizes risk mitigation, recognizes real demo-killers are stupid environment issues (timeouts, env vars, auth tokens).

2. Biggest blind spot: The Expansionist. Assumes .pkl-to-API pipeline works, pours 4 hours into slider on unvalidated foundation.

3. All five missed: Data pipeline freshness — has ingest:rainfall been run recently? Stale CSVs? Demo environment unknowns.

### Reviewer 4
1. Strongest: The Contrarian. Identifies real threat (untrained model → API feature-column mismatch), proposes 30-min validation, then freezes rather than retraining.

2. Biggest blind spot: The Expansionist. Building slider UI day before reliability-critical demo is reckless — introduces React state bugs, Leaflet re-render issues.

3. All five missed: Pre-rendered fallback materials if backend crashes entirely. Render deployment quotas, Python version mismatch.

### Reviewer 5
1. Strongest: The Contrarian. One integration pass, freeze working .pkl, skip retraining is highest-leverage, lowest-risk move.

2. Biggest blind spot: The Expansionist. Assumes model pipeline works, focuses purely on UX dazzle. Entire plan collapses if backend is broken.

3. All five missed: Pre-computed predictions as local fallback for demo. Verifying model.feature_columns exists on loaded object. Laptop capability for running both frontend and backend.

---

## Chairman Synthesis

### Where the Council Agrees

1. The model pipeline is the biggest unvalidated risk. Four of five advisors independently flag that .pkl files come from an old branch and have never been end-to-end tested with new training scripts. This is the one path the 89 passing tests don't cover.

2. Retraining is not the goal; validation is. Nobody thinks 0.994 → 0.997 AUC matters for a demo.

3. Demo prep (dry runs, backup video, demo script) is high leverage.

4. The Expansionist's slider UI is unanimously panned as premature. UX dazzle on an unvalidated foundation is a trap.

### Where the Council Clashes

**Retrain vs Freeze.** The Outsider and Executor say retrain both models. The Contrarian and First Principles say freeze known-good .pkl files. Both agree the pipeline must be validated — they disagree on direction. The right answer depends on an unknown: *how different are old .pkl files from new code expectations?*

**Depth of demo prep.** First Principles wants slides, scripts, dry runs, no code after 5 PM. Executor wants 4 hours retraining then 4 hours dry runs. Contrarian thinks a 30-minute integration pass then freeze is sufficient.

### Blind Spots Caught in Peer Review

- **Data pipeline freshness** — has ingest been run recently?
- **No fallback for dead backend** — pre-computed predictions as hardcoded fallback
- **Demo environment logistics** — WiFi, projector, laptop, Supabase reachability
- **model.feature_columns verification** — 2-line assert that could catch the day-before bug
- **Render deployment quotas** — free tier cold-start delays

### The Recommendation

**Freeze the models. Validate the pipeline. Record the video. Do not retrain.**

Timeline:
- 0-1h: One integration pass. Run training scripts (fast mode), save model, start API, hit /predict endpoints. Fix mismatches. Verify old .pkl files load fine.
- 1-3h: Full cold-boot dry run on demo laptop. Fix showstoppers only.
- 3-5h: Pre-record 5-minute backup demo video.
- 5-8h: Demo script with fallback steps + 3-slide deck.
- 8PM: Stop. No code after this point.

Skip: slider UI, CI integration tests, perf optimization, bug hunt. All negative-expected-value with one day left.

### The One Thing to Do First

**Run the training scripts, then immediately call both /predict endpoints on the output with the exact feature vector you'll demo — if it works, delete the newly trained model and keep the old .pkl; if it breaks, you just found the day-before bug with 23 hours to fix it.**
