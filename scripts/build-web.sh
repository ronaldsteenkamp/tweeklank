#!/usr/bin/env bash
# Bouwt de webversie en zet die in docs/app, zodat GitHub Pages hem serveert op
# https://ronaldsteenkamp.github.io/tweeklank/app/ (zie experiments.baseUrl in app.json).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

rm -rf dist
npx expo export --platform web
rm -rf docs/app
mkdir -p docs
cp -r dist docs/app
# Een directe link (bijv. /tweeklank/app/koppel/ABC234) bestaat niet als bestand; GitHub Pages toont
# dan 404.html, en dat is gewoon de app zelf, die vervolgens het juiste scherm opent.
cp dist/index.html docs/404.html
# Zonder dit negeert GitHub Pages de map _expo (Jekyll slaat mappen met _ over).
touch docs/.nojekyll
rm -rf dist
echo "Webversie staat in docs/app"
