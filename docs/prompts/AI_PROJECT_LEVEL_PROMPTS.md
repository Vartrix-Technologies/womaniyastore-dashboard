# AI Project-Level Documentation Prompts

You are acting as a Principal Engineer documenting a real-world system.

Audience:
- Future maintainers
- Tech leads
- The original author after 6–12 months

Assume zero context.

## Prompt 1: System Overview

Provide:
1. High-level architecture of the application
2. Major subsystems and their responsibilities
3. How Next.js, Supabase, and Tailwind interact
4. Runtime execution model (server vs client)

Use clear sections and bullet points.

## Prompt 2: Authentication & Session Flow

Explain:
1. How authentication is initialized
2. How sessions are stored and restored
3. How protected routes are enforced
4. How roles/permissions are applied
5. Common auth failure scenarios

## Prompt 3: Data Flow & Ownership

Describe:
1. How data flows from UI → backend → Supabase → UI
2. Which layer owns validation
3. Where transformations happen
4. How errors propagate back to UI

## Prompt 4: Domain & Responsibilities

Identify:
1. Core business domains
2. Domain boundaries
3. Shared vs isolated logic
4. Files or folders acting as domain owners

## Prompt 5: Invariants & Contracts

List:
1. Data invariants that must never break
2. API contracts assumed by frontend
3. Authorization assumptions
4. Environment assumptions

## Prompt 6: Deployment & Runtime

Explain:
1. Environment variables and purpose
2. Local vs production differences
3. Supabase configuration dependencies
4. Known deployment pitfalls

## Prompt 7: Handover Guide

Create:
- First 2-hour onboarding plan
- Files to read first
- Areas to avoid touching initially
- Debugging tips
- Common mistakes