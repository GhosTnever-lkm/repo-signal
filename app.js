import { scoreRepository, parseRepository, buildReport, extractTreeInventory, hasReadmeEvidence, unavailableSignalsFor } from './core.js';

const $ = (selector) => document.querySelector(selector);
const form = $('#auditForm');
const input = $('#repoInput');
const button = $('#auditButton');
const status = $('#status');
const results = $('#results');
let lastAudit = null;

function setStatus(message, error = false) {
  status.hidden = !message;
  status.textContent = message;
  status.classList.toggle('error', error);
}

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) {
    if (response.status === 404) throw new Error('Repository or one of its public metadata endpoints was not found. Check the owner/name and try again.');
    if (response.status === 403 || response.status === 429) throw new Error('GitHub public API rate limit reached. Wait a little, then retry. RepoSignal does not need a token.');
    throw new Error(`GitHub returned ${response.status}. Please retry in a moment.`);
  }
  return response.json();
}

async function audit(repo) {
  const encoded = repo.split('/').map(encodeURIComponent);
  const base = `/repos/${encoded[0]}/${encoded[1]}`;
  const responses = await Promise.allSettled([
    github(base), github(`${base}/readme`), github(`${base}/languages`),
    github(`${base}/topics`), github(`${base}/releases?per_page=1`), github(`${base}/actions/workflows?per_page=1`)
  ]);
  const [metadata, readme, languages, topics, releases, workflows] = responses.map((item) => item.status === 'fulfilled' ? item.value : null);
  if (!metadata) throw responses[0].reason;
  const tree = metadata.default_branch ? await github(`${base}/git/trees/${encodeURIComponent(metadata.default_branch)}?recursive=1`) : { tree: [], truncated: false };
  const inventory = extractTreeInventory(tree);
  const { paths: contentPaths, fileNames } = inventory;
  const hasReadme = hasReadmeEvidence(readme, contentPaths);
  const unavailableSignals = unavailableSignalsFor(responses, contentPaths);
  const score = scoreRepository({ metadata, hasReadme, files: fileNames, contentPaths, languages: languages || {}, topics: topics?.names || [], hasRelease: Array.isArray(releases) && releases.length > 0, workflowCount: workflows?.total_count || 0, unavailableSignals });
  return { repo, metadata, files: fileNames, contentPaths, inventoryComplete: inventory.complete, languages: languages || {}, topics: topics?.names || [], hasReadme, hasRelease: Array.isArray(releases) && releases.length > 0, workflowCount: workflows?.total_count || 0, ...score };
}

const destinations = {
  'Project description': 'settings', 'README': 'edit', 'License': 'community/license/new', 'Repository topics': 'topics',
  'GitHub Actions': 'actions', 'First release': 'releases/new', 'Contribution guide': 'community', 'Code of conduct': 'community/code-of-conduct/new', 'Security policy': 'security/policy/new', 'Issue templates': 'issues/new/choose'
};

function render(auditResult) {
  const { metadata, score, checks, availablePoints = 100 } = auditResult;
  const scorePercent = availablePoints ? score / availablePoints * 100 : 0;
  $('#scoreValue').textContent = score;
  $('#scoreDenominator').textContent = `/ ${availablePoints}`;
  $('#scoreRing').classList.toggle('warn', scorePercent < 80 && scorePercent >= 55);
  $('#scoreRing').classList.toggle('low', availablePoints > 0 && scorePercent < 55);
  $('#repoName').textContent = metadata.full_name;
  $('#repoDescription').textContent = metadata.description || 'No short description is set yet.';
  $('#repoLink').href = metadata.html_url;
  $('#repoFacts').replaceChildren(...[
    metadata.language || 'Language not set', metadata.stargazers_count.toLocaleString() + ' stars',
    auditResult.topics.length + ' topics', metadata.license?.spdx_id || 'No license'
  ].map((fact) => { const chip = document.createElement('span'); chip.className = 'fact-chip'; chip.textContent = fact; return chip; }));
  const passed = checks.filter((check) => check.status === 'pass').length;
  const unknown = checks.filter((check) => check.status === 'unknown').length;
  $('#checkCount').textContent = `${passed} of ${checks.length - unknown} verified signals present${unknown ? ` · ${unknown} unavailable` : ''}`;
  $('#scoreNote').textContent = unknown ? `GitHub did not return ${unknown} signal${unknown === 1 ? '' : 's'}. The score uses ${availablePoints} of 100 possible points; unavailable signals are not counted as missing.` : scorePercent >= 80 ? 'Strong first impression: visitors can quickly understand the project and how to work with it.' : scorePercent >= 55 ? 'A few missing signals could make it harder for new users or contributors to get started.' : 'Start with the README, a short description, and a license. Those give visitors the basic context they need.';
  const list = $('#checkList');
  list.replaceChildren(...checks.map((check) => {
    const card = document.createElement('article'); card.className = `check-card ${check.status}`;
    const icon = document.createElement('span'); icon.className = 'check-icon'; icon.textContent = check.status === 'pass' ? '✓' : check.status === 'warn' ? '!' : '×';
    const copy = document.createElement('div'); copy.className = 'check-copy';
    const title = document.createElement('b'); title.textContent = check.title;
    const detail = document.createElement('p'); detail.textContent = check.detail;
    copy.append(title, detail); card.append(icon, copy);
    if (check.status !== 'pass') { const link = document.createElement('a'); link.href = `${metadata.html_url}/${destinations[check.title] || ''}`; link.target = '_blank'; link.rel = 'noreferrer'; link.textContent = 'Fix ↗'; card.append(link); }
    return card;
  }));
  results.hidden = false;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  let repo;
  try { repo = parseRepository(input.value); }
  catch (error) { setStatus(error.message, true); results.hidden = true; return; }
  button.disabled = true; button.querySelector('span').textContent = 'Checking…'; setStatus(`Reading public signals for ${repo}…`); results.hidden = true;
  try {
    lastAudit = await audit(repo); render(lastAudit);
    setStatus(`Checkup ready for ${lastAudit.metadata.full_name}.${lastAudit.inventoryComplete ? '' : ' GitHub returned a partial file list, so some nested guidance files may not be counted.'}`);
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  catch (error) { setStatus(error.message || 'Could not read this repository. Please try again.', true); }
  finally { button.disabled = false; button.querySelector('span').textContent = 'Run checkup'; }
});

document.querySelectorAll('[data-example]').forEach((example) => example.addEventListener('click', () => { input.value = example.dataset.example; form.requestSubmit(); }));
$('#copyReport').addEventListener('click', async () => {
  if (!lastAudit) return;
  try { await navigator.clipboard.writeText(buildReport(lastAudit)); $('#copyReport').textContent = 'Copied ✓'; setTimeout(() => { $('#copyReport').textContent = 'Copy report'; }, 1600); }
  catch { setStatus('Clipboard access was blocked by the browser. Select and copy the report from the repository page instead.', true); }
});
$('#themeButton').addEventListener('click', () => { document.body.classList.toggle('light'); localStorage.setItem('repo-signal-theme', document.body.classList.contains('light') ? 'light' : 'dark'); });
if (localStorage.getItem('repo-signal-theme') === 'light') document.body.classList.add('light');

