#!/usr/bin/env bash
# Shared by the outcome cases: copies the plugin's template into the empty eval workspace.
# Sourced from each case's fixture.sh; $PLUGIN_ROOT is derived from the case script's location.
set -euo pipefail
PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cp -R "$PLUGIN_ROOT/templates/." .
cp apps/api/.dev.vars.example apps/api/.dev.vars
