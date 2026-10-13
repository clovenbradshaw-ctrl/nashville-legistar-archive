#!/usr/bin/env bash
# Deploy / operate the Tennessee county pull on the n8n-server VM.
#
#   scripts/deploy_counties_vm.sh deploy     copy code + registry + page to /mnt/intelechia/tn-counties
#   scripts/deploy_counties_vm.sh probe      run the live coverage probe ON the VM (verdicts come from here)
#   scripts/deploy_counties_vm.sh start      start the pull loop under pm2 as `tn-county-pull`
#   scripts/deploy_counties_vm.sh live       start the watcher (15 min), scoreboard (1 min), index (10 min) and the
#                                            read-only service on 127.0.0.1:8830 (not public: view it over an IAP tunnel)
#   scripts/deploy_counties_vm.sh pylib      install PyMuPDF into $DEST/pylib (our directory only, nothing system-wide)
#   scripts/deploy_counties_vm.sh digest     retrofit: text + proof for held PDFs; add DROP=1 to remove the originals
#   scripts/deploy_counties_vm.sh provenance start the pointer verifier (HEAD) and the archive.org lookup, hourly
#   scripts/deploy_counties_vm.sh stop       stop the pull loop (data and logs stay)
#   scripts/deploy_counties_vm.sh status     pm2 state, disk, per-county doc counts
#   scripts/deploy_counties_vm.sh coverage   bring FALSIFY-coverage.json back next to the registry
#
# Everything lives under DEST on the 251 GB data volume. Nothing is written to / (83% full),
# no existing pm2 app is touched, and nothing here is committed to git (data/counties/*/ is ignored).
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
SSH="$HERE/../n8n-server-docs/scripts/ssh-vm.sh"
DEST=/mnt/intelechia/tn-counties
APP=tn-county-pull

vm() { "$SSH" "$@" 2> >(grep -v -i -E 'numpy|^WARNING|increasing the tunnel|^$|please see' >&2); }

case "${1:-}" in
  deploy)
    cd "$HERE"
    COPYFILE_DISABLE=1 tar czf - \
      src/counties.py src/eo_log.py \
      scripts/county_pull.py scripts/county_coverage.py scripts/build_county_db.py scripts/county_query_server.py \
      scripts/county_watch.py scripts/build_scoreboard.py scripts/county_digest.py \
      scripts/county_reacquire.py scripts/county_archive.py \
      data/counties/registry.json docs/counties.html docs/scoreboard.html \
      | vm "mkdir -p $DEST && tar xzf - -C $DEST && mkdir -p $DEST/data/counties $DEST/logs && ls -R $DEST | head -30"
    ;;
  probe)
    vm "cd $DEST && python3 scripts/county_coverage.py --delay 3 --workers 8 2>&1 | tail -15"
    ;;
  start)
    # PYTHONPATH carries PyMuPDF (see `pylib`). Originals are KEPT unless DROP=1: provenance and an archive.org
    # capture are the foundation, so dropping is opt-in and must not happen before both exist.
    # The app is deleted and re-created so changed arguments take effect (the crawl is resumable).
    vm "cd $DEST && pm2 delete $APP >/dev/null 2>&1; \
        PYTHONPATH=$DEST/pylib pm2 start scripts/county_pull.py --name $APP --interpreter python3 --time \
          --output $DEST/logs/pull-out.log --error $DEST/logs/pull-err.log \
          -- --loop --delay 3 --max-pages 120 --max-docs 400 --revisit-hours 168 ${DROP:+--drop-originals}; \
        pm2 restart tn-county-scoreboard >/dev/null 2>&1; pm2 save >/dev/null 2>&1; pm2 list | grep -E 'name|tn-county'"
    ;;
  live)
    vm "cd $DEST && \
        (pm2 describe tn-county-watch >/dev/null 2>&1 || pm2 start scripts/county_watch.py --name tn-county-watch --interpreter python3 --time \
           --output logs/watch-out.log --error logs/watch-err.log -- --loop 900 --delay 3 --workers 6) && \
        (pm2 describe tn-county-scoreboard >/dev/null 2>&1 || pm2 start scripts/build_scoreboard.py --name tn-county-scoreboard --interpreter python3 --time \
           --output logs/scoreboard-out.log --error logs/scoreboard-err.log -- --loop 60) && \
        (pm2 describe tn-county-index >/dev/null 2>&1 || pm2 start scripts/build_county_db.py --name tn-county-index --interpreter python3 \
           --no-autorestart --cron-restart '*/10 * * * *' --output logs/index-out.log --error logs/index-err.log -- --no-legacy) && \
        (pm2 describe tn-county-api >/dev/null 2>&1 || pm2 start scripts/county_query_server.py --name tn-county-api --interpreter python3 \
           --output logs/api-out.log --error logs/api-err.log -- --host 127.0.0.1 --port 8830) && \
        pm2 save >/dev/null 2>&1; pm2 list | grep -E 'name|tn-county'"
    ;;
  pylib)
    vm "mkdir -p $DEST/pylib && python3 -m pip install --quiet --target $DEST/pylib pymupdf 2>&1 | tail -3; \
        PYTHONPATH=$DEST/pylib python3 -c 'import pymupdf;print(\"pymupdf\", pymupdf.__version__)'; du -sh $DEST/pylib | cut -f1"
    ;;
  digest)
    vm "cd $DEST && PYTHONPATH=$DEST/pylib python3 scripts/county_digest.py ${DROP:+--drop-originals} ${LIMIT:+--limit $LIMIT} 2>&1 | tail -3"
    ;;
  provenance)
    # both are read-only toward the world: HEAD requests to the county, CDX lookups on archive.org (nothing submitted)
    vm "cd $DEST && export PYTHONPATH=$DEST/pylib && \
        (pm2 describe tn-county-verify >/dev/null 2>&1 || pm2 start scripts/county_reacquire.py --name tn-county-verify --interpreter python3 \
           --no-autorestart --cron-restart '15 * * * *' --output logs/verify-out.log --error logs/verify-err.log -- --delay 3) && \
        (pm2 describe tn-county-archive >/dev/null 2>&1 || pm2 start scripts/county_archive.py --name tn-county-archive --interpreter python3 \
           --no-autorestart --cron-restart '45 * * * *' --output logs/archive-out.log --error logs/archive-err.log -- --delay 3) && \
        pm2 save >/dev/null 2>&1; pm2 list | grep -E 'name|tn-county'"
    ;;
  stop)
    vm "pm2 stop $APP"
    ;;
  status)
    vm "pm2 describe $APP 2>/dev/null | grep -E 'status|uptime|restarts' ; df -h /mnt/intelechia / | cat; \
        cd $DEST/data/counties 2>/dev/null && for d in */; do n=\$(wc -l < \$d/manifest.jsonl 2>/dev/null || echo 0); [ \"\$n\" -gt 0 ] && echo \"\$d \$n\"; done | sort -k2 -n -r | head -20; \
        du -sh $DEST/data/counties 2>/dev/null; tail -5 $DEST/logs/pull-out.log 2>/dev/null"
    ;;
  coverage)
    vm "cat $DEST/data/counties/FALSIFY-coverage.json" > "$HERE/data/counties/FALSIFY-coverage.vm.json"
    echo "wrote data/counties/FALSIFY-coverage.vm.json"
    ;;
  *) sed -n 2,13p "$0"; exit 2 ;;
esac
