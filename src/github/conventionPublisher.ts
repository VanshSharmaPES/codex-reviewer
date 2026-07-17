import { Octokit } from '@octokit/rest';
import { ReviewResult } from '../conventions/types';

export async function publishConventionReview(octokit: Octokit, owner: string, repo: string, prNumber: number, headSha: string, result: ReviewResult): Promise<void> {
  const annotations = result.violations.slice(0, 50).map(violation => ({
    path: violation.path,
    start_line: violation.line,
    end_line: violation.line,
    annotation_level: 'warning' as const,
    message: `${violation.message} Confidence: ${Math.round(violation.confidence * 100)}%. Evidence: ${violation.examples.map(example => `${example.path}:${example.line}`).join(', ') || 'profile rule'}`,
  }));
  await octokit.rest.checks.create({ owner, repo, name: 'Codex Reviewer conventions', head_sha: headSha, status: 'completed', conclusion: result.violations.length ? 'failure' : 'success', output: { title: result.partial ? 'Convention review completed with skips' : 'Convention review completed', summary: result.violations.length ? `${result.violations.length} convention violation(s) found.` : 'No enforceable convention violations found.', annotations } });
  if (!result.violations.length) return;
  const comments = result.violations.filter(violation => violation.line > 0).slice(0, 50).map(violation => ({ path: violation.path, line: violation.line, side: 'RIGHT' as const, body: `**Convention:** ${violation.ruleId}\n\n${violation.message}\n\nConfidence: ${Math.round(violation.confidence * 100)}%` }));
  if (comments.length) await octokit.rest.pulls.createReview({ owner, repo, pull_number: prNumber, event: 'COMMENT', comments });
}
