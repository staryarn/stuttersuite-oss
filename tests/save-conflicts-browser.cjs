// SPDX-License-Identifier: AGPL-3.0-or-later
// Normal save conflicts use an isolated session and no microphone input.
const {BrowserWindow,session}=require('electron');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async function verifySaveConflicts(origin){
  const isolated=session.fromPartition(`save-conflicts-${Date.now()}`),windows=[],errors=[];
  let nativePermissions=0;
  isolated.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith(origin+'/')}));
  isolated.setPermissionRequestHandler((_contents,_permission,callback)=>{nativePermissions++;callback(false);});
  const create=()=>{const win=new BrowserWindow({width:1280,height:960,show:false,webPreferences:{session:isolated,nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});windows.push(win);win.webContents.on('console-message',event=>{if(event.level>=3)errors.push(event.message);});return win;};
  const js=(win,body)=>win.webContents.executeJavaScript(`(async()=>{const wait=async fn=>{for(let i=0;i<500;i++){if(await fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('save conflict test timed out');};${body}})()`,true);
  const saved=win=>js(win,`return localStorage.getItem(STORE);`);
  try{
    const a=create(),b=create();await a.loadURL(origin+'/');await b.loadURL(origin+'/');
    await js(b,`globalThis.originalClient=localData;applyCondition(withoutAssistance(defaultCondition()));await startAssist();document.querySelector('#scriptText').value='Bの未保存原稿。';`);
    await js(a,`document.querySelector('#saveCurrentProfile').click();document.querySelector('#profileName').value='Aが追加した設定';await document.querySelector('#profileForm').onsubmit(new Event('submit',{cancelable:true}));`);
    const latest=await saved(a);
    assert.equal(JSON.parse(JSON.parse(latest).value).profiles[0].name,'Aが追加した設定');
    // Ordinary storage events/lifecycle checks must neither reload nor stop B.
    await js(b,`await wait(()=>localData.snapshot().value.includes('Aが追加した設定'));await document.querySelector('#saveScript').onclick();`);
    assert.equal(await saved(b),latest,'stale script save cannot discard A\'s preset');
    assert.equal(await js(b,`return localData===originalClient&&!localData.invalidated&&audio.running&&data.profiles.length===0&&data.script===''&&document.querySelector('#scriptText').value==='Bの未保存原稿。'&&!document.querySelector('#storageNotice').hidden&&document.querySelector('#storageMessage').textContent.includes('他タブの更新は含まれません');`),true,'conflict preserves input and running audio, and explains recovery');
    await js(b,`setTtsRate(1.7);await localData.exclusive(()=>{});globalThis.exportedCandidate=null;download=(name,contents)=>{globalThis.exportedCandidate={name,contents};};await document.querySelector('#backupData').onclick();`);
    assert.equal(await js(b,`return exportedCandidate.contents.script==='Bの未保存原稿。'&&exportedCandidate.contents.ttsRate===1.7&&exportedCandidate.contents.profiles.length===0&&exportedCandidate.contents.schema_version===6&&audio.running;`),true,'repeated failed field saves preserve the local candidate for actual backup UI');
    assert.equal(await saved(b),latest,'exporting a local candidate does not change saved contents');
    const output=path.join(__dirname,'../.test-output');fs.mkdirSync(output,{recursive:true});
    fs.writeFileSync(path.join(output,'save-conflict-desktop.png'),(await b.webContents.capturePage()).toPNG());
    b.setSize(390,844);await js(b,`await new Promise(requestAnimationFrame);`);
    assert.equal(await js(b,`return document.documentElement.scrollWidth<=innerWidth;`),true,'conflict notice fits mobile width');
    fs.writeFileSync(path.join(output,'save-conflict-mobile.png'),(await b.webContents.capturePage()).toPNG());
    b.setSize(1280,960);

    // A reload accepts the latest state; a deliberate retry can retain A's preset.
    await b.loadURL(origin+'/');
    await js(b,`document.querySelector('#scriptText').value='退避して反映したBの原稿。';await document.querySelector('#saveScript').onclick();`);
    assert.equal(await js(b,`return data.profiles[0].name==='Aが追加した設定'&&data.script==='退避して反映したBの原稿。'&&document.querySelector('#storageNotice').hidden;`),true,'reload then save retains the latest data');

    // Neither queued write sees a conflict until it enters the actual Web Lock.
    await a.loadURL(origin+'/');await b.loadURL(origin+'/');
    await js(a,`navigator.locks.request(STORE,()=>new Promise(resolve=>{globalThis.releaseLock=resolve;}));await wait(()=>!!globalThis.releaseLock);setTtsRate(1.9);await wait(async()=>{const q=await navigator.locks.query();return q.pending.length===1;});`);
    await js(b,`document.querySelector('#scriptText').value='待機中の古い原稿';globalThis.queuedSave=document.querySelector('#saveScript').onclick();`);
    await js(a,`await wait(async()=>{const q=await navigator.locks.query();return q.pending.length===2;});releaseLock();await localData.exclusive(()=>{});`);
    await js(b,`await queuedSave;`);
    assert.equal(await js(b,`const value=JSON.parse(localData.snapshot().value);return value.ttsRate===1.9&&value.script==='退避して反映したBの原稿。'&&backupContents().script==='待機中の古い原稿';`),true,'queued conflict is rejected after the preceding save commits');

    // A whole-file restore pins its baseline before the asynchronous file read.
    for(const sameTab of [false,true]){
      await a.loadURL(origin+'/');await b.loadURL(origin+'/');
      await js(b,`globalThis.fileRead=null;readFile=()=>new Promise(resolve=>{fileRead=resolve;});globalThis.delayedRestore=document.querySelector('#restoreData').onchange({target:{files:[new File([''],'delayed.json')],value:''}});`);
      const writer=sameTab?b:a;
      await js(writer,`document.querySelector('#scriptText').value=${JSON.stringify(sameTab?'JSON読込中の自タブ保存':'JSON読込中の他タブ保存')};await document.querySelector('#saveScript').onclick();`);
      const before=await saved(writer);
      await js(b,`fileRead(JSON.stringify({...emptyData(),script:'遅れて置換してはいけない'}));await delayedRestore;`);
      assert.equal(await saved(b),before,`late restore cannot discard a ${sameTab?'same-tab':'cross-tab'} save`);
      assert.equal(await js(b,`return !document.querySelector('#storageNotice').hidden&&document.querySelector('#storageMessage').textContent.includes('JSONは復元しませんでした');`),true);
    }
    assert.equal(nativePermissions,0);assert.deepEqual(errors,[]);
    console.log('SAVE CONFLICT BROWSER TESTS PASSED',JSON.stringify({recovery:'candidate export, reload, explicit retry',races:'actual Web Locks, delayed cross-tab and same-tab JSON',permissions:nativePermissions}));
  }finally{for(const win of windows)if(!win.isDestroyed())win.destroy();}
};
