# Flumen MCP Architecture Decisions

**Status:** Accepted for v2 implementation  
**Last updated:** July 16, 2026

## Context

Flumen is a local-first macOS menu-bar app. The React/Zustand layer owns live timer transitions, while the Swift layer owns native integration and GRDB persistence. MCP support must preserve this division until a separately validated timer migration exists.

The primary constraints are:

- no Flumen cloud, account, or remote relay;
- no always-on daemon or TCP MCP endpoint;
- Agent Access disabled by default;
- Flumen remains the sole state and database authority;
- all agent writes require Flumen-side confirmation;
- existing timer, task, report, CSV, menu bar, hotkey, and update behavior must remain unchanged.

## ADR-001: Native Swift stdio MCP helper

### Decision

Bundle a universal `flumen-mcp` Swift executable inside `Flumen.app` and use the official Model Context Protocol Swift SDK pinned to an exact tested pre-1.0 release.

Agent clients launch the helper over stdio. The helper contains protocol schemas and an IPC proxy, but no business persistence.

### Reasons

- Stdio is broadly supported by local desktop MCP hosts.
- No Node, Python, package-manager download, or runtime is required.
- No local HTTP authentication or port lifecycle is introduced.
- A native universal helper follows Flumen's distribution model.

### Consequences

- Each connected host may run one idle helper process.
- Flumen must package and sign a second executable.
- SDK upgrades require MCP contract tests because the SDK is pre-1.0.
- Remote/cloud-only agents cannot connect in v2.

## ADR-002: Private versioned Unix-socket IPC

### Decision

The stdio helper communicates with the running Flumen app through a bundle-environment-specific Unix domain socket under Application Support.

The internal protocol is newline-delimited, bounded, versioned JSON with request IDs, idempotency keys, client-session metadata, structured errors, timeouts, and cancellation.

### Reasons

- The helper cannot safely reach the WKWebView/Zustand timer directly.
- Direct multi-process SQLite access would bypass app validation and risk contention.
- Unix sockets avoid a network listener while supporting multiple helpers.
- A separate internal protocol prevents MCP transport details from leaking into domain services.

### Consequences

- Flumen must be open for every read and write in v2.
- Turning Agent Access off closes the listener and active connections.
- The socket directory and endpoint must be restricted to the current user.
- Client names from MCP initialization are display metadata, not authentication.

## ADR-003: Flumen app owns all state and mutations

### Decision

`DatabaseManager` remains the sole GRDB owner. App-owned task, project, activity, and report services are shared by the existing WKWebView bridge and Agent Access coordinator.

The helper never reads SQLite, UserDefaults, or report files directly.

Live timer commands are forwarded to the current Zustand source of truth through a request/response extension of the native bridge.

### Reasons

- Existing timer behavior is proven and should not be rewritten as part of MCP.
- Shared services prevent the app and agents from implementing different rules.
- One writer enables serialization, optimistic concurrency, and idempotency.

### Consequences

- The Swift/JavaScript command bridge needs explicit request IDs and timeouts.
- Compound commands revalidate state after approval and commit all-or-nothing.
- App-unavailable errors are expected behavior, not an offline fallback.

## ADR-004: Flumen-side confirmation is mandatory

### Decision

Read operations may execute when Agent Access is enabled. Every mutation requires Allow Proposals plus explicit approval presented by Flumen.

MCP-host approval and elicitation may improve the experience, but neither replaces Flumen approval.

### Reasons

- MCP hosts may offer permissive or fully automatic run modes.
- Agent text claiming the user approved something is not authoritative.
- Focus history is personal and corrections affect future reports and estimates.

### Consequences

- Write calls may wait for approval, decline, cancellation, or timeout.
- Pending proposals are non-mutating and expire.
- The app revalidates current state after approval.
- App closure, permission revocation, stale state, or timeout produces no write.

## ADR-005: No client picker or automatic configuration editing

### Decision

Do not scan for MCP clients or edit their configuration files.

Provide:

- Cursor's supported installation deeplink;
- copyable stdio configuration and executable command;
- setup guides for Claude Code, Codex, Gemini CLI, and generic clients;
- an informational list populated from active MCP handshakes.

### Reasons

- There is no universal macOS MCP-client registry.
- Client configuration formats and locations change independently.
- Modifying another application's settings is brittle and difficult to reverse safely.
- A successful MCP handshake is stronger evidence than app/CLI detection.

### Consequences

- Initial setup remains client-owned and explicit.
- Flumen can test the helper and show actionable diagnostics without claiming the external client is configured correctly.

## ADR-006: Ad-hoc activity is focus time, not cycle completion

### Decision

Confirmed manual and agent-proposed logs contribute to:

- total focus time;
- project and task duration;
- daily activity;
- streak dates.

They do not:

- set `is_completion`;
- increment completed focus cycles;
- increment task pomodoro counts.

### Reasons

A short task or forgotten meeting is real recorded work, but it is not evidence that a configured focus cycle completed.

### Consequences

- Reports include ad-hoc duration without inflating completed-session counts.
- Provenance remains visible as timer, manual, or agent.
- Exact duplicates and overlaps must be resolved before insertion.

## ADR-007: Hooks remain optional experiments

### Decision

Cursor, Claude Code, Codex, and Gemini hooks may remind agents to read Flumen or reconcile work, but core MCP workflows cannot require hooks.

Hooks may observe or propose. They never write directly to Flumen.

### Reasons

- Hook lifecycle events are not proof of focused work or task completion.
- Hook APIs and semantics vary by client.
- Automatic triggers can create duplicate or distracting proposals.

### Consequences

- Hook packs ship only after explicit-command workflows are stable.
- Hook events require deduplication and bounded follow-up behavior.
