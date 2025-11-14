# DeepWiki Demo Config

This example integrates the public DeepWiki MCP server (documented at https://docs.devin.ai/work-with-devin/deepwiki-mcp) into Oplink.

## Files

- `.mcp-workflows/servers.json` – registers the HTTP endpoint `https://mcp.deepwiki.com/sse` under the alias `deepwiki`. No API key is required per the official docs.
- `.mcp-workflows/workflows.yaml` – includes a scripted workflow (`deepwiki_lookup`) that calls DeepWiki's `ask_question` tool behind the scenes.

## Usage

```bash
pnpm -r --filter ./packages/oplink dev -- --config examples/deepwiki-demo/.mcp-workflows
```

After Oplink starts, connect your MCP client and run:

```json
describe_tools({ "workflow": "deepwiki_lookup" })
```

You should see cached schemas for the DeepWiki alias along with the helper tools (`describe_tools`, `external_auth_setup`). Call the scripted workflow directly:

```json
deepwiki_lookup({ "repo": "facebook/react", "question": "What is concurrent mode?" })
```

If you prefer to expose every DeepWiki tool as its own MCP tool (e.g., `deepwiki.read_wiki_structure`), opt in by setting `OPLINK_AUTO_REGISTER_EXTERNAL_TOOLS=1` before starting Oplink. You can also expose the `oplink_info` debugging helper with `OPLINK_INFO_TOOL=1`.

```bash
OPLINK_AUTO_REGISTER_EXTERNAL_TOOLS=1 pnpm -r --filter ./packages/oplink dev -- --config examples/deepwiki-demo/.mcp-workflows
```
