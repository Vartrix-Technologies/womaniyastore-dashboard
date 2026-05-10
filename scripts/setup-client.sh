#!/usr/bin/env bash
# =============================================================================
# setup-client.sh — Womaniya POS: Per-client branding setup script
#
# Usage:
#   ./scripts/setup-client.sh \
#     --name "ClientStore" \
#     --full-name "ClientStore Dashboard" \
#     --short-name "ClientStore" \
#     --logo-letter "C" \
#     --tagline "Quality You Can Trust." \
#     --receipt-header "CLIENTSTORE" \
#     --idb-name "clientstore-db" \
#     --api-app-name "clientstore" \
#     --backup-prefix "clientstore_backup" \
#     --theme-color "#f0fdfa" \
#     --bg-color "#f0fdfa"
#
# Required args: --name, --full-name, --short-name, --logo-letter, --tagline,
#                --receipt-header, --idb-name, --api-app-name
# Optional args: --backup-prefix, --theme-color, --bg-color
# =============================================================================

set -euo pipefail

# ─── Helpers ──────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[OK]${NC}   $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*"; }

die() { log_error "$*"; exit 1; }

# Detect sed: GNU sed uses -i '' on BSD; BSD sed uses -i ''
# Use a temp file approach for cross-platform safety.
replace_in_file() {
  local file="$1" old="$2" new="$3"
  if [[ ! -f "$file" ]]; then
    log_warn "File not found, skipping: $file"
    return 0
  fi
  # Escape special characters for sed
  local escaped_old escaped_new
  escaped_old=$(printf '%s\n' "$old" | sed 's/[[\.*^$()+?{|]/\\&/g')
  escaped_new=$(printf '%s\n' "$new" | sed 's/[[\.*^$()+?{|]/\\&/g; s/&/\\&/g')
  sed -i.bak "s/${escaped_old}/${escaped_new}/g" "$file" && rm -f "${file}.bak"
}

# ─── Argument Parsing ─────────────────────────────────────────────────────────

BRAND_NAME=""
FULL_NAME=""
SHORT_NAME=""
LOGO_LETTER=""
TAGLINE=""
RECEIPT_HEADER=""
IDB_NAME=""
API_APP_NAME=""
BACKUP_PREFIX=""
THEME_COLOR=""
BG_COLOR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)           BRAND_NAME="$2";      shift 2 ;;
    --full-name)      FULL_NAME="$2";       shift 2 ;;
    --short-name)     SHORT_NAME="$2";      shift 2 ;;
    --logo-letter)    LOGO_LETTER="$2";     shift 2 ;;
    --tagline)        TAGLINE="$2";         shift 2 ;;
    --receipt-header) RECEIPT_HEADER="$2";  shift 2 ;;
    --idb-name)       IDB_NAME="$2";        shift 2 ;;
    --api-app-name)   API_APP_NAME="$2";    shift 2 ;;
    --backup-prefix)  BACKUP_PREFIX="$2";   shift 2 ;;
    --theme-color)    THEME_COLOR="$2";     shift 2 ;;
    --bg-color)       BG_COLOR="$2";        shift 2 ;;
    --help|-h)
      head -n 20 "$0" | grep -E "^#" | sed 's/^# //'
      exit 0
      ;;
    *) die "Unknown argument: $1. Run with --help for usage." ;;
  esac
done

# ─── Validation ───────────────────────────────────────────────────────────────

MISSING=()
[[ -z "$BRAND_NAME"      ]] && MISSING+=("--name")
[[ -z "$FULL_NAME"       ]] && MISSING+=("--full-name")
[[ -z "$SHORT_NAME"      ]] && MISSING+=("--short-name")
[[ -z "$LOGO_LETTER"     ]] && MISSING+=("--logo-letter")
[[ -z "$TAGLINE"         ]] && MISSING+=("--tagline")
[[ -z "$RECEIPT_HEADER"  ]] && MISSING+=("--receipt-header")
[[ -z "$IDB_NAME"        ]] && MISSING+=("--idb-name")
[[ -z "$API_APP_NAME"    ]] && MISSING+=("--api-app-name")

