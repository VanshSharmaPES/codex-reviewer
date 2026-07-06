import { NextRequest, NextResponse } from 'next/server';
import { parseCode } from '@/parser/astParser';
import { executeRules } from '@/rules/ruleEngine';
import { buildEnhancedSystemPrompt, buildEnhancedUserPrompt } from '@/prompt/contextBuilder';
import { analyzeCode } from '@/ai/analyzer';
import { Octokit } from '@octokit/rest';

function getPlaygroundOctokit(): Octokit {
    const token = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;
    return new Octokit(token ? { auth: token } : {});
}

export async function POST(req: NextRequest) {
    try {
        const { code, filename, prUrl } = await req.json();

        // Mode 1: Review GitHub PR URL
        if (prUrl) {
            // Regex to parse: https://github.com/owner/repo/pull/number
            const match = prUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/i);
            if (!match) {
                return NextResponse.json({ 
                    success: false, 
                    error: 'Invalid GitHub Pull Request URL. Format must be: https://github.com/owner/repo/pull/number' 
                }, { status: 400 });
            }

            const owner = match[1];
            const repo = match[2];
            const prNumber = parseInt(match[3], 10);

            const octokit = getPlaygroundOctokit();

            // Fetch the list of files in the PR
            const { data: files } = await octokit.rest.pulls.listFiles({
                owner,
                repo,
                pull_number: prNumber,
                per_page: 3 // Limit to first 3 files to fit within rate-limits/timeouts
            });

            const prFindings: any[] = [];
            const filesAnalyzed: string[] = [];

            for (const file of files) {
                if (!file.patch) continue;
                filesAnalyzed.push(file.filename);

                const parsedContext = parseCode(file.filename, file.patch);
                
                const codeContext = {
                    parsedContext,
                    fileContent: file.patch,
                    surroundingLines: 5
                };
                const pipelineResult = executeRules(codeContext);

                const systemPrompt = buildEnhancedSystemPrompt(parsedContext.language);
                const userPrompt = buildEnhancedUserPrompt({
                    filename: file.filename,
                    language: parsedContext.language,
                    rawDiff: file.patch,
                    parsedContext,
                    staticRuleResults: pipelineResult.results
                });

                const fileFindings = await analyzeCode(systemPrompt, userPrompt);
                
                if (fileFindings && fileFindings.length > 0) {
                    prFindings.push(...fileFindings.map(f => ({
                        ...f,
                        file: file.filename
                    })));
                }
            }

            return NextResponse.json({
                success: true,
                type: 'pr',
                findings: prFindings,
                filesAnalyzed
            });
        }

        // Mode 2: Review Raw Text Code Snippet
        if (!code) {
            return NextResponse.json({ success: false, error: 'Code content or GitHub PR URL is required' }, { status: 400 });
        }

        const fname = filename || 'index.js';
        const parsedContext = parseCode(fname, code);
        
        const codeContext = {
            parsedContext,
            fileContent: code,
            surroundingLines: 5
        };
        const pipelineResult = executeRules(codeContext);

        // Format a mock unified diff for prompt context
        const mockDiff = `--- a/${fname}\n+++ b/${fname}\n@@ -1,${code.split('\n').length} +1,${code.split('\n').length} @@\n` + 
                         code.split('\n').map((line: string) => `+${line}`).join('\n');

        const systemPrompt = buildEnhancedSystemPrompt(parsedContext.language);
        const userPrompt = buildEnhancedUserPrompt({
            filename: fname,
            language: parsedContext.language,
            rawDiff: mockDiff,
            parsedContext,
            staticRuleResults: pipelineResult.results
        });

        const findings = await analyzeCode(systemPrompt, userPrompt);

        return NextResponse.json({
            success: true,
            type: 'snippet',
            language: parsedContext.language,
            astSummary: parsedContext.astSummary,
            rules: pipelineResult.results,
            findings: findings.map(f => ({ ...f, file: fname }))
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal server error during analysis'
        }, { status: 500 });
    }
}
