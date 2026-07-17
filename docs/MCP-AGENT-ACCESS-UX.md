# Flumen v2: Agent Access UX Specification

**Status:** Implemented for v2  
**Related:** [MCP v2 PRD](MCP-V2-PRD.md), [MCP Setup Guide](MCP-SETUP.md)  
**Last updated:** July 16, 2026

## 1. Design Decision

Do not present the feature as a bare **Enable MCP Server** toggle.

“MCP server” describes the implementation, not the user benefit. It also makes a security-sensitive connection appear as simple as enabling sound effects. The user needs to understand whether agents can reach Flumen, what they can access, and whether anyone is connected.

Present the feature as **Agent Access**:

> Connect AI agents to your tasks and focus history.

The main Settings view should contain one compact disclosure row:

```text
AGENT ACCESS

Agent Access                              Ready  ›
Connect Cursor, Claude, and other agents
```

Selecting the row opens a dedicated Agent Access view. The enable/disable control, permissions, connected clients, and technical details live there.

This preserves the quiet Settings hierarchy while giving a consequential feature enough space to be understood.

## 2. Product Principles

### Human language first

Use “Agent Access” in navigation and onboarding. Use “MCP” only in setup instructions, technical details, and documentation.

### Status before configuration

The first thing users should understand is whether access is off, ready, connected, or unavailable. Do not make them interpret a URL, process ID, or port.

### Progressive disclosure

Most users start with **Add to Cursor** or **Copy Configuration**. Raw connection details belong behind **Connection Details**. Flumen does not detect installed agents or edit their config files.

### Private by architecture, clear in language

Explain that Flumen exposes data locally, while the connected agent may send selected data to its model provider. Never imply that local MCP access makes the model local.

### Proposals, not silent control

Describe change permission as **Allow Proposals**, not “write access.” Agents can propose a task, time entry, or timer action; Flumen still asks the user to confirm it.

## 3. Information Architecture

```text
Settings
└── Agent Access
    ├── Access status and master control
    ├── Connect an Agent
    │   ├── Add to Cursor
    │   ├── Copy Configuration
    │   └── Open Setup Guide
    ├── Permissions
    │   ├── Read Focus Data
    │   └── Allow Proposals
    ├── Active Connections
    └── Connection Details
        ├── Transport / helper path
        ├── Copy Server Command
        ├── Test Connection
        └── Disconnect Sessions
```

## 4. Main Settings Entry

Add a new section below the existing timer behavior settings and above the footer.

### Off

```text
AGENT ACCESS

Agent Access                                Off  ›
Connect agents to Flumen
```

### Enabled, no active client

```text
AGENT ACCESS

Agent Access                              Ready  ›
Waiting for a local connection
```

### Connected

```text
AGENT ACCESS

Agent Access                          Connected  ›
Cursor connected locally
```

### Attention required

```text
AGENT ACCESS

Agent Access                      Needs Attention ›
Flumen could not start agent access
```

Status must always include text. Color may reinforce state but must not be the only signal.

## 5. Agent Access Detail View

The detail view uses the same full-panel transition as the current Settings view. It should feel like a calm connection inspector, not a developer console.

### Header

```text
‹ Settings                         Agent Access
```

### Primary status card

```text
┌──────────────────────────────────────────────┐
│  ●  Ready for agents                        │
│     Available locally while Flumen is open  │
│                                      [ On ]  │
└──────────────────────────────────────────────┘
```

When connected:

```text
┌──────────────────────────────────────────────┐
│  ●  Cursor connected                        │
│     Local connection · active now           │
│                                      [ On ]  │
└──────────────────────────────────────────────┘
```

The master control belongs here rather than in the main Settings list because enabling access has permissions and privacy consequences.

### Primary actions

```text
[ Add to Cursor ]
[ Copy Configuration ]   [ Setup Guide ]
```

- **Add to Cursor** opens Cursor’s supported install deeplink and also copies it.
- **Copy Configuration** copies a generic stdio MCP JSON block for Claude Code, Codex, Gemini CLI, and other clients.
- **Setup Guide** opens [MCP-SETUP.md](MCP-SETUP.md).

Do not show a client picker, detect installed apps, or edit client config files.

### Permissions

