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
Example 1 – Frontend Debugger

#description
Turn Chrome DevTools MCP into a single `take_screenshot` workflow that agents can call to navigate, wait for content, and capture screenshots.

#slots
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
#title
Example 2 – Repository Q&A with DeepWiki

#description
Ask structured questions about any GitHub repo via DeepWiki, but expose it as a single `deepwiki_lookup` workflow in your IDE.

#slots
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
#title
Example 3 – Universal Helper Across Servers

#description
Use one workflow to route calls to tools from multiple MCP servers (e.g., Chrome DevTools + DeepWiki), with discovery via `describe_tools`.

#slots
  :::prose-pre
  ---
  code: |
    # .mcp-workflows/workflows.yaml
    universal_helper:
      description: "Proxy Chrome DevTools + DeepWiki tools"
      prompt: |
        Accept a JSON object with:
          - tool: the tool name to run
          - server (optional): alias when tool is not prefixed
          - args (optional): arguments for the tool call
        Use describe_tools({ "workflow": "universal_helper" }) to discover tools.
      externalServers:
        - chrome-devtools
        - deepwiki
  filename: .mcp-workflows/workflows.yaml
  ---
  ```yaml
  universal_helper:
    description: "Proxy Chrome DevTools + DeepWiki tools"
    prompt: |
      Accept a JSON object with:
        - tool: the tool name to run
        - server (optional): alias when tool is not prefixed
        - args (optional): arguments for the tool call
      Use describe_tools({ "workflow": "universal_helper" }) to discover tools.
    externalServers:
      - chrome-devtools
      - deepwiki
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
