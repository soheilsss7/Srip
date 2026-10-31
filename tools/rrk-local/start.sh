#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
npm ci --ignore-scripts --no-audit --no-fund
npm start -- --browser chrome --max-pages 10 --max-records 100
