'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Review = { id: string; owner: string; repo: string; prNumber: number; status: 'passed' | 'failed' | 'partial'; violations: number; filesAnalyzed?: number; durationMs?: number; provider?: string; createdAt: string };

const statusCopy = { passed: 'Passed', failed: 'Findings', partial: 'Partial' } as const;

export default function DashboardPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/reviews').then(response => {
      if (!response.ok) throw new Error('Unable to load review history.');
      return response.json();
    }).then(data => setReviews(data.reviews ?? [])).catch(() => setError('Review history is unavailable right now.')).finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => ({
    total: reviews.length,
    passed: reviews.filter(review => review.status === 'passed').length,
    findings: reviews.reduce((total, review) => total + review.violations, 0),
    averageDuration: reviews.length ? Math.round(reviews.reduce((total, review) => total + (review.durationMs ?? 0), 0) / reviews.length) : 0,
  }), [reviews]);

  return (
    <main className="min-h-screen bg-cyber-950 text-slate-100 font-sans">
      <header className="border-b border-cyber-800 bg-cyber-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
            <Link href="/" className="flex items-center gap-3" aria-label="Codex Reviewer home">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-volt-300 text-sm font-black text-black">C</span>
            <span className="font-display text-sm font-bold tracking-tight">Codex Reviewer</span>
            </Link>
          <span className="font-mono text-[11px] text-slate-500">Review history</span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 font-mono text-[11px] text-volt-300">WORKSPACE / REVIEWS</p>
            <h1 className="font-display text-3xl font-bold tracking-tight text-slate-100">Review history</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">A durable record of convention checks run across your repositories.</p>
          </div>
          <Link href="/" className="rounded border border-cyber-700 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-volt-300/50 hover:text-volt-300 focus:outline-none focus:ring-2 focus:ring-volt-300/50">Run a review</Link>
        </div>

        <section aria-label="Review summary" className="mb-8 grid gap-px overflow-hidden rounded-lg border border-cyber-800 bg-cyber-800 sm:grid-cols-3">
          {[['Reviews recorded', summary.total], ['Passed checks', summary.passed], ['Violations found', summary.findings], ['Avg. duration', summary.averageDuration ? `${(summary.averageDuration / 1000).toFixed(1)}s` : '—']].map(([label, value]) => (
            <div key={label} className="bg-cyber-900 px-5 py-5">
              <p className="font-mono text-[11px] text-slate-500">{label}</p>
              <p className="mt-2 font-display text-2xl font-bold text-slate-100">{value}</p>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-lg border border-cyber-800 bg-cyber-900">
          <div className="flex items-center justify-between border-b border-cyber-800 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-200">Recent runs</h2>
            <span className="font-mono text-[11px] text-slate-500">{reviews.length} total</span>
          </div>
          {loading && <div className="space-y-3 p-5" aria-label="Loading review history"><div className="h-12 animate-pulse rounded bg-cyber-800" /><div className="h-12 animate-pulse rounded bg-cyber-800" /></div>}
          {!loading && error && <div className="p-8 text-center text-sm text-rose-300">{error}</div>}
          {!loading && !error && reviews.length === 0 && <div className="p-12 text-center"><p className="text-sm font-semibold text-slate-300">No reviews recorded yet</p><p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-slate-500">Run a convention review from a GitHub webhook to see repository history here.</p></div>}
          {!loading && !error && reviews.length > 0 && <div className="divide-y divide-cyber-800">{reviews.map(review => <div key={review.id} className="flex flex-col gap-3 px-5 py-4 transition hover:bg-cyber-850/40 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono text-sm text-slate-200">{review.owner}/{review.repo} <span className="text-slate-500">#{review.prNumber}</span></p><p className="mt-1 text-xs text-slate-500">{new Date(review.createdAt).toLocaleString()} · {review.filesAnalyzed ?? 0} files · {review.provider ?? 'unknown'}</p></div><div className="flex items-center gap-5"><span className="font-mono text-xs text-slate-400">{review.violations} violation{review.violations === 1 ? '' : 's'}</span><span className={`rounded px-2 py-1 text-[11px] font-semibold ${review.status === 'passed' ? 'bg-volt-300/10 text-volt-300' : review.status === 'failed' ? 'bg-rose-400/10 text-rose-300' : 'bg-amber-300/10 text-amber-300'}`}>{statusCopy[review.status]}</span></div></div>)}</div>}
        </section>
      </div>
    </main>
  );
}
