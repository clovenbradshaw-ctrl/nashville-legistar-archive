#!/bin/sh
# Wrapper for cron: cron runs with a minimal environment (no cwd, no venv
# activation), so this pins both explicitly before calling upload_pending.py.
# Installed via `crontab` -- see cron/README.md.
set -e
cd /Users/mlacy/Documents/3.0/nashville-legistar-archive
exec .venv/bin/python3 scripts/upload_pending.py --limit 50 --delay 1.0 >> data/upload_pending.log 2>&1
