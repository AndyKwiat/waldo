#!/usr/bin/env bash
# Deploy Jade River City (voxel) to https://waldo-voxel.akwiat.com as a static site via radify.
# No build step: stage exactly what the browser loads (index.html, src/, models/*.json + recipes, three.js),
# skipping the 8 MB of Voxer preview sheets and the rest of node_modules.
set -euo pipefail
cd "$(dirname "$0")"
bun install --frozen-lockfile
rm -rf dist && mkdir -p dist/models dist/node_modules/three/build dist/node_modules/three/examples
cp index.html dist/
cp -R src dist/src
cp models/*.json dist/models/
cp -R models/recipes dist/models/recipes
cp node_modules/three/build/three.module.js dist/node_modules/three/build/
cp -R node_modules/three/examples/jsm dist/node_modules/three/examples/jsm
find dist -name .DS_Store -delete
~/radify/bin/radify deploy waldo-voxel dist
