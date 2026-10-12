import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, extractTreeInventory, parseRepository, scoreRepository } from '../core.js';

test('accepts owner/name and common GitHub repository URL forms', () => {
  assert.equal(parseRepository('octocat/Hello-World'), 'octocat/Hello-World');
  assert.equal(parseRepository('https://github.com/octocat/Hello-World.git/'), 'octocat/Hello-World');
});

test('accepts GitHub repository subpages such as issues and tree views', () => {
  assert.equal(parseRepository('https://github.com/octocat/Hello-World/issues/42'), 'octocat/Hello-World');
  assert.equal(parseRepository('https://github.com/octocat/Hello-World/tree/main/src'), 'octocat/Hello-World');
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

test('recognizes contributor and community files in GitHub nested directories', () => {
  const result = scoreRepository({
    contentPaths: [
      '.github/CONTRIBUTING.md',
      '.github/SECURITY.md',
      '.github/CODE_OF_CONDUCT.md',
      '.github/ISSUE_TEMPLATE/bug-report.yml'
    ]
  });
  for (const title of ['Contribution guide', 'Code of conduct', 'Security policy', 'Issue templates']) {
    assert.equal(result.checks.find((check) => check.title === title).status, 'pass', `${title} should be discovered`);
  }
});

test('extracts file paths from a recursive GitHub tree and preserves its completeness flag', () => {
  const inventory = extractTreeInventory({
    truncated: true,
    tree: [
      { path: '.github/ISSUE_TEMPLATE/bug.yml', type: 'blob' },
      { path: '.github/ISSUE_TEMPLATE', type: 'tree' },
      { path: 'README.md', type: 'blob' }
    ]
  });
  assert.deepEqual(inventory.paths, ['.github/ISSUE_TEMPLATE/bug.yml', 'README.md']);
  assert.deepEqual(inventory.fileNames, ['bug.yml', 'readme.md']);
  assert.equal(inventory.complete, false);
  assert.equal(extractTreeInventory({ tree: [] }).complete, true);
});

test('report lists missing signals and identifies its limits', () => {
  const scored = scoreRepository({});
  const report = buildReport({ metadata: { full_name: 'owner/sample' }, ...scored });
  assert.match(report, /owner\/sample/);
  assert.match(report, /not a security review/);
  assert.match(report, /License/);
});

test('report warns when GitHub marks the recursive file inventory as partial', () => {
  const scored = scoreRepository({});
  const report = buildReport({ metadata: { full_name: 'owner/sample' }, inventoryComplete: false, ...scored });
  assert.match(report, /partial file list/i);
});
