import { NextRequest, NextResponse } from 'next/server';
import { parseCode } from '@/parser/astParser';
import { getTriggeredRules } from '@/rules/ruleEngine';
import { buildSystemPrompt, buildUserPrompt } from '@/prompt/contextBuilder';
import { analyzeCode } from '@/ai/analyzer';

export async function POST(req: NextRequest) {
    try {
        const { code, filename } = await req.json();
        
        if (!code) {
            return NextResponse.json({ error: 'Code content is required' }, { status: 400 });
        }

        const fname = filename || 'index.js';
        const parsedContext = parseCode(fname, code);
        const rules = getTriggeredRules(parsedContext);

        // Format a mock unified diff for the prompt context since buildUserPrompt expects a diff format
        const mockDiff = `--- a/${fname}\n+++ b/${fname}\n@@ -1,${code.split('\n').length} +1,${code.split('\n').length} @@\n` + 
                         code.split('\n').map((line: string) => `+${line}`).join('\n');

        const systemPrompt = buildSystemPrompt();
        const userPrompt = buildUserPrompt(
            fname,
            parsedContext.language,
            mockDiff,
            parsedContext.astSummary,
            rules
        );

        const findings = await analyzeCode(systemPrompt, userPrompt);

        return NextResponse.json({
            success: true,
            language: parsedContext.language,
            astSummary: parsedContext.astSummary,
            rules: rules,
            findings: findings
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}
