# Flumen v2: MCP Support

**Status:** Accepted for v2 implementation  
**Target:** Flumen v2  
**Last updated:** July 16, 2026

## 1. Executive Summary

Flumen v2 will expose focus tasks, sessions, and reports through a local Model Context Protocol (MCP) server. This will let users work with Flumen from an agent they already use while preserving Flumen as the source of truth for focused time.

The feature is not intended to make Flumen a general task manager or autonomous productivity system. Its purpose is to remove the administrative work around recording, reconciling, and planning focused work across tools.

The initial launch will address four jobs:

1. Log forgotten meetings and short tasks without running an unnecessary focus timer.
2. Turn verified Flumen history into cross-system weekly work records.
3. Plan a day from calendar or project context and supervise the task-and-timer lifecycle.
4. Improve estimates using the user's own focus history.

All data remains on the Mac. Every action that changes Flumen data or timer state requires explicit user confirmation.

## 2. Problem

Flumen records intentional work accurately once a focus session has started. The record becomes incomplete when the act of tracking is more cumbersome than the work itself.

This happens in several recurring situations:

- A user rushes into a meeting and forgets to start the timer.
- A five-to-ten-minute task does not justify creating a task, assigning a project, starting a timer, stopping it, and completing it.
- A user must manually reconcile Flumen's CSV export with Monday.com or another work-tracking system during a weekly review.
- A user plans work in Cursor, Claude, a calendar, or a project tool, then repeats that plan inside Flumen.
- Session estimates are based on intuition even though Flumen already contains the user's actual history.

The result is missing focus history, repetitive administration, and reports that understate real work.

## 3. Product Hypothesis

We believe that connecting Flumen to agents will help agent-using Mac users preserve a more complete and useful record of their focused work with less manual administration.

We will know this is true when users can:

- record a forgotten or short activity through an agent in under 30 seconds;
- produce a trustworthy weekly work summary without manually exporting and reconciling CSV files;
- turn an existing calendar or project plan into a confirmed Flumen day plan;
- make estimates that are meaningfully informed by comparable past work.

MCP is justified only when it combines Flumen with context from another system or removes repeated transcription. Actions that are already faster through Flumen's menu bar, native controls, or Apple Shortcuts do not justify MCP on their own.

## 4. Target User

### Primary user: Agent-assisted intentional maker

A developer, designer, writer, or knowledge worker on macOS who:

- uses Cursor, Claude, or another MCP-capable agent during daily work;
- uses Flumen to focus on one task at a time;
- works across a calendar and a project system such as Monday.com;
- values accurate personal records but does not want timesheet-style administration;
- expects focus data to remain local and private by architecture.

### Jobs to be done

- When I forget to track work, help me restore an honest record without making me recreate the entire session manually.
- When I finish my week, help me turn proven focus history into the work records my team needs.
- When I begin my day or a project session, help me translate existing commitments into a realistic focus plan.
- When I estimate upcoming work, ground the estimate in how long similar work actually took me.

## 5. Prioritized Use Cases

### P0 — Log forgotten meetings and short work

**User story:** As a user who forgot a meeting or completed a small task, I want to tell my agent what happened and have it propose a Flumen entry so that the work is recorded without creating and running a fake focus session.

Example requests:

- “Log the design review from 10:00 to 10:45 under Client Work.”
- “I just spent eight minutes fixing the export label. Log it under Flumen.”
- “I forgot to track my last meeting. Check my calendar and propose the entry.”

Two modes are required:

1. **Direct logging:** The user supplies the task or event and duration.
2. **Assisted reconstruction:** The agent uses available calendar, project, repository, or conversation context to propose the title, project, and likely interval.

The proposal must show the source, duration, project, and whether the time was supplied by the user or inferred by the agent. The user must confirm it before Flumen writes the entry.

Ad-hoc entries must be distinguishable from timer-recorded sessions. Confirmed ad-hoc meetings and short work count toward focus time, project totals, daily activity, and streaks, but never increment completed focus-cycle counts or task pomodoros unless a real focus cycle completed.

**Why MCP:** The agent can combine Flumen with context from the system where the work occurred. A native manual-entry form should still exist, but it cannot reconstruct missing context across systems.

### P0 — Cross-system weekly work review

