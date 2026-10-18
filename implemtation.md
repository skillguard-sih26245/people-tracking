# Phase-wise implementation plan: training-centre video analytics (prototype)

**Scope:** hackathon demo, one machine, no real footage needed, anonymous counting only, no evaluation work. Estimated effort is **3-4 days** for one person.

## Architecture

```
 Source ───► Detector ───► Sampler ───► Sink ───► SQLite
 synthetic    YOLO          one sample    DB (default)  samples
 images       (skipped      every few s   HTTP (edge)      │
 mp4          for synthetic)                               ▼
                                              Aggregator (window p90, ratios)
                                                           │
 Evidence JPEG ◄──── Compliance engine ◄───────────────────┘
        │             (rules, persistence, alerts)
        └────────────────► FastAPI ◄────────► Streamlit dashboard
```

| Component | Why we need it |
|---|---|
| Source interface | Lets you build everything without footage and plug in real video later |
| YOLO (pretrained) | Gives person and equipment counts with zero training |
| SQLite | Single-file storage, no server to run |
| FastAPI | Clean boundary between processing and dashboard; also what an edge device would post to |
| Streamlit | Fastest authority dashboard in pure Python |
| Not included: Redis, Postgres, Docker, queues, auth | Nothing in a 1-3 centre demo needs them |

## Phase 0: Project skeleton and contracts (2-3 h)

**Objective:** fix the data contracts so later phases don't churn.

**Build:**
- Repo layout (below), `requirements.txt`, `config.yaml`, two centre YAMLs.
- SQLite schema. This adds one thing to my earlier version: `equipment_usage` on samples, which operability needs.

```sql
centres(id, name, region)
cameras(id, centre_id, source_type, source_uri)
inventory(centre_id, class, required_count)
reported_attendance(id, centre_id, session_start, session_end, reported_count)
samples(id, camera_id, ts, person_count, equipment_counts JSON, equipment_usage JSON)
alerts(id, centre_id, ts, type, level, value, threshold, evidence_path, resolved)
```

- `config.yaml`:

```yaml
sample_interval_s: 3
window_percentile: 90
persistence: {min_samples: 20, breach_fraction: 0.8}
attendance: {warning: 0.20, critical: 0.40}
infra: {warning_below: 0.80, critical_below: 0.60}
operability_warning_below: 0.5
```

- `centres/centre_01.yaml`:

```yaml
inventory: {chair: 20, computer: 10, monitor: 10}
class_map: {chair: [chair], computer: [laptop], monitor: [tv]}
```

**Repo structure:**
```
tc-analytics/
├─ config.yaml
├─ centres/            centre_01.yaml  centre_02.yaml
├─ data/               clips/  reported_attendance.csv  evidence/
├─ app/
│  ├─ models.py        # dataclasses: Detection, Observation
│  ├─ db.py
│  ├─ sources.py       # synthetic | images | mp4
│  ├─ detector.py
│  ├─ sampler.py       # source → detector → sink
│  ├─ sinks.py         # DBSink, HttpSink (later)
│  ├─ aggregate.py
│  ├─ compliance.py    # pure functions
│  ├─ operability.py
│  ├─ evidence.py
│  └─ api.py
├─ dashboard.py
├─ scripts/            seed_demo.py  run_demo.py
└─ tests/              test_compliance.py  test_pipeline_smoke.py
```

**Done when:** the DB initialises and `seed_demo.py` inserts 3 centres, their inventories and a reported-attendance CSV.

## Phase 1: Source layer (3-4 h)

**Objective:** produce observations from anything, so footage is never a blocker.

**Interface:**
```python
@dataclass
class Detection: cls: str; conf: float; box: tuple  # x1,y1,x2,y2

@dataclass
class Observation: camera_id: int; ts: datetime
                   frame: np.ndarray | None; detections: list[Detection] | None

class Source(Protocol):
    def observations(self) -> Iterator[Observation]: ...
```

