#!/bin/zsh
# Re-measures the original and rebuilds the clone's motion data for one route (all of src/motion/data/<profile>-<route>.json).
# Needs: the clone served (npm run build && npx vite preview --port 5340) for the initial-state diff, and the original reachable.
#   qa/motion/refresh.sh [route]            e.g. qa/motion/refresh.sh /support/privacy-policy
set -e
ROUTE=${1:-/}
SLUG=$([ "$ROUTE" = "/" ] && echo home || echo "${ROUTE#/}" | tr '/' '_')
for P in desktop mobile; do
  echo "== $P $ROUTE"
  [ "$P" = mobile ] && [ -z "$SKIP_EXPORT" ] && node qa/clone/export-variant.mjs --viewport mobile --route "$ROUTE"
  [ -f "qa/motion/raw/$P-$SLUG.json" ] && [ -n "$REUSE" ] || node qa/motion/record-scroll.mjs --viewport $P --route "$ROUTE"   # REUSE=1 keeps an existing scroll recording
  node qa/motion/record-baseline.mjs --viewport $P --route "$ROUTE"
  node qa/motion/build-timeline.mjs --profile $P --route "$ROUTE"
  if [ "$(python3 -c "import json;print(len(json.load(open('qa/motion/raw/$P-$SLUG.json'))['timeDriven']))")" != "0" ]; then
    node qa/motion/record-time.mjs --viewport $P --route "$ROUTE" --seconds 25
    node qa/motion/record-ticker.mjs --viewport $P --route "$ROUTE" --seconds 110
    node qa/motion/build-time.mjs --profile $P --route "$ROUTE"
  fi
done