```text
PERMISSIONS

Read Focus Data                         Required
Tasks, projects, sessions, and reports

Allow Proposals                         Allowed
Agents may propose changes; you confirm each one
```

For v2, **Read Focus Data** is required while Agent Access is on. **Allow Proposals** may be disabled independently.

Avoid a generic “full access” option. Do not offer autonomous control.

### Active connections

```text
ACTIVE CONNECTIONS

Cursor                                  Active now
[ Disconnect Sessions ]
```

Connections are informational and populated only after a real MCP handshake. Client names are self-reported and are not used for authorization.

**Disconnect Sessions** clears the active-connection list and cancels pending proposals. Turning Agent Access off also terminates the local socket immediately without changing tasks, logs, or timer state.

If a client does not identify itself, show **Local MCP Client**.

## 6. First-Time Enablement

Selecting **Turn On Agent Access** for the first time opens a short consent sheet before access becomes available.

### Step 1 — Explain the value

**Connect Flumen to your agent**

> Let supported agents read your current focus, help log forgotten work, and prepare proposals from your focus history.

Supporting points:

- Runs locally on this Mac.
- No Flumen account or cloud.
- Every change requires your confirmation.

Primary action: **Continue**  
Secondary action: **Not Now**

### Step 2 — Explain the boundary

**Your agent may use the data it reads**

> Flumen keeps your data on this Mac. A connected agent may send requested tasks or focus history to its model provider under that product's privacy terms.

Required acknowledgement:

- “I understand connected agents may process data outside Flumen.”

Primary action: **Turn On Agent Access**

Do not use a long legal document. Link to **Learn About Agent Privacy** for details.

After activation, keep the user on the Agent Access screen with **Add to Cursor**, **Copy Configuration**, and **Setup Guide** visible. Do not leave them on a technically enabled but unconfigured screen without a next action.

## 7. Connect an Agent

There is no client picker in v2. Setup is explicit and user-driven.

### Preferred setup flow

1. Show a short explanation that Flumen stays local and must remain open.
2. Offer **Add to Cursor** for Cursor users.
3. Offer **Copy Configuration** as the universal path for every other MCP client.
4. Provide **Open Setup Guide** for Claude Code, Codex, Gemini CLI, and troubleshooting.
5. Show **No agent is connected right now** until a handshake succeeds.
6. Confirm success by listing the self-reported client under Active Connections.

Example:

```text
Connect Cursor

Add Flumen as a local MCP server in Cursor.

[ Copy Configuration ]
[ Open Cursor Setup Guide ]

○ Waiting for Cursor…
```

On success:

```text
✓ Cursor connected

Flumen can now share focus data when you ask.

[ Done ]
```

Do not require users to manually understand ports, tokens, or JSON unless the known-client flow fails.

## 8. Connection Details

Place **Connection Details** in a collapsed disclosure near the bottom of the Agent Access view.

### Recommended v2 transport

Use a local **stdio** MCP helper for broad desktop-agent compatibility and to preserve Flumen's no-network architecture.

With stdio, the client starts the helper process. The Agent Access control does not literally start a listening server; it authorizes or rejects local helper connections. The UI should therefore say **Turn On Agent Access**, not “Start Server.”

The app should provide a client-ready configuration rather than asking users to assemble a command:

```text
CONNECTION DETAILS

Transport                              Local stdio
Server                                 Flumen MCP
Availability                           While Flumen is open

[ Copy MCP Configuration ]
[ Test Connection ]
```

An advanced disclosure may reveal the executable command:

```text
/Applications/Flumen.app/Contents/Helpers/flumen-mcp
```

The exact path is illustrative and must be confirmed by engineering.

v2 ships stdio only. Do not expose ports, tokens, or HTTP endpoints in the Agent Access UI.

## 9. State Model

### Off

- No agent may read or propose changes.
- Existing sessions are terminated.
- Main Settings status: **Off**.

### Starting

- Brief transitional state after activation.
- Label: **Preparing Agent Access…**
- Disable repeated toggle input.

### Ready

- Access is enabled.
- No client is currently connected.
- Label: **Ready for agents**.

### Connected

- At least one client has an active session.
- Show client identity when verified.

### Error

- Access could not initialize or the helper is unavailable.
- Label: **Agent Access unavailable**.
- Actions: **Try Again**, **Show Details**.

