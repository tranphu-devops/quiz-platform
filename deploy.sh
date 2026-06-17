#!/usr/bin/env bash
# =============================================================================
# Quiz Platform — Production Deploy Script
# Ubuntu 24.04 | Docker Compose
# Usage: bash deploy.sh [--update]
# =============================================================================
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

log()   { echo -e "${GREEN}[$(date +'%H:%M:%S')] ✓ $*${NC}"; }
info()  { echo -e "${BLUE}[$(date +'%H:%M:%S')] → $*${NC}"; }
warn()  { echo -e "${YELLOW}[WARN] $*${NC}"; }
error() { echo -e "${RED}[ERROR] $*${NC}"; exit 1; }
hr()    { echo -e "${BOLD}────────────────────────────────────────────────────${NC}"; }

# ── Config ────────────────────────────────────────────────────────────────────
APP_DIR="/opt/quiz-platform"
REPO_URL="https://github.com/tranphu-devops/quiz-platform.git"
COMPOSE_FILE="docker-compose.yml"          # skip override (dev only)
ADMIN_EMAIL="tranphu.dev@gmail.com"
UPDATE_MODE=false
SET_ADMIN_ONLY=false

[[ "${1:-}" == "--update"    ]] && UPDATE_MODE=true
[[ "${1:-}" == "--set-admin" ]] && SET_ADMIN_ONLY=true

# ── Root check ────────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  error "Run as root: sudo bash deploy.sh"
fi

# ── --set-admin shortcut ──────────────────────────────────────────────────────
if [[ "$SET_ADMIN_ONLY" == true ]]; then
  cd "$APP_DIR"
  info "Setting $ADMIN_EMAIL as admin..."
  ROWS=$(docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -U postgres -d quizdb -tAc \
    "SELECT COUNT(*) FROM auth.users WHERE email='${ADMIN_EMAIL}';" 2>/dev/null | tr -d '[:space:]')
  if [[ "${ROWS}" == "0" || -z "${ROWS}" ]]; then
    error "${ADMIN_EMAIL} not found. Log in with Google first, then re-run: sudo bash deploy.sh --set-admin"
  fi
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -U postgres -d quizdb <<SQL
UPDATE quiz_users.profiles
  SET role = 'admin'
  WHERE id = (SELECT id FROM auth.users WHERE email = '${ADMIN_EMAIL}');
UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data || '{"role":"admin"}'::jsonb
  WHERE email = '${ADMIN_EMAIL}';
SELECT u.email, p.role AS profile_role, u.raw_user_meta_data->>'role' AS jwt_role
  FROM auth.users u JOIN quiz_users.profiles p ON p.id = u.id
  WHERE u.email = '${ADMIN_EMAIL}';
SQL
  log "${ADMIN_EMAIL} is now admin. Log out and log back in to get a new JWT."
  exit 0
fi

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║      Quiz Platform — Deploy Script       ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""

# =============================================================================
# PHASE 1 — System prerequisites
# =============================================================================
hr
info "Phase 1: Installing system prerequisites"
hr

apt-get update -qq

# Git
if ! command -v git &>/dev/null; then
  info "Installing git..."
  apt-get install -y -qq git curl ca-certificates gnupg
else
  log "git already installed"
fi

# Docker
if ! command -v docker &>/dev/null; then
  info "Installing Docker CE..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) \
    signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
  log "Docker installed: $(docker --version)"
else
  log "Docker already installed: $(docker --version)"
fi

# Docker Compose v2
if ! docker compose version &>/dev/null; then
  error "docker compose plugin not found. Install Docker CE properly."
fi
log "Docker Compose: $(docker compose version --short)"

# Docker group — allow non-root user to run docker without sudo
REAL_USER="${SUDO_USER:-}"
if [[ -n "$REAL_USER" && "$REAL_USER" != "root" ]]; then
  if ! groups "$REAL_USER" 2>/dev/null | grep -q '\bdocker\b'; then
    usermod -aG docker "$REAL_USER"
    log "Added $REAL_USER to docker group (re-login required to take effect)"
  else
    log "$REAL_USER already in docker group"
  fi
fi

# =============================================================================
# PHASE 2 — Swap (safety net for low-RAM servers)
# =============================================================================
hr
info "Phase 2: Swap space"
hr