**User story:** As a user who reports completed work in Monday.com or a similar platform, I want an agent to turn verified Flumen history into proposed work items so that I do not have to export a CSV and rebuild the week manually.

Example request:

> “Review my Flumen sessions from this week, group them into meaningful work items, compare them with Monday.com, and propose any missing items.”

The agent may combine Flumen with another MCP-connected system, but Flumen itself will not contain platform-specific integrations. Flumen provides structured, provenance-aware focus records; the agent coordinates the systems.

Before creating or updating an external item, the agent must present:

- the proposed item title;
- the contributing Flumen sessions;
- total recorded time;
- target project or board;
- any uncertainty or overlap.

The user confirms each external write through the relevant agent workflow.

**Why MCP:** The value comes from joining two live systems and taking a supervised action. CSV can provide data, but it leaves reconciliation and repeated export to the user.

### P1 — Agent-assisted daily planning and supervised execution

**User story:** As a user beginning the day or a project session, I want an agent to propose a Flumen task list from my calendar and current project context so that I can start focused work without recreating my plan.

Possible context includes:

- today's calendar events;
- the current Cursor project or agent conversation;
- issues or tasks from an MCP-connected project system;
- incomplete tasks already on Flumen's Task Shelf;
- historical estimates for comparable work.

The proposed plan should remain intentionally small. Flumen is a single-task focus instrument, not a replacement for the user's backlog. The user confirms each task before it is added.

During execution, an agent or client hook may propose the following lifecycle:

1. Add or select the relevant Flumen task.
2. Propose an estimate based on comparable history.
3. Ask permission to start the focus timer.
4. Read the current session status while work is underway.
5. When the agent believes the work is complete, ask whether to stop the timer and complete the task.

Agent completion is not proof of user completion. The final decision always belongs to the user.

**Why MCP:** The agent already understands the work being planned or performed and can carry that context into Flumen. Hooks are an optional client-side trigger, not a Flumen dependency or guarantee.

### P1 — Evidence-based estimation

**User story:** As a user planning a task, I want an estimate informed by similar work in my Flumen history so that I can reserve a realistic number of focus sessions.

An estimate should include:

- a suggested range rather than false precision;
- the comparable tasks or project history used;
- the user's historical estimate-versus-actual pattern;
- a confidence level when the available evidence is weak.

Example:

> “Your last four reporting changes took 70–105 focused minutes. Reserve three focus sessions. Confidence: medium.”

The agent may interpret similarity, but Flumen supplies bounded factual history. It must not claim that two tasks are comparable without showing the basis for the comparison.

**Why MCP:** Flumen has personal duration evidence while the agent understands the semantics of the upcoming task. Neither source can produce the same result independently.

## 6. Lower-Priority Opportunities

These may follow the core launch if usage validates them:

- Capture a single task from an agent conversation into the Task Shelf.
- Close a task and reconcile its final duration after agent-assisted work.
- Query project investment while making a scope decision.
- Generate broader retrospective narratives from Flumen reports.

These are not independent launch pillars when they are already covered by daily planning, weekly review, or native reports.

## 7. Product Requirements

### Read capabilities

An authorized agent must be able to:

- read current timer and session status;
- read the active task and incomplete Task Shelf items;
- query projects;
- query bounded focus history by date, project, or task;
- retrieve report summaries and estimate-versus-actual data;
- identify whether records came from the timer, manual logging, or an agent.

### Write capabilities

An authorized agent may propose:

- an ad-hoc time entry;
- a new task;
- a task update or completion;
- selection of an active task;
- starting, pausing, stopping, or completing a timer session.

Every write or timer action requires explicit confirmation. Read access does not grant write access.

### Provenance

Every recorded activity must preserve:

- origin: timer, manual, or agent;
- whether duration was observed, user-supplied, or inferred;
- creation timestamp;
- associated task and project when available;
- correction history when an inferred entry is later edited.

Agent-inferred entries must never be indistinguishable from timer-recorded history.

### Confirmation

Flumen must not rely solely on an agent's natural-language claim that the user approved an action. A write must pass through an explicit confirmation mechanism supported by Flumen or the MCP client.

Confirmation should state exactly what will change. Bulk actions must summarize all affected records before approval.