### App unavailable

If the v2 server requires Flumen to remain open, setup instructions must say so plainly. Do not imply that agents can reach Flumen after the app quits.

## 10. Disable and Reset Flows

### Turn off

If no client is connected, turn access off immediately and show a lightweight confirmation toast:

> Agent Access turned off.

If a client is connected, confirm:

**Turn off Agent Access?**

> Cursor will be disconnected. Agents will no longer be able to read Flumen or propose changes.

Actions: **Turn Off**, **Cancel**

### Reset access

Keep this in Connection Details as a destructive secondary action.

**Reset Agent Access?**

> This disconnects all agents and invalidates existing authorizations. You will need to connect them again.

Actions: **Reset Access**, **Cancel**

Resetting must not delete tasks, sessions, reports, or ordinary Flumen settings.

## 11. Happy Path

1. User opens Settings and selects **Agent Access — Off**.
2. User reads the two-step explanation and turns access on.
3. Flumen opens **Connect an Agent**.
4. User selects Cursor.
5. User copies the generated configuration into Cursor.
6. Flumen changes from **Waiting for Cursor…** to **Cursor connected**.
7. User asks Cursor, “What am I focused on?”
8. Cursor reads Flumen without additional friction.
9. Cursor later proposes an ad-hoc time entry.
10. Flumen or the MCP client presents the exact change for confirmation.
11. User approves, and Flumen confirms the recorded result.

Target setup time: under two minutes for a supported client.

## 12. Error Path

### Client does not connect

After a reasonable wait:

> Cursor hasn't connected yet.

Offer:

- **Copy Configuration Again**
- **Open Setup Guide**
- **Test Connection**
- **Show Technical Details**

Do not blame the user or display raw process errors first.

### Flumen is closed

The agent should receive a clear actionable error:

> Flumen is not available. Open Flumen on this Mac and try again.

### Permission denied

The agent should receive:

> Agent proposals are turned off in Flumen. You can enable them in Settings → Agent Access.

## 13. Accessibility and Interaction Requirements

- All status indicators include text and an accessible label.
- The master control exposes its current state to VoiceOver.
- Keyboard focus order follows status, primary action, permissions, clients, then advanced details.
- Buttons have a minimum 32-point target, with 44 points preferred for the primary action.
- Connection progress does not depend on animation; announce state changes through an ARIA live region.
- Technical commands wrap, remain selectable, and include an explicit copy button.
- Success and error states use iconography and language in addition to color.
- Respect Reduce Motion for panel transitions and connection-state animation.

## 14. Content Guidelines

### Use

- Agent Access
- Ready for agents
- Connected locally
- Read Focus Data
- Allow Proposals
- Connect an Agent
- Connection Details
- Turn Off Agent Access

### Avoid

- Start MCP daemon
- Bind address
- Expose database
- Full control
- AI-powered productivity
- Always-on server
- Secure, without explaining the specific protection

## 15. Validation Plan

This design is not validated. Test a mid-fidelity prototype with 5–8 agent-using Flumen users.

### Tasks

1. Enable Agent Access and connect Cursor.
2. Explain what Cursor can read and whether Flumen data may reach a remote model.
3. Disable change proposals while preserving read access.
4. Identify whether an agent is currently connected.
5. Disconnect and forget a configured client.
6. Recover from a failed connection using the available guidance.

### Success criteria

- At least 85% complete setup without assistance.
- Median supported-client setup time is under two minutes.
- At least 80% correctly explain the local-Flumen versus remote-model boundary.
- At least 90% can identify the current access state.
- No participant interprets **Allow Proposals** as permission for silent changes.
- No critical usability issue remains unresolved before implementation.
- Target SUS score: 80 or higher.

## 16. Open Engineering Questions

1. Can the MCP helper reliably identify the connecting client?
2. Will v2 use stdio only, or also support local Streamable HTTP?
3. Can Flumen safely offer automatic configuration for any supported client?
4. How will helper authorization be enforced when Agent Access is off?
5. Can active sessions be terminated immediately when access is disabled?
6. Where will client authorizations and secrets be stored?
7. Can a connection test distinguish configuration errors from Flumen being unavailable?
8. Does Flumen need to remain open, or can a signed helper launch it on demand?
