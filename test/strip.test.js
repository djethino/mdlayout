import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { stripLayout } from '../src/strip.js';

test('strip leaves plain Markdown and counts what it left out', () => {
  const source = [
    '---',
    'format: a4',
    '---',
    '',
    '[[toc]]',
    '# Title {align:center}',
    '',
    '::::canvas{responsive}',
    ':::intro{two-thirds}',
    'A [red]{color:#dc2626} word and a [link](https://example.org){target:blank}.',
    ':::',
    ':::picture{third}',
    '![Team](team.jpg){radius:md, shadow:md}',
    ':::',
    '::::',
    '',
    '!video(https://www.youtube.com/watch?v=ID){width:full}',
    '',
    '| Plan {width:140px} | Price |',
    '|---|---|',
    '| Basic {bg:#eee} | 10 |',
    '',
    '---slide bg:#000---',
    '',
    '```markdown',
    '::::canvas',
    '[kept]{color:red}',
    '```',
  ].join('\n');
  const { markdown, removed } = stripLayout(source);
  assert.equal(
    markdown,
    [
      '---',
      'format: a4',
      '---',
      '',
      '# Title',
      '',
      'A red word and a [link](https://example.org).',
      '![Team](team.jpg)',
      '',
      '[https://www.youtube.com/watch?v=ID](https://www.youtube.com/watch?v=ID)',
      '',
      '| Plan | Price |',
      '|---|---|',
      '| Basic | 10 |',
      '',
      '---',
      '',
      '```markdown',
      '::::canvas',
      '[kept]{color:red}',
      '```',
    ].join('\n'),
  );
  assert.equal(removed, 14);
});

test('strip keeps Windows line endings and leaves standard Markdown alone', () => {
  assert.deepEqual(stripLayout('# A {align:right}\r\n\r\ntext\r\n'), { markdown: '# A\r\n\r\ntext\r\n', removed: 1 });
  const plain = '# Plain\n\nNothing [to](do) here.\n';
  assert.deepEqual(stripLayout(plain), { markdown: plain, removed: 0 });
});

test('the mdlayout strip command reads standard input', () => {
  const bin = fileURLToPath(new URL('../bin/mdlayout.js', import.meta.url));
  const out = execFileSync(process.execPath, [bin, 'strip'], { input: 'A [b]{color:red}\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  assert.equal(out, 'A b\n');
});
