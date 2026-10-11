// SPDX-License-Identifier: AGPL-3.0-or-later
// Runs within the same isolated, silent Electron session as browser.cjs.
const assert=require('node:assert/strict');
module.exports=async function verifyWorkspace(run,window){
  const execute=script=>run(script.includes('await ')?'(async()=>{'+script+'})()':script);
  const check=async(script,message)=>assert.equal(await execute(script),true,message);
  await execute(`globalThis.uiCheck=(value,message)=>{if(!value)throw Error(message);};globalThis.uiWait=async fn=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('UI wait timed out');};void 0;`);
  await check(`data.profiles.length===0&&document.querySelector('#profileSelect').value==='baseline'&&currentCondition().masterGain===0&&document.querySelector('#masterGain').value==='0'&&document.querySelector('#masterGainNumber').value==='0'&&!audio.stream`,'fresh workspace separates samples from personal settings');
  await execute(`globalThis.uiOriginalCapture=navigator.mediaDevices.getUserMedia;globalThis.uiCaptureContext=new AudioContext();globalThis.uiCaptureStream=uiCaptureContext.createMediaStreamDestination().stream;navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>globalThis.uiFinishCapture=resolve);globalThis.uiPreparing=prepareAudio();void 0;`);
  await check(`document.querySelector('#micStatus').textContent.includes('確認中')`,'microphone check reports preparation');
  await execute(`await emergencyStop({broadcast:false});globalThis.uiLateStream=uiCaptureStream.clone();uiFinishCapture(uiLateStream);await uiPreparing;navigator.mediaDevices.getUserMedia=uiOriginalCapture;uiCaptureStream.getTracks().forEach(track=>track.stop());await uiCaptureContext.close();`);
  await check(`uiLateStream.getTracks().every(track=>track.readyState==='ended')&&document.querySelector('#micStatus').textContent.includes('未使用')&&!audio.running`,'late microphone confirmation releases stream and preserves stopped state');

  // Hover, focus and pinned content must never edit settings or start audio.
  await execute(`globalThis.beforeHelp=JSON.stringify(currentCondition());globalThis.delayHelp=document.querySelector('#branchAPanel [data-info="delay"]');delayHelp.dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse'}));`);
  await execute(`uiWait(()=>!document.querySelector('#infoPopover').hidden)`);
  await check(`document.querySelector('#infoPopover').getAttribute('role')==='tooltip'&&document.querySelector('#infoDetails').hidden&&JSON.stringify(currentCondition())===beforeHelp&&!audio.stream`,'hover has beginner text and no side effects');
  await execute(`delayHelp.dispatchEvent(new PointerEvent('pointerleave'));document.querySelector('#infoPopover').dispatchEvent(new PointerEvent('pointerenter'));`);
  await execute(`new Promise(resolve=>setTimeout(resolve,200))`);
  await check(`!document.querySelector('#infoPopover').hidden`,'pointer may travel into hover explanation');
  await execute(`document.querySelector('#infoPopover').dispatchEvent(new PointerEvent('pointerleave'));document.querySelector('#startAssist').focus();`);
  await execute(`uiWait(()=>document.querySelector('#infoPopover').hidden)`);
  await execute(`delayHelp.focus();delayHelp.click();`);
  await check(`document.querySelector('#infoPopover').getAttribute('role')==='dialog'&&!document.querySelector('#infoDetails').hidden&&delayHelp.getAttribute('aria-expanded')==='true'`,'click pins interactive explanation');
  await execute(`document.querySelector('#infoDetails').click();`);
  await check(`!document.querySelector('#guideDrawer').hidden&&document.activeElement===document.querySelector('#closeDrawer')&&JSON.stringify(currentCondition())===beforeHelp`,'details preserve values and move focus');
  await execute(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));`);
  await check(`document.querySelector('#guideDrawer').hidden&&document.querySelector('#infoPopover').hidden`,'Escape closes explanations without reopening them');

  // Numeric typing, invalid intermediate text, precise pitch and lock behavior.
  await execute(`document.querySelector('#delayANumber').value='83';document.querySelector('#delayANumber').dispatchEvent(new Event('input'));document.querySelector('#pitchANumber').value='-2.5';document.querySelector('#pitchANumber').dispatchEvent(new Event('input'));`);
  await check(`currentCondition().branches[0].delay===83&&currentCondition().branches[0].pitch===-2.5&&document.querySelector('#pitchAValue').textContent==='-2.5 半音'`,'precise numbers synchronize with sliders');
  await execute(`document.querySelector('#delayANumber').value='';document.querySelector('#delayANumber').dispatchEvent(new Event('input'));`);
  await check(`currentCondition().branches[0].delay===83`,'empty numeric input is not treated as zero');
  await execute(`document.querySelector('#delayANumber').value='999';document.querySelector('#delayANumber').dispatchEvent(new Event('change'));document.querySelector('#settingLock').click();`);
  await check(`currentCondition().branches[0].delay===300&&document.querySelector('#delayANumber').disabled&&!delayHelp.disabled&&!document.querySelector('#masterGainNumber').disabled`,'clamping and lock preserve explanation and volume access');
  await execute(`document.querySelector('#settingLock').click();document.querySelector('#delayANumber').value='83';document.querySelector('#delayANumber').dispatchEvent(new Event('input'));`);

  // Save dialog separates update from copy; edits never mutate the saved preset.
  await execute(`document.querySelector('#saveCurrentProfile').click();document.querySelector('#profileName').value='会話テスト';document.querySelector('#profileScene').value='会話';document.querySelector('#profileFavorite').checked=true;document.querySelector('#profileForm').requestSubmit();`);
  await check(`data.profiles.length===1&&data.profiles[0].favorite&&data.profiles[0].condition.branches[0].delay===83&&!document.querySelector('#profileDialog').open`,'dialog saves named personal preset');
  await execute(`document.querySelector('#delayA').value='99';document.querySelector('#delayA').dispatchEvent(new Event('input'));`);
  await check(`data.profiles[0].condition.branches[0].delay===83&&document.querySelector('#dirtyState').textContent.includes('変更あり')`,'draft differs from persisted preset');
  await execute(`document.querySelector('#updateProfile').click();document.querySelector('#cancelProfile').click();document.querySelector('#revertCondition').click();`);
  await check(`currentCondition().branches[0].delay===83&&document.querySelector('#revertCondition').disabled`,'cancel and revert preserve saved value');
  await execute(`document.querySelector('#delayA').value='99';document.querySelector('#delayA').dispatchEvent(new Event('input'));document.querySelector('#updateProfile').click();document.querySelector('#profileForm').requestSubmit();`);
  await check(`data.profiles.length===1&&data.profiles[0].condition.branches[0].delay===99`,'explicit update changes only selected preset');

  // Snapshot both sides before comparison, then switch without auto-starting.
  await execute(`document.querySelector('#delayA').value='120';document.querySelector('#delayA').dispatchEvent(new Event('input'));openTrial();document.querySelector('#trialProfileA').value='@origin';document.querySelector('#trialProfileB').value='@draft';document.querySelector('#trialRandomize').checked=false;document.querySelector('#trialStartButton').click();`);
  await execute(`uiWait(()=>trial.active&&!document.querySelector('#trialBar').hidden)`);
  await check(`currentCondition().branches[0].delay===99&&!audio.running&&document.querySelector('#trialDifference').textContent.includes('99 ms → 120 ms')`,'comparison retains edit origin and draft');
  await execute(`document.querySelector('#trialAdvance').click();`);await execute(`uiWait(()=>trial.index===1&&currentCondition().branches[0].delay===120)`);
  await check(`!audio.running&&!audio.stream`,'next comparison condition requires explicit start');
  await execute(`document.querySelector('#trialFinish').click();`);await execute(`uiWait(()=>!trial.active)`);

  // Microphone-free baseline use, mid-use changes and optional reflection values.
  await execute(`workspace.reset();await applyProfile('baseline');await startAssist();document.querySelector('#masterGain').value='-30';document.querySelector('#masterGain').dispatchEvent(new Event('input'));await muteAssist();go('history');document.querySelector('#sessionScene').value='会話';document.querySelector('#saveReflection').click();`);
  await check(`data.reflections.at(-1).session.kind==='audio'&&data.reflections.at(-1).session.segments.length===2&&data.reflections.at(-1).conditionSnapshot.masterGain===0&&data.reflections.at(-1).session.segments[1].condition.masterGain===-30&&data.reflections.at(-1).effort===null`,'start snapshot and changes remain distinct, with unanswered ratings');
  await execute(`document.querySelector('#historyList .text-btn').click();`);await execute(`uiWait(()=>document.querySelector('#page-assist').classList.contains('active'))`);
  await check(`currentCondition().masterGain===0&&!audio.running`,'history reuses start condition without auto-start');

  // Stale text cannot play an old phrase. Local TTS remains independent of audio.
  await execute(`go('script');document.querySelector('#scriptText').value='一つ目。二つ目。';document.querySelector('#scriptText').dispatchEvent(new Event('input'));document.querySelector('#splitScript').click();globalThis.savedLocalVoices=speechSynthesis.getVoices;globalThis.savedSpeak=speechSynthesis.speak;globalThis.savedUtterance=window.SpeechSynthesisUtterance;window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};globalThis.uiUtterances=[];speechSynthesis.getVoices=()=>[{name:'local-ui',localService:true,lang:'ja-JP'}];speechSynthesis.speak=u=>uiUtterances.push(u);loadVoices();playPhrase({skipCountdown:true});`);
  await check(`speaking&&document.querySelector('#ttsStatus').classList.contains('running')&&!audio.running`,'TTS status is independent of microphone assistance');
  await execute(`document.querySelector('#openCompact').click();document.querySelector('#compactMute').click();`);await execute(`uiWait(()=>!speaking)`);
  await check(`document.querySelector('#ttsStatus').textContent.includes('停止')`,'compact all-stop works while only TTS is playing');
  await execute(`document.querySelector('#scriptText').value='編集した文。';document.querySelector('#scriptText').dispatchEvent(new Event('input'));playPhrase({skipCountdown:true});`);
  await check(`uiUtterances.length===1&&document.querySelector('#playPhrase').disabled&&document.querySelector('#scriptDirty').textContent.includes('原稿を変更')`,'edited text stops playback until phrases update');
  await execute(`document.querySelector('#saveScript').click();playPhrase({skipCountdown:true});`);
  await check(`uiUtterances.at(-1).text==='編集した文。'&&!document.querySelector('#playPhrase').disabled`,'saving updates phrase source before playback');
  await execute(`pausePhrase();speechSynthesis.getVoices=savedLocalVoices;speechSynthesis.speak=savedSpeak;window.SpeechSynthesisUtterance=savedUtterance;document.querySelector('#closeCompact').click();document.querySelector('#readingView').click();`);
  await check(`document.querySelector('#page-script').classList.contains('reading-mode')&&document.querySelector('#readingView').getAttribute('aria-pressed')==='true'`,'reading mode keeps focused playback controls');
  await execute(`document.querySelector('#readingView').click();workspace.reset();go('guide');globalThis.beforeTour=JSON.stringify(currentCondition());document.querySelector('#startWalkthrough').click();`);
  await check(`!document.querySelector('#guideDrawer').hidden&&JSON.stringify(currentCondition())===beforeTour&&!audio.running`,'optional walkthrough changes no settings');
  await execute(`document.querySelector('#closeDrawer').click();`);
  await execute(`go('assist');await startAssist();delayHelp.focus();delayHelp.click();window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));`);
  await check(`audio.running&&document.querySelector('#infoPopover').hidden&&document.activeElement===delayHelp`,'tooltip Escape closes once and preserves live audio');
  await execute(`await emergencyStop({broadcast:false});workspace.reset();`);
  // All pages must keep status and emergency access at small widths.
  window.setSize(390,844);
  for(const page of ['assist','script','history','settings','guide','home']){
    await execute(`go('${page}')`);
    await check(`document.documentElement.scrollWidth<=innerWidth&&document.querySelector('#emergency').getBoundingClientRect().right<=innerWidth&&getComputedStyle(document.querySelector('.status-group')).display!=='none'`,page+' mobile overflow and status');
  }
  window.setSize(1280,1000);
  await execute(`await emergencyStop({broadcast:false});localStorage.removeItem(STORE)`);await window.reload();
  console.log('WORKSPACE UI TESTS PASSED');
};
