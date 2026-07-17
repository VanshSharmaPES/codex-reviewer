import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { classifyIdentifier, extractFileFeatures } from '../../src/conventions/extractor';
import { buildProfile } from '../../src/conventions/profileBuilder';
import { evaluateProfile } from '../../src/conventions/evaluator';
import { extractLlmPatterns } from '../../src/conventions/llmPatterns';
import { generateFixes } from '../../src/conventions/fixGenerator';
import { validateFix } from '../../src/conventions/fixValidator';
import { deleteRepositoryProfile, listRepositoryProfiles, loadRepositoryProfile, saveRepositoryProfile } from '../../src/conventions/profileRegistry';
import { createValidatedFixPullRequest } from '../../src/github/fixPullRequest';
import { publishConventionReview } from '../../src/github/conventionPublisher';
import { listReviews, recordReview } from '../../src/reviews/reviewStore';

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

test('accepts only model patterns grounded in supplied examples', async () => {
  const source = 'export function runTask() { try { return true; } catch { throw new Error("failed"); } }';
  const features = extractFileFeatures('src/task.ts', source);
  const client = { complete: async (_system: string, user: string) => {
    const candidate = JSON.parse(user).candidates[0];
    return JSON.stringify({ id: 'error-handling-shape', rule: 'Handle errors before returning.', confidence: 0.9, examples: [{ path: candidate.path, line: candidate.line }] });
  } };
  const result = await extractLlmPatterns([{ path: 'src/task.ts', source, features }], client);
  assert.equal(result.patterns.length, 1);
  assert.equal(result.patterns[0].kind, 'llm-advisory');
});

test('reports invalid model evidence without creating an advisory rule', async () => {
  const features = extractFileFeatures('src/task.ts', 'export function runTask() { return true; }');
  const result = await extractLlmPatterns([{ path: 'src/task.ts', source: 'export function runTask() { return true; }', features }], { complete: async () => JSON.stringify({ id: 'function-structure-shape', rule: 'Unsupported evidence.', confidence: 0.9, examples: [{ path: 'src/missing.ts', line: 1 }] }) });
  assert.equal(result.patterns.length, 0);
  assert.equal(result.diagnostics[0].code, 'LLM_PATTERN_FAILED');
});

test('generates a structured diff only for the reported file', async () => {
  const violation = { ruleId: 'function-name-style' as const, path: 'src/helpers.ts', line: 1, message: 'Use camelCase.', confidence: 1, examples: [] };
  const client = { complete: async () => JSON.stringify({ path: 'src/helpers.ts', explanation: 'Rename the function.', unifiedDiff: '--- a/src/helpers.ts\n+++ b/src/helpers.ts\n@@ -1 +1 @@\n-export function bad_name() {}\n+export function badName() {}' }) };
  const results = await generateFixes([violation], new Map([['src/helpers.ts', 'export function bad_name() {}']]), client);
  assert.equal(results[0].status, 'generated');
  assert.match(results[0].unifiedDiff ?? '', /badName/);
});

test('validates a generated fix in an isolated copy', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'convention-fix-test-'));
  const source = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen'].map(name => `export function formatValue${name}(value: string) { return value.trim(); }`).join('\n');
  const changed = `${source}\nexport function format_value_new(value: string) { return value.trim(); }`;
  fs.mkdirSync(path.join(directory, 'src'), { recursive: true }); fs.writeFileSync(path.join(directory, 'src', 'helpers.ts'), changed);
  const baseFeatures = extractFileFeatures('src/helpers.ts', source); const profile = buildProfile(directory, [{ path: 'src/helpers.ts', source, features: baseFeatures }]);
  const violation = { ruleId: 'function-name-style' as const, path: 'src/helpers.ts', line: 16, message: 'Use camelCase.', confidence: 1, examples: [] };
  const unifiedDiff = 'diff --git a/src/helpers.ts b/src/helpers.ts\nindex 1111111..2222222 100644\n--- a/src/helpers.ts\n+++ b/src/helpers.ts\n@@ -13,3 +13,4 @@ export function formatValueTwelve(value: string) { return value.trim(); }\n export function formatValueThirteen(value: string) { return value.trim(); }\n export function formatValueFourteen(value: string) { return value.trim(); }\n export function formatValueFifteen(value: string) { return value.trim(); }\n+export function formatValueNew(value: string) { return value.trim(); }\n';
  const fix = { violation, status: 'generated' as const, unifiedDiff, reason: 'Rename the function.' };
  const result = validateFix(fix, directory, profile);
  assert.equal(result.status, 'validated', result.reason);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('rejects a fix that targets a different file', () => {
  const violation = { ruleId: 'function-name-style' as const, path: 'src/helpers.ts', line: 1, message: 'Use camelCase.', confidence: 1, examples: [] };
  const result = validateFix({ violation, status: 'generated', unifiedDiff: '--- a/src/other.ts\n+++ b/src/other.ts\n@@ -1,1 +1,1 @@\n-old\n+new' }, process.cwd(), { schemaVersion: 1, repository: { root: process.cwd(), sampledPaths: [], createdAt: new Date().toISOString(), fingerprint: '0'.repeat(64) }, rules: [], llmPatterns: [] });
  assert.equal(result.status, 'rejected');
});

