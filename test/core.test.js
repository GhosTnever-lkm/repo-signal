import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, parseRepository, scoreRepository } from '../core.js';

test('accepts owner/name and common GitHub repository URL forms', () => {
  assert.equal(parseRepository('octocat/Hello-World'), 'octocat/Hello-World');
  assert.equal(parseRepository('https://github.com/octocat/Hello-World.git/'), 'octocat/Hello-World');
});

test('rejects unrelated hosts and malformed repository names', () => {
  assert.throws(() => parseRepository('https://example.com/octocat/repo'), /github.com/);
  assert.throws(() => parseRepository('octocat'), /owner\/name/);
  assert.throws(() => parseRepository('octocat/repo/extra'), /owner\/name/);
});

test('calculates a transparent score from weighted visible signals', () => {
  const result = scoreRepository({ metadata: { description: 'An example', license: { spdx_id: 'MIT' } }, hasReadme: true, files: ['contributing.md'], contentPaths: ['.github/workflows/ci.yml'], topics: ['example', 'tool'], hasRelease: true, workflowCount: 1 });
  assert.equal(result.score, 84);
  assert.equal(result.checks.length, 10);
  assert.equal(result.checks.find((check) => check.title === 'README').status, 'pass');
  assert.equal(result.checks.find((check) => check.title === 'Security policy').status, 'warn');
});

test('report lists missing signals and identifies its limits', () => {
  const scored = scoreRepository({});
  const report = buildReport({ metadata: { full_name: 'owner/sample' }, ...scored });
  assert.match(report, /owner\/sample/);
  assert.match(report, /not a security review/);
  assert.match(report, /License/);
});
