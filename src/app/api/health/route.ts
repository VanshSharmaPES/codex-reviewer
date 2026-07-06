import { NextResponse } from 'next/server';
import { checkAIProviderHealth } from '@/ai/analyzer';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const aiHealth = await checkAIProviderHealth();
        
        const appId = process.env.GITHUB_APP_ID;
        const pemPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH || './private-key.pem';
        const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

        let pemExists = false;
        try {
            pemExists = fs.existsSync(path.resolve(pemPath)) || !!process.env.GITHUB_APP_PRIVATE_KEY;
        } catch {
            pemExists = false;
        }

        return NextResponse.json({
            success: true,
            status: 'online',
            ai: {
                groq: aiHealth.groq,
                fallback: aiHealth.fallback,
                message: aiHealth.message
            },
            github: {
                appIdConfigured: !!appId,
                appId: appId || null,
                privateKeyConfigured: pemExists,
                webhookSecretConfigured: !!webhookSecret
            }
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            status: 'degraded',
            error: error.message || 'Health check failed'
        }, { status: 500 });
    }
}
