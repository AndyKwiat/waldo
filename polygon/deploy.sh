#!/usr/bin/env bash
# Deploy Jade River City (polygon) to https://waldo-polygon.akwiat.com as a static site via radify.
# No build step: stage what the browser loads (index.html, src/, three.js core + addons).
set -euo pipefail
cd "$(dirname "$0")"
bun install --frozen-lockfile
rm -rf dist && mkdir -p dist/node_modules/three/build dist/node_modules/three/examples
cp index.html dist/
cp -R src dist/src
cp node_modules/three/build/three.module.js dist/node_modules/three/build/
cp -R node_modules/three/examples/jsm dist/node_modules/three/examples/jsm
find dist -name .DS_Store -delete
~/radify/bin/radify deploy waldo-polygon dist
