import { runCli } from '../src/conventions/cli';
process.exitCode = runCli(process.argv.slice(2));
