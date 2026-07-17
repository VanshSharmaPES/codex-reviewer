import { Queue } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import pino from 'pino';
import { PRReviewJob } from '../types';

dotenv.config();

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
let redisConnection: Redis | undefined;
let prQueue: Queue<PRReviewJob> | undefined;

export function getRedisConnection(): Redis {
    if (!redisConnection) {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        redisConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
        redisConnection.on('error', (err: any) => logger.error({ err }, 'Redis connection error'));
    }
    return redisConnection;
}

export function getPRQueue(): Queue<PRReviewJob> {
    if (!prQueue) {
        prQueue = new Queue('pr-analysis', {
            connection: getRedisConnection() as any,
            defaultJobOptions: {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: true,
                removeOnFail: false,
            },
        }) as Queue<PRReviewJob>;
    }
    return prQueue;
}
