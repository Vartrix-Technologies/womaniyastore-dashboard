# =============================================================================
# setup-client.ps1 — Womaniya POS: Per-client branding setup script (PowerShell)
#
# Usage:
#   .\scripts\setup-client.ps1 `
#     -Name "ClientStore" `
#     -FullName "ClientStore Dashboard" `
#     -ShortName "ClientStore" `
#     -LogoLetter "C" `
#     -Tagline "Quality You Can Trust." `
#     -ReceiptHeader "CLIENTSTORE" `
#     -IdbName "clientstore-db" `
#     -ApiAppName "clientstore"
#
# Required: -Name, -FullName, -ShortName, -LogoLetter, -Tagline,
#           -ReceiptHeader, -IdbName, -ApiAppName
# Optional: -BackupPrefix, -ThemeColor, -BgColor
# =============================================================================
[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $Name,
    [Parameter(Mandatory)] [string] $FullName,
    [Parameter(Mandatory)] [string] $ShortName,
    [Parameter(Mandatory)] [string] $LogoLetter,
    [Parameter(Mandatory)] [string] $Tagline,
    [Parameter(Mandatory)] [string] $ReceiptHeader,
    [Parameter(Mandatory)] [string] $IdbName,
    [Parameter(Mandatory)] [string] $ApiAppName,
    [string] $BackupPrefix = "",
    [string] $ThemeColor = "",
    [string] $BgColor = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ─── Helpers ──────────────────────────────────────────────────────────────────

function Write-Step($msg)    { Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host "[OK]    $msg" -ForegroundColor Green }
function Write-Warn($msg)    { Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Write-Fail($msg)    { Write-Host "[ERROR] $msg" -ForegroundColor Red }

function Replace-InFile {
    param([string]$FilePath, [string]$Pattern, [string]$Replacement)
    if (-not (Test-Path $FilePath)) {
        Write-Warn "File not found, skipping: $FilePath"
        return
    }
    $content = Get-Content $FilePath -Raw -Encoding UTF8
    $newContent = [regex]::Replace($content, $Pattern, $Replacement)
    if ($content -ne $newContent) {
        Set-Content -Path $FilePath -Value $newContent -Encoding UTF8 -NoNewline
    } else {
        Write-Warn "Pattern not matched (skipping): $Pattern"
    }
}

# ─── Derived values ───────────────────────────────────────────────────────────

$Slug = $ApiAppName.ToLower()
$LastEmailKey          = "${Slug}_last_email"
$ProfileCacheKey       = "${Slug}_profile"
$ColorPaletteKey       = "${Slug}_color_palette"
$InvCacheTsKey         = "${Slug}_inventory_cache_ts"
$CartStorageKey        = "${Slug}_cart"
if ($BackupPrefix -eq "") { $BackupPrefix = "${Slug}_backup" }
$SlugPkg = $Slug -replace '_', '-'  # npm package name uses hyphens

# ─── Header ───────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor White
Write-Host " Womaniya POS — Client Setup Script" -ForegroundColor White
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor White
Write-Host ""
Write-Host "  Brand name:       $Name"
Write-Host "  Full name:        $FullName"
Write-Host "  Short name:       $ShortName"
Write-Host "  Logo letter:      $LogoLetter"
Write-Host "  Tagline:          $Tagline"
Write-Host "  Receipt header:   $ReceiptHeader"
Write-Host "  IDB name:         $IdbName"
Write-Host "  API app name:     $ApiAppName"
Write-Host "  Backup prefix:    $BackupPrefix"
if ($ThemeColor) { Write-Host "  Theme color:      $ThemeColor" }
if ($BgColor)    { Write-Host "  BG color:         $BgColor" }
Write-Host ""

$RootDir = Split-Path -Parent $PSScriptRoot

# ─── Step 1: Update app.config.ts ─────────────────────────────────────────────

Write-Step "Step 1/5 — Updating app.config.ts"

$ConfigFile = Join-Path $RootDir "src\lib\config\app.config.ts"
if (-not (Test-Path $ConfigFile)) {
    Write-Fail "Config file not found: $ConfigFile"
    exit 1
}

# Each pattern captures (prefix)(old-value)(suffix) so we can replace only the value.
Replace-InFile $ConfigFile '(name: '"'"')[^'"'"']+('"'"')' "`${1}${Name}`${2}"
Replace-InFile $ConfigFile '(fullName: '"'"')[^'"'"']+('"'"')' "`${1}${FullName}`${2}"
Replace-InFile $ConfigFile '(shortName: '"'"')[^'"'"']+('"'"')' "`${1}${ShortName}`${2}"
Replace-InFile $ConfigFile '(description: '"'"')[^'"'"']+('"'"')' "`${1}${FullName} - Point of Sale and Inventory Management`${2}"
Replace-InFile $ConfigFile '(logoLetter: '"'"')[^'"'"']+('"'"')' "`${1}${LogoLetter}`${2}"
Replace-InFile $ConfigFile '(receiptHeader: '"'"')[^'"'"']+('"'"')' "`${1}${ReceiptHeader}`${2}"
Replace-InFile $ConfigFile '(tagline: '"'"')[^'"'"']+('"'"')' "`${1}${Tagline}`${2}"
Replace-InFile $ConfigFile '(logoAlt: '"'"')[^'"'"']+('"'"')' "`${1}${Name} Logo`${2}"
Replace-InFile $ConfigFile '(idbName: '"'"')[^'"'"']+('"'"')' "`${1}${IdbName}`${2}"
Replace-InFile $ConfigFile '(apiAppName: '"'"')[^'"'"']+('"'"')' "`${1}${ApiAppName}`${2}"
Replace-InFile $ConfigFile '(lastEmailKey: '"'"')[^'"'"']+('"'"')' "`${1}${LastEmailKey}`${2}"
Replace-InFile $ConfigFile '(profileCacheKey: '"'"')[^'"'"']+('"'"')' "`${1}${ProfileCacheKey}`${2}"
Replace-InFile $ConfigFile '(colorPaletteKey: '"'"')[^'"'"']+('"'"')' "`${1}${ColorPaletteKey}`${2}"
Replace-InFile $ConfigFile '(inventoryCacheTimestampKey: '"'"')[^'"'"']+('"'"')' "`${1}${InvCacheTsKey}`${2}"
Replace-InFile $ConfigFile '(cartStorageKey: '"'"')[^'"'"']+('"'"')' "`${1}${CartStorageKey}`${2}"
Replace-InFile $ConfigFile '(backupFilePrefix: '"'"')[^'"'"']+('"'"')' "`${1}${BackupPrefix}`${2}"

if ($ThemeColor) {
    Replace-InFile $ConfigFile '(themeColor: '"'"')[^'"'"']+('"'"')' "`${1}${ThemeColor}`${2}"
}
if ($BgColor) {
    Replace-InFile $ConfigFile '(backgroundColor: '"'"')[^'"'"']+('"'"')' "`${1}${BgColor}`${2}"
}

Write-Success "app.config.ts updated"

# ─── Step 2: Update offline.html ──────────────────────────────────────────────

Write-Step "Step 2/5 — Updating offline.html"

$OfflineFile = Join-Path $RootDir "public\offline.html"
if (Test-Path $OfflineFile) {
    Replace-InFile $OfflineFile '(<title>)[^<]+(</title>)' "`${1}${Name} - Offline`${2}"
    Replace-InFile $OfflineFile '(<div class="icon">)[^<]+(</div>)' "`${1}${LogoLetter}`${2}"
    Write-Success "offline.html updated"
} else {
    Write-Warn "public\offline.html not found — skipping"
}

# ─── Step 3: Update package.json ──────────────────────────────────────────────

Write-Step "Step 3/5 — Updating package.json"

$PackageFile = Join-Path $RootDir "package.json"
if (Test-Path $PackageFile) {
    Replace-InFile $PackageFile '("name":\s*")[^"]+(",?)' "`${1}${SlugPkg}`${2}"
    Write-Success "package.json updated (name: $SlugPkg)"
} else {
    Write-Warn "package.json not found — skipping"
}

# ─── Step 4: Run white-label check ────────────────────────────────────────────

Write-Step "Step 4/5 — Running white-label check (npm run check:white-label)"

Push-Location $RootDir
try {
    $checkOutput = & npm run check:white-label 2>&1
    $exitCode = $LASTEXITCODE
    if ($exitCode -eq 0) {
        Write-Success "White-label check passed — no hardcoded brand strings detected"
    } else {
        Write-Host ""
        Write-Host $checkOutput
        Write-Host ""
        Write-Warn "White-label check found violations. Review the output above and fix manually."
    }
} catch {
    Write-Warn "Could not run npm — skipping check. Run manually: npm run check:white-label"
} finally {
    Pop-Location
}

# ─── Step 5: Summary ──────────────────────────────────────────────────────────

Write-Step "Step 5/5 — Summary"

Write-Host ""
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor White
Write-Host " Setup Complete — Manual Steps Required" -ForegroundColor White
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor White
Write-Host ""
Write-Host "The following must be done manually:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Logo files — Replace with client's logos:"
Write-Host "       public\brand_logo_lightbg.png  (512x512, light background)"
Write-Host "       public\brand_logo_darkbg.png   (512x512, dark background)"
Write-Host ""
Write-Host "  2. App icons — Replace all 8 SVG files in:"
Write-Host "       public\icons\"
Write-Host ""
Write-Host "  3. Environment variables — Set in .env.local:"
Write-Host "       NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co"
Write-Host "       NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key"
Write-Host ""
Write-Host "  4. Color palette (optional) — If the client uses a non-teal brand color:"
Write-Host "       src\app\globals.css                   (CSS custom properties)"
Write-Host "       src\context\ThemeColorContext.tsx     (palette definitions)"
Write-Host "       src\lib\config\app.config.ts          (styles.brandHex)"
Write-Host ""
Write-Host "  5. Supabase backend — Run migrations and deploy edge functions:"
Write-Host "       supabase db push"
Write-Host "       supabase functions deploy create-user"
Write-Host "       supabase functions deploy complete-sale"
Write-Host "       supabase functions deploy add-stock-lot"
Write-Host "       supabase functions deploy auto-close-attendance"
Write-Host "       supabase functions deploy create-daily-checklists"
Write-Host ""
Write-Host "  6. Initial data — Create shop and superadmin account:"
Write-Host "       See supabase\create_superadmin.sql"
Write-Host ""
Write-Host "When ready, run: npm run build" -ForegroundColor Green
Write-Host ""