if [[ ${#MISSING[@]} -gt 0 ]]; then
  die "Missing required arguments: ${MISSING[*]}"
fi

# Derive internal key names from api-app-name slug
SLUG="${API_APP_NAME,,}"  # lowercase
LAST_EMAIL_KEY="${SLUG}_last_email"
PROFILE_CACHE_KEY="${SLUG}_profile"
COLOR_PALETTE_KEY="${SLUG}_color_palette"
INV_CACHE_TS_KEY="${SLUG}_inventory_cache_ts"
CART_STORAGE_KEY="${SLUG}_cart"
BACKUP_PREFIX="${BACKUP_PREFIX:-${SLUG}_backup}"

echo ""
echo -e "${BOLD}════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD} Womaniya POS — Client Setup Script${NC}"
echo -e "${BOLD}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Brand name:       ${BRAND_NAME}"
echo -e "  Full name:        ${FULL_NAME}"
echo -e "  Short name:       ${SHORT_NAME}"
echo -e "  Logo letter:      ${LOGO_LETTER}"
echo -e "  Tagline:          ${TAGLINE}"
echo -e "  Receipt header:   ${RECEIPT_HEADER}"
echo -e "  IDB name:         ${IDB_NAME}"
echo -e "  API app name:     ${API_APP_NAME}"
echo -e "  Backup prefix:    ${BACKUP_PREFIX}"
[[ -n "$THEME_COLOR" ]] && echo -e "  Theme color:      ${THEME_COLOR}"
[[ -n "$BG_COLOR"    ]] && echo -e "  BG color:         ${BG_COLOR}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ─── Step 1: Update app.config.ts ─────────────────────────────────────────────

CONFIG_FILE="${ROOT_DIR}/src/lib/config/app.config.ts"
log_info "Step 1/5 — Updating app.config.ts"

if [[ ! -f "$CONFIG_FILE" ]]; then
  die "Config file not found: ${CONFIG_FILE}"
fi

# Read current values to replace
# Strategy: use sed with line-awareness. Target lines matching the key patterns.

sed_inplace() {
  local pattern="$1" replacement="$2" file="$3"
  if grep -qE "$pattern" "$file"; then
    sed -i.bak -E "s|${pattern}|${replacement}|g" "$file" && rm -f "${file}.bak"
    return 0
  else
    log_warn "Pattern not matched (skipping): $pattern"
    return 0
  fi
}

# brand.name
sed_inplace "(name: ')[^']+(')" "\1${BRAND_NAME}\2" "$CONFIG_FILE"
# brand.fullName
sed_inplace "(fullName: ')[^']+(')" "\1${FULL_NAME}\2" "$CONFIG_FILE"
# brand.shortName
sed_inplace "(shortName: ')[^']+(')" "\1${SHORT_NAME}\2" "$CONFIG_FILE"
# brand.description — set to "FULL_NAME - Point of Sale"
sed_inplace "(description: ')[^']+(')" "\1${FULL_NAME} - Point of Sale and Inventory Management\2" "$CONFIG_FILE"
# brand.logoLetter
sed_inplace "(logoLetter: ')[^']+(')" "\1${LOGO_LETTER}\2" "$CONFIG_FILE"
# billing.receiptHeader
sed_inplace "(receiptHeader: ')[^']+(')" "\1${RECEIPT_HEADER}\2" "$CONFIG_FILE"
# billing.tagline
sed_inplace "(tagline: ')[^']+(')" "\1${TAGLINE}\2" "$CONFIG_FILE"
# billing.logoAlt
sed_inplace "(logoAlt: ')[^']+(')" "\1${BRAND_NAME} Logo\2" "$CONFIG_FILE"
# internal.idbName
sed_inplace "(idbName: ')[^']+(')" "\1${IDB_NAME}\2" "$CONFIG_FILE"
# internal.apiAppName
sed_inplace "(apiAppName: ')[^']+(')" "\1${API_APP_NAME}\2" "$CONFIG_FILE"
# internal.lastEmailKey
sed_inplace "(lastEmailKey: ')[^']+(')" "\1${LAST_EMAIL_KEY}\2" "$CONFIG_FILE"
# internal.profileCacheKey
sed_inplace "(profileCacheKey: ')[^']+(')" "\1${PROFILE_CACHE_KEY}\2" "$CONFIG_FILE"
# internal.colorPaletteKey
sed_inplace "(colorPaletteKey: ')[^']+(')" "\1${COLOR_PALETTE_KEY}\2" "$CONFIG_FILE"
# internal.inventoryCacheTimestampKey
sed_inplace "(inventoryCacheTimestampKey: ')[^']+(')" "\1${INV_CACHE_TS_KEY}\2" "$CONFIG_FILE"
# internal.cartStorageKey
sed_inplace "(cartStorageKey: ')[^']+(')" "\1${CART_STORAGE_KEY}\2" "$CONFIG_FILE"
# internal.backupFilePrefix
sed_inplace "(backupFilePrefix: ')[^']+(')" "\1${BACKUP_PREFIX}\2" "$CONFIG_FILE"

# Optional: theme color overrides
if [[ -n "$THEME_COLOR" ]]; then
  sed_inplace "(themeColor: ')[^']+(')" "\1${THEME_COLOR}\2" "$CONFIG_FILE"
fi
if [[ -n "$BG_COLOR" ]]; then
  sed_inplace "(backgroundColor: ')[^']+(')" "\1${BG_COLOR}\2" "$CONFIG_FILE"
fi

log_success "app.config.ts updated"

# ─── Step 2: Update offline.html ──────────────────────────────────────────────

OFFLINE_FILE="${ROOT_DIR}/public/offline.html"
log_info "Step 2/5 — Updating offline.html"

if [[ -f "$OFFLINE_FILE" ]]; then
  # Update <title>
  sed_inplace "(<title>)[^<]+(</title>)" "\1${BRAND_NAME} - Offline\2" "$OFFLINE_FILE"
  # Update logo letter in the div with class "icon" — matches: <div class="icon">X</div>
  sed_inplace '(<div class="icon">)[^<]+(</div>)' "\1${LOGO_LETTER}\2" "$OFFLINE_FILE"
  log_success "offline.html updated"
else
  log_warn "public/offline.html not found — skipping"
fi

# ─── Step 3: Update package.json ──────────────────────────────────────────────

PACKAGE_FILE="${ROOT_DIR}/package.json"
log_info "Step 3/5 — Updating package.json"

if [[ -f "$PACKAGE_FILE" ]]; then
  slug_pkg="${SLUG//_/-}"  # use hyphens for npm package name convention
  sed_inplace '("name": ")[^"]+(",?)' "\1${slug_pkg}\2" "$PACKAGE_FILE"
  log_success "package.json updated (name: ${slug_pkg})"
else
  log_warn "package.json not found — skipping"
fi

# ─── Step 4: Run white-label check ────────────────────────────────────────────

log_info "Step 4/5 — Running white-label check (npm run check:white-label)"

if command -v npm &>/dev/null; then
  cd "$ROOT_DIR"
  if npm run check:white-label 2>&1; then
    log_success "White-label check passed — no hardcoded brand strings detected"
  else
    echo ""
    log_warn "White-label check found violations. Review the output above and fix manually."
    echo -e "  Violations are usually remaining hardcoded strings in component files."
    echo ""
  fi
else
  log_warn "npm not found — skipping white-label check. Run manually: npm run check:white-label"
fi

# ─── Step 5: Summary ──────────────────────────────────────────────────────────

log_info "Step 5/5 — Summary"

echo ""
echo -e "${BOLD}════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD} Setup Complete — Manual Steps Required${NC}"
echo -e "${BOLD}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}The following must be done manually:${NC}"
echo ""
echo -e "  1. ${BOLD}Logo files${NC} — Replace with client's logos:"
echo -e "       public/brand_logo_lightbg.png  (512×512, light background)"
echo -e "       public/brand_logo_darkbg.png   (512×512, dark background)"
echo ""
echo -e "  2. ${BOLD}App icons${NC} — Replace all 8 SVG files in:"
echo -e "       public/icons/"
echo ""
echo -e "  3. ${BOLD}Environment variables${NC} — Set in .env.local:"
echo -e "       NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co"
echo -e "       NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key"
echo ""
echo -e "  4. ${BOLD}Color palette${NC} (optional) — If the client uses a non-teal brand color:"
echo -e "       src/app/globals.css             (CSS custom properties)"
echo -e "       src/context/ThemeColorContext.tsx (palette definitions)"
echo -e "       src/lib/config/app.config.ts     (styles.brandHex)"
echo ""
echo -e "  5. ${BOLD}Supabase backend${NC} — Run migrations and deploy edge functions:"
echo -e "       supabase db push"
echo -e "       supabase functions deploy create-user"
echo -e "       supabase functions deploy complete-sale"
echo -e "       supabase functions deploy add-stock-lot"
echo -e "       supabase functions deploy auto-close-attendance"
echo -e "       supabase functions deploy create-daily-checklists"
echo ""
echo -e "  6. ${BOLD}Initial data${NC} — Create shop and superadmin account:"
echo -e "       See supabase/create_superadmin.sql"
echo ""
echo -e "${GREEN}When ready, run: npm run build${NC}"
echo ""
