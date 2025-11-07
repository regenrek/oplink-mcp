use linear get all issues assignee = kevin
and save each of them to my stories/<issuename>
and save the name to variable {{ISSUE_PATH_FILE}}


## STEP 1.

use the following layout

<layout>
  <full_ticket_description>
    {{ ADD HERE FULL TICKET DESC }}
  </full_ticket_description>


  <explanation>
   ... Add here an explanation according to my current codebase...
   which files do i need to touch.
  </explanation>
</layout>


## STEP 2

Call `codex "/plan-review read {{ISSUE_PATH_FILE}} and save the review as new plan in docs/stories/{{ISSUE_PATH_FILE}}-reviewed.md`

