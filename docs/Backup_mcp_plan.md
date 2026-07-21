Flumen v2 MCP Implementation Plan

Locked product and architecture decisions





Use the official modelcontextprotocol/swift-sdk, pinned to an exact tested 0.12.x release and isolated behind Flumen-owned adapters. Upgrade the Swift package toolchain from 5.9 to Swift 6.x; the current Swift 6.2.3/Xcode 26.2 environment supports this.



Ship a signed universal flumen-mcp executable inside Flumen.app. Agent clients launch it over MCP stdio; no Node/Python runtime and no localhost MCP server.



The helper communicates with the running app through a versioned Unix-domain-socket protocol. It never opens SQLite or UserDefaults directly.



Flumen remains the only owner of database writes, timer transitions, permissions, and confirmation.



Flumen must be open in v2. Calls made while it is closed return an actionable Open Flumen and try again error; auto-launch and offline reads are deferred.



Remove the client picker. Provide Cursor’s supported install deeplink, copyable generic configuration, and external setup instructions for Claude Code, Codex, Gemini CLI, and other MCP clients. Populate connected-client information only after an actual MCP handshake; treat client identity as informational.



Agent Access is off by default. Reads require Agent Access; writes additionally require Allow Proposals and an explicit Flumen-side confirmation.



Confirmed ad-hoc meetings and short work count toward focus time, project totals, daily activity, and streaks, but never increment completed focus-cycle counts unless a real focus cycle completed.



Hooks remain a post-core experiment. MCP must provide full value without Cursor/Claude/Gemini/Codex hooks.

Target architecture

flowchart LR
    AgentClient["Agent client"] -->|"MCP stdio"| MCPHelper["flumen-mcp helper"]
    MCPHelper -->|"Versioned local IPC"| AgentCoordinator["AgentAccessCoordinator"]
    AgentCoordinator --> PermissionService["Permission and confirmation service"]
    AgentCoordinator --> DomainServices["Task, activity, report services"]
    DomainServices --> Database["GRDB database"]
    AgentCoordinator --> TimerBridge["Timer command bridge"]
    TimerBridge -->|"Request and response IDs"| Zustand["React and Zustand timer"]
    Zustand --> TimerBridge
    PermissionService --> ApprovalUI["Flumen approval UI"]

Create the helper and shared IPC as additional SwiftPM targets without moving the existing app sources initially:





[macos/Pomodoro/Package.swift](macos/Pomodoro/Package.swift): Flumen, FlumenIPC, and FlumenMCP targets/products; exact MCP SDK pin; SwiftNIO Unix-socket dependency if selected by the spike.



[macos/Pomodoro/IPC](macos/Pomodoro/IPC): Codable protocol envelopes, error codes, socket client/server primitives, protocol versioning, request IDs, and cancellation.



[macos/Pomodoro/MCP](macos/Pomodoro/MCP): stdio entry point, MCP registration, schemas, output formatting, and IPC proxy only.



[macos/Pomodoro/Sources](macos/Pomodoro/Sources): app-owned coordinator, services, permissions, and WebView command adapter.

Phase 0 — Protect the existing product and prove feasibility





Capture a baseline by running all existing TypeScript tests and documenting manual behavior for start, pause, reset, skip, focus completion, break transitions, auto-start, menu-bar controls, sleep/wake, backgrounding, restart recovery, tasks, reports, CSV export, staging, and production data isolation.



Add a native Swift test target before changing persistence or database behavior.



Build a spike with one get_server_status MCP tool that launches as a universal stdio helper and reaches a mock app socket. Verify it with MCP Inspector, Cursor, Claude Code, Codex, and Gemini CLI.



Verify nested helper signing, quarantine behavior, Sparkle replacement, staging/production bundle resolution, and operation from a non-development build.



Stop if the official Swift SDK, universal helper packaging, or client launch behavior is unreliable. Do not begin timer or database refactors until this gate passes.

Phase 1 — Create stable app-owned domain seams

Refactor transport and business logic without changing visible behavior:





