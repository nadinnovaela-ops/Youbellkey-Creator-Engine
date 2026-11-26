#!/usr/bin/env bash
set -euo pipefail

# Sync local .env.local secrets & config to Vercel (overwriting existing values with --force).
# Usage:
#   bash infrastructure/local/sync-env.sh           # Prompts for empty keys, then syncs to Vercel
#   bash infrastructure/local/sync-env.sh --sync    # Only pushes non-empty values currently in .env.local
#   bash infrastructure/local/sync-env.sh --deploy  # Also triggers production deployment after syncing

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.local"
PROD_URL="https://youbellkey-creator-engine.vercel.app"
SCOPE="youbellkey1"
PROJECT="youbellkey-creator-engine"

SYNC_ONLY=false
DEPLOY_AFTER=false
for arg in "$@"; do
  case "$arg" in
    --sync) SYNC_ONLY=true ;;
    --deploy) DEPLOY_AFTER=true ;;
  esac
done

if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${ROOT_DIR}/.env.example" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
fi

get_env_val() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "${ENV_FILE}" | tail -n 1 || true)"
  echo "${line#*=}"
}

set_env_val() {
  local key="$1"
  local val="$2"
  node -e '
    const fs = require("node:fs");
    const [file, key, val] = process.argv.slice(1);
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    let replaced = false;
    const out = lines.map((line) => {
      if (line.startsWith(key + "=")) {
        replaced = true;
        return `${key}=${val}`;
      }
      return line;
    });
    if (!replaced) out.push(`${key}=${val}`);
    fs.writeFileSync(file, out.join("\n"), { mode: 0o600 });
  ' "${ENV_FILE}" "${key}" "${val}"
}

merge_missing_from_example() {
  node -e '
    const fs = require("node:fs");
    const [exampleFile, targetFile] = process.argv.slice(1);
    const targetLines = fs.readFileSync(targetFile, "utf8").split(/\r?\n/);
    const existingKeys = new Set(
      targetLines.filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => l.split("=")[0])
    );
    const exampleLines = fs.readFileSync(exampleFile, "utf8").split(/\r?\n/);
    let changed = false;
    for (const line of exampleLines) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const key = line.split("=")[0];
      if (!existingKeys.has(key)) {
        targetLines.push(line);
        existingKeys.add(key);
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(targetFile, targetLines.join("\n") + "\n", { mode: 0o600 });
    }
  ' "${ROOT_DIR}/.env.example" "${ENV_FILE}"
}

is_placeholder() {
  local val="$1"
  [[ -z "$val" || "$val" == your-* || "$val" == replace-with-* || "$val" == *"your-project"* ]]
}

prompt_if_needed() {
  local key="$1"
  local label="$2"
  local is_secret="$3"
  local current
  current="$(get_env_val "$key")"

  if [[ "$SYNC_ONLY" == "true" ]]; then
    return
  fi

  if is_placeholder "$current"; then
    local input=""
    if [[ "$is_secret" == "true" ]]; then
      read -r -s -p "Tempel ${key} (${label}) [Enter untuk lewati]: " input
      echo ""
    else
      read -r -p "Masukkan ${key} (${label}) [Enter untuk lewati]: " input
    fi
    if [[ -n "$input" ]]; then
      set_env_val "$key" "$input"
    fi
  else
    echo "✓ ${key} sudah terisi di .env.local (dipertahankan)."
  fi
}

