import { NextResponse } from 'next/server';
import { listReviews } from '@/reviews/reviewStore';
export async function GET() { return NextResponse.json({ reviews: listReviews() }); }