SWAP_TOTAL=$(free -m | awk '/^Swap:/{print $2}')
if [[ "$SWAP_TOTAL" -lt 1024 ]]; then
  RAM_GB=$(free -g | awk '/^Mem:/{print $2}')
  if [[ "$RAM_GB" -le 4 ]]; then
    info "RAM ≤ 4 GB, adding 2 GB swap..."
    if [[ ! -f /swapfile ]]; then
      fallocate -l 2G /swapfile
      chmod 600 /swapfile
      mkswap /swapfile
      swapon /swapfile
      grep -q '/swapfile' /etc/fstab \
        || echo '/swapfile none swap sw 0 0' >> /etc/fstab
      log "Swap created (2 GB)"
    else
      log "Swapfile already exists"
    fi
  fi
else
  log "Swap OK: ${SWAP_TOTAL} MB"
fi

# =============================================================================
# PHASE 3 — Docker log rotation (prevent disk fill)
# =============================================================================
hr
info "Phase 3: Docker log rotation"
hr

if [[ ! -f /etc/docker/daemon.json ]]; then
  cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  }
}
EOF
  systemctl reload docker
  log "Log rotation configured (50 MB × 3)"
else
  log "daemon.json already exists, skipping"
fi

# =============================================================================
# PHASE 4 — Firewall
# =============================================================================
hr
info "Phase 4: UFW Firewall"
hr

if command -v ufw &>/dev/null; then
  ufw --force enable
  ufw allow 22/tcp   comment 'SSH'  2>/dev/null || true
  ufw allow 80/tcp   comment 'HTTP' 2>/dev/null || true
  ufw allow 443/tcp  comment 'HTTPS' 2>/dev/null || true
  log "UFW: SSH + HTTP + HTTPS allowed"
else
  warn "ufw not found, skipping firewall setup"
fi

# =============================================================================
# PHASE 5 — Clone / update repo
# =============================================================================
hr
info "Phase 5: Repository"
hr

if [[ "$UPDATE_MODE" == true ]]; then
  info "Update mode: pulling latest code..."
  cd "$APP_DIR"
  git pull origin main
  log "Repo updated"
else
  if [[ -d "$APP_DIR/.git" ]]; then
    warn "Directory $APP_DIR already exists."
    read -rp "Pull latest and redeploy? (y/N): " CONFIRM
    if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
      cd "$APP_DIR"
      git pull origin main
      log "Repo updated"
      UPDATE_MODE=true
    else
      error "Aborted. Run 'bash deploy.sh --update' to update an existing install."
    fi
  else
    info "Cloning repository..."
    git clone "$REPO_URL" "$APP_DIR"
    log "Cloned to $APP_DIR"
  fi
fi

cd "$APP_DIR"

# =============================================================================
# PHASE 6 — Environment configuration
# =============================================================================
hr
info "Phase 6: Environment variables"
hr

ENV_FILE="$APP_DIR/.env"

if [[ -f "$ENV_FILE" && "$UPDATE_MODE" == true ]]; then
  log ".env already exists — keeping current values"
  # Source current .env to validate it has required keys
  source "$ENV_FILE"