ensure_defaults_and_secrets() {
  merge_missing_from_example

  if is_placeholder "$(get_env_val "NEXT_PUBLIC_APP_URL")"; then
    set_env_val "NEXT_PUBLIC_APP_URL" "$PROD_URL"
  fi
  local cp_url
  cp_url="$(get_env_val "YB_CONTROL_PLANE_URL")"
  if is_placeholder "$cp_url" || [[ "$cp_url" == "http://localhost:3000" ]]; then
    set_env_val "YB_CONTROL_PLANE_URL" "$PROD_URL"
  fi
  if is_placeholder "$(get_env_val "R2_BUCKET_NAME")"; then
    set_env_val "R2_BUCKET_NAME" "youbellkey-media"
  fi

  local master_key
  master_key="$(get_env_val "YB_SECRETS_MASTER_KEY")"
  if is_placeholder "$master_key"; then
    master_key="$(openssl rand -hex 32)"
    set_env_val "YB_SECRETS_MASTER_KEY" "$master_key"
    echo "✓ Generated YB_SECRETS_MASTER_KEY otomatis."
  fi

  local worker_token
  worker_token="$(get_env_val "YB_WORKER_TOKEN")"
  if is_placeholder "$worker_token"; then
    worker_token="$(openssl rand -hex 24)"
    set_env_val "YB_WORKER_TOKEN" "$worker_token"
    echo "✓ Generated YB_WORKER_TOKEN otomatis."
  fi
}

push_to_vercel() {
  local key="$1"
  local val="$2"
  local envs="$3"
  local vtype="$4"

  if is_placeholder "$val"; then
    return
  fi

  printf '%s' "$val" | vercel env add "$key" --environment "$envs" --type "$vtype" --force --yes --scope "$SCOPE" >/dev/null
  echo "  ↑ Synced ${key} -> Vercel (${envs}, ${vtype})"
}

ensure_defaults_and_secrets

prompt_if_needed "NEXT_PUBLIC_SUPABASE_URL" "Project URL dari Supabase Settings -> API" "false"
prompt_if_needed "NEXT_PUBLIC_SUPABASE_ANON_KEY" "anon / publishable key dari Supabase" "false"
prompt_if_needed "SUPABASE_SERVICE_ROLE_KEY" "service_role / secret key dari Supabase" "true"
prompt_if_needed "R2_ACCOUNT_ID" "Cloudflare R2 Account ID" "false"
prompt_if_needed "R2_ACCESS_KEY_ID" "Cloudflare R2 Access Key ID" "true"
prompt_if_needed "R2_SECRET_ACCESS_KEY" "Cloudflare R2 Secret Access Key" "true"
prompt_if_needed "GEMINI_API_KEY" "Google AI Studio API Key gratis" "true"
prompt_if_needed "GROQ_API_KEY" "Groq API Key gratis" "true"

if [[ ! -f "${ROOT_DIR}/.vercel/project.json" ]]; then
  vercel link --yes --project "$PROJECT" --scope "$SCOPE" >/dev/null
fi

echo ""
echo "Menyinkronkan environment variables ke Vercel (${PROJECT}) dengan --force..."

push_to_vercel "NEXT_PUBLIC_APP_URL" "$PROD_URL" "production,preview" "config"
push_to_vercel "NEXT_PUBLIC_APP_URL" "http://localhost:3000" "development" "config"

for key in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY R2_ACCOUNT_ID R2_BUCKET_NAME; do
  push_to_vercel "$key" "$(get_env_val "$key")" "production,preview,development" "config"
done

for key in SUPABASE_SERVICE_ROLE_KEY YB_SECRETS_MASTER_KEY YB_WORKER_TOKEN R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY GEMINI_API_KEY GROQ_API_KEY OPENROUTER_API_KEY OPENAI_API_KEY AZURE_SPEECH_KEY AZURE_SPEECH_REGION GOOGLE_CLOUD_TTS_API_KEY YOUTUBE_API_KEY GOOGLE_OAUTH_CLIENT_ID GOOGLE_OAUTH_CLIENT_SECRET; do
  push_to_vercel "$key" "$(get_env_val "$key")" "production,preview,development" "secret"
done

echo ""
echo "Selesai! Daftar variabel aktif di Vercel (${PROJECT}):"
vercel env ls --scope "$SCOPE"

if [[ "$DEPLOY_AFTER" == "true" ]]; then
  echo ""
  echo "Memicu production redeploy di Vercel..."
  vercel deploy --prod --yes --scope "$SCOPE"
fi
