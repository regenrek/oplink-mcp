---
title: Atlassian Integration
description: Integrate Jira and Confluence MCP servers for issue management and documentation
---

This example demonstrates how to integrate Atlassian Jira and Confluence MCP servers into Oplink workflows. The demo includes workflows for common Jira and Confluence operations.

## Overview

The Atlassian integration combines:

- **Jira MCP**: Issue management, search, creation, and updates
- **Confluence MCP**: Documentation search, page creation, and content management

## Prerequisites

### 1. Docker

The Atlassian MCP server runs as a Docker container. Ensure Docker is installed and running.

### 2. Atlassian API Tokens

#### For Atlassian Cloud (Recommended)

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **Create API token**
3. Name it (e.g., "Oplink MCP")
4. Copy the token immediately (you won't see it again)

You'll need separate tokens for Jira and Confluence if you use different accounts, or one token if using the same account.

#### For Server/Data Center

1. Go to your profile (avatar) → **Profile** → **Personal Access Tokens**
2. Click **Create token**
3. Name it and set expiry
4. Copy the token immediately

## Configuration

### Environment & .env (place in the config directory)

Create a `.env` file alongside `servers.json` in `examples/atlassian-demo/.mcp-workflows/`:

```bash
# Jira Cloud (option A)
JIRA_URL=https://your-company.atlassian.net
JIRA_USERNAME=your.email@company.com
JIRA_API_TOKEN=your_cloud_api_token

# Jira Server/Data Center (option B)
# JIRA_URL=https://jira.your-company.internal
# JIRA_PERSONAL_TOKEN=your_dc_pat
# JIRA_SSL_VERIFY=false

# Confluence Cloud (option A)
CONFLUENCE_URL=https://your-company.atlassian.net/wiki
CONFLUENCE_USERNAME=your.email@company.com
CONFLUENCE_API_TOKEN=your_confluence_cloud_token

# Confluence Server/Data Center (option B)
# CONFLUENCE_URL=https://confluence.your-company.internal
# CONFLUENCE_PERSONAL_TOKEN=your_dc_pat
# CONFLUENCE_SSL_VERIFY=false

# Optional: Filter by project keys (comma-separated)
# JIRA_PROJECTS_FILTER=PROJ,DEV,SUPPORT

# Optional: Filter by Confluence space keys (comma-separated)
# CONFLUENCE_SPACES_FILTER=DEV,TEAM,DOC
```

**Where to add keys:**

1. **Create `.env` file**: Copy `.env.example` to `.mcp-workflows/.env` (note the location)
2. **Fill in credentials**: Choose Cloud (A) or Server/DC (B) and set only the relevant vars
3. **Auto‑load**: Running with `--config examples/atlassian-demo/.mcp-workflows` auto‑loads `.env` from that folder

### Server Configuration (Cloud vs Server/DC)

Choose the block that matches your deployment.

Cloud (email + API token):

```json
{
  "servers": {
    "atlassian": {
      "type": "stdio",
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e", "JIRA_URL",
        "-e", "JIRA_USERNAME",
        "-e", "JIRA_API_TOKEN",
        "-e", "CONFLUENCE_URL",
        "-e", "CONFLUENCE_USERNAME",
        "-e", "CONFLUENCE_API_TOKEN",
        "ghcr.io/sooperset/mcp-atlassian:latest"
      ],
      "env": {
        "JIRA_URL": "${JIRA_URL}",
        "JIRA_USERNAME": "${JIRA_USERNAME}",
        "JIRA_API_TOKEN": "${JIRA_API_TOKEN}",
        "CONFLUENCE_URL": "${CONFLUENCE_URL}",
        "CONFLUENCE_USERNAME": "${CONFLUENCE_USERNAME}",
        "CONFLUENCE_API_TOKEN": "${CONFLUENCE_API_TOKEN}"
      }
    }
  }
}
```

Server/Data Center (personal token):

```json
{
  "servers": {
    "atlassian": {
      "type": "stdio",
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e", "JIRA_URL",
        "-e", "JIRA_PERSONAL_TOKEN",
        "-e", "JIRA_SSL_VERIFY",
        "-e", "CONFLUENCE_URL",
        "-e", "CONFLUENCE_PERSONAL_TOKEN",
        "-e", "CONFLUENCE_SSL_VERIFY",
        "ghcr.io/sooperset/mcp-atlassian:latest"
      ],
      "env": {
        "JIRA_URL": "${JIRA_URL}",
        "JIRA_PERSONAL_TOKEN": "${JIRA_PERSONAL_TOKEN:-}",
        "JIRA_SSL_VERIFY": "${JIRA_SSL_VERIFY:-false}",
        "CONFLUENCE_URL": "${CONFLUENCE_URL}",
        "CONFLUENCE_PERSONAL_TOKEN": "${CONFLUENCE_PERSONAL_TOKEN:-}",
        "CONFLUENCE_SSL_VERIFY": "${CONFLUENCE_SSL_VERIFY:-false}"
      }
    }
  }
}
```

## Workflows

### Auto-Discovery Workflows

These workflows expose all tools from the Atlassian MCP server:

- `atlassian_helper`: Access all Jira and Confluence tools
- `jira_helper`: Access Jira tools only
- `confluence_helper`: Access Confluence tools only

**Usage:**

1. Discover available tools:
   ```json
   describe_tools({ "workflow": "jira_helper" })
   ```

2. Call a tool:
   ```json
   jira_helper({
     "tool": "jira_search",
     "args": {
       "jql": "assignee = currentUser() AND status = 'In Progress'"
     }
   })
   ```

### Scripted Workflows

These workflows provide convenient wrappers for common Jira and Confluence operations:

#### `list_my_issues`

List issues assigned to you with compact output:

```json
list_my_issues({
  "project": "PROJ",
  "status": "In Progress",
  "max_results": 20
})
```


#### `search_issues_compact`

Search issues with JQL and get compact results:

```json
search_issues_compact({
  "jql": "project = PROJ AND created >= -7d ORDER BY updated DESC",
  "max_results": 50
})
```

#### `get_issue_summary`

Get a concise summary of a specific issue:

```json
get_issue_summary({
  "issue_key": "PROJ-123"
})
```

Returns only: key, summary, description (text only), status, priority, assignee, dates, labels, and URL.

#### `create_issue_from_notes`

Create a Jira issue from meeting notes or text:

```json
create_issue_from_notes({
  "project_key": "PROJ",
  "summary": "Fix authentication bug",
  "description": "Users cannot log in after password reset",
  "issue_type": "Bug",
  "priority": "High"
})
```

#### `update_issue_status`

Transition an issue to a new status:

```json
update_issue_status({
  "issue_key": "PROJ-123",
  "status": "In Progress"
})
```

#### `search_confluence_pages`

Search Confluence pages with compact output:

```json
search_confluence_pages({
  "query": "OKR guide",
  "space_key": "TEAM",
  "limit": 20
})
```

#### `get_confluence_page_content`

Get page content with HTML stripped and formatted:

```json
get_confluence_page_content({
  "page_id": "123456789"
})
```


## Usage

1. **Provide credentials:**
   - Put them in `examples/atlassian-demo/.env` (recommended; auto‑loaded), or
   - Export them in your shell: `export $(cat examples/atlassian-demo/.env | xargs)`

2. **Start Oplink:**
   ```bash
   pnpm -r --filter ./packages/oplink dev -- --config examples/atlassian-demo/.mcp-workflows
   ```

3. **In your MCP client:**
   - Connect to the running Oplink server
   - Use `describe_tools` to discover available tools
   - Call workflows with appropriate parameters

## Example Workflows

### Daily Standup Preparation

1. **List your in-progress issues:**
   ```json
   list_my_issues({
     "status": "In Progress",
     "max_results": 10
   })
   ```

2. **Get details for a specific issue:**
   ```json
   get_issue_summary({
     "issue_key": "PROJ-123"
   })
   ```

### Meeting Notes to Jira

1. **Create issues from meeting notes:**
   ```json
   create_issue_from_notes({
     "project_key": "PROJ",
     "summary": "Implement user authentication",
     "description": "From sprint planning: Need to add OAuth2 support",
     "issue_type": "Story",
     "priority": "High"
   })
   ```

### Documentation Lookup

1. **Search Confluence:**
   ```json
   search_confluence_pages({
     "query": "deployment process",
     "space_key": "DEV"
   })
   ```

2. **Get page content:**
   ```json
   get_confluence_page_content({
     "page_id": "123456789"
   })
   ```

## Troubleshooting

- **"Missing environment variable"**: Ensure all required variables exist in the example `.env` (or are exported in your shell). Oplink auto‑loads `.env` from the example config directory.
- **"Docker not found"**: Ensure Docker is installed and running
- **"Authentication failed"**: Verify your API tokens are correct and not expired
- **"Permission denied"**: Ensure your Atlassian account has access to the projects/spaces you're trying to access
- **"Tool not found"**: Use `describe_tools` to verify the exact tool names exposed by the server

## Notes

- **API Tokens vs Passwords**: Use API tokens, not your account password
- **Token Security**: Never commit `.env` files to version control
- **Cloud vs Server/DC**: Use only one set of env vars (Cloud or DC). If you see errors like `Error calling tool 'search'` with `${JIRA_URL}` literal, ensure `.env` is inside `.mcp-workflows/` and DC variables are set when using Server/Data Center.
- **Project/Space Filters**: Use `JIRA_PROJECTS_FILTER` and `CONFLUENCE_SPACES_FILTER` to limit access
- **Read-Only Mode**: Set `READ_ONLY_MODE=true` in your environment to disable write operations
- **Tool Filtering**: Use `ENABLED_TOOLS` environment variable to restrict which tools are available