Extract task, project, activity-log, and report operations from [macos/Pomodoro/Sources/Bridge.swift](macos/Pomodoro/Sources/Bridge.swift) into app-owned services such as TaskService, ProjectService, ActivityLogService, and ReportService.



Keep [macos/Pomodoro/Sources/DatabaseManager.swift](macos/Pomodoro/Sources/DatabaseManager.swift) as the sole GRDB owner. Both the WKWebView bridge and Agent Access coordinator call the same services.



Preserve current bridge action names and payloads so [src/services/nativeBridge.ts](src/services/nativeBridge.ts) and existing UI behavior do not change during extraction.



Serialize all mutable operations through Swift actors or the existing GRDB transaction boundary.



Add unit tests comparing extracted-service responses with current bridge behavior before enabling MCP access.

Phase 2 — Extend persistence and provenance safely

Add forward-only GRDB migrations with rollback-safe backups/tests:





Persist activeTaskId, which is currently memory-only, alongside the timer anchor, locked task context, session type, and lastStateUpdatedAt through [src/services/persistence.ts](src/services/persistence.ts) and [src/state/pomodoroStore.ts](src/state/pomodoroStore.ts).



Extend session_logs with provenance fields: source (timer, manual, agent), duration_origin (observed, user_supplied, inferred), recorded_at, optional source_client, optional external_reference, and a unique idempotency_key.



Add correction history for later edits using a dedicated revision table rather than silently replacing inferred records.



Define ad-hoc semantics explicitly: include duration in focus/project totals and activity streak dates; write is_completion = false; do not increment task pomodoros or completed focus-cycle counts.



Preserve all existing report and CSV results for legacy rows by assigning safe migration defaults (timer/observed). Add source fields to structured MCP output; update CSV only if explicitly required by the PRD.



Add timezone, overlap-warning, future-time, negative-duration, and maximum-single-entry validation. Permit legitimate meetings while preventing implausible or destructive entries.

Phase 3 — Build the private app IPC broker

Implement AgentAccessCoordinator in the Swift app:





Start the Unix socket only when Agent Access is enabled; store it in the production/staging bundle-specific Application Support directory.



Restrict the parent directory to the current user, restrict socket permissions, and verify same-user peers where supported.



Use a small versioned internal protocol rather than tunnelling MCP: {protocolVersion, requestId, operation, clientSession, idempotencyKey, payload} with structured success/error responses.



Support timeouts, cancellation, graceful shutdown, request-size limits, malformed input rejection, and reconnect behavior.



Track active helper sessions by connection UUID, self-reported MCP client name/version, connection time, and last activity. Do not treat client names as authentication.



Serialize writes and timer commands across multiple helpers. Duplicate idempotency keys must return the original result.



When Agent Access is off or Flumen is not running, expose no data and return stable actionable error codes.

Phase 4 — Add authoritative timer request/response support

Keep [src/core/timerEngine.ts](src/core/timerEngine.ts) and Zustand as the v2 timer source of truth to avoid destabilizing core timing:





Extend the existing Swift-to-JavaScript channel with agentCommand messages containing request IDs.



Add a JavaScript handler that reads or invokes existing Zustand actions and posts agentCommandResult back through [src/services/nativeBridge.ts](src/services/nativeBridge.ts).



Implement commands for timer snapshot, active-task selection, begin focus, pause focus, finish focus, and task completion by reusing existing store actions rather than duplicating transition logic.



Return absolute anchors (now, startedAt, endsAt, timezone) plus computed remaining time and dataFreshness; agents should reason from absolute timestamps.



Add timeout and WebView-unavailable errors. Never partially apply a compound action: begin_focus must either create/select/start as one confirmed operation or leave state unchanged.



Regression-test backgrounding, sleep/wake, app activation, native menu timer, auto-start, minute logging, notifications, and restart hydration after every timer-bridge increment.

Phase 5 — Implement the read-only MCP surface first

Register a compact, bounded v1 read surface in the helper:





get_focus_status: authoritative phase, active task/project, startedAt, endsAt, remaining time, today’s totals, app and data freshness.



