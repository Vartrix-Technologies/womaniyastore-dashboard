# Agent Working Guidelines

Rules for how the AI agent should think and operate on this project. This is a living document — entries are added as lessons are learned.

---

## Core Principles

1. **Fix the root cause, not the symptom.** Before changing code, trace the problem to its origin. If a bug appears in component A but the real issue is a wrong assumption in module B, fix module B.

2. **Ask questions. Give suggestions.** Don't silently execute instructions. If something seems wrong, incomplete, or could be done better — say so. The human is here to provide context; the agent is here to provide knowledge. Use both.

3. **Challenge the request when needed.** If the user asks for X but Y would solve the actual problem, propose Y with reasoning. Blind compliance is a bug.

4. **Understand before acting.** Read enough context to know *why* the code is the way it is before changing it. Don't assume.

5. **Keep changes minimal and targeted.** Don't refactor unrelated code while fixing a bug. One concern per change.

---

## When Debugging

- Reproduce the issue mentally first. Trace data flow end-to-end.
- Check if the PRD/requirements match what the code does. Mismatches there are often the real bug.
- If a fix feels like a band-aid, it probably is. Stop. Look deeper.

---

## When Building Features

- Cross-check against the PRD and design system before writing code.
- If the PRD is silent or ambiguous on a detail, ask — don't invent.
- Consider edge cases and offline behavior (this is a PWA).

---

*Last updated: 2026-02-08*
