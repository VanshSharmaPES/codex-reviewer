import fs from 'fs';
import path from 'path';

export function toRepoPath(root: string, absolutePath: string): string {
  const resolvedRoot = fs.realpathSync(root);
  const resolvedFile = fs.realpathSync(absolutePath);
  const relative = path.relative(resolvedRoot, resolvedFile);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Path escapes repository root: ${absolutePath}`);
  return relative.split(path.sep).join('/');
}

export function safeJoin(root: string, repoPath: string): string {
  if (!repoPath || path.isAbsolute(repoPath) || repoPath.includes('\\')) throw new Error(`Unsafe repository path: ${repoPath}`);
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, repoPath);
  if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error(`Path escapes repository root: ${repoPath}`);
  return target;
}
