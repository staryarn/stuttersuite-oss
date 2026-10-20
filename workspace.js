// Copyright (C) 2026 xer5xer5
// SPDX-License-Identifier: AGPL-3.0-or-later
// UI state is separate from the audio engine and from saved conditions.
(() => {
  const q = s => document.querySelector(s), all = s => [...document.querySelectorAll(s)];
  q('#themeToggle').onclick=()=>{
    const dark=document.documentElement.dataset.theme!=='dark';
    document.documentElement.dataset.theme=dark?'dark':'light';
    q('#themeToggle').setAttribute('aria-checked',String(dark));
  };
  const clone = value => structuredClone(value), same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const help = {
    branch: ['加工音声 A / B','自分の声を加工してヘッドホンに返す、独立した2つの系統です。Aだけでも使えます。Bを有効にすると両方の音が重なります。','AとBで遅延や音程を別々に変えられます。有効を外した系統は再生されませんが、入力した値は残ります。','guide-feedback','branchAEnabled'],
    delay: ['追加遅延（DAF）','自分の声が少し遅れて聞こえるようにします。50 msは0.05秒です。音程は変わりません。','DAFは遅れて聞こえる自分の声を使う補助です。0 msで追加遅延はなくなりますが、機器・ブラウザ自体の遅延は残ります。まず短い同じ文を読み、遅延だけを変えて話しやすさを比べられます。合う値は人や場面で変わります。','guide-feedback','delayA'],
    pitch: ['音程（FAF）','自分の声の高さを変えます。−は低く、＋は高くします。0半音は音程の加工なし。話す速さは変わりません。','FAFは高さを変えた自分の声を聞く補助です。1半音は隣の音階までの幅です。遅延とは別々に設定できます。音程処理自体にも短い遅れが生じます。数字が大きいほど良いという意味ではありません。','guide-feedback','pitchA'],
    gain: ['相対ゲイン・音量（dB）','この音の大きさを調整します。0 dBから負の値に下げるほど小さくなります。補助音量とOSの音量も影響します。','ゲインは音の大きさを調整する倍率です。A/B、自声モニター、ノイズの音量を別々に変えられます。dBの値は耳元の実測音量ではありません。ヘッドホンで小さく聞こえるところから確認してください。','guide-feedback','gainA'],
    master: ['補助音量','TTSには適用されません。加工音声・ノイズ・自声モニター・メトロノーム音をまとめて調整します。TTSの音量はOS／ブラウザ側で調整します。','各系統の相対ゲインを保ちながら補助音全体を下げられます。OSやヘッドホンの音量も確認してください。急に大きくせず、聞き取りやすい小さい音量で試せます。','guide-start','masterGain'],
    pan: ['左右の出力','この音を両耳・左耳・右耳のどこに返すか選びます。片耳を選ぶにはステレオ出力が必要です。','Aを左、Bを右にするなど、各系統で聞こえる場所を変えられます。通話相手への声の送り先を選ぶ設定ではありません。','guide-feedback','panA'],
    masking: ['マスキング','一定のノイズをヘッドホンに流します。自分の声の聞こえ方を変えるための機能です。マイク音声を消す機能ではありません。','ノイズの種類と音量を選べます。加工音声とは独立して使え、マスキングだけで開始した場合はマイクを取得しません。取得済みのマイクは、補助を停止するまで使用を続けます。通話相手に送る音声へのノイズ除去は行いません。小さい音から確認してください。','guide-tools','maskingEnabled'],
    noise: ['ノイズの種類','ホワイトは広い帯域、ピンクは低い帯域を多め、ブラウンはさらに低い帯域を多めに含むノイズです。聞こえる音色が変わります。','同じ数字の音量でも、種類や機器によって聞こえる大きさは違います。一度に種類と音量を両方変えるより、片方ずつ試すと違いを確認しやすくなります。','guide-tools','maskingType'],
    filter: ['周波数調整','ノイズの高い音や低い音を抑えて、聞こえる音色を変えます。声の音程やノイズの種類とは別の設定です。','「高域を抑える」は高い音を、「低域を抑える」は低い音を弱めます。マスキングのノイズだけに作用し、通話音声を加工する機能ではありません。','guide-tools','maskingFilter'],
    direct: ['自声モニター','音程や追加遅延を変えずに、自分の声をヘッドホンへ返します。機器やブラウザによる遅れは残ります。','加工音声A/Bと並行して使えます。自声モニターを有効にして開始するとマイクを使います。マイク未使用で動作中の場合は、いったん停止してから開始し直してください。すでに加工音声が聞こえている場合は、音が重なるので小さい音量から調整してください。','guide-tools','directEnabled'],
    metro: ['メトロノーム','一定間隔の拍を画面や音で示します。話すタイミングをつかむ手掛かりとして使えます。','拍ごとに短い区切りを話すなど、自分が使いやすい合わせ方を試せます。発話の検出や自動追跡は行いません。「画面のみ」なら音は出ず、メトロノームだけで開始した場合はマイクを取得しません。取得済みのマイクを解放するには補助を停止してください。','guide-tools','metroEnabled'],
    bpm: ['テンポ（BPM）','1分間の拍の数です。60 BPMは1秒に1拍、120 BPMは1秒に2拍です。大きいほど拍が速くなります。','話す速さを自動で変える設定ではありません。自分が合わせやすい間隔を試してください。音を出す場合は表示を「音のみ」か「音と画面」にします。','guide-tools','bpm'],
    tts: ['TTS・斉読','TTSは原稿の読み上げです。斉読は、読み上げ音声とほぼ同時に同じ文を話すことです。まず原稿を句に分けてから再生します。','原稿の内容や話すタイミングを確認する補助として使えます。端末内の読み上げ音声だけを使用します。ローカル音声がない端末では再生できません。音声補助の開始とは独立して操作できます。','guide-script','scriptText'],
    split: ['句に分ける','句点・改行などで原稿を短いまとまりに分けます。句を選んで、繰り返しや次の句への移動ができます。','句への分割と原稿保存を同時に行います。原稿を編集した後は、もう一度「句に分ける」か「原稿を保存」を押してください。古い句が誤って読まれないよう、更新するまで再生は停止します。','guide-script','splitScript'],
    rate: ['読み上げ速度','TTSの速さです。1.00倍が標準で、小さくすると遅く、大きくすると速く読みます。加工音声の音程や遅延には影響しません。','再生前に変えると、次に読み上げる句へ適用されます。現在の句をこの速度で聞き直すには、停止して再生してください。声によって実際の速さは異なります。','guide-script','ttsRate'],
    countdown: ['開始カウントダウン','再生を押してから読み始めるまでの待ち時間です。息や姿勢を整える時間を取れます。0秒ならすぐ始まります。','待ち時間中も「停止」や「すべて停止」で取り消せます。連続再生で次の句へ進むときは、開始カウントダウンではなく句間休止が使われます。','guide-script','choralCountdown'],
    pause: ['句間休止','連続再生で、一つの句が終わってから次の句を読むまでの間隔です。0秒なら続けて読みます。','各句の間に準備の時間を入れられます。手動で「次の句」を押したときの開始待ちは、開始カウントダウンで設定します。','guide-script','phrasePause'],
    continuous: ['連続再生','現在の句が終わると、次の句を自動で読みます。最後の句で停止します。','無効なら一つの句だけ再生します。次の句に進む前の待ち時間は句間休止で調整できます。原稿中の自分の発話位置を自動で判断するものではありません。','guide-script','continuousChoral'],
    devices: ['マイクと補助音の出力先','自分の声を取り込むマイクと、加工した音を自分が聞く出力先です。ヘッドホンを使ってください。TTSはOS／ブラウザの既定出力を使います。','機器確認はマイクを一時的に開き、すぐ解放します。開始を押すまで補助音は出ません。使用中のマイクを変更した場合は停止して再開してください。このアプリの停止は通話アプリのミュートには影響しません。','guide-start','inputDevice'],
    compare: ['条件の比較','補助なし、保存した設定、編集前と編集中の値から2つを選び、順番に試します。開始は自分で押します。','同じ短い文や同じ場面で、一つの値だけ変えて比べると違いを振り返りやすくなります。各条件の感想は任意で保存できます。効果を自動判定したり、適した設定を自動で決めたりはしません。','guide-save','startTrial'],
    rating: ['振り返り','話す負担・自然さ・次も使いたいかを任意で残します。未入力は未回答として保存します。吃音の専門知識は必要ありません。','使用を始めたときの設定と、途中で変えた設定を一緒に残せます。後から同じ場面の記録を見たり、開始時の値を読み戻したりできます。点数は自分の感想を比べるためのもので、診断用の尺度ではありません。','guide-save','effort'],
    privacy: ['端末内のデータ','音声は端末内で処理し、送信・録音保存しません。設定・原稿・任意の記録は、このブラウザ内に保存します。','バックアップには原稿やメモも含まれます。ブラウザのサイトデータを削除すると保存内容も消えるため、残したい内容はJSONで書き出せます。','guide-faq','backupData'],
    save: ['保存設定','遅延・音程・ノイズ・リズム・読み上げ速度など、現在の値を名前と場面を付けて残せます。「更新」は選択中の保存設定を置き換え、「別名で保存」は新しく追加します。','編集中の値は、保存するまで保存設定を書き換えません。「複製」では現在の値からコピーを作れます。サンプルは自分の保存設定とは別です。保存した設定を読み込んでも、音声は自動で始まりません。','guide-save','profileSelect'],
    lock: ['設定をロック','加工音声・ノイズ・自声モニター・拍の値を固定し、誤操作を防ぎます。説明のⓘ、停止と補助音量は操作できます。','設定を調整するときはチェックを外してください。保存設定の読み込みや比較で条件を切り替えることはできます。読み上げの操作は独立して使えます。','guide-save','settingLock'],
    compact: ['小型表示','現在の設定名と動作状態、補助音量と停止を、小さいパネルにまとめます。原稿の句があれば読み上げの操作も表示します。','「すべて停止」は、TTSだけが再生されているときも使えます。このパネルはブラウザのページ内に表示されます。通話アプリを操作している間も押せる位置にブラウザを配置できます。','guide-save','openCompact']
  };
  let origin = clone(currentCondition()), originName = activeConditionName, guideReturn = 'assist';
  let anchor = null, pinned = false, showTimer, hideTimer, drawerAnchor = null, drawerHelp = null, returningFocus=false;
  let saveMode = 'copy', trialSnapshots = {}, trialReturn = null, comparisonId = '', advancing = false;
  let currentSession = null, pendingSessions = [], chosenSession = '', lastSegmentAt = 0;
  const popover = q('#infoPopover');

  function positionInfo(){
    if(!anchor || popover.hidden)return;
    const box=anchor.getBoundingClientRect(),size=popover.getBoundingClientRect();
    const left=Math.min(innerWidth-size.width-12,Math.max(12,box.left-20));
    const below=box.bottom+10;
    const top=below+size.height<=innerHeight-12?below:Math.max(12,box.top-size.height-10);
    popover.style.left=left+'px';popover.style.top=top+'px';
  }
  function closeInfo(returnFocus=false){
    clearTimeout(showTimer);clearTimeout(hideTimer);
    const previous=anchor;
    if(anchor){anchor.removeAttribute('aria-describedby');anchor.setAttribute('aria-expanded','false');anchor.removeAttribute('aria-controls');}
    anchor=null;pinned=false;popover.hidden=true;
    if(returnFocus){returningFocus=true;previous?.focus({preventScroll:true});returningFocus=false;}
  }
  function showInfo(button,keep=false){
    const entry=help[button.dataset.info];if(!entry)return;
    closeInfo();anchor=button;pinned=keep;
    q('#infoTitle').textContent=entry[0];q('#infoText').textContent=entry[1];
    popover.setAttribute('role',keep?'dialog':'tooltip');popover.setAttribute('aria-label',entry[0]);
    q('#closeInfo').hidden=q('#infoDetails').hidden=!keep;popover.hidden=false;
    button.setAttribute('aria-describedby','infoText');button.setAttribute('aria-expanded',String(keep));
    if(keep)button.setAttribute('aria-controls','infoPopover');positionInfo();
    if(keep)q('#closeInfo').focus({preventScroll:true});
  }
  function scheduleClose(){clearTimeout(hideTimer);hideTimer=setTimeout(()=>{if(!pinned&&!popover.matches(':hover')&&document.activeElement!==anchor)closeInfo();},160);}
  all('[data-info]').forEach(button=>{
    button.addEventListener('pointerenter',event=>{if(event.pointerType==='touch'||pinned)return;clearTimeout(hideTimer);clearTimeout(showTimer);showTimer=setTimeout(()=>showInfo(button),300);});
    button.addEventListener('pointerleave',()=>{clearTimeout(showTimer);scheduleClose();});
    button.addEventListener('focus',()=>{if(!pinned&&!returningFocus)showInfo(button);});
    button.addEventListener('blur',scheduleClose);
    button.addEventListener('click',()=>{if(anchor===button&&pinned)closeInfo();else showInfo(button,true);});
  });
  popover.addEventListener('pointerenter',()=>clearTimeout(hideTimer));popover.addEventListener('pointerleave',scheduleClose);
  q('#closeInfo').onclick=()=>closeInfo(true);
  document.addEventListener('pointerdown',event=>{if(anchor&&!popover.contains(event.target)&&event.target!==anchor)closeInfo();});
  addEventListener('resize',positionInfo);addEventListener('scroll',positionInfo,true);

  function closeDrawer(returnFocus=false){q('#guideDrawer').hidden=true;q('.app-shell').classList.remove('help-open');all('.highlight-control').forEach(node=>node.classList.remove('highlight-control'));if(returnFocus){returningFocus=true;drawerAnchor?.focus({preventScroll:true});returningFocus=false;}}
  function openDrawer(key,button){
    const entry=help[key];if(!entry)return;
    closeInfo();drawerAnchor=button;drawerHelp=key;
    const content=q('#drawerContent');content.replaceChildren();q('#drawerTitle').textContent=entry[0];
    [entry[1],entry[2]].forEach(value=>{const paragraph=document.createElement('p');paragraph.textContent=value;content.append(paragraph);});
    q('#focusControl').hidden=q('#readFullGuide').hidden=false;
    q('#guideDrawer').hidden=false;q('.app-shell').classList.add('help-open');q('#closeDrawer').focus({preventScroll:true});
  }
  q('#infoDetails').onclick=()=>openDrawer(anchor.dataset.info,anchor);
  q('#closeDrawer').onclick=()=>closeDrawer(true);
  q('#focusControl').onclick=()=>{
    const target=drawerAnchor?.closest('.control')?.querySelector('input:not(.number-input),select')||q('#'+help[drawerHelp][4]);
    if(!target)return;const page=target.closest('.page');if(page)go(page.id.replace('page-',''));if(innerWidth<900)closeDrawer();target.scrollIntoView({behavior:'smooth',block:'center'});target.focus({preventScroll:true});target.classList.add('highlight-control');setTimeout(()=>target.classList.remove('highlight-control'),2400);
  };
  q('#readFullGuide').onclick=()=>{const id=help[drawerHelp][3];closeDrawer();go('guide');const section=q('#'+id);section.tabIndex=-1;section.scrollIntoView({behavior:'smooth',block:'start'});section.focus({preventScroll:true});};
  q('#returnFromGuide').onclick=()=>go(guideReturn);

  function technicalSummary(c){
    const pans={both:'両耳',left:'左',right:'右'};
    const branches=c.branches.map((b,i)=>`${i?'B':'A'} ${b.enabled?b.delay+' ms / '+(b.pitch>0?'+':'')+b.pitch+' 半音 / '+b.gain+' dB / '+pans[b.pan]:'OFF'}`);
    if(c.masking.enabled)branches.push('ノイズ '+c.masking.type+' '+c.masking.gain+' dB');
    if(c.direct.enabled)branches.push('自声 '+c.direct.gain+' dB');
    if(c.metronome.enabled)branches.push(c.metronome.bpm+' BPM');
    return branches.join(' · ');
  }
  function syncSettingAvailability(){
    const starting=!!audio.starting,locked=q('#settingLock').checked;
    all('#detailsPanel input,#detailsPanel select,#detailsPanel button:not(.info-button),.module-grid input,.module-grid select').forEach(node=>node.disabled=starting||locked||node.dataset.unavailable==='true');
    all('#masterGain,#ttsRate,#choralCountdown,#phrasePause,#continuousChoral,#masterGainNumber,#ttsRateNumber,#choralCountdownNumber,#phrasePauseNumber,#compactGain,#compactRate').forEach(node=>node.disabled=starting);
  }
  function checkTrialCondition(condition){
    if(!trial.active||trial.preparing)return;
    const expected=trialSnapshots[trial.order[trial.index]];
    if(expected&&!same(condition,{...normalizeCondition(expected),mode:'custom'}))trial.changed=true;
    if(trial.changed&&currentSession?.session.comparisonId===comparisonId&&currentSession.session.comparisonIndex===trial.index){
      delete currentSession.session.comparisonId;delete currentSession.session.comparisonIndex;
      currentSession.name+='（比較条件から変更）';
    }
  }
  function sync(){
    const c=currentCondition(),dirty=!same(c,origin),profile=selectedProfile();
    syncSettingAvailability();checkTrialCondition(c);showTrial();
    const stored=profile&&same({...normalizeCondition(profile.condition),mode:'custom'},c);
    q('#dirtyState').textContent=dirty?'変更あり・未保存':stored?'保存済み':activeProfile.startsWith('sample:')?'サンプル・未保存':activeProfile==='baseline'?'補助なし':'未保存の条件';
    q('#dirtyState').classList.toggle('changed',dirty);q('#revertCondition').disabled=!!audio.starting||!dirty;
    q('#updateProfile').disabled=!profile;q('#newProfile').disabled=!profile;q('#conditionName').textContent=activeConditionName+(dirty?' ・編集中':'');
    q('#conditionSummary').textContent=technicalSummary(c);
    const select=q('#profileSelect'),transient=select.querySelector('[data-transient]');
    if([...select.options].some(option=>option.value===activeProfile&&!option.dataset.transient))transient?.remove();
    else {const option=transient||new Option();option.dataset.transient='true';option.value=activeProfile;option.textContent=activeConditionName+'（未保存）';if(!transient)select.prepend(option);select.value=activeProfile;}
    all('[data-number-for]').forEach(number=>{const range=q('#'+number.dataset.numberFor);if(document.activeElement!==number)number.value=range.value;number.disabled=range.disabled;});
    ['A','B'].forEach((name,i)=>q('#branch'+name+'Panel').classList.toggle('disabled-branch',!c.branches[i].enabled));
    [['maskingEnabled','.module:has(#maskingEnabled)'],['directEnabled','.module:has(#directEnabled)'],['metroEnabled','.module:has(#metroEnabled)']].forEach(([id,selector])=>q(selector).classList.toggle('disabled-module',!q('#'+id).checked));
    q('#deviceSummary').textContent='マイク: '+(q('#inputDevice').selectedOptions[0]?.textContent||'既定')+' ／ 補助音: '+(q('#outputDevice').selectedOptions[0]?.textContent||'既定');
    q('#reflectionContext').textContent=reflectionDescription();
  }
  function loaded(){origin=clone(currentCondition());originName=activeConditionName;sync();}
  all('[data-number-for]').forEach(number=>{
    const range=q('#'+number.dataset.numberFor);
    number.addEventListener('input',()=>{
      if(number.value.trim()===''||!Number.isFinite(number.valueAsNumber)||number.disabled)return;
      const step=Number(range.step)||1,value=Math.round(number.valueAsNumber/step)*step;
      if(value<Number(range.min)||value>Number(range.max))return;
      range.value=String(value);range.dispatchEvent(new Event('input',{bubbles:true}));
    });
    number.addEventListener('change',()=>{if(!number.disabled&&Number.isFinite(number.valueAsNumber)){const step=Number(range.step)||1;range.value=String(Math.max(Number(range.min),Math.min(Number(range.max),Math.round(number.valueAsNumber/step)*step)));range.dispatchEvent(new Event('input',{bubbles:true}));}number.value=range.value;});
    number.addEventListener('blur',()=>number.value=range.value);
  });
  q('#settingLock').addEventListener('change',()=>{
    sync();toast(q('#settingLock').checked?'詳細設定をロックしました。説明・停止・補助音量は操作できます。':'設定のロックを解除しました。');
  });
  q('#revertCondition').onclick=()=>{applyCondition(clone(origin));conditionChanged();sync();toast('編集前の値に戻しました。');};
  q('#inputDevice').addEventListener('change',()=>{sync();if(audio.running)q('#audioMessage').textContent='マイクの変更は、補助を停止して再開すると適用されます。';});
  q('#outputDevice').addEventListener('change',sync);
  ['masterGain','ttsRate'].forEach(id=>q('#'+id).addEventListener('input',()=>conditionChanged()));
  all('[data-sample]').forEach(button=>button.onclick=async()=>{await applyProfile('sample:'+button.dataset.sample);go('assist');});

  function openSave(mode){
    closeInfo();saveMode=mode;
    const p=selectedProfile(),names={copy:'別名で保存',duplicate:'設定を複製',update:'保存設定を更新'};
    q('#profileDialogTitle').textContent=names[mode];q('#profileName').value=mode==='duplicate'?(p?.name||activeConditionName)+' のコピー':mode==='update'?p.name:activeConditionName==='補助なし'?'新しい設定':activeConditionName;
    const scene=p?.scene||q('#sessionScene').value;
    if(![...q('#profileScene').options].some(option=>option.value===scene))q('#profileScene').add(new Option(scene,scene));
    q('#profileScene').value=scene;q('#profileFavorite').checked=!!p?.favorite;q('#profileDialogMessage').textContent='';
    q('#profileDialog').showModal();q('#profileName').focus();q('#profileName').select();
  }
  q('#updateProfile').onclick=()=>openSave('update');
  q('#cancelProfile').onclick=q('#cancelProfileTop').onclick=()=>q('#profileDialog').close();
  q('#profileForm').onsubmit=async event=>{
    event.preventDefault();const name=q('#profileName').value.trim();if(!name){q('#profileDialogMessage').textContent='名前を入力してください。';q('#profileName').focus();return;}
    const existing=selectedProfile(),updating=saveMode==='update'&&existing,id=updating?existing.id:crypto.randomUUID();
    const profile={id,name,scene:q('#profileScene').value,favorite:q('#profileFavorite').checked,condition:currentCondition()};
    if(!await commitData(current=>{const candidate=clone(current),index=candidate.profiles.findIndex(p=>p.id===id);if(updating&&index>=0)candidate.profiles[index]=profile;else candidate.profiles.push(profile);return candidate;})){q('#profileDialogMessage').textContent='保存できませんでした。入力内容は残っています。機器・データから現在の内容を書き出せます。';return;}
    activeProfile=id;activeConditionName=name;renderProfiles();loaded();q('#profileDialog').close();toast(saveMode==='update'?'保存設定を更新しました。':'新しい設定として保存しました。');
  };
  q('#profileCards').addEventListener('click',async event=>{
    const id=event.target.dataset.favorite||event.target.dataset.deleteProfile;if(!id)return;
    const profile=data.profiles.find(p=>p.id===id);if(!profile)return;
    const favorite=!!event.target.dataset.favorite;
    if(!favorite&&!confirm('「'+profile.name+'」を削除しますか？ 使用記録と画面上の値は残ります。'))return;
    if(!await commitData(current=>{const candidate=clone(current),item=candidate.profiles.find(p=>p.id===id);if(favorite&&item)item.favorite=!item.favorite;else if(!favorite)candidate.profiles=candidate.profiles.filter(p=>p.id!==id);return candidate;}))return;
    if(!data.profiles.some(p=>p.id===activeProfile)&&activeProfile===id)activeProfile='';
    renderProfiles();sync();
  });

  let splitSource=data.script;
  function scriptState(){
    const stale=q('#scriptText').value!==splitSource,unsaved=q('#scriptText').value!==data.script;
    q('#scriptDirty').textContent=stale?'原稿を変更しました。「句に分ける」または「原稿を保存」で読み上げを更新できます。':unsaved?'未保存の原稿です。':'原稿と読み上げの句は一致しています。';
    q('#scriptDirty').classList.toggle('script-stale',stale);
    ['playPhrase','repeatPhrase','compactPlay'].forEach(id=>q('#'+id).disabled=stale||!data.phrases.length);
  }
  function canPlay(){if(q('#scriptText').value!==splitSource){toast('原稿が変更されています。句を更新してから再生してください。');return false;}return true;}
  function scriptSaved(){splitSource=data.script;scriptState();}
  q('#sampleScript').onclick=()=>{if(q('#scriptText').value&&!confirm('編集中の原稿を例文に置き換えますか？'))return;q('#scriptText').value='本日はお時間をいただき、ありがとうございます。\nまず、今回の予定をお伝えします。\nご質問があれば、お知らせください。';q('#scriptText').dispatchEvent(new Event('input'));};
  q('#readingView').onclick=()=>{const reading=q('#page-script').classList.toggle('reading-mode');q('#readingView').setAttribute('aria-pressed',String(reading));q('#readingView').textContent=reading?'編集表示':'原稿表示';};

  function sessionList(){return [...pendingSessions,...(currentSession?[currentSession]:[])];}
  function reflectionTarget(){return sessionList().find(item=>item.session.id===chosenSession)||pendingSessions[0]||currentSession;}
  function reflectionDescription(){
    const target=reflectionTarget();if(!target)return '使用前のメモとして、現在の設定を記録できます。';
    const s=target.session;return target.name+' ／ '+({audio:'音声補助',script:'原稿・TTS',combined:'音声補助＋TTS',manual:'メモ'}[s.kind])+' ／ '+new Date(s.startedAt).toLocaleTimeString('ja-JP')+(s.endedAt?' 終了':' 使用中')+(s.segments.length>1?' ・途中で設定変更あり':'');
  }
  const sessionSelect=document.createElement('select'),sessionLabel=document.createElement('label');sessionSelect.id='reflectionSession';sessionLabel.textContent='記録する使用';sessionLabel.append(sessionSelect);q('#reflectionContext').after(sessionLabel);
  function updateSessionChoices(){
    const items=sessionList(),previous=chosenSession;sessionSelect.replaceChildren();sessionLabel.hidden=items.length<2;
    for(const item of items)sessionSelect.add(new Option(item.name+' · '+new Date(item.session.startedAt).toLocaleTimeString('ja-JP'),item.session.id));
    if(items.some(item=>item.session.id===chosenSession))sessionSelect.value=chosenSession;else {chosenSession=items[0]?.session.id||'';sessionSelect.value=chosenSession;}
    if(previous!==chosenSession){const scene=reflectionTarget()?.session.scene;if(scene){if(![...q('#sessionScene').options].some(option=>option.value===scene))q('#sessionScene').add(new Option(scene,scene));q('#sessionScene').value=scene;}}
    sync();
  }
  sessionSelect.onchange=()=>{chosenSession=sessionSelect.value;resetRatings();const target=reflectionTarget();q('#sessionScene').value=target?.session.scene||'短い試用';sync();};
  function beginSession(kind,startedCondition=currentCondition()){
    const condition=clone(startedCondition);checkTrialCondition(condition);
    if(currentSession){conditionChanged(condition);if(currentSession.session.kind==='manual')currentSession.session.kind=kind;else if(currentSession.session.kind!==kind)currentSession.session.kind='combined';sync();return;}
    const at=new Date().toISOString(),fixedComparison=trial.active&&!trial.preparing&&!trial.changed;
    currentSession={name:activeConditionName+(trial.active&&trial.changed?'（比較条件から変更）':''),condition,session:{id:crypto.randomUUID(),startedAt:at,endedAt:'',kind,reason:'record',scene:selectedProfile()?.scene||q('#sessionScene').value,segments:[{at,condition:clone(condition)}],...(fixedComparison?{comparisonId,comparisonIndex:trial.index}:{})}};
    lastSegmentAt=0;updateSessionChoices();
  }
  function continueSession(){
    const script=speaking||advanceTimer!==null;
    if(audio.running||script)beginSession(audio.running?(script?'combined':'audio'):'script');
  }
  function conditionChanged(c=currentCondition()){
    checkTrialCondition(c);showTrial();
    if(!currentSession)return;const segments=currentSession.session.segments;if(same(segments.at(-1).condition,c))return;
    const timestamp=Date.now(),segment={at:new Date(timestamp).toISOString(),condition:clone(c)};
    // Keep the start intact, coalesce a drag, and bound data saved in a backup.
    if(segments.length>1&&(timestamp-lastSegmentAt<800||segments.length>=64))segments[segments.length-1]=segment;else segments.push(segment);
    lastSegmentAt=timestamp;sync();
  }
  function endSession(reason){if(!currentSession)return;conditionChanged();currentSession.session.endedAt=new Date().toISOString();currentSession.session.reason=reason;pendingSessions.push(currentSession);currentSession=null;updateSessionChoices();}
  function resetRatings(){['effort','naturalness'].forEach(id=>{q('#'+id).value='5';q('#'+id+'Out').textContent='—';});q('#wouldUse').value='';q('#sessionNote').value='';}
  async function saveReflection(){
    const target=reflectionTarget(),condition=clone(target?.condition||sessionConditionSnapshot||currentCondition());
    const s=target?clone(target.session):{id:crypto.randomUUID(),startedAt:'',endedAt:'',kind:'manual',reason:'record',scene:'',segments:[]};
    if(target&&target===currentSession)conditionChanged();
    if(target&&target===currentSession)s.segments=clone(currentSession.session.segments);
    s.scene=q('#sessionScene').value;if(!s.endedAt)s.endedAt=new Date().toISOString();
    const reflection={id:crypto.randomUUID(),at:now(),profile:target?.name||activeConditionName,conditionSnapshot:condition,session:s,effort:q('#effortOut').textContent==='—'?null:Number(q('#effort').value),naturalness:q('#naturalnessOut').textContent==='—'?null:Number(q('#naturalness').value),wouldUse:q('#wouldUse').value,note:q('#sessionNote').value};
    if(!await commitData(current=>({...current,reflections:[...current.reflections,reflection]})))return;
    if(target&&target===currentSession){currentSession=null;sessionConditionSnapshot=null;continueSession();}
    else pendingSessions=pendingSessions.filter(item=>item!==target);
    resetRatings();chosenSession='';updateSessionChoices();renderHistory();toast('設定と振り返りを保存しました。');
  }
  q('#skipReflection').onclick=()=>{const target=reflectionTarget();if(target&&target===currentSession){currentSession=null;sessionConditionSnapshot=null;continueSession();}else pendingSessions=pendingSessions.filter(item=>item!==target);chosenSession='';resetRatings();updateSessionChoices();go('assist');toast('この使用の記録を残さず、操作に戻りました。');};
  q('#sessionScene').onchange=()=>{const target=reflectionTarget();if(target)target.session.scene=q('#sessionScene').value;};

  function renderHistory(){
    const box=q('#historyList');box.replaceChildren();
    for(const [id,getter] of [['historyScene',r=>r.session?.scene||'場面なし（旧記録）'],['historyProfile',r=>r.profile]]){
      const select=q('#'+id),value=select.value;select.replaceChildren(new Option('すべて',''));[...new Set(data.reflections.map(getter))].filter(Boolean).forEach(item=>select.add(new Option(item,item)));select.value=[...select.options].some(option=>option.value===value)?value:'';
    }
    const records=data.reflections.filter(r=>(!q('#historyScene').value||(r.session?.scene||'場面なし（旧記録）')===q('#historyScene').value)&&(!q('#historyProfile').value||r.profile===q('#historyProfile').value));
    q('#historySummary').textContent=records.length+' 件';
    if(!records.length){const empty=document.createElement('p');empty.className='empty';empty.textContent=data.reflections.length?'この条件の記録はありません。':'使用の感想を保存すると、設定と一緒にここに残ります。';box.append(empty);return;}
    const groups=new Map();for(const r of records){if(!r.conditionSnapshot||!r.session||r.session.kind==='manual'||r.session.segments.length>1)continue;const key=JSON.stringify([r.session.scene,r.session.kind,r.conditionSnapshot]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
    for(const values of groups.values())if(values.length>=2){const summary=document.createElement('p');summary.className='history-summary';const average=key=>{const numbers=values.map(r=>r[key]).filter(n=>n!==null);return numbers.length? (numbers.reduce((a,b)=>a+b,0)/numbers.length).toFixed(1)+'（回答 '+numbers.length+' 件）':'未回答';};summary.textContent=values[0].session.scene+' · '+values[0].profile+'：同じ開始条件・使用内容の '+values.length+' 件 ／ 負担 '+average('effort')+' ／ 自然さ '+average('naturalness');box.append(summary);}
    records.slice().reverse().forEach(r=>{
      const item=document.createElement('article'),name=document.createElement('strong'),detail=document.createElement('small'),ratings=document.createElement('p');item.className='history-item';name.textContent=r.profile||'名称なし';
      detail.textContent=r.at+' · '+(r.session?.scene||'場面なし（旧記録）')+(r.session?' · '+({audio:'音声補助',script:'原稿・TTS',combined:'補助＋TTS',manual:'使用前のメモ'}[r.session.kind]):'')+(r.session?.comparisonId?' · 比較 '+(r.session.comparisonIndex+1):'');
      ratings.textContent='負担 '+(r.effort??'—')+' ／ 自然さ '+(r.naturalness??'—')+' ／ 次も使う '+({yes:'はい',unsure:'判断できない',no:'いいえ'}[r.wouldUse]||'—');item.append(name,detail,ratings);
      if(r.conditionSnapshot){const summary=document.createElement('div');summary.className='condition-snapshot';summary.textContent='開始時：'+technicalSummary(r.conditionSnapshot);item.append(summary);const restore=document.createElement('button');restore.className='text-btn';restore.textContent='この開始条件を読み込む →';restore.onclick=async()=>{await loadCondition(r.profile||'記録の設定',r.conditionSnapshot);activeProfile='';loaded();go('assist');toast('記録の設定を読み込みました。補助は停止中です。');};item.append(restore);}else {const old=document.createElement('p');old.textContent='開始条件なし（旧記録）';item.append(old);}
      if(r.session?.segments.length>1){const details=document.createElement('details'),title=document.createElement('summary');title.textContent='途中の設定変更 '+(r.session.segments.length-1)+' 件';details.append(title);r.session.segments.slice(1).forEach(segment=>{const p=document.createElement('p');p.textContent=new Date(segment.at).toLocaleTimeString('ja-JP')+' · '+technicalSummary(segment.condition);details.append(p);});item.append(details);}
      if(r.note){const note=document.createElement('p');note.textContent=r.note;item.append(note);}box.append(item);
    });
  }
  q('#historyScene').onchange=q('#historyProfile').onchange=renderHistory;

  function captureTrial(){
    trialReturn={condition:clone(currentCondition()),activeProfile,activeConditionName,origin:clone(origin),originName};
    comparisonId=crypto.randomUUID();trialSnapshots={'@origin':clone(origin),'@draft':clone(currentCondition()),baseline:withoutAssistance(defaultCondition())};
    for(const p of data.profiles)trialSnapshots[p.id]=clone(p.condition);
  }
  const trialName=id=>id==='baseline'?'補助なし':id==='@origin'?'編集前の条件':id==='@draft'?'編集中の条件':data.profiles.find(p=>p.id===id)?.name||'保存設定';
  function trialDifference(){
    const a=trialSnapshots[trial.order[0]],b=trialSnapshots[trial.order[1]];if(!a||!b)return '';
    const changes=[];
    a.branches.forEach((branch,i)=>{for(const [key,label,unit] of [['enabled','有効',''],['delay','遅延',' ms'],['pitch','音程',' 半音'],['gain','ゲイン',' dB'],['pan','出力','']])if(branch[key]!==b.branches[i][key])changes.push((i?'B':'A')+' '+label+': '+branch[key]+unit+' → '+b.branches[i][key]+unit);});
    for(const [key,label] of [['masking','マスキング'],['direct','自声'],['metronome','拍'],['choral','TTS']])if(!same(a[key],b[key]))changes.push(label+'に差分');
    if(a.masterGain!==b.masterGain)changes.push('補助音量: '+a.masterGain+' → '+b.masterGain+' dB');
    return changes.join(' ／ ')||'設定値は同じです';
  }
  function showTrial(){q('#trialBar').hidden=!trial.active;if(!trial.active)return;q('#trialBarTitle').textContent='比較 '+(trial.index+1)+' / '+trial.order.length+' · '+trialName(trial.order[trial.index])+(trial.changed?' · 比較条件から変更あり':'');q('#trialChangeNotice').hidden=!trial.changed;q('#trialDifference').textContent=trialDifference();q('#trialAdvance').textContent=trial.index===trial.order.length-1?'停止して比較を終える':'停止して次の条件';}
  async function finishTrial(){
    if(advancing)return;advancing=true;
    try{
      if(!await emergencyStop({broadcast:false}))return;
      trial={order:[],index:0,active:false};closeTrial();
      if(trialReturn){const saved=trialReturn;trialReturn=null;activeProfile=saved.activeProfile;activeConditionName=saved.activeConditionName;origin=clone(saved.origin);originName=saved.originName;sessionConditionSnapshot=null;applyCondition(saved.condition);renderProfiles();sync();}
      showTrial();go('history');toast('比較を終了し、開始前の編集状態に戻しました。各条件の感想を記録できます。');
    }finally{advancing=false;}
  }
  async function advanceTrial(){if(!trial.active||advancing)return;if(trial.index===trial.order.length-1){await finishTrial();return;}advancing=true;q('#trialAdvance').disabled=true;try{if(!await emergencyStop({broadcast:false}))return;trial.index++;await applyTrialCondition();}finally{advancing=false;q('#trialAdvance').disabled=false;}}
  q('#trialAdvance').onclick=q('#trialNext').onclick=advanceTrial;q('#trialFinish').onclick=finishTrial;
  q('#trialRate').onclick=()=>{if(!currentSession){sessionConditionSnapshot=clone(currentCondition());beginSession('manual');}chosenSession=currentSession.session.id;updateSessionChoices();go('history');};
  q('#trialStartButton').onclick=async()=>{
    if(!trial.active){const a=q('#trialProfileA').value,b=q('#trialProfileB').value;if(a===b){toast('異なる2つの条件を選んでください。');return;}captureTrial();trial.order=[a,b];if(q('#trialRandomize').checked&&Math.random()<.5)trial.order.reverse();trial.index=0;trial.active=true;}
    await applyTrialCondition();
  };

  const walkthrough=[
    ['機器を確認する','ヘッドホンを装着し、マイクと補助音の出力先を選びます。「機器確認」でマイクを一時的に確認できます。通話アプリの設定は「機器・データ」で確認してください。','inputDevice'],
    ['補助なしを確認する','保存設定で「補助なし」を読み込み、同じ短い文を声に出してみます。これを後で比べる基準にできます。案内を進めるだけでは設定は変更されません。','profileSelect'],
    ['一つの値を試す','Aを有効にして追加遅延だけを変える、または音程だけを変えるなど、一度に一つの違いを試します。ⓘで値の意味を確認できます。','delayA'],
    ['小さい音で開始する','OS・ヘッドホン側も小さい音量にして「開始」を押します。補助音量の0 dBは安全な音圧を保証しません。同じ文を話し、負担や自然さを確認します。合わなければ「すべて停止」で止められます。','startAssist'],
    ['感想と設定を残す','「振り返り」で感想を任意で記録できます。使いたい値は「別名で保存」で名前と場面を付けます。次回はその設定を読み込んで、自分で開始します。','saveCurrentProfile']
  ];
  function showWalkthrough(index){
    closeInfo();go('assist');drawerAnchor=q('#startWalkthrough');drawerHelp=null;
    q('#drawerTitle').textContent=walkthrough[index][0];q('#drawerContent').replaceChildren();
    const progress=document.createElement('p'),body=document.createElement('p'),actions=document.createElement('div');progress.className='walkthrough-progress';progress.textContent=(index+1)+' / '+walkthrough.length;body.textContent=walkthrough[index][1];actions.className='actions';
    if(index>0){const previous=document.createElement('button');previous.className='secondary';previous.textContent='前へ';previous.onclick=()=>showWalkthrough(index-1);actions.append(previous);}
    const next=document.createElement('button');next.className='primary';next.textContent=index===walkthrough.length-1?'案内を閉じる':'次へ';next.onclick=()=>index===walkthrough.length-1?closeDrawer():showWalkthrough(index+1);actions.append(next);q('#drawerContent').append(progress,body,actions);
    q('#focusControl').hidden=q('#readFullGuide').hidden=true;q('#guideDrawer').hidden=false;q('.app-shell').classList.add('help-open');all('.highlight-control').forEach(node=>node.classList.remove('highlight-control'));q('#'+walkthrough[index][2]).classList.add('highlight-control');next.focus({preventScroll:true});
  }
  q('#startWalkthrough').onclick=()=>showWalkthrough(0);
  window.workspace={sync,loaded,openSave,beginSession,endSession,conditionChanged,saveReflection,renderHistory,scriptState,scriptSaved,canPlay,captureTrial,trialCondition:id=>clone(trialSnapshots[id]),showTrial,
    closeHelp(){closeInfo();closeDrawer();},
    dismissEscape(){if(q('#profileDialog').open){q('#profileDialog').close();return true;}if(!popover.hidden){closeInfo(true);return true;}if(!q('#guideDrawer').hidden){closeDrawer(true);return true;}return false;},
    navigating(page){const current=q('.page.active')?.id.replace('page-','');if(page==='guide'&&current!=='guide')guideReturn=current||'assist';closeInfo();if(page!=='assist'&&drawerHelp===null)closeDrawer();},
    reset(){currentSession=null;pendingSessions=[];chosenSession='';trialReturn=null;trialSnapshots={};comparisonId='';trial={order:[],index:0,active:false};closeTrial();splitSource=data.script;closeInfo();closeDrawer();resetRatings();loaded();scriptState();updateSessionChoices();showTrial();}
  };
  loaded();scriptState();renderHistory();updateSessionChoices();
})();
