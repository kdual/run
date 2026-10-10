# Runwise v41: selected internal processing changes

Based on restored v39 (eb2d602). No layout, CSS, scoring formula or preference changes.

- 1: District/province station metadata loaded in parallel, cached separately for 24 hours in each Worker instance, and concurrent identical queries shared. Failed/empty metadata not cached; partial successes remain usable.
- 2: /air successful measurement payloads cached at the edge for 60 seconds, preserving measured_at. Errors and payloads with no measurement excluded. Cache-write failures do not discard a valid response.
- 3: Upstream fetch and body consumption bounded at 20 seconds per attempt, maximum two attempts; non-transient HTTP errors not retried. The whole air measurement/station fallback chain shares a 40-second deadline within the existing 45-second browser timeout. Duplicate nested station retries removed. Live latency calibration remains pending: verification requests returned HTTP errors in this environment.
- 5: Keyword/address searches settle independently; successful results survive partial failure. Both failed queries still report an error.

Only changed app/weather/service-worker references bumped to v41 to deliver the update to existing browsers. Existing CSS and scoring modules kept at their original versions.

Validation: node --experimental-vm-modules tests/internal-processing.mjs
Deployment: GitHub Pages serves the frontend. cloudflare-worker.js must also be deployed to the existing runwise-api Worker; GitHub Pages does not deploy that Worker. Keep its existing DATA_GO_KR_SERVICE_KEY and ALLOWED_ORIGIN bindings.
Rollback: restored v39 remains at eb2d60255f8b7d8db785ef999ddf49e8beb9af42 and backup/before-runwise-v40-20261010. Frontend and Worker deployments are independent.
