// SPDX-License-Identifier: AGPL-3.0-or-later
const test = require('node:test'), assert = require('node:assert/strict');
const Store = require('../storage.js');
function fixture() {
  const values = new Map();
  const storage = {getItem(key) { return values.get(key) ?? null; }, setItem(key, value) { values.set(key, value); }, removeItem(key) { values.delete(key); }};
  let tail = Promise.resolve();
  const locks = {request(_name, _options, action) { const work = tail.then(action); tail = work.catch(() => {}); return work; }};
  const client = onInvalidate => new Store({storage, locks, onInvalidate});
  return {values, storage, locks, client};
}
function deferred() { let resolve; const promise = new Promise(yes => resolve = yes); return {promise, resolve}; }
test('successful migration retains the original v1 copy and gives v2 precedence until explicit deletion', async () => {
  const f = fixture(), raw = JSON.stringify({script:'原稿',phrases:[{text:'句'}],profiles:[]});
  f.storage.setItem(Store.legacyKey, raw);
  const client = f.client(); assert.equal(client.initial.value, raw); assert.equal(f.values.size, 1);
  await client.write(raw);
  assert.equal(f.client().initial.value, raw);
  assert.equal(JSON.parse(f.storage.getItem(Store.key)).value, raw);
  assert.equal(f.storage.getItem(Store.legacyKey),raw,'migration intentionally retains the original');
  await client.write('new v2 contents');
  f.storage.setItem(Store.legacyKey,'later write from an uncooperative old tab');
  assert.equal(f.client().initial.value,'new v2 contents','v1 is never automatically re-imported over v2');
  assert.equal(f.storage.getItem(Store.legacyKey),'later write from an uncooperative old tab','a newer legacy copy is not discarded');
  await f.client().clear();
  assert.equal(f.storage.getItem(Store.legacyKey),null);
  assert.equal(f.client().initial.value,null);
});

test('a failed first v2 write preserves v1 and allows a later migration retry', async () => {
  const f=fixture(),raw=JSON.stringify({script:'移行前の原稿',profiles:[],phrases:[]});
  f.storage.setItem(Store.legacyKey,raw);const client=f.client(),setItem=f.storage.setItem;
  f.storage.setItem=()=>{throw Object.assign(Error('full'),{name:'QuotaExceededError'});};
  await assert.rejects(client.write('validated migration candidate'),{name:'QuotaExceededError'});
  assert.equal(f.storage.getItem(Store.key),null);assert.equal(f.storage.getItem(Store.legacyKey),raw);
  assert.equal(f.client().initial.value,raw);
  f.storage.setItem=setItem;await client.write('validated migration candidate');
  assert.equal(f.client().initial.value,'validated migration candidate');assert.equal(f.storage.getItem(Store.legacyKey),raw);
});

test('damaged v2 is preserved for recovery instead of silently reverting to the retained v1 copy', () => {
  const f=fixture();f.storage.setItem(Store.legacyKey,'old legacy copy');f.storage.setItem(Store.key,'{damaged v2');
  const client=f.client();assert.equal(client.initial.damaged,true);assert.equal(client.initial.value,'{damaged v2');
  assert.equal(f.storage.getItem(Store.key),'{damaged v2');assert.equal(f.storage.getItem(Store.legacyKey),'old legacy copy');
});
test('queued save → delete → stale save is ordered, and the stale payload is never evaluated', async () => {
  const f = fixture(), first = f.client(), deleting = f.client(); let invalidations=0, prepared=0;
  const stale = f.client(() => invalidations++), hold=deferred();
  const barrier=f.locks.request(Store.key,{},()=>hold.promise);
  const before=first.write('before-delete');
  const deletion=deleting.clear();
  const after=assert.rejects(stale.write(()=>{prepared++;return 'must not return';}),{name:'AbortError'});
  hold.resolve(); await barrier; await before; await deletion; await after;
  assert.equal(prepared,0);assert.equal(invalidations,1);assert.equal(f.client().initial.value,null);
  assert.equal(f.storage.getItem(Store.legacyKey),null);
  assert.ok(!f.storage.getItem(Store.key).includes('before-delete'));
});
test('a suspended client is rejected without receiving any storage event; a new explicit restore works', async () => {
  const f=fixture(), old=f.client(), deleting=f.client();
  const epoch=old.epoch;await deleting.clear();
  await assert.rejects(old.write('old import',{epoch}),{name:'AbortError'});
  const current=f.client();await current.write('explicit newly selected backup');
  assert.equal(f.client().initial.value,'explicit newly selected backup');
  // An uncooperative legacy tab must never trigger automatic re-import.
  await f.client().clear();f.storage.setItem(Store.legacyKey,'legacy tab wrote again');
  assert.equal(f.client().initial.value,null);
});
test('delete before a delayed restore rejects it even if the client was already checked', async () => {
  const f=fixture(), restoring=f.client();assert.equal(restoring.current(),true);
  const epoch=restoring.epoch;await f.client().clear();
  await assert.rejects(restoring.write('late file read',{epoch}),{name:'AbortError'});
  assert.equal(f.client().initial.value,null);
});
test('writes publish state inside the lock, preserving different queued field updates', async () => {
  const f=fixture(), client=f.client();let state={script:'',ttsRate:1.2,records:[]};
  const write=update=>{let prepared;return client.write(()=>JSON.stringify(prepared=update(state)),{committed:()=>state=prepared});};
  await Promise.all([write(current=>({...current,ttsRate:1.5})),write(current=>({...current,script:'new draft'})),write(current=>({...current,ttsRate:1.8})),write(current=>({...current,records:[...current.records,'record']}))]);
  assert.deepEqual(state,{script:'new draft',ttsRate:1.8,records:['record']});
  assert.deepEqual(JSON.parse(f.client().initial.value),state);
});

