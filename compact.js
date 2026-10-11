// Copyright (C) 2026 xer5xer5
// SPDX-License-Identifier: AGPL-3.0-or-later

(() => {
  const $ = (s) => document.querySelector(s);
  const sync = () => {
    $('#compactAssist').textContent = $('#assistStatus').textContent.trim();
    $('#compactTts').textContent = $('#ttsStatus').textContent.trim();
    $('#compactProfile').textContent = $('#conditionName').textContent.trim();
    $('#compactScript').hidden = !document.querySelectorAll('#phraseList .phrase').length;
    $('#compactPhrase').textContent = $('#currentPhrase').textContent.trim();
    $('#compactSource').textContent = '原稿の現在の句:';
    $('#compactGain').value = $('#masterGain').value;
    $('#compactRate').value = $('#ttsRate').value;
    $('#compactRateValue').textContent = $('#ttsRateValue').textContent;
  };
  $('#openCompact').addEventListener('click', () => { sync(); $('#compactPanel').hidden = false; });
  $('#closeCompact').addEventListener('click', () => $('#compactPanel').hidden = true);
  $('#compactMute').addEventListener('click', () => emergencyStop());
  $('#compactPrevious').addEventListener('click', () => $('#previousPhrase').click());
  $('#compactPlay').addEventListener('click', () => $('#playPhrase').click());
  $('#compactNext').addEventListener('click', () => $('#nextPhraseBtn').click());
  $('#compactGain').addEventListener('input', (event) => { $('#masterGain').value = event.target.value; $('#masterGain').dispatchEvent(new Event('input')); });
  $('#compactRate').addEventListener('input', (event) => { $('#ttsRate').value = event.target.value; $('#ttsRate').dispatchEvent(new Event('input')); });
  new MutationObserver(sync).observe($('#assistStatus'), {childList:true,subtree:true,characterData:true});
  new MutationObserver(sync).observe($('#currentPhrase'), {childList:true,subtree:true,characterData:true});
  new MutationObserver(sync).observe($('#ttsStatus'), {childList:true,subtree:true,characterData:true});
  new MutationObserver(sync).observe($('#conditionName'), {childList:true,subtree:true,characterData:true});
  $('#masterGain').addEventListener('input', sync);
  $('#ttsRate').addEventListener('input', sync);
})();
