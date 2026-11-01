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
| 4. Financial recovery | Open; diagnosed and reproduced | Seeds 10 and 17 still stall. Implement and test an affordable recovery policy; do not mark them fixed merely because normal acceptance passes. |
| 5. Exception and restart coverage | Partial | Added proof/revision/load and launch-gate regressions. Deterministic hearing, depleted-cap, treasury-shortage and independent-process restart scenarios still remain. |
| 6. Export/import and save support | Open | Add validated save transfer and last-known-good recovery. Preserve existing launch checkpoint behaviour. |
| 7. Gemini delegation and invitations | Open | Extend existing flight operations rather than rebuilding Mercury delegation. |
| 8. Concurrent programme authority | Open | Start with two programmes and one shared-resource conflict; enforce hearing availability. |
| 9. NASA transfer and independent assurance | Open | One explicit transfer/restriction review and a separate clearance responsibility. |
| 10. Stage assembly and integration | Open | One existing two-stage vehicle, independently identified units and applicable evidence. |
| 11. Capability continuity | Open | Link demonstrated flight capabilities to bounded lunar requirements. |
| 12. Funded lunar route | Open | One complete architecture and qualification-to-return route. |
| 13. Durable decision records | Open | Preserve evidence, advice, approval and follow-up for important decisions. |
| 14. Blockhouse adoption | Open | Aerobee offer, Viking readiness gate and C-to-B adoption. |
| 15. Observer boundary | Open | Define launch observation/return, time, communications loss and the accessible 2D fallback before integrating production 3D. |
| 16. Wider institutional life | Later | Build contextual disagreement/mentorship from actual records after the campaign foundations. |

## Verification for this batch

- `npm test`: 172 passed, zero failed (168 existing tests and four new regressions).
- `npm run acceptance`: passed the existing hands-on/delegated routes and Gemini save/reload comparison.
- `DELEGATE=1 SEED=10,17 node tools/balance.mjs`: both known financial stalls remain; nonzero exit is expected and recorded, not treated as a successful route.
- Isolated browser: proof letter and withdrawal action work, with no page errors.
- Logs: `tmp/nov1-safety-rules.log`, `tmp/nov1-safety-acceptance.log`, `tmp/nov1-safety-outliers.log`.

No new full 40-run sweep or installer build was performed for this safety batch. Broad campaign balance is not certified. Next batch: item 4 recovery policy and player-visible cash-flow blockers, then the remaining item 5 exception checks.

## Closed earlier work

Keep paperwork C, the modern development-view toggle, transcript visibility, stable Research selection, pause handling, pre-launch checkpoint recovery, carried-fix identity and lower-stage fix-trial credit. These are implemented, not additional backlog items. Development tests run on dev; releases stay on main. The progress PDF's note that dfc2eb1 was awaiting push is historical: that push was subsequently confirmed on GitHub.

## Folder access

The Windows project directory reports the `Directory` attribute, without `ReadOnly`. Earlier write failures came from this chat's workspace permissions: its normal writable root was Documents/Codex rather than C:/Projects/History of Rocketry. Approved project writes and tests succeeded. No Windows ACL or folder attributes were changed.