test('persists and reloads a repository profile atomically', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'convention-registry-'));
  const profile = buildProfile(directory, [{ path: 'src/helpers.ts', source: 'export function formatValue(value: string) { return value; }', features: extractFileFeatures('src/helpers.ts', 'export function formatValue(value: string) { return value; }') }]);
  saveRepositoryProfile(directory, 'Acme', 'Payments', profile);
  assert.equal(loadRepositoryProfile(directory, 'acme', 'payments')?.profile.schemaVersion, 1);
  assert.equal(listRepositoryProfiles(directory).length, 1);
  assert.equal(deleteRepositoryProfile(directory, 'acme', 'payments'), true);
  assert.equal(loadRepositoryProfile(directory, 'acme', 'payments'), null);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('creates an idempotent validated-fix pull request', async () => {
  const calls: string[] = [];
  const octokit = { rest: {
    git: { createRef: async () => { calls.push('ref'); } },
    repos: { createOrUpdateFileContents: async () => { calls.push('file'); } },
    pulls: { list: async () => ({ data: [] }), get: async () => ({ data: { base: { ref: 'main' } } }), create: async () => { calls.push('pr'); return { data: { html_url: 'https://github.com/acme/app/pull/2' } }; }, },
  } } as any;
  const violation = { ruleId: 'function-name-style' as const, path: 'src/helpers.ts', line: 1, message: 'Use camelCase.', confidence: 1, examples: [] };
  const fix = { violation, status: 'validated' as const, unifiedDiff: 'diff', fixedSource: 'export function goodName() {}' };
  const url = await createValidatedFixPullRequest(octokit, 'acme', 'app', 1, 'abcdef123456', [fix], new Map([['src/helpers.ts', fix.fixedSource]]));
  assert.equal(url, 'https://github.com/acme/app/pull/2');
  assert.deepEqual(calls, ['ref', 'file', 'pr']);
});

test('publishes a convention check and changed-line comments', async () => {
  const calls: string[] = [];
  const octokit = { rest: { checks: { create: async (input: any) => { calls.push(`check:${input.conclusion}:${input.output.annotations.length}`); } }, pulls: { createReview: async (input: any) => { calls.push(`review:${input.comments.length}`); } } } } as any;
  await publishConventionReview(octokit, 'acme', 'app', 4, 'head-sha', { violations: [{ ruleId: 'function-name-style', path: 'src/file.ts', line: 8, message: 'Use camelCase.', confidence: .9, examples: [{ path: 'src/example.ts', line: 2 }] }], skips: [], diagnostics: [], partial: false, fixes: [] });
  assert.deepEqual(calls, ['check:failure:1', 'review:1']);
});

test('records review telemetry newest-first', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'review-history-'));
  const previous = process.env.REVIEW_HISTORY_PATH;
  process.env.REVIEW_HISTORY_PATH = path.join(directory, 'reviews.json');
  recordReview({ id: 'one', owner: 'acme', repo: 'app', prNumber: 1, status: 'passed', violations: 0, durationMs: 100, filesAnalyzed: 2, provider: 'deterministic', createdAt: '2026-01-01T00:00:00.000Z' });
  recordReview({ id: 'two', owner: 'acme', repo: 'app', prNumber: 2, status: 'failed', violations: 1, durationMs: 200, filesAnalyzed: 3, provider: 'groq', createdAt: '2026-01-02T00:00:00.000Z' });
  assert.deepEqual(listReviews().map(review => review.id), ['two', 'one']);
  if (previous === undefined) delete process.env.REVIEW_HISTORY_PATH; else process.env.REVIEW_HISTORY_PATH = previous;
  fs.rmSync(directory, { recursive: true, force: true });
});
