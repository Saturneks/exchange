## Summary
Small, Markets-only improvements from a UX audit of the dashboard, markets, portfolio, news, and profile/settings surfaces:
- Compose category and search filters instead of silently discarding either selection; trim search whitespace and label the search input.
- Replace blank results with an announced empty state and a Clear filters action that restores keyboard focus.
- Make failed market loads recoverable with Retry, HTTP/response checks, a 15-second timeout, and request deduplication. Preserve filters selected while loading.

Account and trading controls remain demo-only; this PR does not add transaction behavior or change those flows.

## Verification
- `node --test tests/markets.test.cjs` — 7 passing tests for combined filters, reset/focus, network/HTTP/invalid/empty/timeout failures, retry, and in-flight request deduplication.
- Diff whitespace checked with `git -c core.whitespace=cr-at-eol diff --check` (preserves the existing HTML CRLF line endings).
- Managed Preview ready; browser assertions passed for combined filters, reset/focus, and mobile empty state at 390px. No uncaught browser errors observed.
- CoinGecko failed during browser verification: verified the real visible Retry state, then verified recovery and filtering with a temporary browser-only fixture response. The fetch override was removed afterward; no fixture is shipped.
- Inspected current mobile screenshot; UI evidence: https://api.hoplite.sh/api/attachments/01e0d4d59fc84749b00944b2e39a3381 (workspace-member access).
