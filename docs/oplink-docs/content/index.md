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
  code: |
    npx -y oplink@latest server --config ./.mcp-workflows

    # .mcp-workflows/workflows.yaml
    frontend_debugger:
      description: "Debug frontend issues with Chrome DevTools"
      prompt: |
        Use Chrome DevTools MCP tools to inspect the page,
        capture screenshots, and list console or network logs.
      externalServers:
        - chrome-devtools
  filename: Terminal
  ---
  ```bash
  npx -y oplink@latest server --config ./.mcp-workflows

  # .mcp-workflows/workflows.yaml
  frontend_debugger:
    description: "Debug frontend issues with Chrome DevTools"
    prompt: |
      Use Chrome DevTools MCP tools to inspect the page,
      capture screenshots, and list console or network logs.
    externalServers:
      - chrome-devtools
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

#features
  :::u-page-feature
  ---
  icon: i-lucide-git-branch
  ---
  #title
  Connect MCP Servers
  
  #description
  Point OPLINK at `.mcp-workflows/servers.json` and combine multiple MCP servers behind one workflow hub.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-terminal
  ---
  #title
  Named Workflow Commands
  
  #description
  Call custom workflow names like `debug_frontend` or `research_repo` instead of juggling dozens of raw tools.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-git-merge
  ---
  #title
  Versioned Config
  
  #description
  Keep workflows in git so your team shares the same debugging, triage, and research flows.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-brain
  ---
  #title
  Encoded Strategies
  
  #description
  Encode multi‑step plans, defaults, and guardrails so agents don’t have to improvise every time.
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
#title
Examples
::

::u-page-section
---
orientation: horizontal
---
#title
Linear + Discord Integration

#description
Combine Linear issue management and Discord messaging into a single `linear_discord_helper` workflow. Use `describe_tools` to discover available tools, then route calls to either server.

#default
  :::prose-pre
  ---
  code: |
    # .mcp-workflows/workflows.yaml
    linear_discord_helper:
      description: "Access both Linear and Discord MCP tools"
      prompt: |
        Use Linear and Discord MCP tools together.
        Call describe_tools({ "workflow": "linear_discord_helper" }) first to see available tools.
        Then call this workflow with {"tool": "tool_name", "server": "linear" or "discord", "args": {...}}.
      externalServers:
        - linear
        - discord
  filename: .mcp-workflows/workflows.yaml
  ---
  ```yaml
  linear_discord_helper:
    description: "Access both Linear and Discord MCP tools"
    prompt: |
      Use Linear and Discord MCP tools together.
      Call describe_tools({ "workflow": "linear_discord_helper" }) first to see available tools.
      Then call this workflow with {"tool": "tool_name", "server": "linear" or "discord", "args": {...}}.
    externalServers:
      - linear
      - discord
  ```
  :::
::

::u-page-section
---
orientation: horizontal
---
#title
Frontend Debugger

#description
Turn Chrome DevTools MCP into a single `take_screenshot` workflow that agents can call to navigate, wait for content, and capture screenshots.

#default
  :::prose-pre
  ---
  code: |
    # .mcp-workflows/workflows.yaml
    take_screenshot:
      description: "Navigate and capture a screenshot"
      runtime: scripted
      parameters:
        url:
          type: string
          required: true
        wait_for:
          type: string
        format:
          type: string
          enum: [png, jpeg, webp]
          default: png
      steps:
        - call: chrome-devtools:navigate_page
          args:
            type: url
            url: "{{ url }}"
            ignoreCache: false
        - call: chrome-devtools:wait_for
          requires: wait_for
          args:
            text: "{{ wait_for }}"
            timeout: 10000
        - call: chrome-devtools:take_screenshot
          args:
            fullPage: true
            format: "{{ format }}"
  filename: .mcp-workflows/workflows.yaml
  ---
  ```yaml
  take_screenshot:
    description: "Navigate and capture a screenshot"
    runtime: scripted
    parameters:
      url:
        type: string
        required: true
      wait_for:
        type: string
      format:
        type: string
        enum: [png, jpeg, webp]
        default: png
    steps:
      - call: chrome-devtools:navigate_page
        args:
          type: url
          url: "{{ url }}"
          ignoreCache: false
      - call: chrome-devtools:wait_for
        requires: wait_for
        args:
          text: "{{ wait_for }}"
          timeout: 10000
      - call: chrome-devtools:take_screenshot
        args:
          fullPage: true
          format: "{{ format }}"
  ```
  :::
::

::u-page-section
---
orientation: horizontal
---
#title
Repository Q&A with DeepWiki

#description
Ask structured questions about any GitHub repo via DeepWiki, but expose it as a single `deepwiki_lookup` workflow in your IDE.

#default
  :::prose-pre
  ---
  code: |
    # .mcp-workflows/workflows.yaml
    deepwiki_lookup:
      description: "Ask DeepWiki a question about a GitHub repository"
      runtime: scripted
      parameters:
        repo:
          type: string
          description: "owner/repo, e.g. shadcn-ui/ui"
          required: true
        question:
          type: string
          description: "Question to ask about the repository"
          required: true
      steps:
        - call: deepwiki:ask_question
          args:
            repoName: "{{ repo }}"
            question: "{{ question }}"
  filename: .mcp-workflows/workflows.yaml
  ---
  ```yaml
  deepwiki_lookup:
    description: "Ask DeepWiki a question about a GitHub repository"
    runtime: scripted
    parameters:
      repo:
        type: string
        description: "owner/repo, e.g. shadcn-ui/ui"
        required: true
      question:
        type: string
        description: "Question to ask about the repository"
        required: true
    steps:
      - call: deepwiki:ask_question
        args:
          repoName: "{{ repo }}"
          question: "{{ question }}"
  ```
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
