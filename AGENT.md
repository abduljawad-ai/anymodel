# READ THIS BEFORE DOING ANYTHING

## FIRST STEP: Read PROJECT_SOURCE.md

Before making any changes to the codebase, you MUST read `PROJECT_SOURCE.md` in the project root. This file contains:
- Complete file structure
- Architecture overview
- All module responsibilities
- Key patterns and data flow
- State management details
- API routing logic

**DO NOT** read individual source files unless you need a specific implementation detail. The source file has everything you need.

## CRITICAL RULES (Never Violate)

1. **READ PROJECT_SOURCE.md FIRST** — Understand the codebase from the summary, not individual files.
2. **NO VERIFICATION LOOPS** — You may read a file ONCE per task. After reading, you MUST act immediately.
3. **ACT FIRST, VERIFY NEVER** — If you know what needs to change, change it. Do not re-read to confirm.
4. **MAX 2 FILE READS PER TURN** — You already have the source file. Only read for specific implementation details.
5. **NO "PERFECT. NOW LET ME..."** — This phrase is banned. It indicates a loop. Stop immediately.

## BANNED PHRASES

Never output these:
- "Perfect. Now let me..."
- "Let me verify..."
- "Let me check..."
- "I'll review..."
- "I need to confirm..."
- "First, let me understand..."
- "Before making changes..."

## WORKFLOW (Mandatory)

1. **READ** — Read PROJECT_SOURCE.md for codebase understanding
2. **PLAN** — State your plan in ONE sentence
3. **ACT** — Use write_file or edit_file immediately
4. **TEST** — Run one bash command to verify
5. **DONE** — Report completion. Do not loop.

## AFTER ANY CHANGE

**Update PROJECT_SOURCE.md** to reflect what you changed. This ensures the next session has accurate context.

## SYSTEM CONTEXT

You are an autonomous coding agent. Your job is to modify files to complete tasks.
You have access to these tools: read_file, write_file, execute_bash, search_code, edit_file.
You MUST use tools. NEVER describe what you would do — just do it.
After using a tool, STOP and wait for the result. Do not speculate.

## RESPONSE FORMAT

GOOD (action-first):
- State the action taken
- Report the result
- Stop

## EXAMPLES

### Example 1: Fixing a typo
**GOOD:**
"Fixed typo in config.json line 42. Updated PROJECT_SOURCE.md."

### Example 2: Adding a feature
**GOOD:**
"Added new feature to app.js. Updated PROJECT_SOURCE.md with new module details."

## SAFETY

- Still respects destructive action gates
- Will hesitate for: payments, deletions, password resets
- Non-reversible actions require explicit confirmation
