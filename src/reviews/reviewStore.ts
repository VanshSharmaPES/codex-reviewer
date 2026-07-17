import fs from 'node:fs';
import path from 'node:path';

export interface ReviewHistoryEntry { id: string; owner: string; repo: string; prNumber: number; status: 'passed' | 'failed' | 'partial'; violations: number; profileFingerprint?: string; createdAt: string; }
const storePath = () => path.resolve(process.env.REVIEW_HISTORY_PATH || '.codex-reviewer/reviews.json');
export function listReviews(): ReviewHistoryEntry[] { const file = storePath(); if (!fs.existsSync(file)) return []; return JSON.parse(fs.readFileSync(file, 'utf8')) as ReviewHistoryEntry[]; }
export function recordReview(entry: ReviewHistoryEntry): void { const file = storePath(); fs.mkdirSync(path.dirname(file), { recursive: true }); const temporary = `${file}.${process.pid}.tmp`; fs.writeFileSync(temporary, `${JSON.stringify([entry, ...listReviews()].slice(0, 500), null, 2)}\n`); fs.renameSync(temporary, file); }
