'use client';

import React, { useState, useEffect } from 'react';

// ============ Preset Code Examples ============
const EXAMPLES = {
  cpp: {
    filename: 'server.cpp',
    language: 'C++',
    code: `#include <iostream>\n#include <string>\n\nvoid handleConnection(std::string ip) {\n    // Allocate connection buffer\n    int* packet_data = new int[512];\n    \n    std::cout << "Received packet from " << ip << std::endl;\n    \n    if (ip == "127.0.0.1") {\n        std::cout << "Local loopback connections are ignored." << std::endl;\n        return; // ERROR: Memory leak of 'packet_data' (no delete[])\n    }\n    \n    // Process packet\n    delete[] packet_data;\n}`
  },
  js: {
    filename: 'wallet.js',
    language: 'JavaScript',
    code: `let currentBalance = 5000;\n\n// Simulate database delay\nconst delay = (ms) => new Promise(res => setTimeout(res, ms));\n\nasync function processWithdrawal(amount) {\n    if (currentBalance >= amount) {\n        console.log("Sufficient funds. Processing transaction...");\n        await delay(150); // Async gap\n        \n        // Race condition: Balance can be mutated by parallel runs during await\n        currentBalance = currentBalance - amount;\n        console.log("Transaction complete. Remaining: " + currentBalance);\n        return true;\n    }\n    return false;\n}`
  },
  python: {
    filename: 'auth.py',
    language: 'Python',
    code: `import sqlite3\n\ndef get_user_profile(user_input_id):\n    connection = sqlite3.connect("production.db")\n    cursor = connection.cursor()\n    \n    # Vulnerable to SQL Injection - direct interpolation\n    query = "SELECT username, role, bio FROM accounts WHERE id = '" + user_input_id + "'"\n    \n    cursor.execute(query)\n    profile = cursor.fetchone()\n    return {\n        "username": profile[0],\n        "role": profile[1],\n        "bio": profile[2]\n    }`
  }
};

// ============ Type Definitions ============
interface Finding {
  ruleId: string;
  severity: string;
  lineStart: number;
  lineEnd: number;
  title: string;
  explanation: string;
  suggestion: string;
  confidence?: number;
  file?: string;
}

interface PullRequest {
  number: number;
  title: string;
  url: string;
  user: string;
}

interface AppHealth {
  success: boolean;
  status: string;
  ai: {
    groq: boolean;
    fallback: boolean;
  };
  github: {
    appIdConfigured: boolean;
    privateKeyConfigured: boolean;
    webhookSecretConfigured: boolean;
  };
}

