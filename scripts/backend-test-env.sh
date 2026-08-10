#!/usr/bin/env bash
set -euo pipefail

# Reads connection details for the local Supabase stack and re-exports them
# under the LASTBITE_TEST_SUPABASE_* names the backend test helpers read.
# Meant to be sourced, not executed on its own, the exports only survive in
# the calling shell when this file is sourced.

if ! STATUS_ENV="$(supabase status -o env 2>&1)"; then
  echo "backend-test-env: 'supabase status -o env' failed, is the local stack running (try 'supabase start')" >&2
  echo "$STATUS_ENV" >&2
  return 1 2>/dev/null || exit 1
fi

extract_value() {
  printf '%s\n' "$STATUS_ENV" | grep -E "^$1=" | head -n1 | cut -d '=' -f2- | tr -d '"' || true
}

SUPABASE_API_URL="$(extract_value API_URL)"
SUPABASE_ANON_KEY_VALUE="$(extract_value ANON_KEY)"
SUPABASE_SERVICE_ROLE_KEY_VALUE="$(extract_value SERVICE_ROLE_KEY)"

if [ -z "$SUPABASE_API_URL" ] || [ -z "$SUPABASE_ANON_KEY_VALUE" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY_VALUE" ]; then
  echo "backend-test-env: could not read API_URL, ANON_KEY, or SERVICE_ROLE_KEY from 'supabase status -o env'" >&2
  echo "$STATUS_ENV" >&2
  return 1 2>/dev/null || exit 1
fi

export LASTBITE_TEST_SUPABASE_URL="$SUPABASE_API_URL"
export LASTBITE_TEST_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY_VALUE"
export LASTBITE_TEST_SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY_VALUE"

unset -f extract_value
