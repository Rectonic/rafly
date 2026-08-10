#!/usr/bin/env bash
set -euo pipefail

# Sources the local Supabase connection details, then runs the backend
# integration suite. Requires the local stack to already be running,
# start it first with 'supabase start'.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$SCRIPT_DIR/backend-test-env.sh"

npx jest --runInBand __tests__/backend
