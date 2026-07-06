/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    devIndicators: false,
    output: "standalone",
    serverExternalPackages: ["tree-sitter", "tree-sitter-python", "tree-sitter-c", "tree-sitter-javascript", "tree-sitter-typescript"],
}

module.exports = nextConfig
