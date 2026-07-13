import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { classifyIdentifier, extractFileFeatures } from '../../src/conventions/extractor';
import { buildProfile } from '../../src/conventions/profileBuilder';
import { evaluateProfile } from '../../src/conventions/evaluator';

test('classifies supported identifier styles', () => {
  assert.equal(classifyIdentifier('formatValue'), 'camelCase');
  assert.equal(classifyIdentifier('FormatValue'), 'PascalCase');
  assert.equal(classifyIdentifier('format_value'), 'snake_case');
  assert.equal(classifyIdentifier('FORMAT_VALUE'), 'SCREAMING_SNAKE_CASE');
  assert.equal(classifyIdentifier('__internal'), null);
});

test('only evaluates a changed declaration', () => {
  const base = Array.from({ length: 15 }, (_, index) => `export function formatValue${index}(value: string) { return value.trim(); }`).join('\n');
  const baseFeatures = extractFileFeatures('src/helpers.ts', base);
  const profile = buildProfile('fixture', [{ path: 'src/helpers.ts', source: base, features: baseFeatures }]);
  const changed = `${base}\nexport function format_value_new(value: string) { return value.trim(); }`;
  const changedFeatures = extractFileFeatures('src/helpers.ts', changed);
  const result = evaluateProfile(profile, [changedFeatures], [{ path: 'src/helpers.ts', startLine: 16, endLine: 16, kind: 'added' }]);
  assert.deepEqual(result.violations.map(item => item.ruleId), ['function-name-style']);
  assert.match(result.violations[0].message, /format_value_new/);
});

test('profile storage rejects unknown schema versions', async () => {
  const { readProfile } = await import('../../src/conventions/profileStore');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'conventions-test-'));
  const profilePath = path.join(directory, 'profile.json');
  fs.writeFileSync(profilePath, JSON.stringify({ schemaVersion: 2 }));
  assert.throws(() => readProfile(profilePath));
  fs.rmSync(directory, { recursive: true, force: true });
});