else
  echo ""
  echo -e "${BOLD}Configure your environment (press Enter to accept defaults where shown)${NC}"
  echo ""

  # ── Auto-generate secrets ───────────────────────────────────────────────────
  GEN_PG_PASS=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
  GEN_JWT=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 48)
  GEN_API_KEY=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 48)

  # ── Postgres ────────────────────────────────────────────────────────────────
  read -rp "POSTGRES_PASSWORD [auto-generated]: " INPUT_PG_PASS
  PG_PASS="${INPUT_PG_PASS:-$GEN_PG_PASS}"

  # ── JWT ─────────────────────────────────────────────────────────────────────
  read -rp "JWT_SECRET [auto-generated]: " INPUT_JWT
  JWT_SECRET="${INPUT_JWT:-$GEN_JWT}"
  [[ ${#JWT_SECRET} -lt 32 ]] && error "JWT_SECRET must be at least 32 characters"

  # ── Internal API key ────────────────────────────────────────────────────────
  read -rp "INTERNAL_API_KEY [auto-generated]: " INPUT_API_KEY
  INTERNAL_API_KEY="${INPUT_API_KEY:-$GEN_API_KEY}"
  [[ ${#INTERNAL_API_KEY} -lt 32 ]] && error "INTERNAL_API_KEY must be at least 32 characters"

  # ── Site URL ─────────────────────────────────────────────────────────────────
  # Try to detect public IP automatically
  DETECTED_IP=$(curl -fsSL --max-time 5 https://api.ipify.org 2>/dev/null || echo "")
  DEFAULT_SITE_URL="${DETECTED_IP:+http://$DETECTED_IP}"
  read -rp "SITE_URL [${DEFAULT_SITE_URL:-http://your-domain.com}]: " INPUT_SITE_URL
  SITE_URL="${INPUT_SITE_URL:-${DEFAULT_SITE_URL:-http://localhost}}"
  # Strip trailing slash
  SITE_URL="${SITE_URL%/}"

  # ── Google OAuth ─────────────────────────────────────────────────────────────
  echo ""
  echo -e "${YELLOW}Google OAuth (leave blank to disable):${NC}"
  read -rp "GOOGLE_CLIENT_ID: " GOOGLE_CLIENT_ID
  if [[ -n "$GOOGLE_CLIENT_ID" ]]; then
    read -rp "GOOGLE_CLIENT_SECRET: " GOOGLE_CLIENT_SECRET
    GOOGLE_OAUTH_ENABLED="true"
  else
    GOOGLE_CLIENT_SECRET=""
    GOOGLE_OAUTH_ENABLED="false"
    warn "Google OAuth disabled. Users must use email/password."
  fi

  # ── AWS / Lightsail Object Storage ──────────────────────────────────────────
  echo ""
  echo -e "${YELLOW}AWS / Lightsail Object Storage (for image uploads):${NC}"
  read -rp "AWS_ACCESS_KEY_ID: " AWS_ACCESS_KEY_ID
  read -rp "AWS_SECRET_ACCESS_KEY: " AWS_SECRET_ACCESS_KEY
  read -rp "AWS_BUCKET: " AWS_BUCKET
  read -rp "AWS_REGION [ap-southeast-1]: " AWS_REGION
  AWS_REGION="${AWS_REGION:-ap-southeast-1}"
  read -rp "AWS_ENDPOINT (leave blank for standard S3): " AWS_ENDPOINT
  read -rp "AWS_PUBLIC_URL (e.g. https://bucket.s3.region.amazonaws.com): " AWS_PUBLIC_URL

  # ── Write .env ───────────────────────────────────────────────────────────────
  cat > "$ENV_FILE" <<EOF
# Auto-generated by deploy.sh on $(date)

# App identity
GITHUB_ORG=tranphu-devops  # kept for reference only

# PostgreSQL
POSTGRES_PASSWORD=${PG_PASS}

# Connection strings
USER_DATABASE_URL=postgres://postgres:${PG_PASS}@postgres:5432/quizdb?search_path=quiz_users
EXAM_DATABASE_URL=postgres://postgres:${PG_PASS}@postgres:5432/quizdb?search_path=quiz_exams
SUBMISSION_DATABASE_URL=postgres://postgres:${PG_PASS}@postgres:5432/quizdb?search_path=quiz_submissions

# Auth
JWT_SECRET=${JWT_SECRET}
INTERNAL_API_KEY=${INTERNAL_API_KEY}

# GoTrue / Site
SITE_URL=${SITE_URL}

# Google OAuth
GOOGLE_OAUTH_ENABLED=${GOOGLE_OAUTH_ENABLED}
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}

# AWS / Lightsail Object Storage
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
AWS_BUCKET=${AWS_BUCKET}
AWS_REGION=${AWS_REGION}
AWS_ENDPOINT=${AWS_ENDPOINT}
AWS_PUBLIC_URL=${AWS_PUBLIC_URL}

# Image tag (use 'latest' for CI/CD built images)
TAG=latest
EOF

  chmod 600 "$ENV_FILE"
  log ".env created at $ENV_FILE"

  echo ""
  echo -e "${BOLD}Generated secrets (save these somewhere safe):${NC}"
  echo -e "  POSTGRES_PASSWORD : ${GREEN}${PG_PASS}${NC}"
  echo -e "  JWT_SECRET        : ${GREEN}${JWT_SECRET}${NC}"
  echo -e "  INTERNAL_API_KEY  : ${GREEN}${INTERNAL_API_KEY}${NC}"
  echo ""
fi

# =============================================================================
# PHASE 7 — Build images locally
# =============================================================================
hr
info "Phase 7: Building images locally (this takes a few minutes)"
hr

# =============================================================================
# PHASE 8 — Deploy
# =============================================================================
hr
info "Phase 8: Starting services"
hr

# Use -f to explicitly skip docker-compose.override.yml (dev only)
docker compose -f "$COMPOSE_FILE" up -d --build

log "All containers started"

# =============================================================================
# PHASE 9 — Health check
# =============================================================================
hr
info "Phase 9: Health check (waiting up to 60s)"
hr

SERVICES=("user-service" "exam-service" "submission-service")
PORTS=(3002 3003 3004)

sleep 5  # give Postgres time to initialize

for i in "${!SERVICES[@]}"; do
  SVC="${SERVICES[$i]}"
  PORT="${PORTS[$i]}"
  info "Waiting for ${SVC}..."
  for ATTEMPT in {1..12}; do
    if docker compose -f "$COMPOSE_FILE" exec -T "$SVC" \
        wget -qO- "http://localhost:${PORT}/health" &>/dev/null; then
      log "${SVC} healthy"
      break
    fi
    if [[ $ATTEMPT -eq 12 ]]; then
      warn "${SVC} health check timed out — check logs: docker compose logs ${SVC}"
    fi
    sleep 5
  done
done

# =============================================================================
# PHASE 10 — Optional: migrate / seed data / admin
# =============================================================================
hr
info "Phase 10: Optional setup"
hr

echo ""
echo -e "${BOLD}Tuỳ chọn bổ sung (Enter để bỏ qua):${NC}"
echo ""

# ── Migration (cho DB cũ đang upgrade) ────────────────────────────────────────
read -rp "  Chạy migrate_image_upload.sql? (chỉ cần nếu DB cũ chưa có cột image) (y/N): " DO_MIGRATE
if [[ "$DO_MIGRATE" =~ ^[Yy]$ ]]; then
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -U postgres -d quizdb -f /dev/stdin \
    < "$APP_DIR/infra/postgres/migrate_image_upload.sql" \
    && log "Migration applied" || warn "Migration failed — xem lại logs"
fi

# ── Sample seed data ───────────────────────────────────────────────────────────
read -rp "  Seed dữ liệu mẫu (seed.sql)? (y/N): " DO_SEED
if [[ "$DO_SEED" =~ ^[Yy]$ ]]; then
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -U postgres -d quizdb -f /dev/stdin \
    < "$APP_DIR/infra/postgres/seed.sql" \
    && log "Sample data seeded" || warn "Seed thất bại"
fi

# ── AWS SAA exam seed ──────────────────────────────────────────────────────────
read -rp "  Seed đề AWS SAA (45 câu hỏi)? (y/N): " DO_SEED_AWS
if [[ "$DO_SEED_AWS" =~ ^[Yy]$ ]]; then
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -U postgres -d quizdb -f /dev/stdin \
    < "$APP_DIR/infra/postgres/seed_aws_saa.sql" \
    && log "AWS SAA data seeded" || warn "Seed AWS thất bại"
fi

# ── Admin account ──────────────────────────────────────────────────────────────
read -rp "  Set ${ADMIN_EMAIL} thành admin? (y/N): " DO_ADMIN
if [[ "$DO_ADMIN" =~ ^[Yy]$ ]]; then
  ROWS=$(docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -U postgres -d quizdb -tAc \
    "SELECT COUNT(*) FROM auth.users WHERE email='${ADMIN_EMAIL}';" 2>/dev/null | tr -d '[:space:]')
  if [[ "${ROWS}" == "0" || -z "${ROWS}" ]]; then
    warn "${ADMIN_EMAIL} chưa có trong DB."
    warn "Hãy đăng nhập bằng Google trước, rồi chạy:"
    echo -e "  ${BOLD}sudo bash $APP_DIR/deploy.sh --set-admin${NC}"
  else
    docker compose -f "$COMPOSE_FILE" exec -T postgres \
      psql -U postgres -d quizdb <<SQL
UPDATE quiz_users.profiles
  SET role = 'admin'
  WHERE id = (SELECT id FROM auth.users WHERE email = '${ADMIN_EMAIL}');
UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data || '{"role":"admin"}'::jsonb
  WHERE email = '${ADMIN_EMAIL}';
SQL
    log "${ADMIN_EMAIL} đã được set thành admin. Đăng xuất và đăng nhập lại để JWT cập nhật."
  fi
fi

echo ""

# =============================================================================
# DONE
# =============================================================================
hr
echo ""
echo -e "${GREEN}${BOLD}  Deployment complete!${NC}"
echo ""

SITE_URL_DISPLAY=$(grep '^SITE_URL=' "$ENV_FILE" | cut -d= -f2)
echo -e "  App URL    : ${BLUE}${BOLD}${SITE_URL_DISPLAY}${NC}"
echo -e "  App dir    : ${APP_DIR}"
echo -e "  Env file   : ${ENV_FILE}"
echo ""
echo -e "${BOLD}Useful commands:${NC}"
echo "  docker compose -f $APP_DIR/$COMPOSE_FILE ps"
echo "  docker compose -f $APP_DIR/$COMPOSE_FILE logs -f --tail=50"
echo "  docker compose -f $APP_DIR/$COMPOSE_FILE restart <service>"
echo "  sudo bash $APP_DIR/deploy.sh --update       # pull latest + redeploy"
echo "  sudo bash $APP_DIR/deploy.sh --set-admin    # set $ADMIN_EMAIL as admin"
echo ""
