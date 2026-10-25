// ==UserScript==
// @name         Compass
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  on screen compass
// @author       imnotkoolkid
// @match        https://kirka.io/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    if (window.__compassActive) return;
    window.__compassActive = true;

    function initCompass() {
        const compassContainer = document.createElement('div');
        compassContainer.id = 'kirka-compass';
        compassContainer.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            width: 600px;
            height: 50px;
            overflow: hidden;
            z-index: 999999;
            pointer-events: none;
            display: flex;
            align-items: center;
            justify-content: center;
            mask-image: linear-gradient(to right, transparent, black 20%, black 80%, transparent);
            -webkit-mask-image: linear-gradient(to right, transparent, black 20%, black 80%, transparent);
        `;

        const tape = document.createElement('div');
        tape.style.cssText = `
            position: absolute;
            top: 0;
            left: 50%;
            height: 100%;
            display: flex;
            align-items: center;
            will-change: transform;
        `;
        compassContainer.appendChild(tape);
        document.body.appendChild(compassContainer);

        const TICK_SPACING = 3;
        const tapeWidth = 360 * TICK_SPACING;

        function getLabel(deg) {
            let norm = deg % 360;
            if (norm < 0) norm += 360;
            if (norm === 0) return 'S';
            if (norm === 45) return 'SW';
            if (norm === 90) return 'W';
            if (norm === 135) return 'NW';
            if (norm === 180) return 'N';
            if (norm === 225) return 'NE';
            if (norm === 270) return 'E';
            if (norm === 315) return 'SE';
            if (norm % 15 === 0) return norm.toString();
            return '';
        }

        for (let i = -180; i <= 540; i += 15) {
            const tick = document.createElement('div');
            tick.style.cssText = `
                position: absolute;
                left: ${(i + 180) * TICK_SPACING}px;
                top: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                transform: translateX(-50%);
            `;

            const line = document.createElement('div');
            line.style.cssText = `
                width: 2px;
                height: 14px;
                background: #ffffff;
                box-shadow: 1px 1px 2px rgba(0,0,0,0.5);
            `;

            const label = document.createElement('div');
            label.innerText = getLabel(i);
            label.style.cssText = `
                color: #ffffff;
                font-family: Helvetica, Arial, sans-serif;
                font-size: 0.9rem;
                font-weight: 600;
                margin-top: 2px;
                text-shadow: 1px 1px 3px rgba(0,0,0,0.8);
            `;

            tick.appendChild(line);
            tick.appendChild(label);
            tape.appendChild(tick);
        }

        let currentYaw = 0;

        const origGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, attrs) {
            const ctx = origGetContext.apply(this, arguments);
            if (type === 'webgl' || type === 'webgl2') {
                if (!ctx.__compassHooked) {
                    ctx.__compassHooked = true;
                    hookWebGL(ctx);
                }
            }
            return ctx;
        };

        function hookWebGL(gl) {
            const origGetUniformLocation = gl.getUniformLocation;
            const uniformLocMap = new WeakMap();

            gl.getUniformLocation = function (program, name) {
                const loc = origGetUniformLocation.apply(this, arguments);
                if (loc) {
                    if (name === 'wmnNwWMW' || name === 'modelViewMatrix' || name === 'matrix_modelView') {
                        uniformLocMap.set(loc, 'modelViewMatrix');
                    }
                }
                return loc;
            };

            const origUniformMatrix4fv = gl.uniformMatrix4fv;
            gl.uniformMatrix4fv = function (loc, transpose, v) {
                if (v && v.length === 16 && uniformLocMap.has(loc)) {
                    const sX = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
                    if (Math.abs(sX - 1.0) < 0.05) {
                        let fwdX = -v[8];
                        let fwdZ = -v[10];

                        if (fwdX !== 0 || fwdZ !== 0) {
                            let yaw = Math.atan2(fwdX, fwdZ) * (180 / Math.PI);
                            currentYaw = yaw;
                        }
                    }
                }
                return origUniformMatrix4fv.apply(this, arguments);
            };
        }

        function updateCompass() {
            let displayYaw = currentYaw % 360;
            if (displayYaw < 0) displayYaw += 360;

            const translate = -(displayYaw + 180) * TICK_SPACING;
            tape.style.transform = `translateX(${translate}px)`;

            requestAnimationFrame(updateCompass);
        }

        updateCompass();
    }

    if (document.body) {
        initCompass();
    } else {
        document.addEventListener('DOMContentLoaded', initCompass);
    }
})();
