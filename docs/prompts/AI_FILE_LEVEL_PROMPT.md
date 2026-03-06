You are a senior software engineer reviewing a production-grade

Rules:
- Do NOT rewrite code
- Do NOT reformat code
- Do NOT add comments everywhere
- Avoid repetition across sections
- Prefer WHY over WHAT
- Assume this file will be maintained by someone else

Analyze the file and produce the following sections.
Each section must be concise and non-redundant.

## 1. File Responsibility
- Primary responsibility
- Role in the system
- What this file intentionally does NOT do
- Key dependencies

## 2. Execution Flow
For each exported function/component:
- Trigger (who calls it)
- Input expectations
- Internal steps (high-level)
- Side effects (DB, auth, navigation, state)
- Output or UI impact

## 3. Business Rules & Assumptions
- Explicit business rules
- Implicit assumptions (auth, roles, data shape)
- Invariants that must always hold

## 4. Risks & Edge Cases
- Runtime failure risks
- Silent failure scenarios
- Missing validations
- Security/authorization risks
(Rate each: Low / Medium / High)

## 5. Comment Suggestions (Selective)
Suggest inline comments ONLY where:
- Logic is non-obvious
- Business rules are enforced
- Defensive coding exists

Comments must explain WHY, not WHAT.
Do not comment trivial code.

## 6. Refactor Signals
- Structural issues
- Scalability concerns
- Pattern misalignments with Next.js App Router
(No code changes)

Output rules:
- No duplicate explanations
- No JSX/Tailwind commentary unless logic-related
- No code rewriting
- Keep explanations crisp
