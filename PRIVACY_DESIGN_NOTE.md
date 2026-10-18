# Privacy-Preserving Architecture & Design Note
**Skilling Scheme AI Video Analytics Engine**

## 1. Executive Summary & Core Philosophy
The Training Centre Video Analytics System is explicitly engineered under a **Privacy-by-Design** methodology. Its primary objective is to verify **aggregate physical presence and infrastructure availability** across empaneled training centres without capturing, identifying, or tracking individual trainees or instructors.

No facial recognition, facial landmark detection, biometric feature extraction, or candidate identity mapping is performed at any stage of processing.

---

## 2. What Is & Is Not Collected / Identified

| Feature / Data Element | Status | System Handling |
|---|---|---|
| **Facial Embeddings / Features** | ❌ EXCLUDED | Detector models ignore facial features entirely. |
| **Candidate Identity (PII)** | ❌ EXCLUDED | No database fields exist for candidate IDs, names, or biometrics. |
| **Continuous Video Recording** | ❌ EXCLUDED | Raw video frames are processed in volatile memory only and immediately discarded after counting. |
| **Aggregate Person Count** | ✅ INCLUDED | Calculated as an anonymized integer per sample timestamp. |
| **Session p90 Attendance** | ✅ INCLUDED | Computed as a percentile scalar over a 3-hour session window. |
| **Equipment & Seating Counts** | ✅ INCLUDED | Anonymized bounding-box object counts for sanctioned inventory items. |
| **Audit Evidence JPEGs** | ✅ INCLUDED | Saved ONLY when compliance breaches occur. **All person regions are heavily Gaussian-blurred before disk write.** |
| **SHA-256 Evidence Hash** | ✅ INCLUDED | Cryptographic hash recorded on alert rows to guarantee evidence integrity without storing raw media. |

---

## 3. On-Edge Anonymization Pipeline

```
 [Live Camera Feed] 
        │
        ▼ (Volatile RAM)
 [YOLO Nano Detector] ──► Extracts Bounding Boxes (person, laptop, chair)
        │
        ▼
 [Privacy Blur Filter] ──► Applies 51x51 Gaussian Blur over ALL 'person' regions
        │
        ▼
 [Evidence Generation] ──► Saves Blurred Thumbnail + Computes SHA-256 Audit Hash
        │
        ▼
 [RAM Flush] ───────────► Raw frame memory is completely zeroed out
```

---

## 4. Bandwidth & Storage Optimization (Low-Bandwidth Mode)

| Mode | Bandwidth Consumption | Media Retention |
|---|---|---|
| **Traditional CCTV Cloud Streaming** | ~450 MB / hour / camera | Continuous raw MP4 files |
| **Edge-Native Analytics Mode (Our System)** | ~0.25 MB / hour / camera | Zero raw video stored. Only 1-2 KB metadata JSON batches + blurred breach thumbnails (~50 KB) sent over edge HTTP. |

---

## 5. Governance & Audit Compliance
- **Audit Integrity:** Every evidence thumbnail generated during a compliance alert is stamped with a cryptographic SHA-256 hash. Any manual tampering with evidence files is immediately flagged by the API.
- **Data Retention:** Aggregate counts and alert rows are subject to configurable retention policies (e.g., 30-day rolling purge).
- **Regulatory Alignment:** Fully compliant with privacy guidelines for public sector skilling schemes.
