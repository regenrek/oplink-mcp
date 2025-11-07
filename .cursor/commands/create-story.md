---
description: use this ALWAYS to create/update a story
globs: docs/stories/*.md
alwaysApply: false
---

# Sstep
1. create the <story>
2. use <send_to_linear>

<story>
Use this template to create a new story for tracking in the `docs/stories` directory. 

# User Story: {{ID}} - {{TITLE}}

## Status: {{STATUS}}  
*(Valid values: TODO, IN PROGRESS, DONE)*

## Description:

As a {{USER_TYPE}}, I want {{FEATURE}} so that {{REASON}}.

## Acceptance Criteria:

- [ ] {{CRITERION_1}}
- [ ] {{CRITERION_2}}
- [ ] ...

## General Tasks:

- [ ] All requirements from the plan are implemented
- [ ] Code follows project style guidelines
- [ ] Tests are written and passing
- [ ] Documentation is updated
- [ ] Performance considerations addressed
- [ ] Security considerations addressed
- [ ] Code has been reviewed

## Sub Tasks:

- [ ] {{SUB_TASK_1}} - Status: {{SUB_TASK_1_STATUS}}

## Estimation: {{ESTIMATION}} story points  
*(Note: One step is 1 story point, which equals 1 day of work for a senior developer)*

## Developer Notes:
*(Note: Add here important learnings, necessary fixes, all other devs need to know to proceed)*

- {{NOTE_1}}
- {{NOTE_2}}
- ...

</story>

<send_to_linear>
use linear mcp create task 
</sent_to_linear>