# Agents

## Cursor Cloud specific instructions

Flumen is a macOS menu-bar focus timer. The frontend (React 19 + TypeScript + Vite) runs on any platform; the native Swift wrapper requires macOS with Xcode.

### Quick reference

| Action | Command |
|--------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` (serves at `localhost:5173`) |
| Type check | `npx tsc --noEmit` |
| Tests | `npx vitest --run` |
| Build | `npm run build` |

### Notes

- The pre-commit hook runs `npx tsc --noEmit && npm test -- --run`. Both must pass before committing.
- The Swift/native layer (`macos/Pomodoro/`) cannot build on Linux — only frontend dev is possible in Cloud Agent VMs.
- The frontend communicates with the native layer via a `window.webkit.messageHandlers` bridge. In browser dev mode, `src/test/setup.ts` mocks this bridge, and the app gracefully degrades (no native persistence, no menu-bar features).
- No Docker, databases, or external services are required for frontend development and testing.
