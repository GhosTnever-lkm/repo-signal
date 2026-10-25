import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildReport, extractTreeInventory, hasReadmeEvidence, parseRepository, scoreRepository, unavailableSignalsFor } from '../core.js';

test('HTML contains every statically selected element required by the app', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const selectors = [...app.matchAll(/\$\('#([^']+)'\)/g)].map((match) => match[1]);
  assert.ok(selectors.length > 0, 'app should contain static ID selectors');
  for (const id of selectors) assert.ok(htmlIds.has(id), `index.html should define #${id}`);
});

test('package version matches the changelog and app cache-busting URL', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  assert.match(html, new RegExp(`app\\.js\\?v=${pkg.version.replaceAll('.', '\\.')}`));
  assert.match(changelog, new RegExp(`^## ${pkg.version.replaceAll('.', '\\.') } - `, 'm'));
});

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
  assert.throws(() => parseRepository('octocat//repo'), /owner\/name/);
  assert.throws(() => parseRepository('https://github.com//octocat/repo'), /owner\/name/);
});

test('calculates a transparent score from weighted visible signals', () => {
  const result = scoreRepository({ metadata: { description: 'An example', license: { spdx_id: 'MIT' } }, hasReadme: true, files: ['contributing.md'], contentPaths: ['.github/workflows/ci.yml'], topics: ['example', 'tool'], hasRelease: true, workflowCount: 1 });
  assert.equal(result.score, 84);
  assert.equal(result.checks.length, 10);
  assert.equal(result.checks.find((check) => check.title === 'README').status, 'pass');
  assert.equal(result.checks.find((check) => check.title === 'Security policy').status, 'warn');
});

test('keeps unavailable GitHub signals out of the score instead of calling them missing', () => {
  const result = scoreRepository({ metadata: { description: 'An example' }, hasReadme: false, unavailableSignals: ['README', 'Repository topics'] });
  assert.equal(result.checks.find((check) => check.title === 'README').status, 'unknown');
  assert.equal(result.checks.find((check) => check.title === 'Repository topics').status, 'unknown');
  assert.equal(result.checks.find((check) => check.title === 'License').status, 'fail');
  assert.equal(result.score, 10);
  assert.equal(result.availablePoints, 72);
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

test('identifies failed optional API signals while using the tree as evidence where possible', () => {
  const responses = [
    { status: 'fulfilled' }, { status: 'rejected' }, { status: 'fulfilled' },
    { status: 'rejected' }, { status: 'rejected' }, { status: 'rejected' }
  ];
  assert.deepEqual(unavailableSignalsFor(responses, ['README.md', '.github/workflows/ci.yml']), ['Repository topics', 'First release']);
  assert.deepEqual(unavailableSignalsFor(responses, ['README.rst']), ['Repository topics', 'First release', 'GitHub Actions']);
  assert.deepEqual(unavailableSignalsFor(responses, []), ['README', 'Repository topics', 'First release', 'GitHub Actions']);
});

test('uses a root README from the recursive tree when the README endpoint is unavailable', () => {
  assert.equal(hasReadmeEvidence(null, ['README.md', 'docs/README.md']), true);
  assert.equal(hasReadmeEvidence(null, ['docs/README.md']), false);
  const scored = scoreRepository({ hasReadme: hasReadmeEvidence(null, ['README.md']), contentPaths: ['README.md'] });
  assert.equal(scored.checks.find((check) => check.title === 'README').status, 'pass');
});

test('does not treat lookalike filenames as code of conduct or issue templates', () => {
  const scored = scoreRepository({
    files: ['mycode_of_conduct.md', 'issue_template-malicious.yml', 'issue_template'],
    contentPaths: ['docs/mycode_of_conduct.md', '.github/issue_template-malicious.yml', 'docs/issue_template']
  });
  assert.equal(scored.checks.find((check) => check.title === 'Code of conduct').status, 'warn');
  assert.equal(scored.checks.find((check) => check.title === 'Issue templates').status, 'warn');
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

test('report discloses unavailable signals and the verified score denominator', () => {
  const scored = scoreRepository({ unavailableSignals: ['README'] });
  const report = buildReport({ metadata: { full_name: 'owner/sample' }, ...scored });
  assert.match(report, /Readiness signals: 0\/82 verified points \(82\/100 available\)/);
  assert.match(report, /\*\*README\*\* \(unknown\)/);
  assert.match(report, /could not determine whether it is present/i);
});