export default function Home() {
  // Mode selection: 'snippet' or 'github'
  const [reviewMode, setReviewMode] = useState<'snippet' | 'github'>('snippet');
  
  // Snippet Mode State
  const [activeTab, setActiveTab] = useState<'cpp' | 'js' | 'python'>('js');
  const [code, setCode] = useState(EXAMPLES.js.code);
  const [filename, setFilename] = useState(EXAMPLES.js.filename);
  
  // GitHub URL State
  const [githubUrl, setGithubUrl] = useState('');
  const [openPulls, setOpenPulls] = useState<PullRequest[]>([]);
  const [selectedPrUrl, setSelectedPrUrl] = useState('');
  const [fetchingPulls, setFetchingPulls] = useState(false);
  const [analyzedPrUrl, setAnalyzedPrUrl] = useState('');

  // General Loading & Results State
  const [loading, setLoading] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [astSummary, setAstSummary] = useState<any>(null);
  const [rulesTriggered, setRulesTriggered] = useState<any[]>([]);
  const [filesAnalyzed, setFilesAnalyzed] = useState<string[]>([]);
  
  // Health Dashboard State
  const [health, setHealth] = useState<AppHealth | null>(null);

  // Load health settings silently on startup
  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setHealth(data);
        }
      })
      .catch(err => console.error('Failed to load API health status', err));
  }, []);

  // Synchronize snippet tab changes
  const handleTabChange = (tab: 'cpp' | 'js' | 'python') => {
    setActiveTab(tab);
    setCode(EXAMPLES[tab].code);
    setFilename(EXAMPLES[tab].filename);
    setAnalyzed(false);
    setFindings([]);
    setAstSummary(null);
    setRulesTriggered([]);
  };

  // Fetch pull requests when a repo URL is provided
  const fetchRepoPulls = async () => {
    if (!githubUrl) return;
    setFetchingPulls(true);
    setOpenPulls([]);
    setSelectedPrUrl('');
    
    try {
      const response = await fetch(`/api/pulls?repoUrl=${encodeURIComponent(githubUrl)}`);
      const data = await response.json();
      
      if (data.success) {
        setOpenPulls(data.pulls || []);
        if (data.pulls && data.pulls.length > 0) {
          setSelectedPrUrl(data.pulls[0].url);
        } else {
          alert('No open Pull Requests found in this repository.');
        }
      } else {
        alert(data.error || 'Failed to fetch PRs. Verify that the URL is public.');
      }
    } catch (err) {
      console.error(err);
      alert('Network request failed. Make sure the backend server is running.');
    } finally {
      setFetchingPulls(false);
    }
  };

  // Run code review (Snippet or GitHub PR)
  const runAnalysis = async () => {
    setLoading(true);
    setAnalyzed(false);
    setFindings([]);
    setFilesAnalyzed([]);
    setAstSummary(null);

    const payload: any = {};
    if (reviewMode === 'snippet') {
      payload.code = code;
      payload.filename = filename;
    } else {
      const targetUrl = selectedPrUrl || githubUrl;
      if (!targetUrl) {
        alert('Please enter a GitHub PR URL or select an open Pull Request.');
        setLoading(false);
        return;
      }
      payload.prUrl = targetUrl;
      setAnalyzedPrUrl(targetUrl);
    }

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (data.success) {
        setFindings(data.findings || []);
        setAstSummary(data.astSummary || null);
        setRulesTriggered(data.rules || []);
        setFilesAnalyzed(data.filesAnalyzed || []);
      } else {
        alert(`Analysis Error: ${data.error || 'Check server configuration'}`);
      }
    } catch (error) {
      console.error(error);
      alert('Network request failed. Please check your internet connection.');
    } finally {
      setLoading(false);
      setAnalyzed(true);
    }
  };

  return (
    <main className="min-h-screen bg-cyber-950 text-slate-100 flex flex-col font-sans selection:bg-volt-300/20">
      
      {/* Background Volt/Lime Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-volt-300/5 via-transparent to-transparent pointer-events-none" />

      {/* ============ Header ============ */}
      <header className="border-b border-cyber-800 bg-cyber-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-tr from-volt-300 to-volt-500 flex items-center justify-center font-bold text-black shadow-md shadow-volt-300/10">
              ⚡
            </div>
            <div>
              <span className="font-display font-bold tracking-tight text-slate-100">AI BUG DETECTOR</span>
              <span className="ml-2.5 text-[9px] tracking-wider uppercase font-bold px-1.5 py-0.5 rounded bg-volt-300/10 text-volt-300 border border-volt-400/10">
                Playground
              </span>
            </div>
          </div>

          {/* Quick status bar */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-volt-300 animate-pulse" />
              <span className="text-slate-400">Server: <strong className="text-volt-300">Online</strong></span>
            </div>
            {health && (
              <div className="hidden md:flex items-center gap-3 border-l border-cyber-850 pl-4">
                <span className="text-slate-400">
                  AI: <strong className={health.ai.groq ? 'text-volt-300' : 'text-rose-400'}>{health.ai.groq ? 'Connected' : 'Degraded'}</strong>
                </span>
                <span className="text-slate-400">
                  GitHook: <strong className={health.github.appIdConfigured ? 'text-volt-300' : 'text-slate-500'}>{health.github.appIdConfigured ? 'Active' : 'Offline'}</strong>
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ============ Main Container ============ */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 flex flex-col gap-8 relative z-10">
        
        {/* ============ Hero Section ============ */}
        <section className="text-center md:text-left md:flex items-center justify-between gap-12 py-4">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-display font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              Deep Logical Bug Detection
            </h1>
            <p className="mt-3 text-sm md:text-base text-slate-400 leading-relaxed font-sans">
              An advanced code review assistant using Abstract Syntax Tree (AST) scanning combined with low-latency LLMs. Paste raw code blocks or connect public GitHub Pull Requests to run automatic reviews.
            </p>
          </div>
        </section>

        {/* ============ Mode Selector ============ */}
        <div className="flex justify-center md:justify-start">
          <div className="bg-cyber-900 p-1 rounded-lg border border-cyber-800 flex gap-1">
            <button
              onClick={() => { setReviewMode('snippet'); setAnalyzed(false); }}
              className={`px-4 py-2 rounded-md text-xs font-semibold tracking-wide uppercase transition ${
                reviewMode === 'snippet' ? 'bg-volt-300 text-black shadow-md font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📝 Code Snippet
            </button>
            <button
              onClick={() => { setReviewMode('github'); setAnalyzed(false); }}
              className={`px-4 py-2 rounded-md text-xs font-semibold tracking-wide uppercase transition ${
                reviewMode === 'github' ? 'bg-volt-300 text-black shadow-md font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🐙 GitHub Pull Request
            </button>
          </div>
        </div>

        {/* ============ Playground Grid ============ */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Panel: Input Area */}
          <div className="lg:col-span-7 bg-cyber-900 rounded-xl border border-cyber-800 shadow-xl overflow-hidden flex flex-col min-h-[460px]">
            
            {/* --- Mode A: Review Code Snippet --- */}
            {reviewMode === 'snippet' && (
              <>
                <div className="bg-cyber-950 border-b border-cyber-800 px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {(['js', 'cpp', 'python'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => handleTabChange(tab)}
                        className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition ${
                          activeTab === tab 
                            ? 'bg-volt-300/10 text-volt-300 border border-volt-400/20' 
                            : 'text-slate-400 hover:text-slate-200 hover:bg-cyber-800/40'
                        }`}
                      >
                        {EXAMPLES[tab].language}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-500">File:</span>
                    <input
                      type="text"
                      value={filename}
                      onChange={(e) => setFilename(e.target.value)}
                      className="bg-cyber-950 border border-cyber-800 rounded px-2 py-0.5 text-xs font-mono text-slate-300 w-32 focus:outline-none focus:border-volt-300/30"
                    />
                  </div>
                </div>

                <div className="relative flex-1 min-h-[340px] font-mono text-sm leading-relaxed bg-cyber-950/80 flex">
                  {/* Line Numbers Gutter */}
                  <div className="w-12 bg-cyber-950/40 select-none text-slate-600 text-right pr-3 py-4 border-r border-cyber-800/40 text-xs font-mono">
                    {Array.from({ length: code.split('\n').length }).map((_, idx) => (
                      <div key={idx} className="h-[21px]">{idx + 1}</div>
                    ))}
                  </div>
                  {/* Textarea */}
                  <textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="flex-1 w-full bg-transparent resize-none p-4 text-xs text-slate-300 focus:outline-none focus:ring-0 font-mono leading-[21px] whitespace-pre min-h-[340px] border-none"
                    spellCheck={false}
                  />
                </div>
              </>
            )}

            {/* --- Mode B: Review GitHub Pull Request --- */}
            {reviewMode === 'github' && (
              <div className="p-6 flex-1 flex flex-col gap-6 bg-cyber-950/60">
                <div>
                  <h3 className="text-sm font-display font-bold text-slate-200">Option 1: Paste Direct Pull Request Link</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed font-sans">
                    Paste the direct URL of a public Pull Request from any public GitHub repository to review it instantly.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. https://github.com/owner/repo/pull/12"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      className="flex-1 bg-cyber-950 border border-cyber-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-volt-300/30"
                    />
                  </div>
                </div>

                <div className="border-t border-cyber-800/50 pt-6">
                  <h3 className="text-sm font-display font-bold text-slate-200">Option 2: Fetch PRs from a Repository</h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed font-sans">
                    Enter the repository link to list its active open Pull Requests:
                  </p>
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. https://github.com/VanshSharmaPES/codex-reviewer"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      className="flex-1 bg-cyber-950 border border-cyber-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-volt-300/30"
                    />
                    <button
                      onClick={fetchRepoPulls}
                      disabled={fetchingPulls || !githubUrl}
                      className="px-4 py-2 rounded-lg bg-cyber-800 border border-cyber-700 hover:bg-cyber-750 hover:border-volt-300/30 transition text-xs font-semibold text-slate-200 font-mono"
                    >
                      {fetchingPulls ? 'Fetching...' : 'Fetch Open PRs'}
                    </button>
                  </div>

                  {openPulls.length > 0 && (
                    <div className="mt-4">
                      <label className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wide">Select Open Pull Request:</label>
                      <select
                        value={selectedPrUrl}
                        onChange={(e) => setSelectedPrUrl(e.target.value)}
                        className="mt-1.5 w-full bg-cyber-950 border border-cyber-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-volt-300/30 font-mono"
                      >
                        {openPulls.map(pr => (
                          <option key={pr.number} value={pr.url}>
                            #{pr.number}: {pr.title} (by @{pr.user})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Editor Actions Footer */}
            <div className="bg-cyber-950 border-t border-cyber-800 p-4 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                {reviewMode === 'snippet' 
                  ? 'Code is parsed into AST representations before running analysis.'
                  : 'Files modified in the pull request will be fetched and analyzed.'}
              </span>
              <button
                onClick={runAnalysis}
                disabled={loading}
                className="px-5 py-2 rounded bg-volt-300 hover:bg-volt-400 disabled:opacity-50 transition text-xs font-bold text-black shadow-lg shadow-volt-500/10 flex items-center gap-2 font-display uppercase tracking-wide"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-3 w-3 text-black" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <span>Run AI Review</span>
                    <span>⚡</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Panel: Results */}
          <div className="lg:col-span-5 bg-cyber-900 rounded-xl border border-cyber-800 shadow-xl overflow-hidden self-stretch flex flex-col min-h-[460px]">
            <div className="bg-cyber-950 border-b border-cyber-800 px-4 py-3 flex items-center justify-between">
              <span className="text-xs font-mono font-semibold tracking-wide uppercase text-slate-300">Live Analysis Output</span>
              {analyzed && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyber-850 border border-cyber-800 text-slate-400 font-mono">
                  {findings.length} findings
                </span>
              )}
            </div>

            {/* Scrollable findings area */}
            <div className="flex-1 p-5 overflow-y-auto max-h-[440px] space-y-4 bg-cyber-950">
              {!analyzed && !loading && (
                <div className="h-full flex flex-col items-center justify-center text-center py-16 px-4">
                  <div className="w-12 h-12 rounded bg-cyber-900 border border-cyber-800 flex items-center justify-center text-xl mb-3 text-volt-300">
                    ⚡
                  </div>
                  <h3 className="text-sm font-display font-semibold text-slate-300">Interactive Review Panel</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed font-sans">
                    {reviewMode === 'snippet' 
                      ? 'Modify the code template on the left and click "Run AI Review" to parse AST and find bugs.'
                      : 'Provide a GitHub Pull Request URL on the left and click "Run AI Review" to analyze.'}
                  </p>
                </div>
              )}

              {loading && (
                <div className="h-full flex flex-col items-center justify-center py-16">
                  <div className="relative w-10 h-10">
                    <div className="absolute inset-0 rounded-full border-2 border-volt-300/10"></div>
                    <div className="absolute inset-0 rounded-full border-2 border-t-volt-300 animate-spin"></div>
                  </div>
                  <span className="text-xs text-slate-500 mt-4 font-mono">Parsing AST & Requesting Groq...</span>
                </div>
              )}

              {analyzed && findings.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center py-16 px-4">
                  <div className="w-10 h-10 rounded bg-volt-300/10 border border-volt-300/20 text-volt-300 flex items-center justify-center mb-3 text-lg font-bold">
                    ✓
                  </div>
                  <h3 className="text-sm font-display font-semibold text-slate-300">No issues found</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed font-sans">
                    The files parsed successfully and no logical bugs or vulnerabilities were detected by the AI model.
                  </p>
                </div>
              )}

              {/* Grouped findings by filename */}
              {analyzed && findings.length > 0 && (
                <div className="space-y-4">
                  {/* List of files analyzed if PR mode */}
                  {filesAnalyzed.length > 0 && (
                    <div className="mb-4 p-3 bg-cyber-900 border border-cyber-800 rounded-lg">
                      <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wide block mb-1">Files Inspected:</span>
                      <div className="flex flex-wrap gap-1">
                        {filesAnalyzed.map(file => (
                          <span key={file} className="text-[9px] font-mono bg-cyber-950 border border-cyber-850 text-volt-300 px-2 py-0.5 rounded">
                            {file}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Findings Cards */}
                  {findings.map((finding, idx) => (
                    <div 
                      key={idx} 
                      className={`p-4 rounded border bg-cyber-900/50 backdrop-blur-sm transition hover:bg-cyber-900 ${
                        finding.severity.toLowerCase() === 'critical' || finding.severity.toLowerCase() === 'high'
                          ? 'border-rose-500/20 hover:border-rose-500/30'
                          : 'border-amber-500/20 hover:border-amber-500/30'
                      }`}
                    >
                      {/* Header info */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded ${
                            finding.severity.toLowerCase() === 'critical' 
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/10' 
                              : finding.severity.toLowerCase() === 'high' 
                                ? 'bg-rose-400/10 text-rose-300 border border-rose-400/10' 
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/10'
                          }`}>
                            {finding.severity}
                          </span>
                          {finding.file && (
                            <span className="text-[10px] font-mono text-volt-300 max-w-[120px] truncate" title={finding.file}>
                              {finding.file.split('/').pop()}
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-slate-500">
                            Line: {finding.lineStart}
                          </span>
                        </div>
                      </div>

                      {/* Title & Description */}
                      <h4 className="text-xs font-display font-bold text-slate-200">{finding.title}</h4>
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed font-sans">{finding.explanation}</p>

                      {/* Suggestion block */}
                      <div className="mt-3 pt-3 border-t border-cyber-850">
                        <span className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wide">Suggested Fix</span>
                        <pre className="mt-1.5 p-2 bg-cyber-950 border border-cyber-800 rounded text-[11px] font-mono text-volt-300 overflow-x-auto whitespace-pre-wrap">
                          {finding.suggestion}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AST summary card */}
            {analyzed && astSummary && (
              <div className="bg-cyber-950 border-t border-cyber-800 p-4 text-xs font-mono">
                <span className="font-semibold text-slate-400 block mb-1.5">Parsed AST Context Metrics:</span>
                <div className="grid grid-cols-2 gap-2 text-slate-400 text-[11px]">
                  <div>Complexity: <strong className="text-slate-200">{astSummary.complexity}</strong></div>
                  <div>Max Depth: <strong className="text-slate-200">{astSummary.maxDepth}</strong></div>
                  <div>Nodes: <strong className="text-slate-200">{astSummary.nodeCount}</strong></div>
                  <div>Functions: <strong className="text-slate-200">{astSummary.functions?.length || 0}</strong></div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ============ Static Rules & Documentation ============ */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Static Rule Catalog */}
          <div className="bg-cyber-900 rounded-xl border border-cyber-800 p-6 shadow-xl">
            <h3 className="text-md font-display font-bold text-slate-200 mb-3 flex items-center gap-2">
              <span>📋</span> Built-in Static Rules Engine
            </h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed font-sans">
              Before submitting code to LLMs, the app runs local static analysis rules to flag common error structures:
            </p>
            <div className="space-y-3.5">
              <div className="p-3 bg-cyber-950 border border-cyber-800/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <strong className="text-xs font-display font-bold text-slate-200">Memory Leak Scanner (C/C++)</strong>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 font-semibold font-mono border border-rose-500/10">Critical</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 font-sans">Detects allocations (`malloc`, `new`) without corresponding deallocations (`free`, `delete`).</p>
              </div>

              <div className="p-3 bg-cyber-950 border border-cyber-800/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <strong className="text-xs font-display font-bold text-slate-200">Async Race Conditions (JS/TS)</strong>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-semibold font-mono border border-amber-500/10">High</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 font-sans">Identifies variables modified inside non-synchronized parallel callbacks or async boundary maps.</p>
              </div>

              <div className="p-3 bg-cyber-950 border border-cyber-800/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <strong className="text-xs font-display font-bold text-slate-200">Null Pointer Dereference</strong>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-semibold font-mono border border-amber-500/10">High</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 font-sans">Detects nested property accesses on objects directly inside checking scopes for null or undefined.</p>
              </div>
            </div>
          </div>

          {/* Setup Guide */}
          <div className="bg-cyber-900 rounded-xl border border-cyber-800 p-6 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-md font-display font-bold text-slate-200 mb-3 flex items-center gap-2">
                <span>⚡</span> Setup & Deployment Guide
              </h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed font-sans">
                Connect this detector as a 24/7 autonomous review assistant on your GitHub repositories:
              </p>
              <ol className="space-y-3.5 text-xs text-slate-400 list-decimal pl-4 font-sans">
                <li className="leading-relaxed">
                  <strong className="text-slate-300">Deploy Serverless:</strong> Push the codebase to Vercel and configure variables (`BYPASS_QUEUE=true`, API keys, and your `.pem` key).
                </li>
                <li className="leading-relaxed">
                  <strong className="text-slate-300">Set Webhook:</strong> Set your GitHub App&apos;s Webhook URL to:
                  <code className="block mt-1 p-1 bg-cyber-950 border border-cyber-800 rounded text-[10px] font-mono text-volt-300 text-center select-all font-semibold">
                    https://your-vercel-domain.vercel.app/api/webhook
                  </code>
                </li>
                <li className="leading-relaxed">
                  <strong className="text-slate-300">Subscribe:</strong> Check the <strong>&quot;Pull requests&quot;</strong> subscription box in GitHub developer settings.
                </li>
                <li className="leading-relaxed">
                  <strong className="text-slate-300">Run:</strong> Open a PR in any installed repository. The inline annotations will be posted automatically!
                </li>
              </ol>
            </div>
            
            <div className="pt-4 mt-4 border-t border-cyber-800 text-[10px] text-slate-500 flex items-center justify-between font-mono">
              <span>Next.js 15 App Router</span>
              <span>MIT Licensed</span>
            </div>
          </div>

        </section>

      </div>

      {/* ============ Footer ============ */}
      <footer className="border-t border-cyber-800 bg-[#030304] py-8 text-center text-xs text-slate-500 mt-12 font-mono">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>© 2026 Codex Reviewer. Built with Next.js, BullMQ, and Groq API.</span>
          <span className="flex items-center gap-4">
            <a href="https://github.com/VanshSharmaPES/codex-reviewer" target="_blank" rel="noreferrer" className="hover:text-slate-300 transition">GitHub</a>
            <span>•</span>
            <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="hover:text-slate-300 transition">Groq Console</a>
          </span>
        </div>
      </footer>

    </main>
  );
}
