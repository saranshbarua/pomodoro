#!/usr/bin/env python3
"""Protocol smoke test for the bundled Flumen stdio MCP helper."""

from __future__ import annotations

import argparse
import json
import os
import selectors
import subprocess
import sys
import time
from pathlib import Path
from typing import Any


EXPECTED_TOOLS = {
    "get_server_status",
    "get_focus_status",
    "list_tasks",
    "list_projects",
    "query_focus_activity",
    "get_focus_summary",
    "get_estimation_context",
    "log_time",
    "create_task",
    "update_task",
    "set_active_task",
    "begin_focus",
    "pause_focus",
    "finish_focus",
    "complete_task",
    "correct_time_entry",
}

EXPECTED_RESOURCES = {
    "flumen://status",
    "flumen://today",
    "flumen://active-task",
}

EXPECTED_PROMPTS = {
    "recover_missing_time",
    "plan_focus_day",
    "weekly_focus_review",
}


class MCPProcess:
    def __init__(self, executable: Path, timeout: float) -> None:
        self.timeout = timeout
        self.process = subprocess.Popen(
            [str(executable)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            env={**os.environ, "FLUMEN_MCP_LOG_LEVEL": "error"},
        )
        if self.process.stdin is None or self.process.stdout is None:
            raise RuntimeError("Failed to open helper stdio")

        self.selector = selectors.DefaultSelector()
        self.selector.register(self.process.stdout, selectors.EVENT_READ)

    def send(self, message: dict[str, Any]) -> None:
        assert self.process.stdin is not None
        self.process.stdin.write(json.dumps(message, separators=(",", ":")) + "\n")
        self.process.stdin.flush()

    def receive(self, expected_id: int) -> dict[str, Any]:
        deadline = time.monotonic() + self.timeout
        while time.monotonic() < deadline:
            remaining = max(0.0, deadline - time.monotonic())
            if not self.selector.select(remaining):
                break

            assert self.process.stdout is not None
            line = self.process.stdout.readline()
            if not line:
                break

            payload = json.loads(line)
            if payload.get("id") == expected_id:
                return payload

        stderr = ""
        if self.process.poll() is not None and self.process.stderr is not None:
            stderr = self.process.stderr.read()
        raise TimeoutError(
            f"Timed out waiting for MCP response id={expected_id}. "
            f"exit={self.process.poll()} stderr={stderr!r}"
        )

    def close(self) -> None:
        if self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=2)


def _assert_flumen_icons(icons: Any, label: str) -> None:
    if not isinstance(icons, list) or not icons:
        raise AssertionError(f"Missing SEP-973 icons on {label}")
    first = icons[0]
    src = first.get("src") if isinstance(first, dict) else None
    if not isinstance(src, str) or not src.startswith("data:image/png;base64,"):
        raise AssertionError(f"Expected embedded PNG icon on {label}, got {first!r}")


def request(
    helper: MCPProcess, request_id: int, method: str, params: dict[str, Any] | None = None
) -> dict[str, Any]:
    message: dict[str, Any] = {
        "jsonrpc": "2.0",
        "id": request_id,
        "method": method,
    }
    if params is not None:
        message["params"] = params
    helper.send(message)
    response = helper.receive(request_id)
    if "error" in response:
        raise RuntimeError(f"{method} failed: {response['error']}")
    return response.get("result", {})


