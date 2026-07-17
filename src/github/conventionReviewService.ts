import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Octokit } from '@octokit/rest';
import { selectSourceFiles } from '../conventions/fileSelector';
import { extractFileFeatures } from '../conventions/extractor';
import { buildProfile } from '../conventions/profileBuilder';
import { readProfile, writeProfile } from '../conventions/profileStore';
import { resolvePatch } from '../conventions/patchResolver';
import { evaluateProfile } from '../conventions/evaluator';
import { safeJoin } from '../conventions/paths';
import { ReviewResult } from '../conventions/types';

async function materializeTree(octokit: Octokit, owner: string, repo: string, sha: string, root: string): Promise<void> {
  const tree = await octokit.rest.git.getTree({ owner, repo, tree_sha: sha, recursive: '1' });
  for (const entry of tree.data.tree) {
    if (entry.type !== 'blob' || !entry.path || !/\.(ts|tsx|js|jsx)$/.test(entry.path)) continue;
    const blob = await octokit.rest.git.getBlob({ owner, repo, file_sha: entry.sha! });
    const target = safeJoin(root, entry.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, Buffer.from(blob.data.content, blob.data.encoding as BufferEncoding));
  }
}

function patchFromFiles(files: Array<{ filename: string; patch?: string }>): string {
  return files.filter(file => file.patch).map(file => `diff --git a/${file.filename} b/${file.filename}\n--- a/${file.filename}\n+++ b/${file.filename}\n${file.patch}`).join('\n');
}

export async function runConventionReview(octokit: Octokit, owner: string, repo: string, baseSha: string, headSha: string, files: Array<{ filename: string; patch?: string }>, profilePath?: string): Promise<ReviewResult> {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-review-github-'));
  const baseRoot = path.join(temporary, 'base');
  const headRoot = path.join(temporary, 'head');
  try {
    fs.mkdirSync(baseRoot, { recursive: true }); fs.mkdirSync(headRoot, { recursive: true });
    await materializeTree(octokit, owner, repo, baseSha, baseRoot);
    await materializeTree(octokit, owner, repo, headSha, headRoot);
    const selected = selectSourceFiles(baseRoot);
    const sources = selected.paths.map(file => { const source = fs.readFileSync(safeJoin(baseRoot, file), 'utf8'); return { path: file, source, features: extractFileFeatures(file, source) }; }).filter(item => !item.features.parseError);
    const profile = profilePath && fs.existsSync(profilePath) ? readProfile(profilePath) : buildProfile(baseRoot, sources);
    if (profilePath && !fs.existsSync(profilePath)) writeProfile(profilePath, profile);
    const patchPath = path.join(temporary, 'change.patch'); fs.writeFileSync(patchPath, patchFromFiles(files));
    const resolution = resolvePatch(baseRoot, headRoot, patchPath);
    const touched = [...new Set(resolution.ranges.map(range => range.path))];
    const changed = touched.map(file => extractFileFeatures(file, fs.readFileSync(safeJoin(headRoot, file), 'utf8')));
    const result = evaluateProfile(profile, changed, resolution.ranges);
    result.skips.push(...resolution.skips); result.diagnostics.push(...resolution.diagnostics); result.partial = result.skips.length > 0;
    return result;
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}