list_tasks: bounded filtering by status/project.



list_projects: active projects and stable IDs.



query_focus_activity: paginated, bounded date/project/task/source query; no unrestricted database dump.



get_focus_summary: bounded aggregate suitable for weekly review and external work-item reconciliation.



get_estimation_context: comparable historical task facts and estimate variance; the connected agent performs interpretation, with no embedded LLM or vector store in Flumen.



Resources: flumen://status, flumen://today, and flumen://active-task; add subscriptions only after tool compatibility is stable across clients.



Optional prompts: recover_missing_time, plan_focus_day, and weekly_focus_review. These instruct agents to combine Flumen with Calendar/Monday/project MCPs without adding those integrations to Flumen.

Gate: ship the read-only surface to internal testers and confirm it has zero impact when Agent Access is off before implementing writes.

Phase 6 — Implement confirmed write workflows

Expose workflow-level tools rather than low-level database controls:





log_time: direct or inferred ad-hoc activity with title, interval/duration, project/task, evidence metadata, and provenance.



create_task: focused Shelf task creation with project and estimate.



update_task: change a task's title, project, or estimate using an expected revision/version; reject stale updates and return the latest task.



set_active_task: select an existing Shelf task without starting a focus session; reject archived or completed tasks unless the user explicitly reopens them.



begin_focus: atomically create/select a task if needed and start a focus session.



pause_focus.



finish_focus: stop/reconcile the active session and optionally propose task completion.



complete_task.



correct_time_entry: revise a completed, non-active activity with confirmation and append-only correction history; never modify the elapsed duration of the active session.

For every write:





Validate and normalize the request without mutating state.



Create an in-memory pending proposal with an idempotency key and expiry.



Display the exact task, time, project, provenance, and side effects in Flumen.



Wait for native approval, decline, cancellation, or timeout.



On approval, revalidate current state and execute atomically through the shared domain/timer services.



Return the authoritative resulting state to the agent.

Use MCP elicitation when a client advertises support, but do not rely on it. Flumen-side confirmation remains mandatory even in permissive agent run modes. A hidden Flumen panel must surface a quiet notification and approval route; no write occurs if the UI cannot obtain confirmation.

Conflict rules for the added tools:





update_task and set_active_task use stable task IDs and optimistic concurrency so user edits made after the agent's read are never overwritten.



Renaming an active task does not retroactively change its locked running-session snapshot.



Completing, archiving, or selecting an invalid task returns the current task state and requires a fresh proposal.



correct_time_entry rejects active-session edits and exact duplicates, detects overlap with timer/manual/agent records, and presents the previous and proposed values before approval.



A correction preserves the original activity record and provenance through its revision history; retries use the same idempotency key.

Phase 7 — Implement Agent Access settings and setup

Revise [docs/MCP-AGENT-ACCESS-UX.md](docs/MCP-AGENT-ACCESS-UX.md) to remove the client picker and then implement:





A compact Agent Access disclosure row in [src/ui/SettingsView.tsx](src/ui/SettingsView.tsx).



A dedicated AgentAccessView with Off, Starting, Ready, Connected, and Error states.



First-enable privacy explanation: Flumen stays local, but an agent may send requested data to its model provider.



Permissions: Read Focus Data and independently switchable Allow Proposals; no autonomous/full-control option.



Informational active connections populated from real MCP handshakes; disconnect current sessions, but do not promise strong per-client identity or authorization.



Setup actions: official Add to Cursor deeplink, Copy MCP Configuration, Copy Server Command, Open Setup Guide, Test Connection, and diagnostics. Do not detect clients, edit their config files, or run their setup CLIs automatically.



Connection details show local stdio, actual bundle-derived helper path, availability while Flumen is open, protocol/server version, and actionable errors—no port or token UI.



Turning access off terminates active IPC sessions immediately without changing tasks, logs, or timer state.

Phase 8 — Deliver and verify the core product workflows

Validate the PRD’s four jobs end to end:





Forgotten meeting/short work: Calendar or conversation context produces a proposed log_time; confirmed entry affects time/project totals and streak but not cycle completion.



Cross-system weekly review: stable Flumen session IDs and structured summaries let an agent compare/create Monday.com items through Monday’s own MCP; Flumen stores optional external references to prevent duplicate reconciliation.



Daily planning and supervised execution: agent combines calendar/project context with existing Shelf items, proposes a small plan, uses begin_focus, rechecks status at phase boundaries, and proposes finish_focus only with confirmation.



Evidence-based estimation: agent receives bounded comparable history, ranges, and estimate variance rather than an unsupported prediction from Flumen.

Test happy paths plus inference correction, overlapping time, stale timer state, declined proposals, retries, multiple agents, external-system failure, and partial workflow cancellation.

Phase 9 — Hooks experiment after core MCP stability

Keep the experiment behind a separate opt-in and verify it against explicit commands:





Cursor: sessionStart awareness, beforeMCPExecution write gating, afterMCPExecution reconciliation, and carefully bounded stop/final-response reminders.



Claude Code, Gemini CLI, and Codex: equivalent lifecycle/tool hooks where supported.



Hooks may read status or suggest a proposal; they never write directly or bypass MCP/native confirmation.



Opening an agent is not evidence that focus started; an agent stop event is not evidence that the task completed.



Deduplicate conversation, generation, tool, and subagent events. Avoid automatic follow-up loops.



Promote hooks into the v2 product only if they reduce missed sessions without irrelevant prompts, latency, false logging, or confirmation fatigue.

Phase 10 — Packaging, security, release, and observability





Update [build_app.sh](build_app.sh) to build both architectures, combine the helper, place it in Contents/Helpers, and sign nested code before signing the app.



Preserve staging bundle ID/data separation and production bundle ID/appcast requirements.



Add Developer ID signing, hardened runtime, and notarization as a release gate for a helper spawned by external apps; do not rely on the current ad-hoc development signature for production.



Keep Agent Access disabled by default and zero-cost when disabled: no listener, polling, network, or idle CPU work.



Log diagnostics locally with redacted payloads and bounded retention; no telemetry. Provide a user-invoked diagnostic export that excludes task titles/history unless explicitly included.



Add compatibility/contract tests for the pinned MCP protocol and a manual client matrix covering supported Cursor, Claude Code, Codex, and Gemini versions.



Document setup, privacy boundary, permissions, tool schemas, errors, troubleshooting, uninstallation, and the app-open requirement.

Non-regression and release gates

Do not merge the feature as one large change. Each phase must preserve green existing tests and pass the relevant new native/contract tests.

Required final gates:





Existing timer, task, reports, CSV, menu bar, hotkey, update, and persistence behavior passes with Agent Access both off and on.



Agent Access off produces no externally readable data and no measurable idle overhead.



Database migration succeeds on representative existing databases and legacy reports remain numerically unchanged.



No duplicate writes under retries, reconnects, concurrent clients, or hook duplication.



Every write is confirmed in Flumen and accurately marked by source.



Ad-hoc activity contributes to time/project totals and streaks but not completed focus-cycle counts.



Helper and app are universal, signed, hardened, notarized, and verified in both staging and production packaging.



At least 5–8 target users complete setup and core workflows; setup target under two minutes, core task completion at least 85%, privacy-comprehension at least 80%, and no critical usability issue remains.

Documentation deliverables





Update [docs/MCP-V2-PRD.md](docs/MCP-V2-PRD.md) with final architecture decisions and ad-hoc metric semantics.



Revise [docs/MCP-AGENT-ACCESS-UX.md](docs/MCP-AGENT-ACCESS-UX.md) to remove client detection/picker and specify actual stdio setup.



Add architecture decision records for SDK/transport, IPC/state ownership, confirmation, and client setup.



Add a versioned MCP tool/resource contract and internal IPC protocol specification.



Add supported-client setup and troubleshooting guides.



Extend [docs/TESTING.md](docs/TESTING.md) with native, MCP, migration, security, multi-client, and release regression matrices.

