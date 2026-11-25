#!/usr/bin/env node
// The mdlayout command.
//
//   mdlayout strip [file.md] [-o out.md]
//     Plain Markdown from a document written with mdlayout (see src/strip.js):
//     reads the file (or standard input), writes to `-o` (or standard output).
//     How many layout marks were left out is told on standard error.
import { readFileSync, writeFileSync } from 'node:fs';
import { stripLayout } from '../src/strip.js';

const usage = 'usage: mdlayout strip [file.md] [-o out.md]';
const [command, ...rest] = process.argv.slice(2);

if (command !== 'strip') {
  console.error(command === '--help' || command === '-h' || !command ? usage : `mdlayout: unknown command "${command}"\n${usage}`);
  process.exit(command === '--help' || command === '-h' ? 0 : 2);
}

let input = null;
let output = null;
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '-o' || rest[i] === '--output') output = rest[++i] ?? null;
  else if (input === null) input = rest[i];
  else {
    console.error(`mdlayout: one file at a time\n${usage}`);
    process.exit(2);
  }
}
if (rest.includes('-o') && !output) {
  console.error(`mdlayout: -o needs a file name\n${usage}`);
  process.exit(2);
}

try {
  const text = readFileSync(input ?? 0, 'utf8');
  const { markdown, removed } = stripLayout(text);
  if (output) writeFileSync(output, markdown);
  else process.stdout.write(markdown);
  console.error(`mdlayout: ${removed} layout mark${removed === 1 ? '' : 's'} left out`);
} catch (error) {
  console.error(`mdlayout: ${error.message}`);
  process.exit(1);
}
