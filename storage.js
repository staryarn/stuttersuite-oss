// Copyright (C) 2026 Staryarn
// SPDX-License-Identifier: AGPL-3.0-or-later
// One snapshot, one Web Lock. Deletion (or repair of a damaged envelope)
// changes the epoch so stale readers cannot write their old contents back.
class StutterSuiteStorage {
  static key = 'stuttersuite.public.v2';
  static legacyKey = 'stuttersuite.public.v1';
  constructor({storage = globalThis.localStorage, locks = globalThis.navigator?.locks, onInvalidate = () => {}} = {}) {
    this.storage = storage; this.locks = locks; this.onInvalidate = onInvalidate;
    this.invalidated = false;
    this.initial = this.snapshot(); this.epoch = this.initial.epoch;
    this.initialized = this.initial.present;
  }
  snapshot() {
    const raw = this.storage.getItem(StutterSuiteStorage.key);
    if (raw === null) return {epoch: 'initial', value: this.storage.getItem(StutterSuiteStorage.legacyKey), present: false};
    if (raw === this.cachedRaw) return this.cachedSnapshot;
    try {
      const saved = JSON.parse(raw);
      if (saved?.format === 1 && typeof saved.epoch === 'string' && saved.epoch.length <= 128 &&
          (saved.value === null || typeof saved.value === 'string')) {
        this.cachedRaw = raw; this.cachedSnapshot = {...saved, present: true};
        return this.cachedSnapshot;
      }
    } catch {}
    // Preserve an unreadable envelope for explicit recovery. Never overwrite it
    // automatically; the app's recovery validation handles the payload separately.
    return {epoch: 'corrupt:' + raw, value: raw, damaged: true, present: true};
  }
  current(expected = this.epoch) {
    if (this.invalidated) return false;
    const snapshot = this.snapshot();
    if (snapshot.epoch === expected && !(this.initialized && !snapshot.present)) {
      this.initialized ||= snapshot.present; return true;
    }
    this.invalidated = true; this.onInvalidate(); return false;
  }
  stale() { const error = Error('保存データの削除を検知しました。ページを再読み込みしてください。'); error.name = 'AbortError'; return error; }
  exclusive(action) {
    if (!this.locks?.request) {
      const error = Error('このブラウザでは安全に保存・削除できません。対応ブラウザで開くか、ブラウザのサイトデータ設定から削除してください。');
      error.name = 'NotSupportedError'; return Promise.reject(error);
    }
    return this.locks.request(StutterSuiteStorage.key, {mode: 'exclusive'}, action);
  }
  write(value, expected = this.epoch, committed = () => {}) {
    return this.exclusive(() => {
      if (!this.current(expected)) throw this.stale();
      const contents = typeof value === 'function' ? value() : value;
      const epoch = expected.startsWith('corrupt:') ? crypto.randomUUID() : expected;
      this.storage.setItem(StutterSuiteStorage.key, JSON.stringify({format: 1, epoch, value: contents}));
      // A successful explicit recovery now owns the repaired envelope.
      this.epoch = epoch; this.initialized = true;
      committed();
      return epoch;
    });
  }
  clear() {
    return this.exclusive(() => {
      if (!this.current()) throw this.stale();
      // Atomic tombstone: a tab that reloads here can never import legacy data.
      this.storage.setItem(StutterSuiteStorage.key, JSON.stringify({format: 1, epoch: crypto.randomUUID(), value: null}));
      this.invalidated = true;
      this.storage.removeItem(StutterSuiteStorage.legacyKey);
    });
  }
}
if (typeof module !== 'undefined') module.exports = StutterSuiteStorage;
