import { NextResponse } from 'next/server';
import { checkAIProviderHealth } from '@/ai/analyzer';
import fs from 'fs';
import path from 'path';
import { getRedisConnection } from '@/queue/prQueue';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const aiHealth = await checkAIProviderHealth();
        
        const appId = process.env.GITHUB_APP_ID;
        const pemPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH || './private-key.pem';
        const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
        let redisReachable = false;
        try {
            if (process.env.NEXT_PHASE === 'phase-production-build') throw new Error('build phase');
            await Promise.race([
                getRedisConnection().ping().then(() => { redisReachable = true; }),
                new Promise(resolve => setTimeout(resolve, 1500)),
            ]);
        } catch { redisReachable = false; }

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
            },
            github: {
                appIdConfigured: !!appId,
                privateKeyConfigured: pemExists,
                webhookSecretConfigured: !!webhookSecret
            },
            queue: {
                redisConfigured: !!process.env.REDIS_URL,
                redisReachable,
            }
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            status: 'degraded',
            error: 'Health check failed'
        }, { status: 500 });
    }
}
