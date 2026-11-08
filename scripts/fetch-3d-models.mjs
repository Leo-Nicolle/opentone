#!/usr/bin/env node
// Download the board's EasyEDA 3D models, which are not redistributed in this
// repo. The board links them from hardware/opentone/3dmodels/opentone.3dshapes.
//
// Usage: node scripts/fetch-3d-models.mjs [output-dir]

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUTPUT = path.join(repoRoot, 'hardware/opentone/3dmodels/opentone.3dshapes');
const MODEL_URL = 'https://modules.easyeda.com/qAxj6KHrDKw4blvCG8QJPs7Y/';
const COMPONENT_URL = (lcsc) => `https://easyeda.com/api/products/${lcsc}/components?version=6.4.19.5`;
const HEADERS = { 'User-Agent': 'opentone-3d-fetch' };
const ATTEMPTS = 4;

const MODELS = [
  ['D701', 'C48260'],
  ['J3', 'C295747'],
  ['J501', 'C262553'],
  ['U11', 'C2845237'],
  ['U12', 'C2682616'],
  ['U1201', 'C3827627'],
  ['U501', 'C91322'],
  ['U502', 'C527464'],
  ['USB1', 'C165948'],
  ['bat-man1', 'C150772'],
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function download(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      await sleep(1000 * attempt);
      const response = await fetch(url, { headers: HEADERS });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt === ATTEMPTS) throw new Error(`${url}: ${error.message}`);
    }
  }
}

async function fetchModel(lcsc, target) {
  const component = JSON.parse(await download(COMPONENT_URL(lcsc)));
  const node = component.result.packageDetail.dataStr.shape.find((shape) => shape.startsWith('SVGNODE~'));
  if (!node) throw new Error(`${lcsc}: no 3D model on EasyEDA`);

  const { uuid } = JSON.parse(node.slice('SVGNODE~'.length)).attrs;
  const step = await download(MODEL_URL + uuid);
  if (!step.subarray(0, 12).equals(Buffer.from('ISO-10303-21'))) {
    throw new Error(`${lcsc}: response is not a STEP file`);
  }
  writeFileSync(target, step);
}

const output = path.resolve(process.argv[2] ?? DEFAULT_OUTPUT);
mkdirSync(output, { recursive: true });

let failures = 0;
for (const [ref, lcsc] of MODELS) {
  const name = `${ref}_${lcsc}.step`;
  const target = path.join(output, name);
  if (existsSync(target)) {
    console.log(`have ${name}`);
    continue;
  }
  try {
    await fetchModel(lcsc, target);
    console.log(`got  ${name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

const alpsTarget = path.join(output, 'SKQGAF.STEP');
if (!existsSync(alpsTarget)) copyFileSync(path.join(repoRoot, 'hardware/3dmodels/SKQGAF.STEP'), alpsTarget);

console.log('Get the jack model from SnapMagic (see THIRD_PARTY.md): hardware/opentone/jack/SJ-43515TS-SMT-TR.step');
process.exit(failures > 0 ? 1 : 0);
