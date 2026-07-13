import { ConventionProfile, ReviewResult } from './types';

export function renderProfile(profile: ConventionProfile, skipped = 0): string {
  const lines = [`Convention profile: ${profile.repository.root}`, `Sampled files: ${profile.repository.sampledPaths.length}${skipped ? ` (${skipped} skipped)` : ''}`, `Fingerprint: ${profile.repository.fingerprint}`, ''];
  if (!profile.rules.length) return [...lines, 'No convention had enough evidence to become enforceable.'].join('\n');
  for (const rule of profile.rules) lines.push(`${rule.enforceable ? 'ENFORCE' : 'ADVISORY'} ${rule.id}: ${JSON.stringify(rule.expected)} (${Math.round(rule.confidence * 100)}%, ${rule.supportCount}/${rule.eligibleCount})`, ...rule.examples.map(example => `  - ${example.path}:${example.line}`));
  return lines.join('\n');
}

export function renderReview(result: ReviewResult): string {
  const lines = [result.partial ? 'Review result: partial' : 'Review result: complete'];
  if (!result.violations.length) lines.push('No enforceable convention violations found.');
  for (const violation of result.violations) lines.push('', `${violation.path}:${violation.line} [${violation.ruleId}] ${violation.message} (${Math.round(violation.confidence * 100)}%)`, ...violation.examples.map(example => `  evidence: ${example.path}:${example.line}`));
  for (const skip of result.skips) lines.push(`SKIPPED ${skip.path}: ${skip.reason}`);
  for (const diagnostic of result.diagnostics) lines.push(`${diagnostic.severity.toUpperCase()} ${diagnostic.code}: ${diagnostic.message}`);
  return lines.join('\n');
}
