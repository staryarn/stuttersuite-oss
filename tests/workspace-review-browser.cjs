// SPDX-License-Identifier: AGPL-3.0-or-later
// Regression coverage for PR #4. Uses silent synthetic capture only.
const assert=require('node:assert/strict');
module.exports=async function verifyWorkspaceReview(run,window){
  const execute=script=>run('(async()=>{'+script+'})()');
  const check=async(script,message)=>assert.equal(await execute('return '+script),true,message);
  await execute(`
    globalThis.reviewWait=async fn=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('review wait timed out');};
    globalThis.reviewSet=(id,value)=>{const node=document.querySelector('#'+id);node.value=String(value);node.dispatchEvent(new Event('input',{bubbles:true}));};
    globalThis.reviewOriginalCapture=navigator.mediaDevices.getUserMedia;
    globalThis.reviewCaptureContext=new AudioContext();
    globalThis.reviewCaptureStream=reviewCaptureContext.createMediaStreamDestination().stream;
    navigator.mediaDevices.getUserMedia=async()=>reviewCaptureStream.clone();
    const condition=defaultCondition();condition.branches[0].pitch=0;
    data.profiles=[{id:'review-preset',name:'保存条件',scene:'会話',condition},{id:'review-other',name:'別の保存条件',scene:'発表',condition:{...structuredClone(condition),masterGain:-35}}];
    renderProfiles();await applyProfile('review-preset');workspace.reset();
    globalThis.reviewCompare=async(a,b)=>{openTrial();document.querySelector('#trialProfileA').value=a;document.querySelector('#trialProfileB').value=b;document.querySelector('#trialRandomize').checked=false;document.querySelector('#trialStartButton').click();await reviewWait(()=>trial.active&&!document.querySelector('#trialModal').classList.contains('open'));};
    globalThis.reviewFinish=async()=>{document.querySelector('#trialFinish').click();await reviewWait(()=>!trial.active);};
  `);

  // A comparison that ends on baseline must preserve the unsaved draft and its origin.
  await execute(`reviewSet('delayA',120);await reviewCompare('@draft','baseline');document.querySelector('#trialAdvance').click();await reviewWait(()=>trial.index===1&&currentCondition().branches.every(b=>!b.enabled));await reviewFinish();`);
  await check(`currentCondition().branches[0].delay===120&&currentCondition().branches[0].enabled&&activeProfile==='review-preset'&&document.querySelector('#profileSelect').value==='review-preset'&&document.querySelector('#dirtyState').textContent.includes('変更あり')&&!audio.running&&!audio.stream`,'comparison restores unsaved draft, selection and dirty state after baseline');
  await execute(`document.querySelector('#revertCondition').click();`);
  await check(`currentCondition().branches[0].delay===50&&data.profiles[0].condition.branches[0].delay===50`,'restored draft keeps the original revert target and does not update saved data');
  await execute(`reviewSet('delayA',120);await reviewCompare('@draft','baseline');await reviewFinish();await reviewCompare('@draft','baseline');`);
  await check(`currentCondition().branches[0].delay===120`,'early exit and a new comparison preserve the same draft');
  await execute(`await reviewFinish();workspace.reset();await applyProfile('review-preset');await reviewCompare('review-preset','baseline');await startAssist();document.querySelector('#saveReflection').click();`);
  await check(`!!data.reflections.at(-1).session.comparisonId&&data.reflections.at(-1).session.comparisonIndex===0`,'unchanged comparison use retains its comparison association');

  // Changes must be visible and must not count as the originally fixed comparison condition.
  await execute(`globalThis.reviewValidComparison=data.reflections.at(-1).session.comparisonId;reviewSet('delayA',75);`);
  await check(`document.querySelector('#trialBarTitle').textContent.includes('比較条件から変更あり')&&!document.querySelector('#trialChangeNotice').hidden`,'live edits visibly flag comparison deviation');
  await execute(`document.querySelector('#saveReflection').click();`);
  await check(`!data.reflections.at(-1).session.comparisonId&&data.reflections.at(-1).session.segments.length===2&&data.reflections.at(-1).conditionSnapshot.branches[0].delay===50&&data.reflections.at(-1).session.segments.at(-1).condition.branches[0].delay===75&&data.reflections.at(-2).session.comparisonId===reviewValidComparison`,'mixed use is separate from fixed comparison results without rewriting earlier records');
  await execute(`reviewSet('delayA',50);`);
  await check(`document.querySelector('#trialBarTitle').textContent.includes('比較条件から変更あり')`,'returning to the old value does not erase the fact that the phase was edited');
  await execute(`openTrial();document.querySelector('#trialStartButton').click();await reviewWait(()=>!trial.preparing&&!document.querySelector('#trialModal').classList.contains('open'));`);
  await check(`document.querySelector('#trialChangeNotice').hidden&&currentCondition().branches[0].delay===50`,'preparing the fixed condition again clears deviation');
  await execute(`document.querySelector('#trialAdvance').click();await reviewWait(()=>trial.index===1&&currentCondition().branches.every(b=>!b.enabled));`);
  await check(`!document.querySelector('#trialBarTitle').textContent.includes('変更あり')`,'advancing starts the next fixed phase without a false deviation');
  await execute(`await reviewFinish();workspace.reset();await applyProfile('review-preset');await reviewCompare('review-preset','baseline');await applyProfile('review-other');`);
  await check(`!document.querySelector('#trialChangeNotice').hidden`,'loading a different saved preset also flags comparison deviation');
  await execute(`await startAssist();document.querySelector('#saveReflection').click();`);
  await check(`!data.reflections.at(-1).session.comparisonId&&data.reflections.at(-1).conditionSnapshot.masterGain===-35`,'a different loaded preset is recorded independently');
  await execute(`await reviewFinish();workspace.reset();await applyProfile('review-preset');`);

  // Discard only the selected use, then continue tracking a still-running engine.
  await execute(`await startAssist();reviewSet('delayA',75);globalThis.reviewDiscardedId=document.querySelector('#reflectionSession').value;globalThis.reviewSavedCount=data.reflections.length;document.querySelector('#skipReflection').click();`);
  await check(`audio.running&&document.querySelector('#reflectionSession').value!==reviewDiscardedId&&document.querySelector('#reflectionContext').textContent.includes('使用中')`,'discarding current audio use starts a fresh tracked use without stopping audio');
  await execute(`reviewSet('masterGain',-31);await muteAssist();document.querySelector('#saveReflection').click();`);
  await check(`data.reflections.length===reviewSavedCount+1&&data.reflections.at(-1).session.kind==='audio'&&data.reflections.at(-1).session.id!==reviewDiscardedId&&data.reflections.at(-1).conditionSnapshot.branches[0].delay===75&&data.reflections.at(-1).session.segments.length===2&&data.reflections.at(-1).session.segments.at(-1).condition.masterGain===-31`,'continued use retains its new start and later setting changes');

  // TTS-only use must continue as TTS rather than becoming a manual memo.
  await execute(`
    workspace.reset();data.script='試験文。';data.phrases=splitPhrases(data.script);document.querySelector('#scriptText').value=data.script;workspace.reset();renderPhrases();
    globalThis.reviewVoices=speechSynthesis.getVoices;globalThis.reviewSpeak=speechSynthesis.speak;globalThis.reviewUtterance=window.SpeechSynthesisUtterance;
    speechSynthesis.getVoices=()=>[{name:'review-local',localService:true,lang:'ja-JP'}];speechSynthesis.speak=()=>{};window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
    loadVoices();playPhrase({skipCountdown:true});document.querySelector('#skipReflection').click();reviewSet('ttsRate',1.5);stopTts();document.querySelector('#saveReflection').click();
  `);
  await check(`data.reflections.at(-1).session.kind==='script'&&data.reflections.at(-1).session.segments.length===2&&data.reflections.at(-1).session.segments.at(-1).condition.choral.rate===1.5`,'discarded TTS use resumes with later rate changes');
  await execute(`speechSynthesis.getVoices=reviewVoices;speechSynthesis.speak=reviewSpeak;window.SpeechSynthesisUtterance=reviewUtterance;workspace.reset();await applyProfile('review-preset');`);

  // A delayed microphone permission cannot change the condition used to start audio.
  await execute(`navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>globalThis.reviewResolveCapture=resolve);globalThis.reviewStarting=startAssist();await reviewWait(()=>!!globalThis.reviewResolveCapture);`);
  await check(`document.querySelector('#delayA').disabled&&document.querySelector('#delayANumber').disabled&&document.querySelector('#masterGain').disabled&&document.querySelector('#ttsRate').disabled&&!document.querySelector('#emergency').disabled&&!document.querySelector('[data-info="delay"]').disabled`,'pending start freezes condition controls while stop and explanations remain available');
  // Also guard a programmatic edit that bypasses disabled native controls.
  await execute(`reviewSet('delayA',120);reviewResolveCapture(reviewCaptureStream.clone());await reviewStarting;globalThis.reviewStartedSnapshot=structuredClone(sessionConditionSnapshot);document.querySelector('#saveReflection').click();`);
  await check(`audio.running&&currentCondition().branches[0].delay===50&&reviewStartedSnapshot.branches[0].delay===50&&data.reflections.at(-1).conditionSnapshot.branches[0].delay===50&&data.reflections.at(-1).session.segments[0].condition.branches[0].delay===50&&!document.querySelector('#delayA').disabled&&!document.querySelector('#delayANumber').disabled`,'ready audio, displayed controls and recorded start all match the requested snapshot');
  await execute(`await muteAssist();workspace.reset();navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>globalThis.reviewResolveCancelled=resolve);globalThis.reviewCancelled=startAssist();await reviewWait(()=>!!globalThis.reviewResolveCancelled);await emergencyStop({broadcast:false});`);
  await check(`!document.querySelector('#delayA').disabled&&!document.querySelector('#masterGain').disabled`,'cancelling a pending start releases the temporary control lock');
  await execute(`globalThis.reviewLateStream=reviewCaptureStream.clone();reviewResolveCancelled(reviewLateStream);await reviewCancelled;`);
  await check(`!audio.running&&reviewLateStream.getTracks().every(track=>track.readyState==='ended')`,'late permission completion cannot resurrect cancelled audio');
  await execute(`navigator.mediaDevices.getUserMedia=reviewOriginalCapture;reviewCaptureStream.getTracks().forEach(track=>track.stop());await reviewCaptureContext.close();await emergencyStop({broadcast:false});localStorage.removeItem(STORE);`);
  await window.reload();
  console.log('PR #4 REVIEW REGRESSION TESTS PASSED');
};
