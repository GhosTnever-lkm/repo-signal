export function parseRepository(value) {
  const text = String(value ?? '').trim();
  let match;
  if (/^https?:\/\//i.test(text)) {
    let url;
    try { url = new URL(text); } catch { throw new Error('Enter a valid GitHub repository link or owner/name.'); }
    if (url.hostname.toLowerCase() !== 'github.com') throw new Error('Use a public repository hosted on github.com.');
    const segments = url.pathname.split('/');
    if (segments[0] !== '' || !segments[1] || !segments[2]) throw new Error('Enter a repository as owner/name or paste its GitHub URL.');
    match = segments.slice(1, 3);
  } else {
    match = text.split('/');
    if (match.length !== 2 || match.some((part) => !part)) throw new Error('Enter a repository as owner/name or paste its GitHub URL.');
  }
  if (!match || match.length !== 2 || !/^[A-Za-z0-9-]+$/.test(match[0]) || !/^[A-Za-z0-9._-]+$/.test(match[1])) throw new Error('Enter a repository as owner/name or paste its GitHub URL.');
  return `${match[0]}/${match[1].replace(/\.git$/i, '')}`;
}

const fileExists = (files, ...names) => names.some((name) => files.includes(name));

export function extractTreeInventory(tree) {
  const paths = Array.isArray(tree?.tree)
    ? tree.tree.filter((item) => item?.type === 'blob' && typeof item.path === 'string').map((item) => item.path)
    : [];
  return {
    paths,
    fileNames: paths.map((path) => path.split('/').at(-1).toLowerCase()),
    complete: tree?.truncated !== true
  };
}

export function hasReadmeEvidence(readmeResponse, contentPaths = []) {
  return Boolean(readmeResponse) || contentPaths.some((path) => /^readme(?:\.|$)/i.test(path));
}

export function unavailableSignalsFor(responses, contentPaths = []) {
  const paths = contentPaths.map((path) => path.toLowerCase());
  const unavailable = [];
  if (responses[1]?.status === 'rejected' && !paths.some((path) => /^readme(?:\.|$)/.test(path))) unavailable.push('README');
  if (responses[3]?.status === 'rejected') unavailable.push('Repository topics');
  if (responses[4]?.status === 'rejected') unavailable.push('First release');
  if (responses[5]?.status === 'rejected' && !paths.some((path) => path.startsWith('.github/workflows/'))) unavailable.push('GitHub Actions');
  return unavailable;
}

export function scoreRepository({ metadata = {}, hasReadme = false, files = [], contentPaths = [], languages = {}, topics = [], hasRelease = false, workflowCount = 0, unavailableSignals = [] }) {
  const checks = [
    { title: 'Project description', ok: Boolean(metadata.description?.trim()), points: 10, detail: metadata.description?.trim() ? 'A short description explains the project in GitHub search and on the repository page.' : 'Add a one-sentence description so visitors can understand the project before opening it.' },
    { title: 'README', ok: hasReadme, points: 18, detail: hasReadme ? 'A README is available to explain setup, use, and project scope.' : 'Add a README with what it does, how to try it, and a small example.' },
    { title: 'License', ok: Boolean(metadata.license?.spdx_id), points: 14, detail: metadata.license?.spdx_id ? `GitHub identifies ${metadata.license.spdx_id} as the repository license.` : 'No recognized license is attached. Choose one that matches how you want others to use the code.' },
    { title: 'Repository topics', ok: topics.length >= 2, points: 10, detail: topics.length >= 2 ? `${topics.length} topics help people find this repository.` : 'Add a few accurate topics such as the language, platform, and problem area.' },
    { title: 'GitHub Actions', ok: workflowCount > 0 || contentPaths.some((path) => path.startsWith('.github/workflows/')), points: 14, detail: workflowCount > 0 || contentPaths.some((path) => path.startsWith('.github/workflows/')) ? 'At least one Actions workflow is visible.' : 'Consider a small CI workflow that runs the project checks on each change.' },
    { title: 'First release', ok: hasRelease, points: 10, detail: hasRelease ? 'A GitHub release gives users a versioned starting point.' : 'Publish a tagged release when you have a version worth trying.' },
    { title: 'Contribution guide', ok: fileExists(files, 'contributing.md') || contentPaths.some((path) => path.toLowerCase().endsWith('/contributing.md')), points: 8, detail: fileExists(files, 'contributing.md') || contentPaths.some((path) => path.toLowerCase().endsWith('/contributing.md')) ? 'Contributor guidance is present.' : 'A short CONTRIBUTING guide can explain setup, checks, and how to report changes.' },
    { title: 'Code of conduct', ok: fileExists(files, 'code_of_conduct.md') || contentPaths.some((path) => path.toLowerCase().endsWith('/code_of_conduct.md')), points: 6, detail: fileExists(files, 'code_of_conduct.md') || contentPaths.some((path) => path.toLowerCase().endsWith('/code_of_conduct.md')) ? 'A code of conduct is visible.' : 'A code of conduct can set a clear baseline for community interaction.' },
    { title: 'Security policy', ok: fileExists(files, 'security.md') || contentPaths.some((path) => path.toLowerCase().endsWith('/security.md')), points: 6, detail: fileExists(files, 'security.md') || contentPaths.some((path) => path.toLowerCase().endsWith('/security.md')) ? 'Security reporting guidance is present.' : 'Add private vulnerability reporting guidance if the project handles sensitive issues.' },
    { title: 'Issue templates', ok: contentPaths.some((path) => /^\.github\/issue_template(?:\.md$|\/)/i.test(path)), points: 4, detail: contentPaths.some((path) => /^\.github\/issue_template(?:\.md$|\/)/i.test(path)) ? 'Issue templates can make reports more actionable.' : 'Issue templates can prompt for the details maintainers need.' }
  ];
  const unavailable = new Set(unavailableSignals);
  const resultChecks = checks.map(({ title, points, ok, detail }) => unavailable.has(title)
    ? { title, points, status: 'unknown', detail: `GitHub did not provide this signal, so RepoSignal could not determine whether it is present. ${detail}` }
    : { title, points, status: ok ? 'pass' : (points <= 6 ? 'warn' : 'fail'), detail });
  const score = resultChecks.reduce((sum, check) => sum + (check.status === 'pass' ? check.points : 0), 0);
  const availablePoints = resultChecks.reduce((sum, check) => sum + (check.status === 'unknown' ? 0 : check.points), 0);
  return { score, availablePoints, checks: resultChecks };
}

export function buildReport(audit) {
  const { metadata, score, checks, inventoryComplete = true } = audit;
  const availablePoints = audit.availablePoints ?? 100;
  const lines = [`# Repository checkup: ${metadata.full_name}`, '', `Readiness signals: ${score}/${availablePoints} verified points (${availablePoints}/100 available)`, '', `> This is a transparent checklist, not a security review or a quality rating.`, '', '## Signals'];
  if (!inventoryComplete) lines.splice(4, 0, '> GitHub returned a partial file list; some nested guidance files may not be counted.', '');
  for (const check of checks) lines.push(`- [${check.status === 'pass' ? 'x' : ' '}] **${check.title}** (${check.status}) — ${check.detail}`);
  lines.push('', `Checked with [RepoSignal](https://github.com/GhosTnever-lkm/repo-signal).`);
  return lines.join('\n');
}
