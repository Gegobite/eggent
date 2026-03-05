# Changelog

All notable changes to this project will be documented in this file.

## [0.1.1] - 2026-03-03

### Added
- `PUT /api/projects/[id]/mcp` endpoint for saving raw MCP config content.
- Inline MCP JSON editor with save/reset in `Dashboard -> MCP`.
- Inline MCP JSON editor with save/reset in project details context panel.
- Editable project instructions with save/reset in project details.
- Release documentation set in `docs/releases/`.

### Changed
- MCP content validation and normalization before writing `.meta/mcp/servers.json`.
- Package/app health version updated to `0.1.1`.
