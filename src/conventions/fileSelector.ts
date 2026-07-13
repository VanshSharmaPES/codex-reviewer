import fs from 'fs';
import path from 'path';
import { AnalysisSkip, Diagnostic, SOURCE_EXTENSIONS } from './types';
import { toRepoPath } from './paths';

const MAX_FILE_BYTES = 512 * 1024;
const EXCLUDED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'vendor']);
export interface FileSelection { paths: string[]; skips: AnalysisSkip[]; diagnostics: Diagnostic[]; }

function isTestPath(repoPath: string) { return /(^|\/)(__tests__|test)\/|\.(test|spec)\.[^.]+$/i.test(repoPath); }
export function selectSourceFiles(root: string, options: { maxFiles?: number; includeTests?: boolean } = {}): FileSelection {
  const paths: string[] = [], skips: AnalysisSkip[] = [], diagnostics: Diagnostic[] = [];
  const visit = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (!EXCLUDED_DIRS.has(entry.name)) visit(absolute); continue; }
      if (!entry.isFile()) continue;
      const repoPath = toRepoPath(root, absolute);
      const extension = path.extname(entry.name).toLowerCase();
      if (!SOURCE_EXTENSIONS.has(extension)) continue;
      if (/\.min\./i.test(entry.name) || (!options.includeTests && isTestPath(repoPath))) continue;
      if (fs.statSync(absolute).size > MAX_FILE_BYTES) { skips.push({ path: repoPath, reason: 'file-too-large' }); continue; }
      paths.push(repoPath);
    }
  };
  visit(path.resolve(root));
  paths.sort();
  const maxFiles = Math.min(Math.max(options.maxFiles ?? 50, 1), 50);
  if (paths.length > maxFiles) diagnostics.push({ code: 'FILE_LIMIT', severity: 'warning', message: `Selected the first ${maxFiles} of ${paths.length} eligible files.` });
  return { paths: paths.slice(0, maxFiles), skips, diagnostics };
}
