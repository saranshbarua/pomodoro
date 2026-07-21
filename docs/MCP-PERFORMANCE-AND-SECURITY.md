# MCP Performance and Security Gates

**Status:** Release criteria  
**Baseline measured:** July 16, 2026

## Baseline

- Installed `Flumen.app`: approximately 15 MB
- Universal main executable: approximately 9.8 MB
- Compressed release ZIP: approximately 7.5 MB
- Existing frontend tests: 82 passing
- Existing native package: builds successfully before MCP changes

These figures are comparison points, not permanent limits. Measure release builds on both Apple Silicon and Intel-compatible universal artifacts.

## Performance budgets

### Agent Access off

- No app-owned socket listener
- No polling or network listener
- No database work caused by MCP
- No measurable timer or animation regression
- No externally readable data

A configured MCP host may launch the stdio helper independently. The helper must remain event-driven and perform no retry polling while idle.

### Agent Access on, no client

- Incremental app memory target: less than 2 MB
- Average idle CPU target: less than 0.05%
- No timer tick, persistence, or report-query changes

### Connected client

- Idle helper private-memory target: less than 20 MB per client
- Average idle helper CPU target: less than 0.1%
- Ordinary read-tool latency target: less than 100 ms
- Requests and responses must be bounded; no unpaginated history dump

### Distribution size

- Installed app increase target: no more than 12 MB
- Compressed ZIP increase target: no more than 5 MB
- Record the main binary, helper, frameworks, app bundle, and ZIP separately

Exceeding a target requires investigation, not silent acceptance. First inspect debug symbols, stripping, duplicate static linkage, and the Unix-socket dependency.

## Security invariants

- MCP uses stdio between the host and helper; Flumen exposes no HTTP or TCP MCP endpoint.
- The helper never opens Flumen SQLite or UserDefaults directly.
- The running app is the sole data and mutation authority.
- The private Unix socket is bundle-environment-specific and restricted to the current user.
- Agent Access is disabled by default.
- Read permission and proposal permission are enforced independently.
- Every write is revalidated and explicitly approved in Flumen.
- Client tool approval or permissive agent mode never replaces Flumen approval.
- Client names from MCP initialization are informational, not authentication.
- Writes are serialized and idempotent across retries and multiple clients.
- Diagnostic logs redact task titles, focus history, prompts, and raw payloads by default.
- Turning Agent Access off terminates active IPC connections and invalidates pending proposals.
- Closing Flumen makes all MCP data unavailable in v2.

## Conflict invariants

- The active session duration cannot be corrected through MCP.
- Exact duplicate activities are rejected.
- Partial overlaps return a conflict and uncovered interval rather than double-counting silently.
- Ad-hoc activities affect focus/project totals and streaks but not completed focus-cycle counts.
- Stale task revisions cannot overwrite newer user changes.
- Timer/task state is re-read after approval and before mutation.
- App shutdown, permission revocation, or proposal timeout results in no write.

## Release verification

1. Run frontend and native test suites.
2. Build universal release binaries.
3. Verify both architectures with `lipo`.
4. Verify nested signatures and the complete app signature.
5. Measure app/helper CPU and private memory in off, ready, idle-connected, and active-query states.
6. Compare timer accuracy and animation responsiveness with Agent Access off and on.
7. Exercise duplicate, overlap, stale revision, timeout, disconnect, and concurrent-client tests.
8. Verify production and staging use separate bundle IDs, sockets, defaults, and databases.
9. Verify the app-open error from every supported MCP client.
10. For Developer ID releases, notarize, staple, recreate the ZIP, and verify Gatekeeper acceptance.
