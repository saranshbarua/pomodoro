# MCP icon source

`mcp-icon.png` (128×128) is derived from `marketing/branding/assets/logo-mark.png`.

The packaged helper embeds this PNG as a SEP-973 `data:image/png;base64,...` URI in `FlumenMCPIcons.swift`, so `Contents/Helpers/flumen-mcp` stays self-contained.

To regenerate after a brand update:

```bash
sips -z 128 128 marketing/branding/assets/logo-mark.png \
  --out macos/Pomodoro/MCP/Resources/mcp-icon.png
# then refresh the base64 constant in FlumenMCPIcons.swift
```