**Build:**
- **SyntheticSource:** emits detections directly (no frame). Each centre has a true person level, noise, occasional dropouts (simulating occlusion), and some equipment items randomly missing. One centre is deliberately non-compliant so you get guaranteed warning and critical alerts.
- **VideoSource (mp4):** reads every Nth frame with OpenCV. Timestamps are *virtual*: `session_start + frame_time × speedup`, so a 2-minute clip can represent a 3-hour session and the demo runs in seconds. Loops the clip if needed.
- **ImageFolderSource:** same, from JPEGs.
- Source choice per camera comes from the `cameras` table.

**Done when:** `run_demo.py --source synthetic` prints a stream of observations, and the same script runs on one downloaded mp4. Use free stock clips (classroom, computer lab, workshop); they do not need to look like CCTV.

## Phase 2: Detection and sampling (half a day)

**Objective:** turn frames into per-sample counts.

**Build:**
- `detector.py`: wrapper around a pretrained Ultralytics YOLO nano model (CPU-friendly; any current nano weights work). Returns `list[Detection]` filtered by confidence ≥ 0.35 (configurable).
- Class map (per centre): inventory names map to COCO labels. Keep `computer → laptop` and `monitor → tv` as separate classes so nothing is double counted.
- `sampler.py`: for each observation, if `detections` is None run the detector. Then compute `person_count`, `equipment_counts{class: n}` and `equipment_usage{class: 0/1}` (see Phase 5), and write via a **Sink**.
- `sinks.py`: `DBSink` writes to SQLite. Keeping a Sink interface costs nothing and gives you the edge mode in Phase 9.

**Algorithm note:** YOLO is O(pixels) per frame regardless of the number of people. NMS cost grows slightly with detections. At 1 sample per 3 s, a CPU is plenty (roughly 0.05-0.3 s per frame on a typical laptop, hardware-dependent).

**Done when:** a real mp4 produces `samples` rows with sensible counts, checked visually on 2-3 clips (draw boxes, eyeball the count). That is the only validation.

## Phase 3: Attendance estimation (half a day)

**Objective:** observed attendance per session, compared with reported.

**Build** (`aggregate.py`, `compliance.py`):
- Window = a reported session's `[session_start, session_end]`.
- `A_obs = percentile(person_count over window, 90)`. p90 beats the mean because occlusion and people leaving frame only cause undercounts. It beats the max because one false detection spike would dominate.
- `D_a = |A_rep − A_obs|`, `R_a = D_a / max(A_rep, 1)`.
- Level: `critical if R_a > 0.40`, `warning if R_a > 0.20`, else `normal`.

```python
def level_high(x, warn, crit): return "critical" if x > crit else "warning" if x > warn else "normal"
def level_low(x, warn_below, crit_below): return "critical" if x < crit_below else "warning" if x < warn_below else "normal"
```

**Tests:** table-driven unit tests for boundary values and `A_rep = 0`.

**Done when:** the CSV upload plus synthetic or mp4 samples produce a correct reported-vs-observed row per session.

## Phase 4: Infrastructure compliance (half a day)

**Objective:** compare observed equipment with the approved inventory.

**Build:**
- Per class `c`: `obs_c = percentile(count_c over window, 90)`.
- Per-class compliance `min(obs_c, req_c) / req_c`; overall `C_infra = mean over classes`.
- `missing_c = max(req_c − obs_c, 0)`, shown per item in the dashboard table.
- Level: `critical if C_infra < 0.60`, `warning if < 0.80`.
- Caveat to state in the UI: counts are **only for classes the detector can see**. Items outside COCO (sewing machines, lathes) are not covered. If you need them, the upgrade path is YOLO-World with text prompts, then a fine-tuned detector.

**Done when:** a non-compliant centre shows the right missing items and a warning or critical level.

## Phase 5: Temporal reasoning, operability and alerts (about 1 day)

**Objective:** make alerts persistent and add apparent operability.

