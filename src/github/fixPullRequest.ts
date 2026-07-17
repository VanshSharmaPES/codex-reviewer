import { Octokit } from '@octokit/rest';
import { FixResult } from '../conventions/types';

export async function createValidatedFixPullRequest(octokit: Octokit, owner: string, repo: string, prNumber: number, headSha: string, fixes: FixResult[], files: Map<string, string>): Promise<string | null> {
  const validated = fixes.filter(fix => fix.status === 'validated' && fix.unifiedDiff && files.has(fix.violation.path));
  if (!validated.length) return null;
  const branch = `codex-reviewer/fixes-${prNumber}-${headSha.slice(0, 8)}`;
  await octokit.rest.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: headSha });
  for (const fix of validated) {
    const content = files.get(fix.violation.path)!;
    await octokit.rest.repos.createOrUpdateFileContents({ owner, repo, path: fix.violation.path, message: `fix: apply ${fix.violation.ruleId}`, content: Buffer.from(content).toString('base64'), branch });
  }
  const pull = await octokit.rest.pulls.create({ owner, repo, title: 'Codex Reviewer: apply validated convention fixes', head: branch, base: (await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber })).data.base.ref, body: 'This pull request was created from fixes validated in an isolated copy by Codex Reviewer.' });
  return pull.data.html_url;
}
