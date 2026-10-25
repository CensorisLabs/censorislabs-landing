// ==UserScript==
// @name         Custom Player Color (browser + clients)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  -
// @match        *://kirka.io/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const PLAYER_HEAD = "#ff0000";
    const PLAYER_BODY = "#fff700ff";

    function createSkinTexture(headColor, bodyColor) {
        const c = document.createElement("canvas");
        c.width = 64;
        c.height = 64;
        const ctx = c.getContext("2d");
        ctx.fillStyle = bodyColor;
        ctx.fillRect(0, 32, 64, 32);
        ctx.fillStyle = headColor;
        ctx.fillRect(0, 0, 64, 32);
        const img = new Image();
        img.src = c.toDataURL();
        return img;
    }

    const playerImg = createSkinTexture(PLAYER_HEAD, PLAYER_BODY);

    const oldIsArr = Array.isArray;

    Array.isArray = (...args) => {
        if (args[0] && args[0].map && args[0].map.image) {
            if (
                args[0].map.image.width === 64 &&
                args[0].map.image.height === 64
            ) {
                if (args[0].map.image.src !== playerImg.src) {
                    args[0].map.image.src = playerImg.src;
                    args[0].map.needsUpdate = true;
                }
            }
        }
        return oldIsArr(...args);
    };

    console.log("Custom Player Color Script Active");
})();