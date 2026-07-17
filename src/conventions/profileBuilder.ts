import crypto from 'crypto';
import { ConventionProfile, DeclarationFeature, FileFeatures, IdentifierStyle, LlmPattern, ProfileRule, RuleId } from './types';
import { classifyIdentifier } from './extractor';

const minForRule = (id: RuleId) => id === 'import-order' ? 10 : 15;
const stableExamples = (items: { path: string; line: number }[]) => [...items].sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line).slice(0, 5);
function dominantStyle(id: Extract<RuleId, `${string}-name-style`>, kind: DeclarationFeature['kind'], files: FileFeatures[]): ProfileRule | null {
  const values = files.flatMap(file => file.declarations.filter(d => d.kind === kind).map(d => ({ value: d.name, path: file.path, line: d.line }))).map(item => ({ ...item, style: classifyIdentifier(item.value) })).filter((item): item is typeof item & { style: IdentifierStyle } => Boolean(item.style));
  if (!values.length) return null;
  const groups = new Map<IdentifierStyle, typeof values>(); for (const value of values) groups.set(value.style, [...(groups.get(value.style) ?? []), value]);
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length); const [style, support] = sorted[0];
  const confidence = Math.round((support.length / values.length) * 100) / 100;
  return { id, kind: 'deterministic', expected: { style }, supportCount: support.length, eligibleCount: values.length, confidence, examples: stableExamples(support), enforceable: values.length >= minForRule(id) && confidence >= .8 && (!sorted[1] || sorted[1][1].length !== support.length) } as ProfileRule;
}
function importRule(files: FileFeatures[]): ProfileRule | null {
  const eligible = files.filter(file => file.imports.length > 0); if (!eligible.length) return null;
  const valid = eligible.filter(file => { const groups = file.imports.map(i => i.group); const rank = { builtin: 0, external: 1, relative: 2 }; return groups.every((group, i) => i === 0 || rank[group] >= rank[groups[i - 1]]) && file.imports.every((item, i, all) => i === 0 || item.group !== all[i - 1].group || item.source.localeCompare(all[i - 1].source) >= 0); });
  const confidence = Math.round((valid.length / eligible.length) * 100) / 100;
  return { id: 'import-order', kind: 'deterministic', expected: { groups: ['builtin', 'external', 'relative'], alphabetizedWithinGroups: true }, supportCount: valid.length, eligibleCount: eligible.length, confidence, examples: stableExamples(valid.map(file => ({ path: file.path, line: file.imports[0].line }))), enforceable: eligible.length >= 10 && confidence >= .8 };
}
function documentationRule(files: FileFeatures[]): ProfileRule | null {
  const declarations = files.flatMap(file => file.declarations.filter(d => d.exported).map(d => ({ ...d, path: file.path }))); if (!declarations.length) return null;
  const documented = declarations.filter(d => d.documented); const confidence = Math.round((documented.length / declarations.length) * 100) / 100;
  return { id: 'export-doc-comment', kind: 'deterministic', expected: { required: true }, supportCount: documented.length, eligibleCount: declarations.length, confidence, examples: stableExamples(documented), enforceable: declarations.length >= 15 && confidence >= .8 };
}
function lengthRule(files: FileFeatures[]): ProfileRule | null {
  const functions = files.flatMap(file => file.declarations.filter(d => d.kind === 'function' && d.bodyLines !== undefined).map(d => ({ ...d, path: file.path }))); if (!functions.length) return null;
  const ordered = functions.map(f => f.bodyLines!).sort((a, b) => a - b); const median = ordered[Math.floor(ordered.length / 2)]; const max = Math.max(10, Math.ceil(median * 1.5));
  return { id: 'function-length', kind: 'deterministic', expected: { maxNonCommentBodyLines: max, medianNonCommentBodyLines: median }, supportCount: functions.filter(f => f.bodyLines! <= max).length, eligibleCount: functions.length, confidence: 1, examples: stableExamples(functions.slice(0, 5)), enforceable: functions.length >= 15 };
}
export function fingerprint(root: string, files: { path: string; source: string }[]) { return crypto.createHash('sha256').update(files.sort((a, b) => a.path.localeCompare(b.path)).map(file => `${file.path}\0${crypto.createHash('sha256').update(file.source).digest('hex')}`).join('\n')).digest('hex'); }
export function buildProfile(root: string, sources: { path: string; source: string; features: FileFeatures }[], llmPatterns: LlmPattern[] = []): ConventionProfile {
  const files = sources.map(s => s.features); const rules = [dominantStyle('function-name-style', 'function', files), dominantStyle('variable-name-style', 'variable', files), dominantStyle('class-name-style', 'class', files), importRule(files), lengthRule(files), documentationRule(files)].filter((rule): rule is ProfileRule => Boolean(rule));
  return { schemaVersion: 1, repository: { root, sampledPaths: sources.map(s => s.path).sort(), createdAt: new Date().toISOString(), fingerprint: fingerprint(root, sources) }, rules, llmPatterns };
}