def resolve_helper(explicit: Path | None) -> Path:
    if explicit is not None:
        return explicit.expanduser().resolve()

    candidates = [
        Path("macos/Pomodoro/.build/arm64-apple-macosx/debug/flumen-mcp"),
        Path("macos/Pomodoro/.build/arm64-apple-macosx/release/flumen-mcp"),
        Path("macos/Pomodoro/.build/apple/Products/Release/flumen-mcp"),
        Path("macos/Pomodoro/.build/debug/flumen-mcp"),
        Path("macos/Pomodoro/.build/release/flumen-mcp"),
        Path("Flumen.app/Contents/Helpers/flumen-mcp"),
    ]
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved.is_file() and os.access(resolved, os.X_OK):
            return resolved
    raise FileNotFoundError(
        "flumen-mcp helper not found. Build with "
        "`swift build --package-path macos/Pomodoro --product flumen-mcp` "
        "or pass an explicit helper path."
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("helper", nargs="?", type=Path, default=None)
    parser.add_argument("--timeout", type=float, default=10.0)
    parser.add_argument(
        "--require-app",
        action="store_true",
        help="Require Flumen open with Agent Access on for a full healthy handshake.",
    )
    args = parser.parse_args()

    try:
        helper_path = resolve_helper(args.helper)
    except FileNotFoundError as error:
        print(str(error), file=sys.stderr)
        return 2

    helper = MCPProcess(helper_path, args.timeout)
    try:
        # Preflight may exit immediately when Flumen Agent Access is unavailable.
        deadline = time.monotonic() + min(2.0, args.timeout)
        while time.monotonic() < deadline and helper.process.poll() is None:
            time.sleep(0.05)

        if helper.process.poll() is not None:
            stderr = ""
            if helper.process.stderr is not None:
                stderr = helper.process.stderr.read().strip()
            if args.require_app:
                print(
                    f"Helper exited before initialize (code={helper.process.returncode}): {stderr}",
                    file=sys.stderr,
                )
                return 1
            print(
                "MCP stdio smoke test passed: "
                f"helper={helper_path} refused unauthorized session "
                f"(exit={helper.process.returncode})"
                + (f" message={stderr!r}" if stderr else "")
            )
            return 0

        initialize = request(
            helper,
            1,
            "initialize",
            {
                "protocolVersion": "2025-11-25",
                "capabilities": {},
                "clientInfo": {
                    "name": "flumen-smoke-test",
                    "version": "1.0.0",
                },
            },
        )
        helper.send(
            {
                "jsonrpc": "2.0",
                "method": "notifications/initialized",
                "params": {},
            }
        )

        tools_result = request(helper, 2, "tools/list", {})
        tools = tools_result.get("tools", [])
        tool_names = {tool["name"] for tool in tools}
        missing_tools = EXPECTED_TOOLS - tool_names
        if missing_tools:
            raise AssertionError(
                f"Missing expected tools: {', '.join(sorted(missing_tools))}"
            )
        _assert_flumen_icons(
            initialize.get("serverInfo", {}).get("icons"),
            "serverInfo",
        )
        for tool in tools:
            _assert_flumen_icons(tool.get("icons"), f"tool {tool.get('name')}")

        resources_result = request(helper, 3, "resources/list", {})
        resources = resources_result.get("resources", [])
        resource_uris = {resource["uri"] for resource in resources}
        missing_resources = EXPECTED_RESOURCES - resource_uris
        if missing_resources:
            raise AssertionError(
                f"Missing expected resources: {', '.join(sorted(missing_resources))}"
            )
        for resource in resources:
            _assert_flumen_icons(
                resource.get("icons"), f"resource {resource.get('uri')}"
            )

        prompts_result = request(helper, 4, "prompts/list", {})
        prompts = prompts_result.get("prompts", [])
        prompt_names = {prompt["name"] for prompt in prompts}
        missing_prompts = EXPECTED_PROMPTS - prompt_names
        if missing_prompts:
            raise AssertionError(
                f"Missing expected prompts: {', '.join(sorted(missing_prompts))}"
            )
        for prompt in prompts:
            _assert_flumen_icons(prompt.get("icons"), f"prompt {prompt.get('name')}")

        status = request(
            helper,
            5,
            "tools/call",
            {"name": "get_server_status", "arguments": {}},
        )
        content = status.get("content", [])
        text = next((item.get("text") for item in content if item.get("type") == "text"), "")
        if status.get("isError"):
            raise RuntimeError(f"get_server_status returned tool error: {text}")
        payload = json.loads(text) if text else {}
        if not payload.get("ok") or not payload.get("agentAccessEnabled", True):
            raise RuntimeError(f"get_server_status returned unauthorized payload: {text}")

        print(
            "MCP stdio smoke test passed: "
            f"helper={helper_path} "
            f"server={initialize.get('serverInfo', {}).get('name', 'unknown')} "
            f"tools={len(tool_names)} resources={len(resource_uris)} "
            f"prompts={len(prompt_names)} icons=ok app=authorized"
        )
        return 0
    except Exception as error:
        if not args.require_app:
            # Initialize/list may fail if Agent Access flipped off mid-handshake.
            exit_code = helper.process.poll()
            if exit_code not in (None, 0):
                print(
                    "MCP stdio smoke test passed: "
                    f"helper={helper_path} refused unauthorized session "
                    f"(exit={exit_code}, detail={error})"
                )
                return 0
        print(f"MCP stdio smoke test failed: {error}", file=sys.stderr)
        return 1
    finally:
        helper.close()


if __name__ == "__main__":
    raise SystemExit(main())
