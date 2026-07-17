import { runCli } from '../src/conventions/cli';
runCli(process.argv.slice(2)).then(code => { process.exitCode = code; });
