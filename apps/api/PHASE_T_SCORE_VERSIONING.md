# PHASE T — Score Versioning

## Contract

`ScoreVersion`, `ScoreCalibration` and `ScoreSnapshot` remain canonical.

Administrators can configure scoring policy through the backend API without deploying code. Every policy change is versioned; active versions are immutable and historical snapshots retain the version that produced them.

### Banking example

```json
{
  "industry": "Banking",
  "weights": {
    "strategicValue": 30,
    "trust": 20,
    "influence": 25,
    "engagement": 15,
    "otherWeight": 10
  }
}
```

`otherWeight` is a group weight. The eight canonical factors not explicitly named in the Banking profile share the remaining 10% equally. The profile therefore totals exactly 100%.

## API

- `GET /scores/versions` — list versions (admin)
- `POST /scores/versions` — create a new draft version
- `PATCH /scores/versions/:id` — edit a draft only
- `POST /scores/versions/configure-industry` — create a new version from the active version with an industry profile
- `POST /scores/versions/:id/activate` — atomically archive the previous active version and activate the selected version
- `GET /scores/versions/:id/calibrations` — inspect calibration records
- `POST /scores/versions/:id/calibrations` — add an observed-vs-expected calibration record

All administrative endpoints require `scoring.admin` and are audited.

## Invariants

1. Industry profiles must total 100%.
2. Unknown relationship factors are rejected.
3. Active versions cannot be edited.
4. Activation is atomic per score-version name.
5. Historical `ScoreSnapshot` records keep their original version.
6. Runtime scoring reads the active version; no code deployment is needed for policy changes.
