import { parse } from '@typescript-eslint/typescript-estree';
import { builtinModules } from 'module';
import { DeclarationFeature, FileFeatures, IdentifierStyle, ImportFeature } from './types';

const builtins = new Set([...builtinModules, ...builtinModules.map(name => `node:${name}`)]);
function lineOf(node: any) { return node?.loc?.start?.line ?? 1; }
function endLineOf(node: any) { return node?.loc?.end?.line ?? lineOf(node); }
function sourceGroup(source: string): ImportFeature['group'] { return source.startsWith('.') ? 'relative' : builtins.has(source) ? 'builtin' : 'external'; }
function isDocComment(source: string, line: number): boolean {
  const before = source.split(/\r?\n/).slice(0, Math.max(0, line - 1)).join('\n');
  return /\/\*\*[\s\S]*?\*\/\s*$/.test(before);
}
function bodyLineCount(source: string, body: any): number {
  if (!body?.loc) return 0;
  return source.split(/\r?\n/).slice(body.loc.start.line - 1, body.loc.end.line).filter(line => {
    const trimmed = line.trim(); return trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*') && !trimmed.startsWith('*/');
  }).length;
}
function collectNames(pattern: any): string[] {
  if (!pattern) return [];
  if (pattern.type === 'Identifier') return [pattern.name];
  if (pattern.type === 'AssignmentPattern') return collectNames(pattern.left);
  return [];
}

export function classifyIdentifier(name: string): IdentifierStyle | null {
  if (name.length < 2 || name.startsWith('__')) return null;
  const normalized = name.startsWith('_') ? name.slice(1) : name;
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(normalized)) return null;
  if (/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(normalized)) return 'SCREAMING_SNAKE_CASE';
  if (/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(normalized)) return 'snake_case';
  if (/^[A-Z][A-Za-z0-9]*$/.test(normalized)) return 'PascalCase';
  if (/^[a-z][A-Za-z0-9]*$/.test(normalized)) return 'camelCase';
  return null;
}

export function extractFileFeatures(repoPath: string, source: string): FileFeatures {
  try {
    const ast: any = parse(source, { loc: true, range: true, jsx: repoPath.endsWith('.tsx') || repoPath.endsWith('.jsx'), comment: true });
    const imports: ImportFeature[] = [];
    const declarations: DeclarationFeature[] = [];
    const exportedNames = new Set<string>();
    for (const node of ast.body) if (node.type === 'ExportNamedDeclaration' && node.specifiers) for (const specifier of node.specifiers) exportedNames.add(specifier.local?.name);
    const visitDeclaration = (node: any, exported = false) => {
      const documented = isDocComment(source, lineOf(node));
      if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
        if (node.id?.name) declarations.push({ kind: 'function', name: node.id.name, line: lineOf(node), endLine: endLineOf(node), bodyStartLine: lineOf(node.body), bodyEndLine: endLineOf(node.body), bodyLines: bodyLineCount(source, node.body), exported: exported || exportedNames.has(node.id.name), documented });
      } else if (node.type === 'ClassDeclaration' && node.id?.name) {
        declarations.push({ kind: 'class', name: node.id.name, line: lineOf(node), endLine: endLineOf(node), exported: exported || exportedNames.has(node.id.name), documented });
      } else if (node.type === 'VariableDeclaration') {
        for (const declaration of node.declarations) for (const name of collectNames(declaration.id)) {
          const functionValue = ['FunctionExpression', 'ArrowFunctionExpression'].includes(declaration.init?.type);
          declarations.push({ kind: functionValue ? 'function' : 'variable', name, line: lineOf(declaration), endLine: endLineOf(declaration), bodyStartLine: functionValue ? lineOf(declaration.init.body) : undefined, bodyEndLine: functionValue ? endLineOf(declaration.init.body) : undefined, bodyLines: functionValue ? bodyLineCount(source, declaration.init.body) : undefined, exported: exported || exportedNames.has(name), documented });
        }
      }
    };
    for (const node of ast.body) {
      if (node.type === 'ImportDeclaration') imports.push({ line: lineOf(node), source: String(node.source.value), group: sourceGroup(String(node.source.value)) });
      else if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') { if (node.declaration) visitDeclaration(node.declaration, true); }
      else visitDeclaration(node);
    }
    return { path: repoPath, imports, declarations };
  } catch (error) { return { path: repoPath, imports: [], declarations: [], parseError: error instanceof Error ? error.message : 'Unable to parse source.' }; }
}
