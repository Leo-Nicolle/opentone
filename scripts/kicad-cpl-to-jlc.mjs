#!/usr/bin/env node
// Convert a KiCad position export (Ref,Val,Package,PosX,PosY,Rot,Side) to the
// JLCPCB CPL format (Designator,Mid X,Mid Y,Layer,Rotation).
//
// Usage: node scripts/kicad-cpl-to-jlc.mjs [input.csv] [output.csv] [--bom bom.csv]
// With --bom, only designators listed in that JLC BOM are kept, so both files match.
// Output defaults to the input path with "-pos.csv" replaced by "-cpl-jlc.csv".

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_INPUT = path.join(repoRoot, 'hardware/opentone/exports/opentone-all-pos.csv');
const REQUIRED_COLUMNS = ['Ref', 'PosX', 'PosY', 'Rot', 'Side'];
const LAYERS = { top: 'Top', bottom: 'Bottom' };

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

// JLCPCB expects rotations in the 0-360 range; KiCad exports -180..180.
function normalizeRotation(value, ref) {
  const degrees = Number(value);
  if (value.trim() === '' || !Number.isFinite(degrees)) {
    throw new Error(`${ref}: invalid rotation "${value}"`);
  }
  const normalized = ((degrees % 360) + 360) % 360;
  return String(Number(normalized.toFixed(3)));
}

function coordinate(value, ref, column) {
  if (value.trim() === '' || !Number.isFinite(Number(value))) {
    throw new Error(`${ref}: invalid ${column} "${value}"`);
  }
  return value.trim();
}

function readBomDesignators(bomPath) {
  const [header, ...rows] = parseCsv(readFileSync(bomPath, 'utf8').replace(/^﻿/, ''));
  const index = (header ?? []).findIndex((name) => name.trim() === 'Designator');
  if (index < 0) throw new Error(`${bomPath} has no "Designator" column`);
  return new Set(rows.flatMap((row) => (row[index] ?? '').split(/[,\s]+/).filter(Boolean)));
}

function convert(inputPath, bomDesignators) {
  const [header, ...rows] = parseCsv(readFileSync(inputPath, 'utf8').replace(/^﻿/, ''));
  if (!header) throw new Error(`${inputPath} is empty`);

  const column = Object.fromEntries(header.map((name, i) => [name.trim(), i]));
  const missing = REQUIRED_COLUMNS.filter((name) => !(name in column));
  if (missing.length > 0) {
    throw new Error(`missing column(s): ${missing.join(', ')} (found: ${header.join(', ')})`);
  }

  const seen = new Set();
  const lines = ['Designator,Mid X,Mid Y,Layer,Rotation'];

  for (const row of rows) {
    const ref = (row[column.Ref] ?? '').trim();
    if (!ref) throw new Error(`row without a designator: ${row.join(',')}`);
    if (seen.has(ref)) throw new Error(`duplicate designator: ${ref}`);
    seen.add(ref);
    if (bomDesignators && !bomDesignators.has(ref)) continue;

    const side = (row[column.Side] ?? '').trim().toLowerCase();
    if (!(side in LAYERS)) throw new Error(`${ref}: unknown side "${row[column.Side]}"`);

    lines.push(
      [
        ref,
        coordinate(row[column.PosX] ?? '', ref, 'PosX'),
        coordinate(row[column.PosY] ?? '', ref, 'PosY'),
        LAYERS[side],
        normalizeRotation(row[column.Rot] ?? '', ref),
      ].join(','),
    );
  }
  if (bomDesignators) {
    const unplaced = [...bomDesignators].filter((ref) => !seen.has(ref));
    if (unplaced.length > 0) {
      throw new Error(`in the BOM but not in the position file: ${unplaced.join(', ')}`);
    }
    const dropped = [...seen].filter((ref) => !bomDesignators.has(ref));
    if (dropped.length > 0) console.log(`Left out ${dropped.length} parts not in the BOM: ${dropped.join(', ')}`);
  }
  return lines;
}

const args = process.argv.slice(2);
const bomFlag = args.indexOf('--bom');
const bomPath = bomFlag >= 0 ? args.splice(bomFlag, 2)[1] : undefined;
const inputPath = path.resolve(args[0] ?? DEFAULT_INPUT);
const outputPath = path.resolve(
  args[1] ??
    (inputPath.endsWith('-pos.csv')
      ? inputPath.replace(/-pos\.csv$/, '-cpl-jlc.csv')
      : inputPath.replace(/(\.csv)?$/, '-jlc.csv')),
);

try {
  if (bomFlag >= 0 && !bomPath) throw new Error('--bom needs a file path');
  const lines = convert(inputPath, bomPath ? readBomDesignators(path.resolve(bomPath)) : undefined);
  writeFileSync(outputPath, `${lines.join('\n')}\n`);
  console.log(`Wrote ${lines.length - 1} parts to ${outputPath}`);
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
