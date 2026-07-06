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
}

interface AppHealth {
  success: boolean;
  status: string;
  ai: {
    groq: boolean;
    fallback: boolean;
    message: string;
  };
  github: {
    appIdConfigured: boolean;
    appId: string | null;
    privateKeyConfigured: boolean;
    webhookSecretConfigured: boolean;
  };
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'cpp' | 'js' | 'python'>('js');
  const [code, setCode] = useState(EXAMPLES.js.code);
  const [filename, setFilename] = useState(EXAMPLES.js.filename);
  const [loading, setLoading] = useState(false);
  
  // Results State
  const [analyzed, setAnalyzed] = useState(false);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [astSummary, setAstSummary] = useState<any>(null);
  const [rulesTriggered, setRulesTriggered] = useState<any[]>([]);
  
  // Health Dashboard State
  const [health, setHealth] = useState<AppHealth | null>(null);

  // Synchronize tab changes
  const handleTabChange = (tab: 'cpp' | 'js' | 'python') => {
    setActiveTab(tab);
    setCode(EXAMPLES[tab].code);
    setFilename(EXAMPLES[tab].filename);
    setAnalyzed(false);
    setFindings([]);
    setAstSummary(null);
    setRulesTriggered([]);
  };

  // Fetch API configurations on load
  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setHealth(data);
        }
      })
      .catch(err => console.error('Failed to load API health', err));
  }, []);

  // Run Local AST + AI Analysis
  const runAnalysis = async () => {
    setLoading(true);
    setAnalyzed(false);
    setFindings([]);
    
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code, filename })
      });
      const data = await response.json();
      
      if (data.success) {
        setFindings(data.findings || []);
        setAstSummary(data.astSummary);
        setRulesTriggered(data.rules || []);
      } else {
        alert(`Analysis Error: ${data.error || 'Server error'}`);
      }
    } catch (error) {
      console.error(error);
      alert('Network request failed. Make sure your local server is running.');
    } finally {
      setLoading(false);
      setAnalyzed(true);
    }
  };

  return (
    <main className="min-h-screen bg-[#060814] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      
      {/* Background Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-950/20 via-transparent to-transparent pointer-events-none" />

      {/* ============ Header ============ */}
      <header className="border-b border-slate-800/80 bg-[#060814]/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              🔍
            </div>
            <div>
              <span className="font-semibold text-slate-100">AI Bug Detector</span>
              <span className="ml-2 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400">App Router</span>
            </div>
          </div>

          {/* Quick status bar */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-400">Server Status: <strong className="text-slate-200">Online</strong></span>
            </div>
            {health && (
              <div className="hidden md:flex items-center gap-3 border-l border-slate-800 pl-4">
                <span className="text-slate-400">
                  Groq API: <strong className={health.ai.groq ? 'text-emerald-400' : 'text-rose-400'}>{health.ai.groq ? 'Healthy' : 'Degraded'}</strong>
                </span>
                <span className="text-slate-400">
                  GitHub App: <strong className={health.github.appIdConfigured ? 'text-indigo-400' : 'text-slate-500'}>{health.github.appIdConfigured ? 'Active' : 'Offline'}</strong>
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ============ Main Container ============ */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col gap-8 relative z-10">
        
        {/* ============ Hero Section ============ */}
        <section className="text-center md:text-left md:flex items-center justify-between gap-12 py-4">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Deep Logical Bug Detection
            </h1>
            <p className="mt-3 text-lg text-slate-400">
              An advanced code review assistant using Abstract Syntax Tree (AST) scanning combined with low-latency LLMs to capture memory leaks, race conditions, and vulnerabilities in pull request workflows.
            </p>
          </div>
          <div className="mt-6 md:mt-0 flex gap-3 justify-center">
            <a 
              href="https://github.com/VanshSharmaPES/AI-Bug-Detector" 
              target="_blank" 
              rel="noreferrer"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 transition border border-slate-700/50 flex items-center gap-2"
            >
              <svg className="w-4 h-4 fill-slate-300" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              GitHub Repository
            </a>
          </div>
        </section>

        {/* ============ Playground Grid ============ */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Panel: Editor */}
          <div className="lg:col-span-7 bg-[#0b0e1a] rounded-xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
            
            {/* Editor Tabs & File Header */}
            <div className="bg-[#0e1222] border-b border-slate-800 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {(['js', 'cpp', 'python'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => handleTabChange(tab)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                      activeTab === tab 
                        ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
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
                  className="bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-xs font-mono text-slate-300 w-32 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
            </div>

            {/* Editable code text area */}
            <div className="relative flex-1 min-h-[360px] font-mono text-sm leading-relaxed bg-[#070913] flex">
              {/* Line Numbers gutter */}
              <div className="w-12 bg-[#0a0d18]/60 select-none text-slate-600 text-right pr-3 py-4 border-r border-slate-800/50 text-xs">
                {Array.from({ length: code.split('\n').length }).map((_, idx) => (
                  <div key={idx} className="h-[21px]">{idx + 1}</div>
                ))}
              </div>
              {/* Textarea */}
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="flex-1 w-full bg-transparent resize-none p-4 text-xs text-slate-300 focus:outline-none focus:ring-0 font-mono leading-[21px] whitespace-pre min-h-[360px]"
                spellCheck={false}
              />
            </div>

            {/* Editor Footer Actions */}
            <div className="bg-[#0e1222] border-t border-slate-800 p-4 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Pasted code is analyzed using local AST Parsers before sending to Groq.
              </span>
              <button
                onClick={runAnalysis}
                disabled={loading}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 disabled:opacity-50 transition text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-3 w-3 text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
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
          <div className="lg:col-span-5 bg-[#0b0e1a] rounded-xl border border-slate-800 shadow-xl overflow-hidden self-stretch flex flex-col">
            <div className="bg-[#0e1222] border-b border-slate-800 px-4 py-3 flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide uppercase text-slate-300">Live Analysis Output</span>
              {analyzed && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                  {findings.length} findings
                </span>
              )}
            </div>

            {/* Scrollable findings area */}
            <div className="flex-1 p-5 overflow-y-auto max-h-[464px] space-y-4 bg-[#070913]">
              {!analyzed && !loading && (
                <div className="h-full flex flex-col items-center justify-center text-center py-16 px-4">
                  <div className="w-12 h-12 rounded-full bg-slate-800/40 border border-slate-700/50 flex items-center justify-center text-xl mb-3">
                    🔍
                  </div>
                  <h3 className="text-sm font-semibold text-slate-300">Interactive Playground</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                    Select a tab, modify the code template, and click "Run AI Review" to see static parser feedback and logical bug highlights.
                  </p>
                </div>
              )}

              {loading && (
                <div className="h-full flex flex-col items-center justify-center py-16">
                  <div className="relative w-10 h-10">
                    <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20"></div>
                    <div className="absolute inset-0 rounded-full border-2 border-t-indigo-500 animate-spin"></div>
                  </div>
                  <span className="text-xs text-slate-500 mt-4">Parsing AST & Requesting Groq...</span>
                </div>
              )}

              {analyzed && findings.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center py-16 px-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                    ✓
                  </div>
                  <h3 className="text-sm font-semibold text-slate-300">No issues found</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    The code compiled cleanly and no logical security or safety bugs were flagged by the AI engine.
                  </p>
                </div>
              )}

              {analyzed && findings.map((finding, idx) => (
                <div 
                  key={idx} 
                  className={`p-4 rounded-lg border bg-[#0b0e1a]/50 backdrop-blur-sm transition hover:bg-[#0b0e1a] ${
                    finding.severity.toLowerCase() === 'critical' || finding.severity.toLowerCase() === 'high'
                      ? 'border-rose-500/20 hover:border-rose-500/30'
                      : 'border-amber-500/20 hover:border-amber-500/30'
                  }`}
                >
                  {/* Header info */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                        finding.severity.toLowerCase() === 'critical' 
                          ? 'bg-rose-500/20 text-rose-400' 
                          : finding.severity.toLowerCase() === 'high' 
                            ? 'bg-rose-400/15 text-rose-300' 
                            : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {finding.severity}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        Line: {finding.lineStart === finding.lineEnd ? finding.lineStart : `${finding.lineStart}-${finding.lineEnd}`}
                      </span>
                    </div>
                    {finding.confidence && (
                      <span className="text-[10px] text-slate-500">
                        Confidence: {(finding.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <h4 className="text-xs font-bold text-slate-200">{finding.title}</h4>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{finding.explanation}</p>

                  {/* Suggestion block */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Suggested Fix</span>
                    <pre className="mt-1.5 p-2 bg-slate-950/80 border border-slate-800/50 rounded text-[11px] font-mono text-indigo-300 overflow-x-auto whitespace-pre-wrap">
                      {finding.suggestion}
                    </pre>
                  </div>
                </div>
              ))}
            </div>

            {/* AST summary card */}
            {analyzed && astSummary && (
              <div className="bg-[#0e1222] border-t border-slate-800 p-4 text-xs">
                <span className="font-semibold text-slate-400 block mb-1.5">Parsed AST Context Metrics:</span>
                <div className="grid grid-cols-2 gap-2 text-slate-400 font-mono text-[11px]">
                  <div>Complexity: <strong className="text-slate-200">{astSummary.complexity}</strong></div>
                  <div>Max Depth: <strong className="text-slate-200">{astSummary.maxDepth}</strong></div>
                  <div>Nodes: <strong className="text-slate-200">{astSummary.nodeCount}</strong></div>
                  <div>Functions: <strong className="text-slate-200">{astSummary.functions?.length || 0}</strong></div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ============ Health Dashboard Panel ============ */}
        <section className="bg-[#0b0e1a] rounded-xl border border-slate-800 p-6 shadow-xl">
          <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
            <span>⚙️</span> Local & Cloud Configuration Status
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Groq Connection */}
            <div className="bg-[#070913] border border-slate-800/50 rounded-lg p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400">Groq API Connection</span>
                  <span className={`w-2 h-2 rounded-full ${health?.ai.groq ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Used for fast, deterministic code reviews via the Llama-3.3-70B model.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/30 text-xs">
                Status: <strong className={health?.ai.groq ? 'text-emerald-400' : 'text-slate-500'}>{health?.ai.groq ? 'ONLINE' : 'OFFLINE'}</strong>
              </div>
            </div>

            {/* GitHub App Authentication */}
            <div className="bg-[#070913] border border-slate-800/50 rounded-lg p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400">GitHub App Authentication</span>
                  <span className={`w-2 h-2 rounded-full ${health?.github.appIdConfigured ? 'bg-indigo-500' : 'bg-slate-600'}`} />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  App credentials used to authenticate requests via GitHub Webhooks.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/30 text-xs flex justify-between">
                <span>App ID: <strong className="text-indigo-400">{health?.github.appId || 'Not set'}</strong></span>
                <span>Key: <strong className={health?.github.privateKeyConfigured ? 'text-emerald-400' : 'text-rose-400'}>{health?.github.privateKeyConfigured ? 'LOADED' : 'MISSING'}</strong></span>
              </div>
            </div>

            {/* Webhook Endpoint Configuration */}
            <div className="bg-[#070913] border border-slate-800/50 rounded-lg p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400">Webhook HMAC Verification</span>
                  <span className={`w-2 h-2 rounded-full ${health?.github.webhookSecretConfigured ? 'bg-indigo-500' : 'bg-slate-600'}`} />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Secures the webhooks using SHA-256 signature verification signatures.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/30 text-xs">
                HMAC Secret: <strong className={health?.github.webhookSecretConfigured ? 'text-indigo-400' : 'text-rose-400'}>{health?.github.webhookSecretConfigured ? 'CONFIGURED' : 'NOT SET'}</strong>
              </div>
            </div>

          </div>
        </section>

        {/* ============ Static Rules & Documentation ============ */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Static Rule Catalog */}
          <div className="bg-[#0b0e1a] rounded-xl border border-slate-800 p-6 shadow-xl">
            <h3 className="text-md font-bold text-slate-200 mb-3 flex items-center gap-2">
              <span>📋</span> Built-in Static Rules Engine
            </h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Before submitting code to LLMs, the app runs local static analysis rules to flag common error structures:
            </p>
            <div className="space-y-3.5">
              <div className="p-3 bg-[#070913] border border-slate-800/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <strong className="text-xs font-bold text-slate-200">Memory Leak Scanner (C/C++)</strong>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 font-semibold font-mono">Critical</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Detects allocations (`malloc`, `new`) without corresponding deallocations (`free`, `delete`).</p>
              </div>

              <div className="p-3 bg-[#070913] border border-slate-800/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <strong className="text-xs font-bold text-slate-200">Async Race Conditions (JS/TS)</strong>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-semibold font-mono">High</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Identifies variables modified inside non-synchronized parallel callbacks or async boundary maps.</p>
              </div>

              <div className="p-3 bg-[#070913] border border-slate-800/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <strong className="text-xs font-bold text-slate-200">Null Pointer Dereference</strong>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-semibold font-mono">High</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Detects nested property accesses on objects directly inside checking scopes for null or undefined.</p>
              </div>
            </div>
          </div>

          {/* Setup Guide */}
          <div className="bg-[#0b0e1a] rounded-xl border border-slate-800 p-6 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-md font-bold text-slate-200 mb-3 flex items-center gap-2">
                <span>⚡</span> Setup & Deployment Guide
              </h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Connect this detector as a 24/7 autonomous review assistant on your GitHub repositories:
              </p>
              <ol className="space-y-3.5 text-xs text-slate-400 list-decimal pl-4">
                <li>
                  <strong className="text-slate-300">Deploy Serverless:</strong> Push the codebase to Vercel and configure variables (`BYPASS_QUEUE=true`, API keys, and your `.pem` key).
                </li>
                <li>
                  <strong className="text-slate-300">Set Webhook:</strong> Set your GitHub App's Webhook URL to:
                  <code className="block mt-1 p-1 bg-slate-950/80 border border-slate-800/40 rounded text-[10px] font-mono text-indigo-300 text-center select-all">
                    https://your-vercel-domain.vercel.app/api/webhook
                  </code>
                </li>
                <li>
                  <strong className="text-slate-300">Subscribe:</strong> Check the **"Pull requests"** subscription box in GitHub developer settings.
                </li>
                <li>
                  <strong className="text-slate-300">Run:</strong> Open a PR in any installed repository. The inline annotations will be posted automatically!
                </li>
              </ol>
            </div>
            
            <div className="pt-4 mt-4 border-t border-slate-800/80 text-[10px] text-slate-500 flex items-center justify-between">
              <span>Next.js 15 App Router</span>
              <span>MIT Licensed</span>
            </div>
          </div>

        </section>

      </div>

      {/* ============ Footer ============ */}
      <footer className="border-t border-slate-800/60 bg-[#04060e] py-8 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>© 2026 AI Bug Detector. Built with Next.js, BullMQ, and Groq API.</span>
          <span className="flex items-center gap-4">
            <a href="https://github.com/VanshSharmaPES/AI-Bug-Detector" target="_blank" rel="noreferrer" className="hover:text-slate-300 transition">GitHub</a>
            <span>•</span>
            <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="hover:text-slate-300 transition">Groq Console</a>
          </span>
        </div>
      </footer>

    </main>
  );
}