**Persistence rule:**
- Per sample `t`, compute a breach flag using a short rolling median (5 samples) of the person or equipment counts against the threshold.
- Raise an alert only if breaches make up ≥ 80% of the last N samples, with `N ≥ 20`. A machine missing from one frame never alerts.
- Close each session with a final verdict from the p90 values in Phases 3-4.
- Alerts are deduplicated per `(centre, type, session)`, which gives idempotency without a queue.

**Apparent operability (per equipment class):**
- `presence_ratio_c = mean over samples of min(count_c / req_c, 1)`
- `usage_frac_c` = fraction of samples where either a person's box overlaps an enlarged equipment box, or frame-difference motion inside that box exceeds a threshold. Computed at sampling time in `operability.py`. In synthetic mode it is simulated.
- `usage_factor_c = 0.5 + 0.5 × usage_frac_c`, so an unused but present item is not scored as zero.
- `score_c = presence_ratio_c × usage_factor_c`, warning below 0.5.
- Always labelled **"apparent operability (probabilistic)"**, with the note that CCTV cannot prove mechanical function.

**Risk status per centre:** the worst level among its open alerts, plus a simple numeric score for ranking (for example critical = 3, warning = 1, summed).

**Done when:** a synthetic run with a short single-frame dropout produces no alert, while a sustained shortfall does.

## Phase 6: Evidence (3-4 h)

**Objective:** attach privacy-safe proof to each alert.

**Build:**
- During sampling, save an annotated thumbnail every ~10th sample to a temp folder.
- At alert time, pick the thumbnail whose count is closest to the window p90, copy it to `data/evidence/`, delete the temp ones, and store the path and confidence on the alert.
- **Privacy:** blur or pixelate every person box before saving, then draw labelled boxes with confidence. No faces are ever persisted.
- Synthetic mode generates a placeholder image with boxes and a "SIMULATED" watermark.

**Done when:** each alert in the DB has an evidence JPEG that opens and shows boxes with no visible faces.

## Phase 7: Backend API (half a day)

```
POST /attendance/upload             CSV → reported_attendance
POST /run/{centre_id}               process the centre's source for its session window
POST /ingest/samples                batch of samples (used by the edge sink in Phase 9)
GET  /centres                       list + risk status
GET  /centres/{id}/summary          reported vs observed, C_infra, per-item table, operability
GET  /centres/{id}/samples          trend data
GET  /centres/{id}/alerts           alerts + evidence URLs
GET  /evidence/{file}               static evidence serving
```

Processing runs as a FastAPI background task. Structured logging via the standard `logging` module with JSON-ish fields (centre_id, camera_id, phase), and a `GET /health`. That is enough observability for a demo.

**Done when:** every endpoint returns correct data for the seeded centres.

## Phase 8: Dashboard (about 1 day)

**Streamlit pages:**
1. **Overview:** centre cards sorted by risk, with a normal/warning/critical badge, reported vs observed attendance and C_infra.
2. **Centre detail:** attendance comparison, inventory table (required / observed / missing / apparent operability), trend line of person count across the session, and the alert list with evidence images, confidence and timestamp.
3. **Admin:** CSV upload and a "Run analysis" button per centre.

Add a "Simulated data" banner whenever the source is synthetic.

**Done when:** one run-through of Upload → Run → Overview → Centre detail → Alert evidence works without touching code.

## Phase 9: Low-bandwidth / edge story (optional, half a day)

**Objective:** demonstrate the bandwidth argument credibly.

- Add `HttpSink`: the same sampler runs as a separate process and posts sample batches to `/ingest/samples`, with a local SQLite outbox that retries when the network is down.
- Alerts upload only their evidence JPEG.
- **Numbers for the slides** (approximate): a 1 Mbps camera stream is about 450 MB per hour. Metadata at one sample per 3 s is about 0.25 MB per hour, plus roughly 50-100 KB per evidence image. That is orders of magnitude less.