test('a stale tab cannot overwrite another tab\'s normal save, even without a storage event', async () => {
  const f=fixture(), original=JSON.stringify({profiles:[],script:''});
  f.storage.setItem(Store.legacyKey,original);
  let invalidations=0, prepared, published=false;
  const a=f.client(),b=f.client(()=>invalidations++);
  await a.write(JSON.stringify({profiles:[{id:'saved-in-A'}],script:''}));
  const latest=f.storage.getItem(Store.key);
  // Lifecycle/deletion checks must not accept another tab's normal save as our baseline.
  assert.equal(b.current(),true);
  await assert.rejects(b.write(()=>JSON.stringify(prepared={profiles:[],script:'draft-in-B'}),{committed:()=>published=true}),{name:'ConflictError'});
  assert.equal(f.storage.getItem(Store.key),latest);assert.equal(published,false);
  assert.equal(prepared.script,'draft-in-B');assert.equal(invalidations,0);assert.equal(b.invalidated,false);
  await assert.rejects(b.write('retry cannot force an overwrite'),{name:'ConflictError'});
  const reloaded=f.client(),state=JSON.parse(reloaded.initial.value);
  await reloaded.write(JSON.stringify({...state,script:'draft-in-B'}));
  assert.deepEqual(JSON.parse(f.client().initial.value),{profiles:[{id:'saved-in-A'}],script:'draft-in-B'});
});

test('normal save conflicts are checked inside the lock after earlier queued saves', async () => {
  const f=fixture(),a=f.client(),b=f.client(),hold=deferred();
  const barrier=f.locks.request(Store.key,{},()=>hold.promise);
  const first=a.write('save-in-A');
  const second=assert.rejects(b.write('stale-save-in-B'),{name:'ConflictError'});
  hold.resolve();await barrier;await first;await second;
  assert.equal(f.client().initial.value,'save-in-A');
});

test('a delayed full restore is rejected after another save, including one in the same tab', async () => {
  for(const sameTab of [false,true]){
    const f=fixture(),restoring=f.client(),baseline=restoring.baseline,epoch=restoring.epoch;
    await (sameTab?restoring:f.client()).write('saved while reading the file');
    await assert.rejects(restoring.write('late replacement',{epoch,baseline}),{name:'ConflictError'});
    assert.equal(f.client().initial.value,'saved while reading the file');
  }
});

test('an unchanged snapshot from another tab is safe, and rejected writes do not advance the baseline', async () => {
  const f=fixture(),a=f.client(),b=f.client();
  await a.write(null); // Same contents as an empty initial store; no update to lose.
  await b.write('first nonempty save');
  const baseline=b.baseline;
  await f.client().write('new contents');
  await assert.rejects(b.write('stale contents'),{name:'ConflictError'});
  assert.equal(b.baseline,baseline);
});
test('quota failure preserves the previous snapshot and does not publish a failed candidate', async () => {
  const f=fixture(), client=f.client();await client.write('original');let published=false;
  const raw=f.storage.getItem(Store.key);f.storage.setItem=()=>{throw Object.assign(Error('full'),{name:'QuotaExceededError'});};
  await assert.rejects(client.write('candidate',{committed:()=>published=true}),{name:'QuotaExceededError'});
  await assert.rejects(client.clear(),{name:'QuotaExceededError'});
  assert.equal(published,false);assert.equal(f.storage.getItem(Store.key),raw);assert.equal(client.invalidated,false);
});
test('a failed legacy cleanup reports failure but the tombstone still prevents re-import', async () => {
  const f=fixture();f.storage.setItem(Store.legacyKey,'private legacy text');const client=f.client();
  f.storage.removeItem=()=>{throw Object.assign(Error('blocked'),{name:'SecurityError'});};
  await assert.rejects(client.clear(),{name:'SecurityError'});
  assert.equal(client.invalidated,true);assert.equal(f.client().initial.value,null);
});
test('no lock support means read-only; neither saving nor deleting claims success', async () => {
  const f=fixture();f.storage.setItem(Store.legacyKey,'legacy');const client=new Store({storage:f.storage,locks:{}});
  assert.equal(client.initial.value,'legacy');await assert.rejects(client.write('no'),{name:'NotSupportedError'});
  await assert.rejects(client.clear(),{name:'NotSupportedError'});assert.equal(f.values.size,1);
});
test('unreadable envelope stays recoverable and a deliberate replacement repairs it', async () => {
  const f=fixture();f.storage.setItem(Store.key,'{broken');const client=f.client();
  assert.equal(client.initial.damaged,true);assert.equal(client.initial.value,'{broken');
  await client.write('validated replacement');assert.equal(f.client().initial.value,'validated replacement');
});
test('clearing the browser storage after a new snapshot invalidates cached state', async () => {
  const f=fixture();let invalidations=0;const client=f.client(()=>invalidations++);await client.write('original');
  f.values.clear();assert.equal(client.current(),false);assert.equal(invalidations,1);
  await assert.rejects(client.write('old memory'),{name:'AbortError'});
});
