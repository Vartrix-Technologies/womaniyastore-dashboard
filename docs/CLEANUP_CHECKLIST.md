# Files to Delete - Cleanup Script

## Outdated/Conflicting Documentation (Delete These)

### Root Level Documentation
- [ ] README.md (default Next.js boilerplate, not useful)
- [ ] CODE_REVIEW_SUGGESTIONS.md (superseded by PROJECT_ANALYSIS_AND_ROADMAP.md)
- [ ] CRITICAL_FIXES_REQUIRED.md (outdated, conflicts with current state)
- [ ] PROJECT_STATUS.md (outdated, says "98% complete" which is misleading)
- [ ] COMPREHENSIVE_TESTING_GUIDE.md (premature, no tests exist yet)
- [ ] DEVELOPMENT_INTERVIEW_GUIDE.md (not part of the project)

### Agent Files (Not part of actual project)
- [ ] .github/agents/Womaniya Architect & Guardrails.agent.md
- [ ] .github/agents/Supabase Schema & RLS Guardian.agent.md
- [ ] .github/agents/PWA & Tablet UI UX Specialist.agent.md
- [ ] .github/agents/POS & Offline Sync Engineer.agent.md
- [ ] .github/agents/Finances & Reports Engineer.agent.md
- [ ] .github/agents/codeReview.md

### Empty Component Folders
- [ ] src/components/attendance/ (empty, use inline components)
- [ ] src/components/checklists/ (empty, use inline components)
- [ ] src/components/finance/ (empty, duplicate of finances/)
- [ ] src/components/finances/ (empty, use inline components)
- [ ] src/components/forms/ (empty, using react-hook-form inline)
- [ ] src/components/inventory/ (empty, use inline components)
- [ ] src/components/nav/ (empty, already have tablet/ folder)
- [ ] src/components/tables/ (empty, using shadcn/ui directly)

## Files to KEEP

### Essential Documentation
- ✅ UPDATED_REQUIREMENTS.md (source of truth)
- ✅ SUPABASE_SETUP_GUIDE.md (useful reference)
- ✅ QUICK_START.md (onboarding guide)
- ✅ PROJECT_ANALYSIS_AND_ROADMAP.md (comprehensive current analysis)
- ✅ ACTION_PLAN.md (current action plan)
- ✅ debug_database.sql (debugging helper)

### Project Files
- ✅ package.json
- ✅ next.config.ts
- ✅ tsconfig.json
- ✅ .env.local
- ✅ All source code files

## PowerShell Cleanup Script

```powershell
# Run this from project root to delete outdated files

# Delete outdated documentation
Remove-Item -Path "README.md" -Force
Remove-Item -Path "CODE_REVIEW_SUGGESTIONS.md" -Force
Remove-Item -Path "CRITICAL_FIXES_REQUIRED.md" -Force
Remove-Item -Path "PROJECT_STATUS.md" -Force
Remove-Item -Path "COMPREHENSIVE_TESTING_GUIDE.md" -Force
Remove-Item -Path "DEVELOPMENT_INTERVIEW_GUIDE.md" -Force

# Delete agent files
Remove-Item -Path ".github/agents" -Recurse -Force

# Delete empty component folders
Remove-Item -Path "src/components/attendance" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "src/components/checklists" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "src/components/finance" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "src/components/finances" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "src/components/forms" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "src/components/inventory" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "src/components/nav" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "src/components/tables" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "✅ Cleanup complete!" -ForegroundColor Green
```

## Bash Cleanup Script (Alternative)

```bash
#!/bin/bash
# Run this from project root to delete outdated files

# Delete outdated documentation
rm -f README.md
rm -f CODE_REVIEW_SUGGESTIONS.md
rm -f CRITICAL_FIXES_REQUIRED.md
rm -f PROJECT_STATUS.md
rm -f COMPREHENSIVE_TESTING_GUIDE.md
rm -f DEVELOPMENT_INTERVIEW_GUIDE.md

# Delete agent files
rm -rf .github/agents

# Delete empty component folders
rm -rf src/components/attendance
rm -rf src/components/checklists
rm -rf src/components/finance
rm -rf src/components/finances
rm -rf src/components/forms
rm -rf src/components/inventory
rm -rf src/components/nav
rm -rf src/components/tables

echo "✅ Cleanup complete!"
```

## After Cleanup, Your Documentation Should Be:

```
womaniya-dashboard/
├── ACTION_PLAN.md                        ← Current action plan (NEW)
├── PROJECT_ANALYSIS_AND_ROADMAP.md       ← Comprehensive analysis (NEW)
├── UPDATED_REQUIREMENTS.md               ← Source of truth
├── SUPABASE_SETUP_GUIDE.md              ← Reference
├── QUICK_START.md                        ← Onboarding
├── debug_database.sql                    ← Debug helper (NEW)
├── package.json
├── next.config.ts
└── ... (other project files)
```

Much cleaner and less confusing!