If you are short on time, skip the code and present this as the intended deployment.

## Phase 10: Privacy and security basics (2-3 h)

| Data | Where it lives | Retention (demo defaults) |
|---|---|---|
| Raw video | Source machine only, never stored by the app | Not retained |
| Detection metadata | Memory only, never persisted per person | Discarded after counting |
| Aggregated samples | `samples` table (counts only) | Configurable, e.g. 30 days |
| Compliance events | `alerts` table | Until resolved plus archive |
| Evidence | Blurred JPEG, local disk | e.g. 30 days, purge script |

- No face detection, recognition or embeddings anywhere. No identity fields in any table.
- Basic hardening: one API key header for write endpoints, camera URIs kept in env vars rather than YAML, evidence served only through the API.
- Evidence integrity: store a SHA-256 of each JPEG on the alert row.
- State plainly in the slides what is **not** built: RBAC, TLS termination, secrets manager, audit log.

## Phase 11: Integration and demo (about 1 day)

- `run_demo.py`: seeds data, runs all three centres (one compliant, one attendance discrepancy, one infrastructure shortfall), then opens the dashboard.
- Demo script: the three scenarios in order, then the privacy and bandwidth slides.
- Smoke test `test_pipeline_smoke.py`: runs the synthetic pipeline and asserts the expected levels per centre. This is a test, not an evaluation.
- Optional: a `docker-compose.yml` wrapping API + dashboard, only after everything works.

## Schedule

| Day | Phases | Outcome |
|---|---|---|
| 1 | 0, 1, 3 (synthetic) | Fake data flows to a compliance level |
| 2 | 2, 4, 7, start of 8 | Real mp4 counts, equipment, API, basic dashboard |
| 3 | 5, 6, finish 8 | Persistence, operability, evidence, full dashboard |
| 4 | 10, 11, optional 9 | Privacy table, demo script, slides |

## Technology choices

| Need | Pick | Alternatives | Trade-off |
|---|---|---|---|
| Detector | Ultralytics YOLO nano | RT-DETR, MediaPipe, YOLO-World | Easiest, but check Ultralytics' AGPL license if this ever becomes a product |
| Tracking | None (p90 counting) | ByteTrack, BoT-SORT | Tracking adds ID fragmentation debugging for little gain in a seated classroom |
| DB | SQLite | Postgres | Zero setup; swap later via the ORM |
| Dashboard | Streamlit | React | Python-only and fast; less polished |
| Temporal logic | Rule-based windows | Statistical, ML | Explainable and cheap, which suits an authority audit |

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| COCO lacks the target equipment | High | Choose a COCO-friendly inventory for the demo; YOLO-World as the next step |
| Occlusion undercounts people | High | p90 window aggregation; state it as a known limitation |
| Stock clip angle degrades counts | Medium | Use a few clips; synthetic mode as the fallback |
| Thresholds look arbitrary | Medium | Label them "configurable defaults, not validated" |
| Time runs out | Medium | Phase 9 and Docker are the first things to cut |

## MVP cut line

**Must have:** Phases 0-8, 10 (table only), 11. **Cut first:** Phase 9 code, Docker, operability motion signal (use proximity only), trend chart.

## Evolution path (production, for the slides)

Real RTSP ingestion with reconnects → edge agents on Jetson-class hardware using the existing `HttpSink` → Postgres and object storage → JWT auth with centre, district and state roles → fine-tuned or open-vocabulary detector for vocational equipment → per-centre thresholds → full observability stack and audit logging → pilot with field-collected, annotated footage and formal evaluation.

## Exact first task

Build Phase 0 plus the synthetic source and `compliance.py`, as in my previous message: create the repo and schema, generate the synthetic stream where one centre has a real discrepancy, add the three pure functions with a test file, and print one centre's summary and level. When that works, send me the output and I'll give you the code for the sampler, SQLite models and the first Streamlit page.

