# Flumen MCP Hooks Experiment

**Status:** Deferred post-core experiment  
**Related:** [MCP v2 PRD §10](MCP-V2-PRD.md), [ADR-007](MCP-ARCHITECTURE.md)

Hooks are optional. Core MCP must deliver forgotten-time logging, weekly review, daily planning, and estimation without Cursor/Claude/Gemini/Codex hooks.

## Rules

- Hooks may read Flumen status or suggest a proposal.
- Hooks never write directly or bypass Flumen confirmation.
- Opening an agent is not evidence that focus started.
- An agent stop event is not evidence that a task completed.
- Deduplicate conversation, generation, tool, and subagent events.
- Avoid automatic follow-up loops.

## Candidate signals

| Client | Signals to evaluate |
| --- | --- |
| Cursor | `sessionStart`, `beforeMCPExecution`, `afterMCPExecution`, stop/final-response reminders |
| Claude Code | session, tool-use, stop, compaction, elicitation |
| Gemini CLI | SessionStart, BeforeAgent, MCP-matched tool hooks, AfterAgent |
| Codex | session, prompt, MCP tool, permission, stop |

## Promotion criteria

Promote only if hooks reduce missed sessions without irrelevant prompts, latency, false logging, or confirmation fatigue compared with explicit “use Flumen MCP” commands.
