import fs from 'node:fs';
import path from 'node:path';
import { conventionProfileSchema, ConventionProfile } from './types';

export interface StoredProfile {
  owner: string;
  repo: string;
  profile: ConventionProfile;
  updatedAt: string;
}

function key(owner: string, repo: string): string {
  const value = `${owner}/${repo}`.toLowerCase();
  if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(value)) throw new Error('Repository identifier is unsafe.');
  return `${value.replace('/', '__')}.json`;
}

function profilePath(root: string, owner: string, repo: string): string {
  return path.join(path.resolve(root), '.codex-reviewer', 'profiles', key(owner, repo));
}

export function saveRepositoryProfile(root: string, owner: string, repo: string, profile: ConventionProfile): StoredProfile {
  const valid = conventionProfileSchema.parse(profile);
  const stored: StoredProfile = { owner, repo, profile: valid, updatedAt: new Date().toISOString() };
  const target = profilePath(root, owner, repo);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(stored, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, target);
  return stored;
}

export function loadRepositoryProfile(root: string, owner: string, repo: string): StoredProfile | null {
  const target = profilePath(root, owner, repo);
  if (!fs.existsSync(target)) return null;
  const parsed = JSON.parse(fs.readFileSync(target, 'utf8')) as StoredProfile;
  return { owner: parsed.owner, repo: parsed.repo, updatedAt: parsed.updatedAt, profile: conventionProfileSchema.parse(parsed.profile) };
}

export function deleteRepositoryProfile(root: string, owner: string, repo: string): boolean {
  const target = profilePath(root, owner, repo);
  if (!fs.existsSync(target)) return false;
  fs.unlinkSync(target);
  return true;
}

export function listRepositoryProfiles(root: string): StoredProfile[] {
  const directory = path.join(path.resolve(root), '.codex-reviewer', 'profiles');
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter(file => file.endsWith('.json')).sort().map(file => {
    const parsed = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8')) as StoredProfile;
    return { owner: parsed.owner, repo: parsed.repo, updatedAt: parsed.updatedAt, profile: conventionProfileSchema.parse(parsed.profile) };
  });
}
