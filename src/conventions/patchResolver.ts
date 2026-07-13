import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { AnalysisSkip, Diagnostic } from './types';
import { safeJoin } from './paths';

export interface ChangedRange { path: string; startLine: number; endLine: number; kind: 'added'; }
export interface PatchResolution { ranges: ChangedRange[]; skips: AnalysisSkip[]; diagnostics: Diagnostic[]; }

function normalize(text: string) { return text.replace(/\r\n/g, '\n'); }
function patchPath(value: string): string | null {
  if (value === '/dev/null') return null;
  if (!value.startsWith('a/') && !value.startsWith('b/')) throw new Error(`Unsupported patch path: ${value}`);
  const result = value.slice(2); if (!result || result.includes('"')) throw new Error(`Unsafe patch path: ${value}`); return result;
}
function copyDirectory(source: string, destination: string) { fs.cpSync(source, destination, { recursive: true, filter: value => !value.includes(`${path.sep}.git${path.sep}`) }); }

export function resolvePatch(baseRoot: string, postRoot: string, patchPathname: string): PatchResolution {
  const patch = fs.readFileSync(patchPathname, 'utf8');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'convention-patch-'));
  const working = path.join(temp, 'base');
  try {
    copyDirectory(baseRoot, working);
    fs.writeFileSync(path.join(temp, 'change.patch'), patch);
    execFileSync('git', ['apply', '--whitespace=nowarn', path.join(temp, 'change.patch')], { cwd: working, stdio: 'pipe' });
    const ranges: ChangedRange[] = [], skips: AnalysisSkip[] = [];
    const lines = normalize(patch).split('\n'); let oldPath: string | null = null, newPath: string | null = null, currentLine = 0;
    for (const line of lines) {
      if (line.startsWith('--- ')) oldPath = patchPath(line.slice(4).trim());
      else if (line.startsWith('+++ ')) { newPath = patchPath(line.slice(4).trim()); if (newPath === null && oldPath) skips.push({ path: oldPath, reason: 'deleted' }); }
      else {
        const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (hunk) { currentLine = Number(hunk[1]); continue; }
        if (!newPath || line.startsWith('\\')) continue;
        if (line.startsWith('+')) { ranges.push({ path: newPath, startLine: currentLine, endLine: currentLine, kind: 'added' }); currentLine++; }
        else if (!line.startsWith('-')) currentLine++;
      }
    }
    const touched = new Set(ranges.map(range => range.path));
    for (const repoPath of touched) {
      const expected = safeJoin(postRoot, repoPath); const actual = safeJoin(working, repoPath);
      if (!fs.existsSync(expected) || !fs.existsSync(actual) || normalize(fs.readFileSync(expected, 'utf8')) !== normalize(fs.readFileSync(actual, 'utf8'))) throw new Error(`Patch result does not match post-change source: ${repoPath}`);
    }
    return { ranges, skips, diagnostics: [] };
  } catch (error) { throw new Error(error instanceof Error ? `Invalid patch: ${error.message}` : 'Invalid patch.'); }
  finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
