---
seo:
  title: OPLINK - Better Tools for Developers
  description: OPLINK helps developers work smarter by connecting AI tools right in your code editor.
---

::u-page-hero
---
orientation: horizontal
---
  :::prose-pre
  ---
  code: npx -y oplink@latest server --config ./.mcp-workflows
  filename: Terminal
  ---
  ```bash
  npx -y oplink@latest server --config ./.mcp-workflows
  ```
  :::

#title
OPLINK – MCP Server for Workflows

#description
OPLINK is an MCP server that sits between your IDE and multiple MCP servers. It reads simple YAML workflow definitions and exposes them as a single, coherent tool surface in your editor.

#links
  :::u-button
  ---
  size: xl
  to: /getting-started
  trailing-icon: i-lucide-arrow-right
  color: primary
  ---
  Get started
  :::

  :::u-button
  ---
  color: neutral
  icon: i-simple-icons-github
  size: xl
  target: _blank
  to: https://github.com/regenrek/oplink
  variant: subtle
  ---
  GitHub
  :::
::

::u-page-section
#title
Workflows on Top of Your MCP Servers

#links
  :::u-button
  ---
  color: neutral
  size: lg
  target: _blank
  to: https://github.com/regenrek/oplink
  trailingIcon: i-lucide-arrow-right
  variant: subtle
  ---
  See the Tool Library
  :::

#features
  :::u-page-feature
  ---
  icon: i-lucide-git-branch
  ---
  #title
  Connect Your MCP Servers
  
  #description
  Point OPLINK at `.mcp-workflows/servers.json` and combine multiple MCP servers behind one workflow hub.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-terminal
  ---
  #title
  Workflow Commands
  
  #description
  Call named workflows like `frontend_debugger` or `deepwiki_lookup` instead of raw tools.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-git-merge
  ---
  #title
  Share Your Setup
  
  #description
  Keep workflows in git so your team shares the same debugging, triage, and research flows.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-brain
  ---
  #title
  Smart Helpers
  
  #description
  Encode strategies, defaults, and multi‑step plans so agents don’t have to improvise every time.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-users
  ---
  #title
  Team Friendly
  
  #description
  Give teammates one MCP endpoint with curated workflows instead of a pile of servers.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-library
  ---
  #title
  Ready-Made Workflows
  
  #description
  Start from examples (DeepWiki, Chrome DevTools, Context7, Atlassian, etc.) and adapt them to your stack.
  :::
::

::u-page-section
  :::u-page-c-t-a
  ---
  links:
    - label: Get Started Now
      to: /getting-started
      target: _blank
      icon: i-lucide-arrow-right
      color: primary
    - label: GitHub
      to: https://github.com/regenrek/oplink
      target: _blank
      icon: i-simple-icons-github
      color: neutral
      variant: subtle
  description: OPLINK turns your MCP ecosystem into a coherent, versioned set of workflows that your IDE (and agents) can call with one server.
  title: Try OPLINK as your workflow MCP server
  variant: subtle
  ---
  :::
::
