import { ConventionProfile, FileFeatures, ProfileRule, ReviewResult, Violation } from './types';
import { ChangedRange } from './patchResolver';
import { classifyIdentifier } from './extractor';

function overlaps(range: ChangedRange, start: number, end: number) { return range.startLine <= end && range.endLine >= start; }
function violation(rule: ProfileRule, path: string, line: number, message: string): Violation { return { ruleId: rule.id, path, line, message, confidence: rule.confidence, examples: rule.examples }; }
export function evaluateProfile(profile: ConventionProfile, files: FileFeatures[], ranges: ChangedRange[]): ReviewResult {
  const result: ReviewResult = { violations: [], skips: [], diagnostics: [], partial: false, fixes: [] };
  const rangesByPath = new Map<string, ChangedRange[]>(); for (const range of ranges) rangesByPath.set(range.path, [...(rangesByPath.get(range.path) ?? []), range]);
  for (const file of files) {
    if (file.parseError) { result.skips.push({ path: file.path, reason: 'parse-error' }); result.partial = true; continue; }
    const changed = rangesByPath.get(file.path) ?? []; if (!changed.length) continue;
    for (const rule of profile.rules.filter(rule => rule.enforceable)) {
      if (rule.id === 'import-order') {
        const importLines = file.imports.map(item => item.line); if (!importLines.length || !changed.some(range => importLines.some(line => overlaps(range, line, line)))) continue;
        const rank = { builtin: 0, external: 1, relative: 2 }; const ordered = file.imports.every((item, index, all) => index === 0 || (rank[item.group] > rank[all[index - 1].group] || (item.group === all[index - 1].group && item.source.localeCompare(all[index - 1].source) >= 0)));
        if (!ordered) result.violations.push(violation(rule, file.path, file.imports[0].line, 'Imports do not follow the repository grouping and alphabetical ordering convention.'));
      } else for (const declaration of file.declarations) {
        const changedDeclaration = changed.some(range => overlaps(range, declaration.line, declaration.endLine)); if (!changedDeclaration) continue;
        if (rule.id === 'function-name-style' && declaration.kind === 'function' && classifyIdentifier(declaration.name) !== rule.expected.style) result.violations.push(violation(rule, file.path, declaration.line, `Function '${declaration.name}' should use ${rule.expected.style}.`));
        if (rule.id === 'variable-name-style' && declaration.kind === 'variable' && classifyIdentifier(declaration.name) !== rule.expected.style) result.violations.push(violation(rule, file.path, declaration.line, `Variable '${declaration.name}' should use ${rule.expected.style}.`));
        if (rule.id === 'class-name-style' && declaration.kind === 'class' && classifyIdentifier(declaration.name) !== rule.expected.style) result.violations.push(violation(rule, file.path, declaration.line, `Class '${declaration.name}' should use ${rule.expected.style}.`));
        if (rule.id === 'function-length' && declaration.kind === 'function' && (declaration.bodyLines ?? 0) > rule.expected.maxNonCommentBodyLines) result.violations.push(violation(rule, file.path, declaration.line, `Function body has ${declaration.bodyLines} lines; repository limit is ${rule.expected.maxNonCommentBodyLines}.`));
        if (rule.id === 'export-doc-comment' && declaration.exported && !declaration.documented) result.violations.push(violation(rule, file.path, declaration.line, `Export '${declaration.name}' requires an immediately preceding TSDoc comment.`));
      }
    }
  }
  result.violations.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.ruleId.localeCompare(b.ruleId));
  return result;
}
