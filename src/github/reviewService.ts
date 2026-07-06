import pRetry from 'p-retry';
import pino from 'pino';
import { getOctokitClient } from './client';
import { fetchPRDiff } from './diffFetcher';
import { parseCode } from '../parser/astParser';
import { getTriggeredRules } from '../rules/ruleEngine';
import { buildSystemPrompt, buildUserPrompt } from '../prompt/contextBuilder';
import { analyzeCode } from '../ai/analyzer';
import { postReviewComments } from './commenter';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export async function runPRReview(
    owner: string,
    repo: string,
    prNumber: number,
    installationId: number
): Promise<void> {
    logger.info(`Starting direct PR analysis for ${owner}/${repo}#${prNumber}`);

    const octokit = getOctokitClient(installationId);

    const diffFiles = await pRetry(() => fetchPRDiff(octokit, owner, repo, prNumber), {
        retries: 3,
        onFailedAttempt: error => {
            logger.warn(`Diff fetch failed, attempt ${error.attemptNumber}`);
        }
    });

    const allFindings: any[] = [];

    for (const file of diffFiles) {
        if (!file.patch) continue;

        const parsedContext = parseCode(file.filename, file.patch);
        const rules = getTriggeredRules(parsedContext);

        const systemPrompt = buildSystemPrompt();
        const userPrompt = buildUserPrompt(
            file.filename,
            parsedContext.language,
            file.patch,
            parsedContext.astSummary,
            rules
        );

        const findings = await pRetry(() => analyzeCode(systemPrompt, userPrompt), {
            retries: 3,
            onFailedAttempt: error => {
                logger.warn(`AI analysis failed for ${file.filename}, attempt ${error.attemptNumber}`);
            }
        });

        if (findings.length > 0) {
            allFindings.push({ file, findings });
        }
    }

    await pRetry(() => postReviewComments(octokit, owner, repo, prNumber, diffFiles, allFindings), {
        retries: 3,
        onFailedAttempt: error => {
            logger.warn(`Posting comments failed, attempt ${error.attemptNumber}`);
        }
    });

    logger.info(`Successfully finished direct PR review for ${owner}/${repo}#${prNumber}`);
}
