<!-- Keep the title imperative and scoped, e.g. "Add streak-freeze token to daily goal". -->

## What & why
<!-- What does this change and what problem does it solve? Link issues with "Closes #123". -->

## How
<!-- Key implementation notes / trade-offs a reviewer should know. -->

## Screenshots / recordings
<!-- For any UI change. Before/after is ideal. Delete if N/A. -->

## Verification
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes (dataset validation gates the build)
- [ ] `npm run smoke` / `npm run e2e` run clean (if behavior changed)
- [ ] Checked on a narrow mobile viewport (`npm run mobile`)

## Player-progress safety
<!-- This project must never lose signed-in users' progress. Confirm each item or explain. -->
- [ ] No change to the `localStorage` key `gre_vocab_game_v1`
- [ ] `GameState` shape and `mergeStates()` stay in sync
- [ ] No destructive SQL migration
- [ ] Fail-closed sync contract preserved (a failed remote read never triggers a push)
