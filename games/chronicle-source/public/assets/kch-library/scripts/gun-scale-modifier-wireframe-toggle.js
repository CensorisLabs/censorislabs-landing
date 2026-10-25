// ==UserScript==
// @name         Gun scale modifier + wireframe toggle + rgb toggle
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  modify gun scale with T/Y, toggle wireframe with G, rgb mode with H, reposition weapon with Alt+Arrows
// @author       imnotkoolkid , zVipexx
// @match        *://kirka.io/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=kirka.io
// @grant        none
// ==/UserScript==

(function () {
    // ---- CONFIG ----
    let wireframeOn = false;
    let scaleFactor = 1.0;    
    let rainbowOn = false;
    let offsetX = 0.0;
    let offsetY = 0.0;
    let offsetZ = 0.0;

    const seenContexts = new WeakSet();
    const scratchMatrix = new Float32Array(16);

    document.addEventListener('keydown', e => {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

        const k = e.key.toLowerCase();
        if (k === 'g') wireframeOn = !wireframeOn;
        if (k === 'h') rainbowOn = !rainbowOn;
        if (k === 't') scaleFactor = Math.min(3.0, scaleFactor + 0.1);
        if (k === 'y') scaleFactor = Math.max(0.1, scaleFactor - 0.1);

        if (e.altKey && e.key.startsWith('Arrow')) {
            e.preventDefault();
            if (e.shiftKey) {
                if (e.key === 'ArrowUp') offsetZ -= 0.01;
                if (e.key === 'ArrowDown') offsetZ += 0.01;
            } else {
                if (e.key === 'ArrowLeft') offsetX -= 0.01;
                if (e.key === 'ArrowRight') offsetX += 0.01;
                if (e.key === 'ArrowUp') offsetY += 0.01;
                if (e.key === 'ArrowDown') offsetY -= 0.01;
            }
        }
    });

    function updateRainbowPixel(pixelArray, h) {
        const h6 = (h * 6) % 6;
        const x = (1 - Math.abs(h6 % 2 - 1)) * 255 | 0;
        if (h6 < 1) { pixelArray[0] = 255; pixelArray[1] = x; pixelArray[2] = 0; }
        else if (h6 < 2) { pixelArray[0] = x; pixelArray[1] = 255; pixelArray[2] = 0; }
        else if (h6 < 3) { pixelArray[0] = 0; pixelArray[1] = 255; pixelArray[2] = x; }
        else if (h6 < 4) { pixelArray[0] = 0; pixelArray[1] = x; pixelArray[2] = 255; }
        else if (h6 < 5) { pixelArray[0] = x; pixelArray[1] = 0; pixelArray[2] = 255; }
        else { pixelArray[0] = 255; pixelArray[1] = 0; pixelArray[2] = x; }
        pixelArray[3] = 255;
    }

    const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
    
    const classify = m => {
        if (!m || m.length < 16 || Math.abs(m[3]) > 0.001 || Math.abs(m[7]) > 0.001 || Math.abs(m[11]) > 0.001 || Math.abs(m[15] - 1) > 0.001) return null;
        
        const s0 = len3(m[0], m[1], m[2]);
        if (s0 < 0.001 || s0 > 15) return null;
        const s1 = len3(m[4], m[5], m[6]);
        if (s1 < 0.001 || s1 > 15) return null;
        const s2 = len3(m[8], m[9], m[10]);
        if (s2 < 0.001 || s2 > 15) return null;

        const avg = (s0 + s1 + s2) / 3;
        if (Math.abs(avg - 0.4) < 0.05 || Math.abs(avg - 2.4) < 0.1) return null;

        const dist = len3(m[12], m[13], m[14]);
        if (dist < 0.001 || dist > 0.6) return null;

        const maxS = Math.max(s0, s1, s2);
        return (maxS < 1.7 || maxS / Math.min(s0, s1, s2) < 1.05) ? "weapon" : "arms";
    };

    const isSpectating = () => !!document.querySelector(".infos .fps");

    const origGetContext = HTMLCanvasElement.prototype.getContext;

    HTMLCanvasElement.prototype.getContext = function (type, attrs) {
        const gl = origGetContext.call(this, type, attrs);
        if (!gl || (type !== 'webgl' && type !== 'webgl2') || seenContexts.has(gl)) return gl;
        seenContexts.add(gl);

        const colorTex = gl.createTexture();
        const colorPixel = new Uint8Array([255, 255, 255, 255]);
        gl.bindTexture(gl.TEXTURE_2D, colorTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, colorPixel);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        let activeThisFrame = false;
        let lastBoundTexture = null;
        let lastRainbowUpdate = 0;


        const origUniform = gl.uniformMatrix4fv;
        const origBindTexture = gl.bindTexture;
        const origTexImage2D = gl.texImage2D;
        const origDrawArrays = gl.drawArrays;
        const origDrawElements = gl.drawElements;

        const matrixCache = new Float32Array(48); 
        let cacheCount = 0;

        const weaponTrans = new Float32Array(24); 
        let weaponCount = 0;

        const checkAndCache = (s) => {
            const s0 = s[0], s5 = s[5], s10 = s[10], s12 = s[12], s13 = s[13], s14 = s[14];
            for (let i = 0; i < cacheCount; i++) {
                const o = i * 6;
                if (Math.abs(matrixCache[o] - s0) < 0.001 &&
                    Math.abs(matrixCache[o+1] - s5) < 0.001 &&
                    Math.abs(matrixCache[o+2] - s10) < 0.001 &&
                    Math.abs(matrixCache[o+3] - s12) < 0.001 &&
                    Math.abs(matrixCache[o+4] - s13) < 0.001 &&
                    Math.abs(matrixCache[o+5] - s14) < 0.001) return true;
            }
            if (cacheCount < 8) {
                const o = cacheCount * 6;
                matrixCache[o] = s0; matrixCache[o+1] = s5; matrixCache[o+2] = s10;
                matrixCache[o+3] = s12; matrixCache[o+4] = s13; matrixCache[o+5] = s14;
                cacheCount++;
            }
            return false;
        };

        const isNearWeapon = (tx, ty, tz) => {
            for (let i = 0; i < weaponCount; i++) {
                const o = i * 3;
                const dx = tx - weaponTrans[o], dy = ty - weaponTrans[o+1], dz = tz - weaponTrans[o+2];
                if (dx * dx + dy * dy + dz * dz < 0.0144) return true; 
            }
            return false;
        };

        gl.bindTexture = function (target, texture) {
            if (target === gl.TEXTURE_2D) lastBoundTexture = texture;
            return origBindTexture.call(gl, target, texture);
        };

        gl.uniformMatrix4fv = function (loc, transpose, val, srcOffset, srcLength) {
            activeThisFrame = false;

            if (!isSpectating() && val && val.length >= 16) {
                const offset = srcOffset ?? 0;
                const slice = (offset === 0 && val.length === 16)
                    ? val
                    : (val.subarray ? val.subarray(offset, offset + 16) : val.slice(offset, offset + 16));

                const kind = classify(slice);

                if (kind === "weapon" || kind === "arms") {
                    if (checkAndCache(slice)) {
                        return origUniform.call(gl, loc, transpose, val, srcOffset, srcLength);
                    }

                    if (kind === "arms" && isNearWeapon(slice[12], slice[13], slice[14])) {
                        return origUniform.call(gl, loc, transpose, val, srcOffset, srcLength);
                    }

                    activeThisFrame = true;

                    if (rainbowOn && lastBoundTexture !== null) {
                        const now = performance.now();
                        if (now - lastRainbowUpdate > 16) {
                            updateRainbowPixel(colorPixel, (now / 3000) % 1);
                            origBindTexture.call(gl, gl.TEXTURE_2D, colorTex);
                            origTexImage2D.call(gl, gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, colorPixel);
                            lastRainbowUpdate = now;
                        } else {
                            origBindTexture.call(gl, gl.TEXTURE_2D, colorTex);
                        }
                    } else if (lastBoundTexture !== null) {
                        origBindTexture.call(gl, gl.TEXTURE_2D, lastBoundTexture);
                    }

                    if (kind === "weapon") {
                        if (weaponCount < 8) {
                            const o = weaponCount * 3;
                            weaponTrans[o] = slice[12]; weaponTrans[o+1] = slice[13]; weaponTrans[o+2] = slice[14];
                            weaponCount++;
                        }
                    }

                    scratchMatrix.set(slice);
                    scratchMatrix[0] *= scaleFactor; scratchMatrix[1] *= scaleFactor; scratchMatrix[2] *= scaleFactor;
                    scratchMatrix[4] *= scaleFactor; scratchMatrix[5] *= scaleFactor; scratchMatrix[6] *= scaleFactor;
                    scratchMatrix[8] *= scaleFactor; scratchMatrix[9] *= scaleFactor; scratchMatrix[10] *= scaleFactor;
                    scratchMatrix[12] += offsetX;
                    scratchMatrix[13] += offsetY;
                    scratchMatrix[14] += offsetZ;

                    return origUniform.call(gl, loc, transpose, scratchMatrix, 0, 16);
                }
            }
            return origUniform.call(gl, loc, transpose, val, srcOffset, srcLength);
        };

        const toWireframe = (mode) =>
            (mode === gl.TRIANGLES || mode === gl.TRIANGLE_FAN || mode === gl.TRIANGLE_STRIP)
                ? gl.LINES : mode;

        gl.drawArrays = function (mode, first, count) {
            if (wireframeOn && activeThisFrame) mode = toWireframe(mode);
            activeThisFrame = false;
            cacheCount = 0;
            weaponCount = 0;
            return origDrawArrays.call(gl, mode, first, count);
        };

        gl.drawElements = function (mode, count, type, offset) {
            if (wireframeOn && activeThisFrame) mode = toWireframe(mode);
            activeThisFrame = false;
            cacheCount = 0;
            weaponCount = 0;
            return origDrawElements.call(gl, mode, count, type, offset);
        };

        return gl;
    };
})();