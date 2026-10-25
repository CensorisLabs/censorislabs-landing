// ==UserScript==
// @name         esc menu bypass
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  removes 3sec timer in esc menu
// @author       imnotkoolkid
// @match        *://kirka.io/*
// @grant        none
// @run-at       document-start
// ==/UserScript==
(function () {
  if (window.__escTimerPatch) return console.log('already active');
  window.__escTimerPatch = true;

  const startObserver = () => {
    const targetNode = document.body || document.documentElement;

    new MutationObserver(() => {
      const btn = document.querySelector('.esc-interface #continue');
      const timerEl = document.querySelector('.esc-interface #timer');

      if (timerEl) timerEl.style.visibility = 'hidden';

      if (!btn || btn.__patched) return;
      btn.__patched = true;
      btn.addEventListener('click', () => {
        const interfaceEl = document.querySelector('.esc-interface');
        const vm = interfaceEl ? interfaceEl.WwnWmNMw : null;
        if (!vm) return;
        vm.$data.timer = 0;
        vm.$data.wNwWnWM = false;
        setTimeout(() => window.game.requestPointerLock(), 100);
      }, true);
    }).observe(targetNode, { childList: true, subtree: true });

    console.log('ESC timer bypass active');
  };

  if (document.body) {
    startObserver();
  } else {
    document.addEventListener('DOMContentLoaded', startObserver);
  }
})();