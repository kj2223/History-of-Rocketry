# Implementation backlog

Updated 1 November 2026. Working status for the numbered items in `Project_Vanguard_Prioritised_Todo_2026-11-01.pdf`. Keep its item numbers when discussing follow-up work. The older progress PDF groups the same work more broadly; its numbering is not a second implementation queue.

## Overlap between the two lists

| Progress PDF workstream | Prioritised list items |
| --- | --- |
| 1. Combined management loop and verification | 1-6; hearing availability in 8 |
| 2. Delegation boundaries and concurrent authority | 7-8 |
| 3. Hardware and evidence | 10-11 |
| 4. Institutional formation | 9 |
| 5. Apollo beyond the opening | 11-12 |
| 6. Interface evolution | 14-15 |
| 7. Longer institutional vision | 13, 16 |

## Current status

| Item | Status | Next action or result |
| --- | --- | --- |
| 1. Campaign-safe risk cache | Completed in safety batch | Cache invalidates on reset/load, includes changing flight-model inputs and keeps at most 32 entries. Seeded campaign/load regressions compare against an independent cache. |
| 2. Revision-bound proof requests | Completed in safety batch | A changed published configuration supersedes the request and allows reassessment. Already-running tests retain their original evidence key. Waiting proof can be withdrawn with the existing refusal consequences. Save/load and queued/running cases are tested. |
| 3. Actual flown configuration | Completed in safety batch | Mission gate and planner use the selected booster and its stage revisions. Overrides record configuration and airframe ID. An old vehicle cannot borrow a newer revision's tests. |
| 4. Financial recovery | Completed | Missions cannot spend beyond the treasury; annual funding covers unavoidable operations; one bounded emergency appropriation protects essential work; delegated automation preserves a two-month operating reserve. Seeds 10 and 17 now complete with zero stalls. |
| 5. Exception and restart coverage | Completed | Added deterministic treasury-shortage and depleted-cap standing-order regressions, hearing availability checks, and an independent Node-process save/load check for a pending hearing. Existing proof, revision, load, launch-gate, and checkpoint regressions remain covered. |
| 6. Export/import and save support | Completed | Added validated JSON export/import, preserved the existing save format, retained unreadable primary saves for diagnosis, restored a last-known-good backup when needed, and preserved launch checkpoint recovery. |
| 7. Gemini delegation and invitations | Completed | Added explicit Gemini delegation through Flight Ops. Ellis prepares Gemini launches under the existing cap and readiness pipeline, while every Gemini launch remains behind a player greenlight; existing Mercury delegation and invitation behavior is preserved. |
| 8. Concurrent programme authority | Implemented; validation pending | Added persisted shared-line ownership, deterministic cross-programme conflict handling, preserved global hearing exclusivity, and regression coverage. Broader delegated balance acceptance still needs a separate review. |
| 9. NASA transfer and independent assurance | Implemented; validation pending | Added the persisted NASA transfer/restriction review, an independent Escape & Man-Rating assurance responsibility, astronaut-flight clearance enforcement, UI status, and regression coverage. Unit and browser checks pass; delegated balance acceptance still reports existing Mercury stalls. |
| 10. Stage assembly and integration | Deferred for design | Requires a separate model for independently identified stages, assembly ownership, and evidence applicability before implementation. |
| 11. Capability continuity | Deferred for design | Requires a bounded capability/evidence model linked to lunar requirements; do not implement until item 10's stage and evidence boundaries are settled. |
| 12. Funded lunar route | Deferred for design | Requires an end-to-end architecture and funding model after capability continuity is defined. |
| 13. Durable decision records | Deferred for design | Requires a decision-record schema and retention/export policy before implementation. |
| 14. Blockhouse adoption | Deferred for design | Requires clarification of the Aerobee/Viking/C-to-B adoption path and its interaction with existing launch-site rules. |
| 15. Observer boundary | Deferred for design | Requires a clear 2D observation/return contract before any production 3D integration. |
| 16. Wider institutional life | Deferred for design | Build only after the earlier institutional and evidence models are stable. |

## Verification for this batch

- `npm test`: 182 passed, zero failed.
- `npm run acceptance`: currently reports delegated Mercury balance stalls; this remains a separate balance-certification issue and is not being claimed as passed for items 8–9.
- `DELEGATE=1 SEED=10,17 node tools/balance.mjs`: both formerly known financial stalls now complete Gemini and Saturn I with zero stalls.
- Isolated browser: proof letter and withdrawal action work, with no page errors; pause, reload, and checkpoint recovery pass.
- Logs: `tmp/nov1-safety-rules.log`, `tmp/nov1-safety-acceptance.log`, `tmp/nov1-safety-outliers.log`.

Next batch: pause implementation after item 9. Items 10–16 require design review before coding.

## Closed earlier work

Keep paperwork C, the modern development-view toggle, transcript visibility, stable Research selection, pause handling, pre-launch checkpoint recovery, carried-fix identity and lower-stage fix-trial credit. These are implemented, not additional backlog items. Development tests run on dev; releases stay on main. The progress PDF's note that dfc2eb1 was awaiting push is historical: that push was subsequently confirmed on GitHub.

## Folder access

The Windows project directory reports the `Directory` attribute, without `ReadOnly`. Earlier write failures came from this chat's workspace permissions: its normal writable root was Documents/Codex rather than C:/Projects/History of Rocketry. Approved project writes and tests succeeded. No Windows ACL or folder attributes were changed.
