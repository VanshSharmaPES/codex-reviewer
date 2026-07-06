import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

export async function GET(req: NextRequest) {
    try {
        const repoUrl = req.nextUrl.searchParams.get('repoUrl');
        
        if (!repoUrl) {
            return NextResponse.json({ success: false, error: 'repoUrl parameter is required' }, { status: 400 });
        }

        // Parse owner and repo from URL
        // Match formats like https://github.com/owner/repo or git@github.com:owner/repo.git
        const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/i);
        if (!match) {
            return NextResponse.json({ success: false, error: 'Invalid GitHub Repository URL. Format must be: https://github.com/owner/repo' }, { status: 400 });
        }

        const owner = match[1];
        const repo = match[2].replace(/\.git$/, '').split('?')[0]; // strip .git and query params

        const token = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;
        const octokit = new Octokit(token ? { auth: token } : {});

        // Fetch open pull requests
        const { data: pulls } = await octokit.rest.pulls.list({
            owner,
            repo,
            state: 'open',
            per_page: 15
        });

        return NextResponse.json({
            success: true,
            pulls: pulls.map((pr: any) => ({
                number: pr.number,
                title: pr.title,
                url: pr.html_url,
                user: pr.user?.login
            }))
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to fetch pull requests from GitHub'
        }, { status: 500 });
    }
}
