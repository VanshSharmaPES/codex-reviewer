import OpenAI from 'openai';
import { z } from 'zod';
import { Diagnostic, FileFeatures, LlmPattern } from './types';

const MAX_CHARS = 12_000;
const patternSchema = z.object({
  id: z.enum(['error-handling-shape', 'function-structure-shape']),
  rule: z.string().min(1).max(500),
  confidence: z.number().min(0).max(1),
  examples: z.array(z.object({ path: z.string(), line: z.number().int().positive() })).min(1).max(15),
});

export interface PatternSource { path: string; source: string; features: FileFeatures; }
export interface PatternClient { complete(system: string, user: string): Promise<string>; }

function configuredClient(): PatternClient | null {
  const apiKey = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  const client = new OpenAI({ apiKey, baseURL: process.env.OPENAI_BASE_URL || (process.env.GROQ_API_KEY ? 'https://api.groq.com/openai/v1' : undefined) });
  const model = process.env.OPENAI_MODEL || (process.env.GROQ_API_KEY ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini');
  return { complete: async (system, user) => (await client.chat.completions.create({ model, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })).choices[0]?.message?.content ?? '{}' };
}

function samplesFor(id: LlmPattern['id'], sources: PatternSource[]) {
  const result: { path: string; line: number; snippet: string }[] = [];
  for (const entry of [...sources].sort((a, b) => a.path.localeCompare(b.path))) for (const declaration of entry.features.declarations) {
    if (declaration.kind !== 'function') continue;
    const lines = entry.source.split(/\r?\n/); const snippet = lines.slice(declaration.line - 1, declaration.endLine).join('\n');
    if (id === 'error-handling-shape' && !/\b(try|catch|throw)\b/.test(snippet)) continue;
    result.push({ path: entry.path, line: declaration.line, snippet }); if (result.length === 15) return result;
  }
  return result;
}

export async function extractLlmPatterns(sources: PatternSource[], client: PatternClient | null = configuredClient()): Promise<{ patterns: LlmPattern[]; diagnostics: Diagnostic[] }> {
  if (!client) return { patterns: [], diagnostics: [{ code: 'LLM_UNAVAILABLE', severity: 'warning', message: 'Skipping advisory patterns because no AI provider key is configured.' }] };
  const patterns: LlmPattern[] = [], diagnostics: Diagnostic[] = [];
  for (const id of ['error-handling-shape', 'function-structure-shape'] as const) {
    const samples = samplesFor(id, sources); if (!samples.length) continue;
    const candidates = new Set(samples.map(sample => `${sample.path}:${sample.line}`));
    const user = JSON.stringify({ pattern: id, candidates: samples.map(sample => ({ path: sample.path, line: sample.line, code: sample.snippet })).slice(0, 15) }).slice(0, MAX_CHARS);
    try {
      const raw = await client.complete('Infer one concise repository convention. Return JSON with id, rule, confidence, and examples. Examples must only use supplied path and line values.', user);
      const parsed = patternSchema.parse(JSON.parse(raw));
      if (parsed.id !== id || !parsed.examples.every(example => candidates.has(`${example.path}:${example.line}`))) throw new Error('Model returned an unsupported pattern ID or evidence location.');
      patterns.push({ ...parsed, kind: 'llm-advisory' });
    } catch (error) { diagnostics.push({ code: 'LLM_PATTERN_FAILED', severity: 'warning', message: `${id}: ${error instanceof Error ? error.message : 'unknown failure'}` }); }
  }
  return { patterns, diagnostics };
}
