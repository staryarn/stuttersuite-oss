// SPDX-License-Identifier: AGPL-3.0-or-later
// Regression test for evidence-guide structure, citations, and external-link safety.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const evidence = fs.readFileSync(path.join(root, 'EVIDENCE_JA.md'), 'utf8');
test('each studied assistive method has a unique anchored, expandable evidence card', () => {
  for (const id of ['evidence-daf', 'evidence-faf', 'evidence-choral', 'evidence-masking', 'evidence-rhythm']) {
    assert.equal((html.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1, id);
    assert.match(html, new RegExp('<article[^>]*id="' + id + '"[\\s\\S]*?<details class="evidence-detail">[\\s\\S]*?<summary>対象・比較条件・限界と出典<\\/summary>'), id);
  }
});
test('guide and reference ledger both link to foundational published evidence', () => {
  for (const id of ['42340070', '8729926', '41175681', '22365886', '26123259', '37216145']) {
    assert.ok(html.includes('pubmed.ncbi.nlm.nih.gov/' + id + '/'), 'guide PMID ' + id);
    assert.ok(evidence.includes('pubmed.ncbi.nlm.nih.gov/' + id + '/'), 'ledger PMID ' + id);
  }
  assert.ok(evidence.includes('pubmed.ncbi.nlm.nih.gov/39772710/'));
  assert.ok(html.includes('www.asha.org/practice-portal/clinical-topics/fluency-disorders/'));
});
test('all guide external links opened in new tabs use noopener and noreferrer', () => {
  const science = html.split('id="guide-science"')[1].split('id="guide-faq"')[0];
  const links = science.match(/<a\b[^>]*>/g) || [];
  assert.ok(links.length > 5);
  for (const link of links) {
    if (/target="_blank"/.test(link)) {
      assert.match(link, /rel="noopener noreferrer"/);
    }
  }
});
