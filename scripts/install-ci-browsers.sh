#!/usr/bin/env bash
set -euo pipefail

# The hosted runner's Azure mirror stalled on font/media packages. Keep the
# runner's signed Ubuntu sources, with the primary archive as their mirror.
if [[ "${GITHUB_ACTIONS:-}" == "true" && "${RUNNER_OS:-}" == "Linux" && -f /etc/apt/apt-mirrors.txt ]]; then
  printf '%s\n' 'https://archive.ubuntu.com/ubuntu/' | sudo tee /etc/apt/apt-mirrors.txt >/dev/null
  printf '%s\n' 'Acquire::http::Timeout "30";' 'Acquire::https::Timeout "30";' 'Acquire::Retries "2";' \
    | sudo tee /etc/apt/apt.conf.d/99-rsmb-browser-downloads >/dev/null
fi

npx playwright install --with-deps "$@"
