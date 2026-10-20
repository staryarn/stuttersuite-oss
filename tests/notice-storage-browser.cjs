// SPDX-License-Identifier: AGPL-3.0-or-later
// Own hidden Chromium session; synthetic input only. Never uses the user's browser.
const {BrowserWindow,session} = require('electron');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async function verifyNoticesAndDeletion(origin){
  const isolated=session.fromPartition(`notice-storage-${Date.now()}`),windows=[],requests=[],errors=[];
  let nativePermissions=0,phase='notices';
  isolated.webRequest.onBeforeRequest((details,callback)=>{requests.push(details.url);callback({cancel:!details.url.startsWith(origin+'/')});});
  isolated.setPermissionRequestHandler((_contents,_permission,callback)=>{nativePermissions++;callback(false);});
  function create(width=1280,backgroundThrottling=false){const win=new BrowserWindow({width,height:960,show:false,webPreferences:{session:isolated,nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling}});windows.push(win);win.webContents.on('console-message',event=>{if(event.level>=3)errors.push(event.message);});return win;}
  const js=(win,body)=>win.webContents.executeJavaScript(`(async()=>{const wait=async fn=>{for(let i=0;i<500;i++){if(await fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('privacy test timed out');};${body}})()`,true);
  function reloadEvent(win){return new Promise((resolve,reject)=>{const timer=setTimeout(async()=>{let state;try{state=await js(win,`return {epoch:localData?.epoch,invalidated:localData?.invalidated,stored:JSON.parse(localStorage.getItem(STORE))?.epoch,hidden:document.hidden,events:globalThis.lifecycleEvents};`);}catch(error){state=error.message;}reject(Error(`reset did not reload tab (${phase}, window ${win.id}): ${JSON.stringify(state)}`));},10000);win.webContents.once('did-finish-load',()=>{clearTimeout(timer);resolve();});});}
  const cleared=win=>js(win,`return data.script===''&&data.profiles.length===0&&data.reflections.length===0&&data.phrases.length===0&&!audio.running&&!audio.stream&&!speaking&&JSON.parse(localStorage.getItem(STORE)).value===null;`);
  async function erase(a,b){const done=[reloadEvent(a),...(b?[reloadEvent(b)]:[])];await js(a,`window.confirm=()=>true;document.querySelector('#clearData').click();`);await Promise.all(done);}
  try{
    const about=create();await about.loadURL(origin+'/about.html#privacy');
    assert.equal(await js(about,`return document.scripts.length===0&&typeof AssistanceAudioEngine==='undefined'&&['safety','privacy','license','contact'].every(id=>!!document.getElementById(id));`),true);
    assert.equal(requests.some(url=>url.endsWith('.js')),false,'notice page loads no application JS');
    const output=path.join(__dirname,'../.test-output');fs.mkdirSync(output,{recursive:true});
    await js(about,`window.scrollTo(0,0);await new Promise(requestAnimationFrame);`);
    fs.writeFileSync(path.join(output,'about-desktop.png'),(await about.webContents.capturePage()).toPNG());
    about.setSize(390,844);await js(about,`window.scrollTo(0,0);await new Promise(requestAnimationFrame);`);
    assert.equal(await js(about,`return document.documentElement.scrollWidth<=innerWidth;`),true);
    fs.writeFileSync(path.join(output,'about-mobile.png'),(await about.webContents.capturePage()).toPNG());
    await about.loadURL(origin+'/index.html#guide-start');
    assert.equal(await js(about,`return document.querySelector('#page-guide').classList.contains('active')&&!audio.stream;`),true,'direct guide link works');
    about.destroy();

    const a=create(),b=create(1280,true);await a.loadURL(origin+'/');await b.loadURL(origin+'/');
    assert.equal(await js(a,`return document.querySelector('#masterGain').value==='0'&&document.querySelector('#listeningSafety').getBoundingClientRect().height>0&&document.querySelector('#listeningSafety').textContent.includes('0 dB')&&document.querySelector('.app-policy-links a').getAttribute('href')==='about.html';`),true,'persistent 0 dB guidance and policy access');
    await js(a,`document.querySelector('#scriptText').value='合成の原稿。';const saved=document.querySelector('#saveScript').onclick();setTtsRate(1.8);const record=workspace.saveReflection();await Promise.all([saved,record]);await localData.exclusive(()=>{});`);
    assert.equal(await js(a,`return data.script==='合成の原稿。'&&data.ttsRate===1.8&&data.reflections.length===1;`),true,'queued UI saves keep script, rate, and reflection');
    await b.loadURL(origin+'/');
    await js(b,`globalThis.fakeInput=new AudioContext();globalThis.fakeStream=fakeInput.createMediaStreamDestination().stream;globalThis.captures=0;navigator.mediaDevices.getUserMedia=async()=>{captures++;return fakeStream.clone();};const condition=withoutAssistance(defaultCondition());condition.masking.enabled=true;applyCondition(condition);await startAssist();if(captures!==0)throw Error('masking captured microphone');await muteAssist();condition.masking.enabled=false;condition.metronome.enabled=true;applyCondition(condition);await startAssist();if(captures!==0)throw Error('metronome captured microphone');await muteAssist();condition.metronome.enabled=false;condition.direct.enabled=true;applyCondition(condition);await startAssist();if(captures!==1)throw Error('direct did not capture');condition.direct.enabled=false;applyCondition(condition);if(!audio.stream)throw Error('existing microphone should persist until stop');speechSynthesis.getVoices=()=>[{name:'synthetic-local',lang:'ja-JP',localService:true}];speechSynthesis.speak=()=>{};window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};loadVoices();playPhrase({skipCountdown:true});if(!speaking)throw Error('synthetic TTS did not start');`);
    phase='active audio and TTS';await erase(a,b);
    assert.equal(await cleared(a),true);assert.equal(await cleared(b),true,'active tab stops and resets audio, TTS, and saved contents');

    // Real Chromium lifecycle freeze; the frozen tab cannot execute a reset until resumed.
    phase='frozen tab';await js(a,`await commitData(current=>({...current,script:'休止前の合成原稿'}));`);await b.loadURL(origin+'/');
    const frozenEvent=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('browser emitted no freeze event')),4000);b.webContents.on('console-message',event=>{if(event.message==='PRIVACY_FROZEN'){clearTimeout(timer);resolve();}});});
    await js(b,`globalThis.lifecycleEvents=[];for(const type of ['freeze','resume','visibilitychange'])document.addEventListener(type,()=>{lifecycleEvents.push(type);if(type==='freeze')console.log('PRIVACY_FROZEN');});window.addEventListener('storage',()=>lifecycleEvents.push('storage'));`);
    b.webContents.debugger.attach('1.3');await b.webContents.debugger.sendCommand('Page.setWebLifecycleState',{state:'frozen'});
    await frozenEvent;
    const resumed=reloadEvent(b);let resetWhileFrozen=false;b.webContents.once('did-finish-load',()=>resetWhileFrozen=true);
    await erase(a);assert.equal(resetWhileFrozen,false,'frozen tab cannot process deletion yet');
    await b.webContents.debugger.sendCommand('Page.setWebLifecycleState',{state:'active'});await resumed;
    assert.equal(await cleared(b),true,'frozen tab notices deletion after resume');b.webContents.debugger.detach();

    // Hold the actual browser lock; enqueue delete before a stale UI save from B.
    phase='queued save';await js(a,`navigator.locks.request(STORE,()=>new Promise(resolve=>{globalThis.releaseSaveLock=resolve;}));await wait(()=>!!globalThis.releaseSaveLock);`);
    const resetA=reloadEvent(a),resetB=reloadEvent(b);
    await js(a,`window.confirm=()=>true;document.querySelector('#clearData').click();await wait(async()=>{const q=await navigator.locks.query();return q.pending.length===1;});`);
    await js(b,`document.querySelector('#scriptText').value='古いタブの書き戻しは禁止';document.querySelector('#saveScript').click();`);
    await js(a,`await wait(async()=>{const q=await navigator.locks.query();return q.pending.length===2;});releaseSaveLock();`);
    await Promise.all([resetA,resetB]);assert.equal(await cleared(a),true);assert.equal(await cleared(b),true,'queued stale save cannot resurrect deleted data');

    // Delay notifications' UI effect to inspect cancellation of in-flight file reads.
    phase='late file reads';await js(a,`await commitData(current=>({...current,script:'読込前の状態'}));`);await b.loadURL(origin+'/');
    await js(b,`localData.onInvalidate=()=>{globalThis.detectedReset=true;};globalThis.readResolvers={};readFile=file=>new Promise(resolve=>readResolvers[file.name]=resolve);const jsonInput=document.querySelector('#restoreData'),txtInput=document.querySelector('#txtImport');globalThis.jsonRead=jsonInput.onchange({target:{files:[new File([''],'late.json')],value:''}});globalThis.txtRead=txtInput.onchange({target:{files:[new File([''],'late.txt')],value:''}});`);
    await erase(a);
    await js(b,`await wait(()=>globalThis.detectedReset);readResolvers['late.json'](JSON.stringify({schema_version:6,profiles:[],phrases:[],reflections:[],script:'遅れて復元してはいけない',ttsRate:1.2}));readResolvers['late.txt']('遅れて表示してはいけない');await Promise.all([jsonRead,txtRead]);`);
    assert.equal(await js(b,`return localData.snapshot().value===null&&backupContents()===undefined&&document.querySelector('#scriptText').value!=='遅れて表示してはいけない'&&pendingSaves===0;`),true,'late JSON/TXT reads and stale export are blocked');
    await b.loadURL(origin+'/');
    await js(b,`const candidate={schema_version:6,profiles:[],phrases:[],reflections:[],script:'削除後に選び直したバックアップ',ttsRate:1.2};const transfer=new DataTransfer();transfer.items.add(new File([JSON.stringify(candidate)],'chosen-after-delete.json'));const input=document.querySelector('#restoreData');input.files=transfer.files;await input.onchange({target:input});`);
    assert.equal(await js(b,`return data.script==='削除後に選び直したバックアップ';`),true,'new explicit restore is allowed');

    await js(b,`globalThis.beforeUnsupported=localStorage.getItem(STORE);localData.locks={};document.querySelector('#scriptText').value='保存してはいけない';await document.querySelector('#saveScript').onclick();window.confirm=()=>true;await document.querySelector('#clearData').onclick();`);
    assert.equal(await js(b,`return localStorage.getItem(STORE)===beforeUnsupported&&!document.querySelector('#storageNotice').hidden&&document.querySelector('#storageMessage').textContent.includes('削除を完了できません')&&!document.querySelector('#clearData').disabled;`),true,'unsupported locks never report successful save/delete');
    await js(b,`applyCondition(withoutAssistance(defaultCondition()));await startAssist();if(!audio.running)throw Error('read-only audio unavailable');globalThis.originalStorage=localData.storage;localData.storage={getItem(){throw new DOMException('blocked','SecurityError');}};document.querySelector('#muteAssist').click();await wait(()=>!audio.running);localData.storage=originalStorage;globalThis.originalLocalData=localData;localData=undefined;await startAssist();if(!audio.running)throw Error('audio unavailable without storage');await emergencyStop({broadcast:false});localData=originalLocalData;`);
    assert.equal(await js(b,`return !audio.running&&!audio.stream;`),true,'storage access failure never disables stop or ephemeral audio');
    assert.equal(nativePermissions,0,'no real microphone permission requested');assert.deepEqual(errors,[]);
    console.log('NOTICE / STORAGE BROWSER TESTS PASSED',JSON.stringify({freeze:'CDP frozen → active',races:'actual Web Locks, delayed JSON/TXT',microphone:'synthetic only',permissions:nativePermissions}));
  }finally{for(const win of windows)if(!win.isDestroyed())win.destroy();}
};