## 8. Privacy and Trust

Flumen remains local-first:

- no Flumen account;
- no Flumen cloud service;
- no remote relay operated by Flumen;
- no telemetry;
- no unrestricted database dump;
- scoped access to the minimum data required for each tool.

The enablement, permissions, client setup, connection status, and disable flows are defined in the [Agent Access UX specification](MCP-AGENT-ACCESS-UX.md).

Local MCP access does not guarantee local AI processing. An MCP client may include returned focus data in a request to a remote model provider. Setup must explain this distinction plainly before access is enabled.

Users must be able to:

- enable or disable Agent Access;
- grant read and proposal permissions separately;
- see informational active connections after a real handshake;
- disconnect sessions or turn access off;
- understand what categories of focus data a client can request.

v2 transport is a bundled `flumen-mcp` stdio helper talking to the open Flumen app over a private Unix-domain socket. There is no localhost HTTP MCP server and no client picker.

## 9. Native Companion Experience

MCP must not become the only way to correct missing history.

Flumen v2 should also provide a native **Log Time** action for users who know the activity and duration. Agent-assisted reconstruction is the MCP advantage; simple manual entry is a universal product need.

Reports should visually distinguish:

- timer-recorded focus;
- manually logged time;
- agent-proposed and user-confirmed time.

The distinction should preserve trust without making the report feel like a corporate timesheet.

## 10. Experiment — Agent Hooks and Lifecycle Awareness

**Status:** To be verified  
**Launch commitment:** No. This experiment must demonstrate reliable user value before becoming part of the v2 launch scope.

### Hypothesis

We believe that pairing Flumen's MCP server with lifecycle hooks in agent clients can reduce forgotten timers and incomplete records by prompting the agent at relevant moments without allowing it to control the user's focus autonomously.

Hooks provide timing signals, MCP provides Flumen data and actions, and the user remains the final authority:

> Hooks notice. Agents propose. Users decide. Flumen records.

### Candidate workflow

1. When an agent session begins, a hook prompts the agent to read Flumen's current task and timer status.
2. Once meaningful work is identified, the agent proposes a task, project, historical estimate, and timer action.
3. The user confirms before Flumen creates the task or starts the timer.
4. During longer work, the agent may re-read Flumen at meaningful phase boundaries rather than after every tool call.
5. Before the agent finishes, a lifecycle hook or agent instruction prompts it to reconcile the session.
6. The agent proposes continuing, pausing, logging, or completing the work; the user confirms the final action.

Agent-session events are not evidence of focused work. Opening an agent must not automatically start a timer, and an agent's `stop` or completion event must not automatically complete a Flumen task.

### Client experiments

- **Cursor Hooks:** Explore `sessionStart` for initial awareness, `beforeMCPExecution` for write approval, `afterMCPExecution` for authoritative results and deduplication, and `stop` or `afterAgentResponse` for a reconciliation reminder.
- **Claude Code:** Explore session, tool-use, stop, compaction, and MCP elicitation hooks.
- **Gemini CLI:** Explore `SessionStart`, `BeforeAgent`, MCP-matched tool hooks, `AfterAgent`, and compression events.
- **Codex CLI:** Explore session, prompt, MCP tool, permission, stop, and compaction hooks.
- **Clients without hooks:** Validate whether MCP tool descriptions, project instructions, and an explicit Flumen working-agreement prompt provide sufficient behavior.

Flumen's MCP server must remain useful without any hook integration. Hook configurations are optional client adapters, not part of Flumen's core protocol.

### Safety constraints

- Hooks may read status or create a non-mutating proposal, but must not write directly to Flumen.
- All writes pass through MCP and require explicit confirmation.
- Flumen must enforce confirmation independently of the client's hook or permission configuration.
- Repeated hook events and retries must not create duplicate tasks, logs, or timer transitions.
- Hook-triggered checks must be narrowly filtered and fast enough not to slow ordinary agent work.
- A current Flumen read is authoritative; context injected at session start may become stale.

### Validation plan

Test the workflow with users who already use both Flumen and a hook-capable agent client. Compare it with Flumen MCP without hooks.

The experiment succeeds if:

- users forget to start or reconcile materially fewer sessions;
- hook prompts occur at moments users consider relevant rather than distracting;
- users understand that agent completion is not task completion;
- duplicate or incorrect writes do not occur;
- the median confirmation flow remains faster than manually recreating the task and timer state;
- the workflow demonstrates repeated use beyond an initial novelty period;
- users prefer hooks to a simple explicit command such as “start this in Flumen.”

The experiment fails if hooks create frequent irrelevant prompts, encourage false logging, add noticeable latency, or save too little effort compared with native controls and explicit agent commands.

### Questions to verify

1. Which event best represents the start of meaningful work across different clients?
2. Is reconciliation more useful before the final agent response or after the agent stops?
3. Can one confirmation cover task creation and timer start without becoming ambiguous?
4. Do users want project-level hook configuration, user-level configuration, or both?
5. How should agent and subagent events be deduplicated?
6. Are client-specific hook packs worth maintaining, or are shared MCP prompts sufficient?

## 11. Success Measures

Flumen does not use telemetry, so launch validation must use opt-in research, usability studies, and user-provided local summaries rather than silent product analytics.

### Pre-launch validation

- At least 8 of 10 target users can log a forgotten event through an agent without assistance.
- Median confirmed logging time is under 30 seconds.
- At least 80% of reconstructed proposals are accepted with no more than one correction.
- At least 4 of 5 users completing a weekly-review test prefer the MCP workflow to CSV reconciliation.
- Users can explain the difference between local MCP access and remote model processing after onboarding.

### Post-launch signals

- Qualitative reports show repeated weekly use, not only launch-day experimentation.
- Users report recovering work that otherwise would have remained unlogged.
- Users successfully create or update records in external tools from cited Flumen sessions.
- Confirmed estimates become closer to actual duration over repeated comparable tasks.
- Privacy or incorrect-write reports remain launch-blocking issues rather than accepted tradeoffs.

## 12. Out of Scope for v2

- A Flumen-hosted cloud or remote MCP relay.
- Accounts, team dashboards, or manager-facing surveillance.
- Autonomous writes without explicit confirmation.
- Passive IDE or application activity tracking.
- Replacing Monday.com, calendars, or full task-management systems.
- Notes, documents, embeddings, or general agent memory.
- Claims that Flumen can determine whether time was productive.
- Motivational coaching or hustle-oriented scoring.

## 13. Risks and Mitigations

### False historical records

Agents may infer the wrong task or duration. Require visible evidence, mark inferred fields, use ranges where appropriate, and require confirmation.

### Confirmation fatigue

Confirming every action may reduce the benefit of automation. Keep proposals grouped and concise for v2, then study whether narrowly scoped, revocable permissions are warranted later.

### Task Shelf pollution

Agents may import an entire backlog. Limit daily-plan proposals to near-term focus tasks and require individual confirmation.

### Privacy misunderstanding

Users may assume local MCP means their data never reaches a model provider. Explain the data path during setup and provide scoped permissions.

### Generic weekly summaries

An agent may produce plausible but unsupported narratives. Require every material claim or external work item to cite the contributing Flumen records.

### Platform dependency

Other MCP servers and clients vary in capability. Flumen should expose standards-compliant structured data without promising that every third-party integration or hook will behave identically.

## 14. Open Questions

1. Should meetings count toward focused time, or appear as a separate recorded-work category?
2. What is the minimum native confirmation experience that remains fast without weakening trust?
3. Should reconstructed entries store supporting evidence references, or only record that they were inferred?
4. How should overlapping calendar events and timer sessions be resolved?
5. What date range and data granularity should agents receive by default?
6. Should external work-item creation be part of launch testing even though it is performed by another MCP server?
7. How should estimate quality be evaluated when task titles are sparse or inconsistent?

## 15. Launch Narrative

**Primary promise:** Forgot to start your timer? Tell your agent what happened—or let it reconstruct the gap—and confirm the record in seconds.

**Supporting promise:** Turn your private focus history into a verified weekly work record without exporting and rebuilding a CSV.

**Long-term value:** Flumen gives agents the factual layer they lack: what the user intended to do, how long similar work actually took, and which work was truly recorded.

The message is not “AI controls your focus.” It is:

> Your agent understands the work. Flumen remembers the time. You remain in control.
