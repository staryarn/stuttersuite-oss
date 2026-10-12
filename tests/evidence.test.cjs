// SPDX-License-Identifier: AGPL-3.0-or-later
// Regression test for evidence-guide structure, citations, and external-link safety.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const evidence = fs.readFileSync(path.join(root, 'EVIDENCE_JA.md'), 'utf8');

const science = html.split('id="guide-science"')[1]?.split('id="guide-faq"')[0];
assert.ok(science, 'the evidence guide section exists');

// Keep each search within its own closed article; never allow a following
// article's details/citation to satisfy an earlier article's assertions.
function evidenceCards(markup) {
  return [...markup.matchAll(/<article\b[^>]*\bclass="evidence-card"[^>]*>[\s\S]*?<\/article>/g)].map(match => match[0]);
}
function assertCard(card, sourceUrl) {
  const details = card.match(/<details class="evidence-detail">([\s\S]*?)<\/details>/);
  assert.ok(details, 'card must contain its own expandable details');
  assert.match(details[1], /<summary>対象・比較条件・限界と出典<\/summary>/);
  assert.match(details[1], /<dt>研究規模<\/dt>/);
  assert.match(details[1], /<dt>比較・結果<\/dt>/);
  assert.match(details[1], /<dt>限界とアプリとの差<\/dt>/);
  assert.ok(details[1].includes(sourceUrl), 'card details must contain the correct primary source: ' + sourceUrl);
}

test('each assistive method has one independently validated evidence card', () => {
  const expected = new Map([
    ['evidence-daf', 'https://doi.org/10.1111/1460-6984.70283'],
    ['evidence-faf', 'https://pubmed.ncbi.nlm.nih.gov/8729926/'],
    ['evidence-choral', 'https://pubmed.ncbi.nlm.nih.gov/41175681/'],
    ['evidence-masking', 'https://pubmed.ncbi.nlm.nih.gov/22365886/'],
    ['evidence-rhythm', 'https://pubmed.ncbi.nlm.nih.gov/22365886/'],
  ]);
  const cards = evidenceCards(science);
  assert.equal(cards.length, expected.size, 'exactly one card for each studied method');
  for (const [id, sourceUrl] of expected) {
    const matches = cards.filter(card => card.match(/^<article\b[^>]*\bid="([^"]+)"/)?.[1] === id);
    assert.equal(matches.length, 1, id + ' is present exactly once');
    assert.equal((html.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1, id + ' has a unique document ID');
    assertCard(matches[0], sourceUrl);
  }
});

test('deleting DAF details is detected even when later cards still have details', () => {
  const daf = evidenceCards(science)[0];
  assert.match(daf, /id="evidence-daf"/);
  const withoutDetails = daf.replace(/<details\b[^>]*>[\s\S]*?<\/details>/, '');
  assert.notEqual(withoutDetails, daf);
  assert.throws(() => assertCard(withoutDetails, 'https://doi.org/10.1111/1460-6984.70283'), assert.AssertionError);
});

test('guide and reference ledger both link to published evidence', () => {
  for (const id of ['42340070', '8729926', '41175681', '22365886', '26123259', '37216145', '39772710']) {
    assert.ok(html.includes('pubmed.ncbi.nlm.nih.gov/' + id + '/'), 'guide PMID ' + id);
    assert.ok(evidence.includes('pubmed.ncbi.nlm.nih.gov/' + id + '/'), 'ledger PMID ' + id);
  }
  assert.ok(html.includes('www.asha.org/practice-portal/clinical-topics/fluency-disorders/'));
  assert.ok(science.includes('/blob/a25ac839ceb256f64b9a2b5dfded8fcfc54bd510/EVIDENCE_JA.md'),
    'published guide links to a working immutable evidence snapshot, including in PR previews');
});

test('all guide external links opened in new tabs use noopener and noreferrer', () => {
  const links = science.match(/<a\b[^>]*>/g) || [];
  assert.ok(links.length > 5);
  for (const link of links) {
    if (/target="_blank"/.test(link)) {
      assert.match(link, /rel="noopener noreferrer"/);
    }
  }
});
