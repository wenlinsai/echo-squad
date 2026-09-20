/*
 * Echo Squad — ad / platform adapter.
 *
 * The game only ever talks to window.Ads. To ship on another portal,
 * add an implementation here; game.js does not change.
 *
 * Platform selection (first match wins):
 *   1. URL param   ?platform=crazygames | poki | mock | none
 *   2. window.ECHO_PLATFORM set before this script (use this in portal builds)
 *   3. hostname auto-detect (crazygames / poki)
 *   4. localhost or file://  -> mock   (fake ads so you can test the flow)
 *   5. anything else         -> none   (no ads, rewarded buttons hidden)
 *
 * Contract:
 *   Ads.init()            -> Promise<void>   never rejects
 *   Ads.canReward         -> boolean         show "watch ad" buttons only if true
 *   Ads.loadingDone()
 *   Ads.gameplayStart() / Ads.gameplayStop()
 *   Ads.interstitial()    -> Promise<void>   resolves when the break is over (or skipped)
 *   Ads.rewarded()        -> Promise<boolean> true only if the reward must be granted
 *   Ads.happy()                              celebration moment (boss kill, new record)
 *   Ads.onPause(fn) / Ads.onResume(fn)       game must mute + pause while an ad is on screen
 */
(function () {
  'use strict';

  var pauseFns = [], resumeFns = [];
  function firePause() { pauseFns.forEach(function (f) { try { f(); } catch (e) {} }); }
  function fireResume() { resumeFns.forEach(function (f) { try { f(); } catch (e) {} }); }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = resolve; s.onerror = function () { reject(new Error('load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function detect() {
    var q = null;
    try { q = new URLSearchParams(location.search).get('platform'); } catch (e) {}
    if (q) return q;
    if (window.ECHO_PLATFORM) return window.ECHO_PLATFORM;
    var h = location.hostname || '';
    if (/crazygames|1001juegos/.test(h)) return 'crazygames';
    if (/poki/.test(h)) return 'poki';
    if (location.protocol === 'file:' || h === 'localhost' || h === '127.0.0.1') return 'mock';
    return 'none';
  }

  /* ---------- none: no ads at all ---------- */
  var None = {
    name: 'none', canReward: false,
    init: function () { return Promise.resolve(); },
    loadingDone: function () {}, gameplayStart: function () {}, gameplayStop: function () {},
    interstitial: function () { return Promise.resolve(); },
    rewarded: function () { return Promise.resolve(false); },
    happy: function () {}
  };

  /* ---------- mock: fake overlay for local testing ---------- */
  function mockOverlay(label, seconds) {
    return new Promise(function (resolve) {
      firePause();
      var el = document.createElement('div');
      el.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#000d;color:#fff;display:flex;' +
        'flex-direction:column;align-items:center;justify-content:center;font:600 22px system-ui;gap:12px';
      var t = document.createElement('div'), c = document.createElement('div');
      t.textContent = label; c.style.opacity = '.7';
      el.appendChild(t); el.appendChild(c); document.body.appendChild(el);
      var end = performance.now() + seconds * 1000;
      (function tick() {
        var left = Math.max(0, end - performance.now());
        c.textContent = (left / 1000).toFixed(1) + 's';
        if (left > 0) return setTimeout(tick, 100);
        el.remove(); fireResume(); resolve();
      })();
    });
  }
  var Mock = {
    name: 'mock', canReward: true,
    init: function () { return Promise.resolve(); },
    loadingDone: function () {}, gameplayStart: function () {}, gameplayStop: function () {},
    interstitial: function () { return mockOverlay('[MOCK] Interstitial ad', 1.2); },
    rewarded: function () { return mockOverlay('[MOCK] Rewarded ad', 1.5).then(function () { return true; }); },
    happy: function () {}
  };

  /* ---------- CrazyGames SDK v3 ---------- */
  var Crazy = {
    name: 'crazygames', canReward: true, sdk: null,
    init: function () {
      var self = this;
      return loadScript('https://sdk.crazygames.com/crazygames-sdk-v3.js')
        .then(function () { return window.CrazyGames.SDK.init(); })
        .then(function () {
          self.sdk = window.CrazyGames.SDK;
          if (self.sdk.environment === 'disabled') { self.sdk = null; self.canReward = false; return; }
          try { self.sdk.game.loadingStart(); } catch (e) {}
        })
        .catch(function () { self.sdk = null; self.canReward = false; });
    },
    loadingDone: function () { try { this.sdk && this.sdk.game.loadingStop(); } catch (e) {} },
    gameplayStart: function () { try { this.sdk && this.sdk.game.gameplayStart(); } catch (e) {} },
    gameplayStop: function () { try { this.sdk && this.sdk.game.gameplayStop(); } catch (e) {} },
    happy: function () { try { this.sdk && this.sdk.game.happytime(); } catch (e) {} },
    _request: function (type) {
      var sdk = this.sdk;
      return new Promise(function (resolve) {
        if (!sdk) return resolve(false);
        var started = false;
        try {
          sdk.ad.requestAd(type, {
            adStarted: function () { started = true; firePause(); },
            adFinished: function () { if (started) fireResume(); resolve(true); },
            adError: function () { if (started) fireResume(); resolve(false); }
          });
        } catch (e) { resolve(false); }
      });
    },
    interstitial: function () { return this._request('midgame').then(function () {}); },
    rewarded: function () { return this._request('rewarded'); },
    muted: function () { try { return !!(this.sdk && this.sdk.game.settings.muteAudio); } catch (e) { return false; } }
  };

  /* ---------- Poki SDK ---------- */
  var Poki = {
    name: 'poki', canReward: true, ok: false,
    init: function () {
      var self = this;
      return loadScript('https://game-cdn.poki.com/scripts/v2/poki-sdk.js')
        .then(function () { return window.PokiSDK.init(); })
        .then(function () { self.ok = true; })
        .catch(function () { self.ok = !!window.PokiSDK; self.canReward = self.ok; });
    },
    loadingDone: function () { try { this.ok && window.PokiSDK.gameLoadingFinished(); } catch (e) {} },
    gameplayStart: function () { try { this.ok && window.PokiSDK.gameplayStart(); } catch (e) {} },
    gameplayStop: function () { try { this.ok && window.PokiSDK.gameplayStop(); } catch (e) {} },
    happy: function () {},
    interstitial: function () {
      if (!this.ok) return Promise.resolve();
      var started = false;
      return window.PokiSDK.commercialBreak(function () { started = true; firePause(); })
        .then(function () { if (started) fireResume(); })
        .catch(function () { if (started) fireResume(); });
    },
    rewarded: function () {
      if (!this.ok) return Promise.resolve(false);
      var started = false;
      return window.PokiSDK.rewardedBreak({ size: 'medium', onStart: function () { started = true; firePause(); } })
        .then(function (success) { if (started) fireResume(); return !!success; })
        .catch(function () { if (started) fireResume(); return false; });
    }
  };

  var impls = { none: None, mock: Mock, crazygames: Crazy, poki: Poki };
  var impl = impls[detect()] || None;

  // An ad request must never hang the game: every promise gets a hard timeout.
  function guard(p, ms, fallback) {
    return new Promise(function (resolve) {
      var done = false;
      var t = setTimeout(function () { if (!done) { done = true; fireResume(); resolve(fallback); } }, ms);
      p.then(function (v) { if (!done) { done = true; clearTimeout(t); resolve(v); } },
             function () { if (!done) { done = true; clearTimeout(t); resolve(fallback); } });
    });
  }

  window.Ads = {
    get name() { return impl.name; },
    get canReward() { return !!impl.canReward; },
    init: function () { return guard(impl.init(), 6000, undefined); },
    loadingDone: function () { impl.loadingDone(); },
    gameplayStart: function () { impl.gameplayStart(); },
    gameplayStop: function () { impl.gameplayStop(); },
    interstitial: function () { return guard(impl.interstitial(), 90000, undefined); },
    rewarded: function () { return guard(impl.rewarded(), 120000, false); },
    happy: function () { impl.happy(); },
    platformMuted: function () { return impl.muted ? impl.muted() : false; },
    onPause: function (f) { pauseFns.push(f); },
    onResume: function (f) { resumeFns.push(f); }
  };
})();
