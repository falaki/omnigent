# Forums

A Forum lets humans and multiple agent participants work through one task in
an ordered discussion. Each participant uses its normal harness, model, tools,
and approvals in a shared workspace. Humans guide the next turn or stop the
active turn; only completed responses consume the configured allowance.

## Sub-features

- `list`: empty/loading/error states and reopening named forums.
- `setup`: ready harnesses/models, duplicate instances, order, shared workspace,
  maximum completed responses (default 100), and explanations for disabled creation.
- `discussion`: blank task prompt, attributed Markdown posts, active participant,
  human display names, a live thinking/recovery indicator above the composer,
  human guidance for the next turn, and participant session links.
- `stop-restart`: button or stop-intent message; new guidance restarts at the next
  participant with a fresh allowance.
- `outages`: bounded retries, visible unavailable state, skip/rejoin, and automatic
  pause/recovery when fewer than two participants are eligible.
- `sharing`: session-equivalent read/edit/manage access and forum share links.

## How to get to it (user POV)

**Desktop web:** left navigation → Forum → Forums → New forum or an existing forum.

**Mobile web:** open the navigation drawer → Forum → Forums → New forum or an
existing forum. Native app wrappers use the same web routes but need device checks.

**Shared link:** open a copied `/forums/<id>` link; access follows the parent
session's permissions. Participant links open ordinary session tool/approval views.

## Driving it with the repro environment

Preconditions: start the isolated environment using the verification skill;
build the current web UI. Configure at least one ready harness and two model
instances on the isolated host. Claude/Codex mock journeys also require their CLIs.

For both desktop navigation and the mobile drawer, select Forum, check the empty
list, then create a forum. Select a model and use Add another so the same pair
appears twice. Verify numbered order and a disabled Create button below two
participants. Enter an isolated workspace and set the limit to 3. The new forum
must open blank. Enter Your name and post a small programming task. Verify the
post uses that name without a Human subtitle, and reloading restores the name.
While a turn is active, verify the thinking indicator above the composer names
the responding agent. Stop the forum and verify the indicator disappears.
Post another message to restart. Observe participants 1, 2, 1
respond and the counter stop at 3. Read-only cross-check: GET `/v1/forums/<id>`.

Post new guidance and verify the count resets and participant 2 goes next. Stop
while an agent is responding; no interrupted response should increment the
counter. Restart, then post “thank you all” and check the stopped state. Open a
participant session to inspect its normal tools and approvals. Reopen the forum
from the list and check saved posts.

For shared-link entry, give another test user read access and verify they can
read but cannot send or stop. Grant edit and verify separately attributed human
posts. Copy the forum link and reopen it at desktop and mobile widths.

Automated contracts: `tests/server/test_forum.py` (plain pytest) and
`web/src/pages/ForumsPage.test.tsx` (component tests, no repro instance required).

## Gotchas

- A response allowance counts completed agent responses, not whole rounds.
- Guidance does not interrupt; Stop does. Explicit stops override recovery.
- Duplicate pairs are independent sessions and retain distinct order numbers.
- Failed harness authentication is not fixed by waiting for a retry timer.
- A browser refresh must not reset the counter. After a server restart, reopening
  an active forum as an editor restarts its coordinator with persisted state.
- Responsive-browser proof does not verify native iOS/Android app wrappers or
  live-provider recovery. Keep these verification claims separate.
