/**
 * Extensión Conciliador DIAN v2.0.0 — Autollenado + Desbloqueo Nativo Automático
 * ------------------------------------------------------------------------------
 * 1. En /User/SearchDocument: Rellena automáticamente el CUFE y el NIT sin DV.
 * 2. En /Document/ShowDocumentToPublic: Detecta automáticamente el botón "Descargar PDF"
 *    y los NIT del Emisor y Receptor en pantalla, descarga el PDF en segundo plano,
 *    elimina la contraseña directamente a nivel vectorial (conservando el 100% del
 *    texto seleccionable, fuentes y tablas originales, sin convertir a imagen) y
 *    entrega el archivo YA DESBLOQUEADO (_SIN_CLAVE.pdf).
 */
(function () {
  const STORAGE_KEY_NIT = "tributoapp_dian_last_nit_sin_dv";
  const STORAGE_KEY_EMISOR = "tributoapp_dian_last_emisor_sin_dv";
  const chromeApi = globalThis.chrome;

  // ============================================================================
  // 1. MOTOR CRIPTOGRÁFICO Y DESENCRIPTADOR VECTORIAL NATIVO DE PDF (ISO 32000-1)
  // ============================================================================

  const PDF_PADDING = new Uint8Array([
    0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41,
    0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
    0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80,
    0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
  ]);

  function md5(data) {
    const s = [
      7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
      5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
      4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
      6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
    ];
    const K = new Uint32Array(64);
    for (let i = 0; i < 64; i++) {
      K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;
    }
    const origLen = data.length;
    const bitLenLo = (origLen << 3) >>> 0;
    const bitLenHi = (origLen >>> 29) >>> 0;
    const paddedLen = (((origLen + 8) >>> 6) + 1) << 6;
    const buf = new Uint8Array(paddedLen);
    buf.set(data);
    buf[origLen] = 0x80;
    const view = new DataView(buf.buffer);
    view.setUint32(paddedLen - 8, bitLenLo, true);
    view.setUint32(paddedLen - 4, bitLenHi, true);

    let a0 = 0x67452301;
    let b0 = 0xefcdab89;
    let c0 = 0x98badcfe;
    let d0 = 0x10325476;
    const M = new Uint32Array(16);

    for (let offset = 0; offset < paddedLen; offset += 64) {
      for (let j = 0; j < 16; j++) M[j] = view.getUint32(offset + j * 4, true);
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F = 0, g = 0;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7 * i) % 16; }
        F = (F + A + K[i] + M[g]) >>> 0;
        A = D; D = C; C = B;
        B = (B + ((F << s[i]) | (F >>> (32 - s[i])))) >>> 0;
      }
      a0 = (a0 + A) >>> 0;
      b0 = (b0 + B) >>> 0;
      c0 = (c0 + C) >>> 0;
      d0 = (d0 + D) >>> 0;
    }
    const out = new Uint8Array(16);
    const outView = new DataView(out.buffer);
    outView.setUint32(0, a0, true);
    outView.setUint32(4, b0, true);
    outView.setUint32(8, c0, true);
    outView.setUint32(12, d0, true);
    return out;
  }

  function rc4(key, data) {
    const S = new Uint8Array(256);
    for (let i = 0; i < 256; i++) S[i] = i;
    let j = 0;
    const keyLen = key.length;
    for (let i = 0; i < 256; i++) {
      j = (j + S[i] + key[i % keyLen]) & 0xff;
      const t = S[i]; S[i] = S[j]; S[j] = t;
    }
    const out = new Uint8Array(data.length);
    let i = 0; j = 0;
    for (let k = 0; k < data.length; k++) {
      i = (i + 1) & 0xff;
      j = (j + S[i]) & 0xff;
      const t = S[i]; S[i] = S[j]; S[j] = t;
      out[k] = data[k] ^ S[(S[i] + S[j]) & 0xff];
    }
    return out;
  }

  const AES_SBOX = new Uint8Array(256);
  const AES_INV_SBOX = new Uint8Array(256);
  const AES_RCON = new Uint8Array([0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36]);

  (function initAesTables() {
    const p = new Uint8Array(256);
    const q = new Uint8Array(256);
    let x = 1;
    for (let i = 0; i < 255; i++) {
      p[i] = x;
      q[x] = i;
      x ^= (x << 1) ^ (x & 0x80 ? 0x11b : 0);
    }
    p[255] = 1;
    AES_SBOX[0] = 0x63;
    AES_INV_SBOX[0x63] = 0;
    for (let i = 1; i < 256; i++) {
      const b = p[255 - q[i]];
      const res = (b ^ ((b << 1) | (b >>> 7)) ^ ((b << 2) | (b >>> 6)) ^ ((b << 3) | (b >>> 5)) ^ ((b << 4) | (b >>> 4)) ^ 0x63) & 0xff;
      AES_SBOX[i] = res;
      AES_INV_SBOX[res] = i;
    }
  })();

  function gmul(a, b) {
    let p = 0, aa = a, bb = b;
    for (let i = 0; i < 8; i++) {
      if (bb & 1) p ^= aa;
      const hi = aa & 0x80;
      aa = (aa << 1) & 0xff;
      if (hi) aa ^= 0x1b;
      bb >>= 1;
    }
    return p;
  }

  function aesExpandKey(key) {
    const nk = key.length >>> 2;
    const nr = nk + 6;
    const totalWords = 4 * (nr + 1);
    const w = new Uint8Array(totalWords * 4);
    w.set(key);
    const temp = new Uint8Array(4);
    for (let i = nk; i < totalWords; i++) {
      temp.set(w.subarray((i - 1) * 4, i * 4));
      if (i % nk === 0) {
        const t = temp[0];
        temp[0] = AES_SBOX[temp[1]] ^ AES_RCON[i / nk];
        temp[1] = AES_SBOX[temp[2]];
        temp[2] = AES_SBOX[temp[3]];
        temp[3] = AES_SBOX[t];
      } else if (nk > 6 && i % nk === 4) {
        temp[0] = AES_SBOX[temp[0]];
        temp[1] = AES_SBOX[temp[1]];
        temp[2] = AES_SBOX[temp[2]];
        temp[3] = AES_SBOX[temp[3]];
      }
      const prev = (i - nk) * 4;
      const cur = i * 4;
      w[cur] = w[prev] ^ temp[0];
      w[cur + 1] = w[prev + 1] ^ temp[1];
      w[cur + 2] = w[prev + 2] ^ temp[2];
      w[cur + 3] = w[prev + 3] ^ temp[3];
    }
    return { roundKeys: w, rounds: nr };
  }

  function aesDecryptBlock(block, roundKeys, nr) {
    const state = new Uint8Array(block);
    let rkOffset = nr * 16;
    for (let i = 0; i < 16; i++) state[i] ^= roundKeys[rkOffset + i];
    const tmp = new Uint8Array(16);
    for (let round = nr - 1; round >= 1; round--) {
      tmp[0] = state[0]; tmp[4] = state[4]; tmp[8] = state[8]; tmp[12] = state[12];
      tmp[1] = state[13]; tmp[5] = state[1]; tmp[9] = state[5]; tmp[13] = state[9];
      tmp[2] = state[10]; tmp[6] = state[14]; tmp[10] = state[2]; tmp[14] = state[6];
      tmp[3] = state[7]; tmp[7] = state[11]; tmp[11] = state[15]; tmp[15] = state[3];
      rkOffset = round * 16;
      for (let i = 0; i < 16; i++) tmp[i] = AES_INV_SBOX[tmp[i]] ^ roundKeys[rkOffset + i];
      for (let c = 0; c < 4; c++) {
        const idx = c * 4;
        const s0 = tmp[idx], s1 = tmp[idx + 1], s2 = tmp[idx + 2], s3 = tmp[idx + 3];
        state[idx] = gmul(s0, 0x0e) ^ gmul(s1, 0x0b) ^ gmul(s2, 0x0d) ^ gmul(s3, 0x09);
        state[idx + 1] = gmul(s0, 0x09) ^ gmul(s1, 0x0e) ^ gmul(s2, 0x0b) ^ gmul(s3, 0x0d);
        state[idx + 2] = gmul(s0, 0x0d) ^ gmul(s1, 0x09) ^ gmul(s2, 0x0e) ^ gmul(s3, 0x0b);
        state[idx + 3] = gmul(s0, 0x0b) ^ gmul(s1, 0x0d) ^ gmul(s2, 0x09) ^ gmul(s3, 0x0e);
      }
    }
    tmp[0] = state[0]; tmp[4] = state[4]; tmp[8] = state[8]; tmp[12] = state[12];
    tmp[1] = state[13]; tmp[5] = state[1]; tmp[9] = state[5]; tmp[13] = state[9];
    tmp[2] = state[10]; tmp[6] = state[14]; tmp[10] = state[2]; tmp[14] = state[6];
    tmp[3] = state[7]; tmp[7] = state[11]; tmp[11] = state[15]; tmp[15] = state[3];
    for (let i = 0; i < 16; i++) state[i] = AES_INV_SBOX[tmp[i]] ^ roundKeys[i];
    return state;
  }

  function aesDecryptCBC(dataWithIv, key, stripPadding, explicitIv) {
    const iv = explicitIv ? explicitIv : dataWithIv.subarray(0, 16);
    const cipher = explicitIv ? dataWithIv : dataWithIv.subarray(16);
    if (cipher.length === 0 || cipher.length % 16 !== 0) return new Uint8Array(0);
    const { roundKeys, rounds } = aesExpandKey(key);
    const out = new Uint8Array(cipher.length);
    let prevBlock = iv;
    for (let offset = 0; offset < cipher.length; offset += 16) {
      const block = cipher.subarray(offset, offset + 16);
      const dec = aesDecryptBlock(block, roundKeys, rounds);
      for (let i = 0; i < 16; i++) out[offset + i] = dec[i] ^ prevBlock[i];
      prevBlock = block;
    }
    if (!stripPadding) return out;
    const padLen = out[out.length - 1];
    if (padLen >= 1 && padLen <= 16 && padLen <= out.length) {
      let validPad = true;
      for (let i = 1; i <= padLen; i++) {
        if (out[out.length - i] !== padLen) { validPad = false; break; }
      }
      if (validPad) return out.subarray(0, out.length - padLen);
    }
    return out;
  }

  function concatBytes() {
    let total = 0;
    for (let i = 0; i < arguments.length; i++) total += arguments[i].length;
    const out = new Uint8Array(total);
    let pos = 0;
    for (let i = 0; i < arguments.length; i++) {
      out.set(arguments[i], pos);
      pos += arguments[i].length;
    }
    return out;
  }

  function bytesToLatin1(bytes) {
    let s = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return s;
  }

  function latin1ToBytes(str) {
    const out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
    return out;
  }

  function bytesToHex(bytes) {
    let hex = "";
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, "0").toUpperCase();
    }
    return hex;
  }

  function hexToBytes(hexStr) {
    let clean = hexStr.replace(/\s+/g, "");
    if (clean.length % 2 !== 0) clean += "0";
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16) || 0;
    }
    return out;
  }

  function parsePdfLiteralString(str, startParenIdx) {
    const out = [];
    let depth = 0;
    let i = startParenIdx;
    const len = str.length;
    while (i < len) {
      const ch = str.charCodeAt(i);
      if (ch === 0x28) {
        if (depth > 0) out.push(0x28);
        depth++; i++;
      } else if (ch === 0x29) {
        depth--; i++;
        if (depth === 0) break;
        out.push(0x29);
      } else if (ch === 0x5c) {
        i++;
        if (i >= len) break;
        const esc = str.charCodeAt(i);
        if (esc === 0x6e) { out.push(0x0a); i++; }
        else if (esc === 0x72) { out.push(0x0d); i++; }
        else if (esc === 0x74) { out.push(0x09); i++; }
        else if (esc === 0x62) { out.push(0x08); i++; }
        else if (esc === 0x66) { out.push(0x0c); i++; }
        else if (esc === 0x28) { out.push(0x28); i++; }
        else if (esc === 0x29) { out.push(0x29); i++; }
        else if (esc === 0x5c) { out.push(0x5c); i++; }
        else if (esc === 0x0d) {
          i++;
          if (i < len && str.charCodeAt(i) === 0x0a) i++;
        } else if (esc === 0x0a) {
          i++;
        } else if (esc >= 0x30 && esc <= 0x37) {
          let oct = str[i]; i++;
          if (i < len && str.charCodeAt(i) >= 0x30 && str.charCodeAt(i) <= 0x37) {
            oct += str[i]; i++;
            if (i < len && str.charCodeAt(i) >= 0x30 && str.charCodeAt(i) <= 0x37) {
              oct += str[i]; i++;
            }
          }
          out.push(parseInt(oct, 8) & 0xff);
        } else {
          out.push(esc & 0xff); i++;
        }
      } else if (ch === 0x0d) {
        out.push(0x0a); i++;
        if (i < len && str.charCodeAt(i) === 0x0a) i++;
      } else {
        out.push(ch & 0xff); i++;
      }
    }
    return { bytes: new Uint8Array(out), endIdx: i };
  }

  function extractDictBinaryString(dictText, keyName) {
    const re = new RegExp("\\/" + keyName + "(?![A-Za-z0-9_])\\s*", "g");
    const match = re.exec(dictText);
    if (!match) return null;
    const pos = match.index + match[0].length;
    if (pos >= dictText.length) return null;
    if (dictText[pos] === "(") return parsePdfLiteralString(dictText, pos).bytes;
    if (dictText[pos] === "<" && dictText[pos + 1] !== "<") {
      const closeIdx = dictText.indexOf(">", pos + 1);
      if (closeIdx !== -1) return hexToBytes(dictText.slice(pos + 1, closeIdx));
    }
    return null;
  }

  function extractTrailerId(src) {
    const match = /\/ID\s*\[/.exec(src);
    if (!match) return null;
    let pos = match.index + match[0].length;
    while (pos < src.length && /\s/.test(src[pos])) pos++;
    if (pos >= src.length) return null;
    let id0Bytes;
    if (src[pos] === "<") {
      const closeIdx = src.indexOf(">", pos + 1);
      if (closeIdx === -1) return null;
      id0Bytes = hexToBytes(src.slice(pos + 1, closeIdx));
    } else if (src[pos] === "(") {
      id0Bytes = parsePdfLiteralString(src, pos).bytes;
    } else {
      return null;
    }
    const hex0 = bytesToHex(id0Bytes);
    return { id0Bytes, idRaw: "[<" + hex0 + "> <" + hex0 + ">]" };
  }

  function padPassword32(pwdStr) {
    const pwdBytes = latin1ToBytes(pwdStr);
    const out = new Uint8Array(32);
    const copyLen = Math.min(pwdBytes.length, 32);
    out.set(pwdBytes.subarray(0, copyLen), 0);
    if (copyLen < 32) out.set(PDF_PADDING.subarray(0, 32 - copyLen), copyLen);
    return out;
  }

  function computeFileKeyR234(paddedPwd32, info) {
    const pBytes = new Uint8Array([
      info.p & 0xff,
      (info.p >>> 8) & 0xff,
      (info.p >>> 16) & 0xff,
      (info.p >>> 24) & 0xff,
    ]);
    let combined = concatBytes(paddedPwd32, info.oBytes.subarray(0, 32), pBytes, info.id0Bytes);
    if (info.r >= 4 && !info.encryptMetadata) {
      combined = concatBytes(combined, new Uint8Array([0xff, 0xff, 0xff, 0xff]));
    }
    let hash = md5(combined);
    const keyLenBytes = info.r === 2 ? 5 : Math.max(5, Math.min(16, Math.floor(info.lengthBits / 8)));
    if (info.r >= 3) {
      for (let i = 0; i < 50; i++) hash = md5(hash.subarray(0, keyLenBytes));
    }
    return hash.subarray(0, keyLenBytes);
  }

  function verifyUserKeyR234(fileKey, info) {
    if (info.r === 2) {
      const uCalc = rc4(fileKey, PDF_PADDING);
      for (let i = 0; i < 32; i++) if (uCalc[i] !== info.uBytes[i]) return false;
      return true;
    }
    let acc = md5(concatBytes(PDF_PADDING, info.id0Bytes));
    acc = rc4(fileKey, acc);
    const tempKey = new Uint8Array(fileKey.length);
    for (let i = 1; i <= 19; i++) {
      for (let j = 0; j < fileKey.length; j++) tempKey[j] = fileKey[j] ^ i;
      acc = rc4(tempKey, acc);
    }
    for (let i = 0; i < 16; i++) if (acc[i] !== info.uBytes[i]) return false;
    return true;
  }

  function tryOwnerPasswordR234(pwdStr, info) {
    const padded = padPassword32(pwdStr);
    let hash = md5(padded);
    const keyLenBytes = info.r === 2 ? 5 : Math.max(5, Math.min(16, Math.floor(info.lengthBits / 8)));
    if (info.r >= 3) {
      for (let i = 0; i < 50; i++) hash = md5(hash.subarray(0, keyLenBytes));
    }
    const ownerRc4Key = hash.subarray(0, keyLenBytes);
    let userPadded;
    if (info.r === 2) {
      userPadded = rc4(ownerRc4Key, info.oBytes.subarray(0, 32));
    } else {
      userPadded = new Uint8Array(info.oBytes.subarray(0, 32));
      const tempKey = new Uint8Array(ownerRc4Key.length);
      for (let i = 19; i >= 0; i--) {
        for (let j = 0; j < ownerRc4Key.length; j++) tempKey[j] = ownerRc4Key[j] ^ i;
        userPadded = rc4(tempKey, userPadded);
      }
    }
    const fileKey = computeFileKeyR234(userPadded, info);
    return verifyUserKeyR234(fileKey, info) ? fileKey : null;
  }

  function computeObjectKey(fileKey, objNum, genNum, cipherMethod) {
    if (cipherMethod === "AESV3") return fileKey;
    const extra =
      cipherMethod === "AESV2"
        ? new Uint8Array([
            objNum & 0xff, (objNum >>> 8) & 0xff, (objNum >>> 16) & 0xff,
            genNum & 0xff, (genNum >>> 8) & 0xff,
            0x73, 0x41, 0x6c, 0x54,
          ])
        : new Uint8Array([
            objNum & 0xff, (objNum >>> 8) & 0xff, (objNum >>> 16) & 0xff,
            genNum & 0xff, (genNum >>> 8) & 0xff,
          ]);
    const digest = md5(concatBytes(fileKey, extra));
    return digest.subarray(0, Math.min(fileKey.length + 5, 16));
  }

  function decryptBufferForObject(data, fileKey, objNum, genNum, cipherMethod) {
    if (!data || data.length === 0) return data;
    const objKey = computeObjectKey(fileKey, objNum, genNum, cipherMethod);
    if (cipherMethod === "RC4") return rc4(objKey, data);
    return aesDecryptCBC(data, objKey, true);
  }

  function decryptStringsInObjectText(text, fileKey, objNum, genNum, cipherMethod) {
    let out = "";
    let i = 0;
    const len = text.length;
    while (i < len) {
      const ch = text[i];
      if (ch === "%") {
        const nl = text.indexOf("\n", i);
        if (nl === -1) { out += text.slice(i); break; }
        out += text.slice(i, nl + 1);
        i = nl + 1;
        continue;
      }
      if (ch === "(") {
        const parsed = parsePdfLiteralString(text, i);
        const dec = decryptBufferForObject(parsed.bytes, fileKey, objNum, genNum, cipherMethod);
        out += "<" + bytesToHex(dec) + ">";
        i = parsed.endIdx;
        continue;
      }
      if (ch === "<" && text[i + 1] === "<") { out += "<<"; i += 2; continue; }
      if (ch === ">" && text[i + 1] === ">") { out += ">>"; i += 2; continue; }
      if (ch === "<") {
        const closeIdx = text.indexOf(">", i + 1);
        if (closeIdx !== -1) {
          const hexContent = text.slice(i + 1, closeIdx);
          if (/^[0-9A-Fa-f\s]*$/.test(hexContent)) {
            const rawBytes = hexToBytes(hexContent);
            const dec = decryptBufferForObject(rawBytes, fileKey, objNum, genNum, cipherMethod);
            out += "<" + bytesToHex(dec) + ">";
            i = closeIdx + 1;
            continue;
          }
        }
      }
      out += ch;
      i++;
    }
    return out;
  }

  async function inflateFlateStream(data) {
    if (typeof DecompressionStream === "undefined") return null;
    const formats = ["deflate", "deflate-raw"];
    for (let f = 0; f < formats.length; f++) {
      try {
        const ds = new DecompressionStream(formats[f]);
        const writer = ds.writable.getWriter();
        writer.write(new Uint8Array(data)).catch(function () {});
        writer.close().catch(function () {});
        const reader = ds.readable.getReader();
        const chunks = [];
        while (true) {
          const res = await reader.read();
          if (res.done) break;
          if (res.value) chunks.push(res.value);
        }
        return concatBytes.apply(null, chunks);
      } catch {}
    }
    return null;
  }

  function parseAllTopLevelObjects(pdfBytes, pdfLatin1) {
    const objects = new Map();
    const objHeaderRegex = /(?:^|[\r\n\s])(\d+)\s+(\d+)\s+obj(?=[\r\n\s</[(])/g;
    const intObjects = new Map();
    const simpleIntRegex = /(?:^|[\r\n\s])(\d+)\s+(\d+)\s+obj[\r\n\s]+(\d+)[\r\n\s]+endobj/g;
    let intMatch;
    while ((intMatch = simpleIntRegex.exec(pdfLatin1)) !== null) {
      intObjects.set(Number(intMatch[1]), Number(intMatch[3]));
    }

    let match;
    while ((match = objHeaderRegex.exec(pdfLatin1)) !== null) {
      const objNum = Number(match[1]);
      const genNum = Number(match[2]);
      const bodyStart = match.index + match[0].length;
      const nextEndObj = pdfLatin1.indexOf("endobj", bodyStart);
      if (nextEndObj === -1) continue;

      const segmentBeforeEndObj = pdfLatin1.slice(bodyStart, nextEndObj);
      const streamKwMatch = />>[\r\n\s]*stream(?:\r\n|\n|\r)/.exec(segmentBeforeEndObj);
      if (!streamKwMatch) {
        objects.set(objNum, {
          objNum,
          genNum,
          dictOrBodyText: segmentBeforeEndObj.trim(),
          hasStream: false,
        });
        objHeaderRegex.lastIndex = nextEndObj + 6;
        continue;
      }

      const dictEndOffset = bodyStart + streamKwMatch.index + 2;
      const dictText = pdfLatin1.slice(bodyStart, dictEndOffset).trim();
      const streamDataStart = bodyStart + streamKwMatch.index + streamKwMatch[0].length;

      let streamLen = -1;
      const lenRefMatch = dictText.match(/\/Length\s+(\d+)\s+(\d+)\s+R/);
      if (lenRefMatch && intObjects.has(Number(lenRefMatch[1]))) {
        streamLen = intObjects.get(Number(lenRefMatch[1]));
      } else {
        const lenDirectMatch = dictText.match(/\/Length\s+(\d+)/);
        if (lenDirectMatch) streamLen = Number(lenDirectMatch[1]);
      }

      let streamDataEnd = -1;
      let objEndPos = nextEndObj + 6;
      if (streamLen >= 0 && streamDataStart + streamLen <= pdfBytes.length) {
        const afterStream = pdfLatin1.slice(streamDataStart + streamLen, streamDataStart + streamLen + 32);
        if (/^[\r\n\s]*endstream/.test(afterStream)) {
          streamDataEnd = streamDataStart + streamLen;
          const endObjAfter = pdfLatin1.indexOf("endobj", streamDataEnd);
          if (endObjAfter !== -1) objEndPos = endObjAfter + 6;
        }
      }
      if (streamDataEnd === -1) {
        const endStreamIdx = pdfLatin1.indexOf("endstream", streamDataStart);
        if (endStreamIdx === -1) continue;
        let end = endStreamIdx;
        if (pdfBytes[end - 2] === 0x0d && pdfBytes[end - 1] === 0x0a) end -= 2;
        else if (pdfBytes[end - 1] === 0x0a || pdfBytes[end - 1] === 0x0d) end -= 1;
        streamDataEnd = Math.max(streamDataStart, end);
        const endObjAfter = pdfLatin1.indexOf("endobj", endStreamIdx);
        if (endObjAfter !== -1) objEndPos = endObjAfter + 6;
      }

      objects.set(objNum, {
        objNum,
        genNum,
        dictOrBodyText: dictText,
        hasStream: true,
        streamBytes: pdfBytes.subarray(streamDataStart, streamDataEnd),
      });
      objHeaderRegex.lastIndex = objEndPos;
    }
    return objects;
  }

  function extractEncryptionAndTrailerInfo(pdfLatin1, objects) {
    let rootRef = null, infoRef = null, encryptRefNum = null, inlineEncryptDict = null;
    let id0Bytes = new Uint8Array(0), idRaw = null;
    const trailerSources = [];
    let searchPos = 0;
    while (true) {
      const idx = pdfLatin1.indexOf("trailer", searchPos);
      if (idx === -1) break;
      trailerSources.push(pdfLatin1.slice(idx, idx + 1500));
      searchPos = idx + 7;
    }
    objects.forEach(function (obj) {
      if (/\/Type\s*\/XRef\b/.test(obj.dictOrBodyText)) {
        trailerSources.push(obj.dictOrBodyText);
      }
    });

    for (let i = 0; i < trailerSources.length; i++) {
      const src = trailerSources[i];
      const rMatch = src.match(/\/Root\s+(\d+\s+\d+\s+R)/);
      if (rMatch) rootRef = rMatch[1];
      const iMatch = src.match(/\/Info\s+(\d+\s+\d+\s+R)/);
      if (iMatch) infoRef = iMatch[1];
      const eRefMatch = src.match(/\/Encrypt\s+(\d+)\s+(\d+)\s+R/);
      if (eRefMatch) encryptRefNum = Number(eRefMatch[1]);
      else {
        const eInline = src.match(/\/Encrypt\s*(<<[\s\S]*?>>)/);
        if (eInline) inlineEncryptDict = eInline[1];
      }
      const parsedId = extractTrailerId(src);
      if (parsedId && parsedId.id0Bytes.length > 0) {
        id0Bytes = parsedId.id0Bytes;
        idRaw = parsedId.idRaw;
      }
    }

    if (!rootRef) {
      objects.forEach(function (obj) {
        if (!rootRef && /\/Type\s*\/Catalog\b/.test(obj.dictOrBodyText)) {
          rootRef = obj.objNum + " " + obj.genNum + " R";
        }
      });
    }

    const encryptDictText =
      encryptRefNum !== null && objects.has(encryptRefNum)
        ? objects.get(encryptRefNum).dictOrBodyText
        : inlineEncryptDict;

    if (!encryptDictText) {
      return { encryptInfo: null, rootRef, infoRef, idRaw };
    }

    const vMatch = encryptDictText.match(/\/V\s+(\d+)/);
    const rMatch = encryptDictText.match(/\/R\s+(\d+)/);
    const lenMatch = encryptDictText.match(/\/Length\s+(\d+)/);
    const pMatch = encryptDictText.match(/\/P\s+(-?\d+)/);

    const v = vMatch ? Number(vMatch[1]) : 1;
    const r = rMatch ? Number(rMatch[1]) : v <= 1 ? 2 : v === 2 ? 3 : v === 4 ? 4 : 5;
    const lengthBits = lenMatch ? Number(lenMatch[1]) : v === 1 ? 40 : v === 5 ? 256 : 128;
    const p = pMatch ? Number(pMatch[1]) : -4;
    const oBytes = extractDictBinaryString(encryptDictText, "O") || new Uint8Array(32);
    const uBytes = extractDictBinaryString(encryptDictText, "U") || new Uint8Array(32);
    const encryptMetadata = !/\/EncryptMetadata\s+false\b/.test(encryptDictText);

    let cipherMethod = "RC4";
    if (v === 5 || /\/AESV3\b/.test(encryptDictText)) cipherMethod = "AESV3";
    else if (v === 4 && /\/AESV2\b/.test(encryptDictText)) cipherMethod = "AESV2";

    return {
      encryptInfo: {
        encryptObjNum: encryptRefNum !== null ? encryptRefNum : -1,
        v, r, lengthBits, p, oBytes, uBytes, id0Bytes,
        idRaw: idRaw || "",
        encryptMetadata,
        cipherMethod,
      },
      rootRef, infoRef, idRaw,
    };
  }

  function verifyKeyByFlateHeader(fileKey, objects, encryptInfo) {
    let ok = false;
    objects.forEach(function (obj) {
      if (ok || !obj.hasStream || !obj.streamBytes || obj.streamBytes.length < 18) return;
      if (obj.objNum === encryptInfo.encryptObjNum) return;
      if (/\/Type\s*\/XRef\b/.test(obj.dictOrBodyText)) return;
      if (!/\/FlateDecode\b/.test(obj.dictOrBodyText)) return;
      const sample =
        encryptInfo.cipherMethod === "RC4"
          ? obj.streamBytes.subarray(0, 16)
          : obj.streamBytes.subarray(0, Math.min(obj.streamBytes.length, 48));
      const dec = decryptBufferForObject(sample, fileKey, obj.objNum, obj.genNum, encryptInfo.cipherMethod);
      if (dec && dec.length >= 2) {
        const b0 = dec[0], b1 = dec[1];
        if ((b0 & 0x0f) === 8 && ((b0 << 8) + b1) % 31 === 0) ok = true;
      }
    });
    return ok;
  }

  async function decryptPdfNativeBytes(rawPdfBytes, candidatePasswords) {
    const pdfLatin1 = bytesToLatin1(rawPdfBytes);
    if (!pdfLatin1.includes("%PDF-")) {
      return { unlocked: false, wasEncrypted: false, passwordUsed: null, pdfBytes: rawPdfBytes };
    }

    const objects = parseAllTopLevelObjects(rawPdfBytes, pdfLatin1);
    const { encryptInfo, rootRef, infoRef, idRaw } = extractEncryptionAndTrailerInfo(pdfLatin1, objects);

    if (!encryptInfo) {
      return { unlocked: true, wasEncrypted: false, passwordUsed: null, pdfBytes: rawPdfBytes };
    }

    const allCandidates = Array.from(new Set([""].concat(candidatePasswords || [])));
    let matchedPassword = null;
    let fileKey = null;

    for (let i = 0; i < allCandidates.length; i++) {
      const pwd = allCandidates[i];
      if (encryptInfo.r <= 4) {
        const padded = padPassword32(pwd);
        const candidateKey = computeFileKeyR234(padded, encryptInfo);
        if (verifyUserKeyR234(candidateKey, encryptInfo) || verifyKeyByFlateHeader(candidateKey, objects, encryptInfo)) {
          fileKey = candidateKey;
          matchedPassword = pwd;
          break;
        }
        const ownerKey = tryOwnerPasswordR234(pwd, encryptInfo);
        if (ownerKey) {
          fileKey = ownerKey;
          matchedPassword = pwd;
          break;
        }
      }
    }

    if (!fileKey) {
      return { unlocked: false, wasEncrypted: true, passwordUsed: null, pdfBytes: rawPdfBytes };
    }

    const finalObjects = new Map();
    const objStmsToUnpack = [];

    objects.forEach(function (obj) {
      if (obj.objNum === encryptInfo.encryptObjNum) return;
      if (/\/Type\s*\/XRef\b/.test(obj.dictOrBodyText)) return;

      if (!obj.hasStream) {
        const decBody = decryptStringsInObjectText(
          obj.dictOrBodyText, fileKey, obj.objNum, obj.genNum, encryptInfo.cipherMethod
        );
        finalObjects.set(obj.objNum, {
          genNum: obj.genNum,
          rawObjectBytes: latin1ToBytes(obj.objNum + " " + obj.genNum + " obj\n" + decBody + "\nendobj\n"),
        });
        return;
      }

      const isUnencryptedMetadata =
        !encryptInfo.encryptMetadata &&
        (/\/Type\s*\/Metadata\b/.test(obj.dictOrBodyText) || /\/Subtype\s*\/XML\b/.test(obj.dictOrBodyText));
      const decStream = isUnencryptedMetadata
        ? obj.streamBytes || new Uint8Array(0)
        : decryptBufferForObject(obj.streamBytes || new Uint8Array(0), fileKey, obj.objNum, obj.genNum, encryptInfo.cipherMethod);

      if (/\/Type\s*\/ObjStm\b/.test(obj.dictOrBodyText)) {
        objStmsToUnpack.push({ dictText: obj.dictOrBodyText, decStream });
      }

      let cleanDict = decryptStringsInObjectText(
        obj.dictOrBodyText, fileKey, obj.objNum, obj.genNum, encryptInfo.cipherMethod
      );
      if (/\/Length\s+\d+\s+\d+\s+R/.test(cleanDict)) {
        cleanDict = cleanDict.replace(/\/Length\s+\d+\s+\d+\s+R/, "/Length " + decStream.length);
      } else if (/\/Length\s+\d+/.test(cleanDict)) {
        cleanDict = cleanDict.replace(/\/Length\s+\d+/, "/Length " + decStream.length);
      } else {
        cleanDict = cleanDict.replace(/>>\s*$/, " /Length " + decStream.length + " >>");
      }

      const prefixBytes = latin1ToBytes(obj.objNum + " " + obj.genNum + " obj\n" + cleanDict + "\nstream\n");
      const suffixBytes = latin1ToBytes("\nendstream\nendobj\n");
      finalObjects.set(obj.objNum, {
        genNum: obj.genNum,
        rawObjectBytes: concatBytes(prefixBytes, decStream, suffixBytes),
      });
    });

    for (let s = 0; s < objStmsToUnpack.length; s++) {
      const stm = objStmsToUnpack[s];
      const nMatch = stm.dictText.match(/\/N\s+(\d+)/);
      const firstMatch = stm.dictText.match(/\/First\s+(\d+)/);
      if (!nMatch || !firstMatch) continue;
      const count = Number(nMatch[1]);
      const firstOffset = Number(firstMatch[1]);
      const inflated = await inflateFlateStream(stm.decStream);
      if (!inflated || inflated.length <= firstOffset) continue;

      const headerStr = bytesToLatin1(inflated.subarray(0, firstOffset)).trim();
      const tokens = headerStr.split(/\s+/).map(Number);
      const entries = [];
      for (let i = 0; i < count * 2 && i + 1 < tokens.length; i += 2) {
        entries.push({ objNum: tokens[i], relOffset: tokens[i + 1] });
      }
      for (let i = 0; i < entries.length; i++) {
        const cur = entries[i];
        if (finalObjects.has(cur.objNum)) continue;
        const start = firstOffset + cur.relOffset;
        const end = i + 1 < entries.length ? firstOffset + entries[i + 1].relOffset : inflated.length;
        if (start >= 0 && end >= start && end <= inflated.length) {
          const bodySlice = inflated.subarray(start, end);
          finalObjects.set(cur.objNum, {
            genNum: 0,
            rawObjectBytes: concatBytes(
              latin1ToBytes(cur.objNum + " 0 obj\n"),
              bodySlice,
              latin1ToBytes("\nendobj\n")
            ),
          });
        }
      }
    }

    if (objStmsToUnpack.length > 0) {
      objects.forEach(function (obj, num) {
        if (/\/Type\s*\/ObjStm\b/.test(obj.dictOrBodyText)) finalObjects.delete(num);
      });
    }

    const sortedNums = Array.from(finalObjects.keys()).sort(function (a, b) { return a - b; });
    const maxObjNum = sortedNums.length > 0 ? sortedNums[sortedNums.length - 1] + 1 : 1;
    const chunks = [];
    const headerBytes = latin1ToBytes("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n");
    chunks.push(headerBytes);
    let currentOffset = headerBytes.length;
    const offsets = new Map();

    for (let i = 0; i < sortedNums.length; i++) {
      const num = sortedNums[i];
      const item = finalObjects.get(num);
      offsets.set(num, { offset: currentOffset, genNum: item.genNum });
      chunks.push(item.rawObjectBytes);
      currentOffset += item.rawObjectBytes.length;
    }

    const xrefOffset = currentOffset;
    let xrefStr = "xref\n0 " + maxObjNum + "\n0000000000 65535 f \r\n";
    for (let i = 1; i < maxObjNum; i++) {
      const entry = offsets.get(i);
      if (entry) {
        xrefStr += String(entry.offset).padStart(10, "0") + " " + String(entry.genNum).padStart(5, "0") + " n \r\n";
      } else {
        xrefStr += "0000000000 65535 f \r\n";
      }
    }
    let trailerStr = "trailer\n<<\n/Size " + maxObjNum + "\n";
    if (rootRef) trailerStr += "/Root " + rootRef + "\n";
    if (infoRef) trailerStr += "/Info " + infoRef + "\n";
    if (idRaw) trailerStr += "/ID " + idRaw + "\n";
    trailerStr += ">>\nstartxref\n" + xrefOffset + "\n%%EOF\n";
    chunks.push(latin1ToBytes(xrefStr + trailerStr));

    return {
      unlocked: true,
      wasEncrypted: true,
      passwordUsed: matchedPassword,
      pdfBytes: concatBytes.apply(null, chunks),
    };
  }

  // Extrae el primer .pdf si la DIAN devuelve un archivo .zip
  async function extractPdfIfZip(rawBytes) {
    if (rawBytes.length < 4) return rawBytes;
    if (rawBytes[0] !== 0x50 || rawBytes[1] !== 0x4b || rawBytes[2] !== 0x03 || rawBytes[3] !== 0x04) {
      return rawBytes;
    }
    const view = new DataView(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength);
    let eocdOffset = -1;
    for (let i = rawBytes.byteLength - 22; i >= Math.max(0, rawBytes.byteLength - 65557); i--) {
      if (view.getUint32(i, true) === 0x06054b50) { eocdOffset = i; break; }
    }
    if (eocdOffset === -1) return rawBytes;
    const totalEntries = view.getUint16(eocdOffset + 10, true);
    let ptr = view.getUint32(eocdOffset + 16, true);
    const decoder = new TextDecoder("utf-8");

    for (let idx = 0; idx < totalEntries; idx++) {
      if (ptr + 46 > rawBytes.byteLength || view.getUint32(ptr, true) !== 0x02014b50) break;
      const compressionMethod = view.getUint16(ptr + 10, true);
      const compressedSize = view.getUint32(ptr + 20, true);
      const fileNameLen = view.getUint16(ptr + 28, true);
      const extraLen = view.getUint16(ptr + 30, true);
      const commentLen = view.getUint16(ptr + 32, true);
      const localHeaderOffset = view.getUint32(ptr + 42, true);
      const fileName = decoder.decode(rawBytes.subarray(ptr + 46, ptr + 46 + fileNameLen));
      ptr += 46 + fileNameLen + extraLen + commentLen;
      if (!fileName.toLowerCase().endsWith(".pdf")) continue;

      const localNameLen = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const compressedSlice = rawBytes.subarray(dataStart, dataStart + compressedSize);
      if (compressionMethod === 0) return compressedSlice.slice();
      if (compressionMethod === 8 && typeof DecompressionStream !== "undefined") {
        const ds = new DecompressionStream("deflate-raw");
        const writer = ds.writable.getWriter();
        writer.write(compressedSlice.slice());
        writer.close();
        const buf = await new Response(ds.readable).arrayBuffer();
        return new Uint8Array(buf);
      }
    }
    return rawBytes;
  }

  // ============================================================================
  // 2. PANTALLA 1: /User/SearchDocument — AUTOLLENADO DE CUFE Y NIT SIN DV
  // ============================================================================

  function getNitSinDv(rawNit) {
    if (!rawNit) return "";
    const trimmed = String(rawNit).trim();
    const hyphenMatch = trimmed.match(/^([\d.\s]+)-\s*\d$/);
    if (hyphenMatch) return hyphenMatch[1].replace(/\D+/g, "");
    const digits = trimmed.replace(/\D+/g, "");
    if (digits.length === 10 && /^[89]/.test(digits)) return digits.slice(0, 9);
    return digits;
  }

  function parseParams() {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

    const cufe =
      search.get("DocumentKey") ||
      search.get("documentkey") ||
      search.get("cufe") ||
      hash.get("DocumentKey") ||
      hash.get("cufe") ||
      "";

    const nit =
      search.get("nit") ||
      search.get("Nit") ||
      search.get("SenderCode") ||
      hash.get("nit") ||
      "";

    const emisor =
      search.get("emisor") ||
      search.get("nitEmisor") ||
      hash.get("emisor") ||
      "";

    if (nit) {
      try { localStorage.setItem(STORAGE_KEY_NIT, getNitSinDv(nit)); } catch {}
    }
    if (emisor) {
      try { localStorage.setItem(STORAGE_KEY_EMISOR, getNitSinDv(emisor)); } catch {}
    }

    let savedNit = "";
    let savedEmisor = "";
    try {
      savedNit = localStorage.getItem(STORAGE_KEY_NIT) || "";
      savedEmisor = localStorage.getItem(STORAGE_KEY_EMISOR) || "";
    } catch {}

    return {
      cufe: cufe.trim(),
      nit: getNitSinDv(nit || savedNit),
      emisor: getNitSinDv(emisor || savedEmisor),
    };
  }

  function getVisibleTextInputs() {
    return Array.from(
      document.querySelectorAll(
        'input[type="text"], input[type="search"], input[type="number"], input:not([type])'
      )
    ).filter(function (el) {
      const style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden" && el.offsetParent !== null;
    });
  }

  function findCufeInput() {
    return (
      document.querySelector(
        'input#DocumentKey, input[name="DocumentKey"], input[name*="DocumentKey" i], input[placeholder*="CUFE" i], input[placeholder*="UUID" i]'
      ) ||
      getVisibleTextInputs()[0] ||
      null
    );
  }

  function findNitInput() {
    return (
      document.querySelector(
        'input#SenderCode, input[name="SenderCode"], input#Nit, input[name*="Nit" i], input[placeholder*="NIT" i], input[placeholder*="emisor" i]'
      ) ||
      getVisibleTextInputs()[1] ||
      null
    );
  }

  function setInputValue(input, value) {
    if (!input || !value) return false;
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;
    if (nativeInputValueSetter) nativeInputValueSetter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
    return true;
  }

  function injectHelperBar(nitInput, data) {
    if (!nitInput || document.getElementById("tributoapp-dian-helper")) return;
    const bar = document.createElement("div");
    bar.id = "tributoapp-dian-helper";
    bar.style.cssText =
      "margin-top:8px;padding:8px 10px;border-radius:8px;background:#f0fdfa;border:1px solid #14b8a6;font-family:system-ui,-apple-system,sans-serif;font-size:12px;color:#0f172a;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px;box-shadow:0 1px 3px rgba(0,0,0,0.06);";

    const status = document.createElement("span");
    status.style.cssText = "font-weight:700;color:#0f766e;";
    status.textContent = data.nit
      ? "⚡ Autollenado listo (NIT: " + data.nit + ") — Al darle Buscar, el PDF se descargará YA DESBLOQUEADO automáticamente"
      : "⚡ Asistente Conciliador DIAN activo";
    bar.appendChild(status);

    const btnGroup = document.createElement("div");
    btnGroup.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;";

    if (data.nit) {
      const btnReceptor = document.createElement("button");
      btnReceptor.type = "button";
      btnReceptor.textContent = "NIT Receptor: " + data.nit;
      btnReceptor.style.cssText =
        "background:#0d9488;color:#fff;border:none;border-radius:6px;padding:4px 8px;font-size:11px;font-weight:700;cursor:pointer;";
      btnReceptor.onclick = function () { setInputValue(nitInput, data.nit); };
      btnGroup.appendChild(btnReceptor);
    }

    if (data.emisor && data.emisor !== data.nit) {
      const btnEmisor = document.createElement("button");
      btnEmisor.type = "button";
      btnEmisor.textContent = "NIT Emisor: " + data.emisor;
      btnEmisor.style.cssText =
        "background:#e2e8f0;color:#0f172a;border:1px solid #cbd5e1;border-radius:6px;padding:4px 8px;font-size:11px;font-weight:700;cursor:pointer;";
      btnEmisor.onclick = function () { setInputValue(nitInput, data.emisor); };
      btnGroup.appendChild(btnEmisor);
    }

    bar.appendChild(btnGroup);
    if (nitInput.parentElement) nitInput.parentElement.appendChild(bar);
  }

  // ============================================================================
  // 3. PANTALLA 2: /Document/ShowDocumentToPublic — DESCARGA Y DESBLOQUEO AUTOMÁTICO
  // ============================================================================

  let cachedUnlockedBytes = null;
  let cachedLockedBytes = null;
  let cachedUnlockedFileName = "Factura_DIAN_SIN_CLAVE.pdf";
  let autoUnlockStarted = false;

  /**
   * Extrae todos los NIT visibles en la página de detalle de la DIAN
   * (DATOS DEL EMISOR -> NIT: 802009158, DATOS DEL RECEPTOR -> NIT: 901260460),
   * además de Serie, Folio y Nombre del Emisor para nombrar el PDF limpio.
   */
  function extractPageInvoiceMetadata() {
    const bodyText = document.body ? document.body.innerText || "" : "";
    const candidates = new Set();

    function addNitCandidate(raw) {
      if (!raw) return;
      const digits = String(raw).replace(/\D+/g, "");
      if (!digits || digits.length < 5) return;
      const sinDv = getNitSinDv(raw);
      if (sinDv) candidates.add(sinDv);
      candidates.add(digits);
      if (digits.length === 10) candidates.add(digits.slice(0, 9));
    }

    const params = parseParams();
    addNitCandidate(params.nit);
    addNitCandidate(params.emisor);

    // Extraer todos los "NIT: 802009158" o "NIT : 901260460" del texto de la página DIAN
    const nitMatches = bodyText.matchAll(/NIT\s*:\s*([0-9.\-\s]{5,16})/gi);
    for (const m of nitMatches) {
      addNitCandidate(m[1]);
    }

    // Extraer Serie y Folio (ej. Serie: FE, Folio: 29159)
    const serieMatch = bodyText.match(/Serie\s*:\s*([A-Za-z0-9-]+)/i);
    const folioMatch = bodyText.match(/Folio\s*:\s*([A-Za-z0-9-]+)/i);
    const nombreMatch = bodyText.match(/DATOS DEL EMISOR[\s\S]{0,160}?Nombre\s*:\s*([^\r\n]+)/i);

    const serie = serieMatch ? serieMatch[1].trim() : "";
    const folio = folioMatch ? folioMatch[1].trim() : "";
    const emisorNombre = nombreMatch
      ? nombreMatch[1].trim().replace(/[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32)
      : "";

    const docPrefix = serie && folio ? serie + "-" + folio : folio || serie || "Factura_DIAN";
    const fileName = emisorNombre
      ? docPrefix + "_" + emisorNombre + "_SIN_CLAVE.pdf"
      : docPrefix + "_SIN_CLAVE.pdf";

    return {
      passwords: Array.from(candidates),
      docLabel: docPrefix,
      unlockedFileName: fileName,
    };
  }

  function findDownloadPdfLink() {
    const links = Array.from(document.querySelectorAll("a, button"));
    for (let i = 0; i < links.length; i++) {
      const el = links[i];
      const txt = (el.textContent || "").trim();
      const href = el.getAttribute("href") || "";
      if (
        /descargar\s*pdf/i.test(txt) ||
        /DownloadPDF/i.test(href) ||
        /GetGraphicRepresentation/i.test(href) ||
        /DownloadDocument/i.test(href)
      ) {
        return el;
      }
    }
    return null;
  }

  function resolveDownloadUrl(el) {
    if (!el) return null;
    const rawHref = el.getAttribute("href") || el.href || "";
    if (rawHref && rawHref !== "#" && !rawHref.toLowerCase().startsWith("javascript:")) {
      try {
        return new URL(rawHref, window.location.href).href;
      } catch {}
    }
    const onclick = el.getAttribute("onclick") || "";
    const urlMatch = onclick.match(/['"](\/[^'"]+|https?:\/\/[^'"]+)['"]/);
    if (urlMatch) {
      try {
        return new URL(urlMatch[1], window.location.href).href;
      } catch {}
    }
    return null;
  }

  function base64ToUint8Array(base64) {
    const bin = atob(base64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function fetchPdfBytesFromDian(url) {
    // 1. Intentar fetch directo same-origin con cookies de la sesión DIAN
    try {
      const res = await fetch(url, { method: "GET", credentials: "include" });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 100) return new Uint8Array(buf);
      }
    } catch {}

    // 2. Respaldo vía Service Worker (background.js) por si hay redirección 302 a Azure Blob Storage
    if (chromeApi && chromeApi.runtime && chromeApi.runtime.sendMessage) {
      return new Promise(function (resolve, reject) {
        chromeApi.runtime.sendMessage({ type: "FETCH_DIAN_PDF", url: url }, function (resp) {
          if (resp && resp.ok && resp.base64) {
            resolve(base64ToUint8Array(resp.base64));
          } else {
            reject(new Error((resp && resp.error) || "No se pudo descargar el PDF"));
          }
        });
      });
    }

    throw new Error("No fue posible obtener los bytes del PDF desde la DIAN.");
  }

  function triggerBrowserDownload(pdfBytes, fileName) {
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 8000);
  }

  function ensureDocumentBanner() {
    let banner = document.getElementById("tributoapp-dian-unlocker-banner");
    if (banner) return banner;

    banner = document.createElement("div");
    banner.id = "tributoapp-dian-unlocker-banner";
    banner.style.cssText =
      "margin:12px auto;max-width:1180px;padding:12px 16px;border-radius:10px;background:linear-gradient(90deg,#f0fdfa 0%,#ecfdf5 100%);border:2px solid #0d9488;font-family:system-ui,-apple-system,sans-serif;color:#0f172a;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;box-shadow:0 4px 12px rgba(13,148,136,0.12);z-index:9999;";

    const statusEl = document.createElement("div");
    statusEl.id = "tributoapp-dian-unlocker-status";
    statusEl.style.cssText = "font-size:13px;font-weight:700;color:#0f766e;flex:1;min-width:260px;";
    statusEl.textContent = "⏳ Preparando descarga y desbloqueo automático del PDF...";
    banner.appendChild(statusEl);

    const actions = document.createElement("div");
    actions.id = "tributoapp-dian-unlocker-actions";
    actions.style.cssText = "display:flex;align-items:center;gap:8px;flex-wrap:wrap;";
    banner.appendChild(actions);

    const downloadLink = findDownloadPdfLink();
    const container =
      (downloadLink && downloadLink.closest(".card, .panel, .container, .row")?.parentElement) ||
      document.querySelector(".container, main, body");
    if (container && container.firstChild) {
      container.insertBefore(banner, container.firstChild);
    } else if (document.body) {
      document.body.insertBefore(banner, document.body.firstChild);
    }
    return banner;
  }

  function updateBannerState(state, message, extra) {
    ensureDocumentBanner();
    const statusEl = document.getElementById("tributoapp-dian-unlocker-status");
    const actionsEl = document.getElementById("tributoapp-dian-unlocker-actions");
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.style.color = state === "error" ? "#b91c1c" : "#0f766e";
    }
    if (!actionsEl) return;
    actionsEl.innerHTML = "";

    if (cachedUnlockedBytes) {
      const btnDownloadUnlocked = document.createElement("button");
      btnDownloadUnlocked.type = "button";
      btnDownloadUnlocked.textContent = "⬇️ Descargar PDF SIN CLAVE (" + cachedUnlockedFileName + ")";
      btnDownloadUnlocked.style.cssText =
        "background:#0d9488;color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:800;cursor:pointer;box-shadow:0 2px 4px rgba(13,148,136,0.25);";
      btnDownloadUnlocked.onclick = function () {
        triggerBrowserDownload(cachedUnlockedBytes, cachedUnlockedFileName);
      };
      actionsEl.appendChild(btnDownloadUnlocked);
    }

    // Selector manual por si el usuario quiere desbloquear cualquier otro PDF o probar otra clave
    const manualInput = document.createElement("input");
    manualInput.type = "text";
    manualInput.placeholder = "Otro NIT sin DV (opcional)";
    manualInput.style.cssText =
      "padding:5px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:11px;width:155px;background:#fff;color:#0f172a;";
    actionsEl.appendChild(manualInput);

    const btnRetry = document.createElement("button");
    btnRetry.type = "button";
    btnRetry.textContent = "🔓 Desbloquear";
    btnRetry.style.cssText =
      "background:#0f172a;color:#fff;border:none;border-radius:6px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;";
    btnRetry.onclick = function () {
      const customPwd = getNitSinDv(manualInput.value);
      processDownloadAndUnlock(extra && extra.downloadUrl, customPwd ? [customPwd] : [], true);
    };
    actionsEl.appendChild(btnRetry);

    if (cachedLockedBytes) {
      const btnLocked = document.createElement("button");
      btnLocked.type = "button";
      btnLocked.textContent = "🔒 Original con clave";
      btnLocked.style.cssText =
        "background:transparent;color:#64748b;border:1px solid #cbd5e1;border-radius:6px;padding:5px 8px;font-size:11px;cursor:pointer;";
      btnLocked.onclick = function () {
        triggerBrowserDownload(
          cachedLockedBytes,
          cachedUnlockedFileName.replace("_SIN_CLAVE.pdf", "_ORIGINAL.pdf")
        );
      };
      actionsEl.appendChild(btnLocked);
    }
  }

  async function processDownloadAndUnlock(explicitUrl, extraPasswords, forceTriggerDownload) {
    const linkEl = findDownloadPdfLink();
    const downloadUrl = explicitUrl || resolveDownloadUrl(linkEl);
    const meta = extractPageInvoiceMetadata();
    cachedUnlockedFileName = meta.unlockedFileName;

    const allPasswords = (extraPasswords || []).concat(meta.passwords);
    updateBannerState(
      "loading",
      "⏳ Descargando " + meta.docLabel + " y eliminando contraseña automáticamente (NITs: " + allPasswords.slice(0, 3).join(", ") + ")...",
      { downloadUrl }
    );

    try {
      let rawBytes = cachedLockedBytes;
      if (!rawBytes) {
        if (!downloadUrl) {
          throw new Error("No se encontró el enlace directo del PDF en esta página.");
        }
        const fetched = await fetchPdfBytesFromDian(downloadUrl);
        rawBytes = await extractPdfIfZip(fetched);
        cachedLockedBytes = rawBytes;
      }

      const result = await decryptPdfNativeBytes(rawBytes, allPasswords);
      if (result.unlocked) {
        cachedUnlockedBytes = result.pdfBytes;
        if (forceTriggerDownload !== false) {
          triggerBrowserDownload(cachedUnlockedBytes, cachedUnlockedFileName);
        }
        const msg = result.wasEncrypted
          ? "✅ ¡Listo! " +
            meta.docLabel +
            " descargada YA DESBLOQUEADA (Contraseña eliminada: " +
            (result.passwordUsed || "NIT") +
            " · Texto 100% original seleccionable)"
          : "✅ ¡Listo! " + meta.docLabel + " descargada (El PDF ya venía libre de contraseña)";
        updateBannerState("success", msg, { downloadUrl });

        // Actualizar también el botón original de la DIAN para que indique que ya descarga sin clave
        if (linkEl) {
          linkEl.innerHTML = "🔓 Descargar PDF SIN CLAVE";
          linkEl.style.cssText += ";background:#0d9488 !important;color:#ffffff !important;padding:6px 12px !important;border-radius:6px !important;text-decoration:none !important;font-weight:700 !important;";
        }
      } else {
        updateBannerState(
          "error",
          "⚠️ El PDF tiene una clave distinta a los NIT en pantalla (" +
            allPasswords.slice(0, 3).join(", ") +
            "). Escribe el NIT sin DV a la derecha y dale a Desbloquear.",
          { downloadUrl }
        );
      }
    } catch (err) {
      updateBannerState(
        "error",
        "⚠️ Error al auto-desbloquear: " + String((err && err.message) || err),
        { downloadUrl }
      );
    }
  }

  function setupDocumentPageAutoUnlocker() {
    const linkEl = findDownloadPdfLink();
    if (!linkEl) return;

    // Interceptar el clic en "Descargar PDF" para que SIEMPRE entregue el PDF desbloqueado
    if (!linkEl.dataset.tributoappHooked) {
      linkEl.dataset.tributoappHooked = "1";
      linkEl.addEventListener(
        "click",
        function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (cachedUnlockedBytes) {
            triggerBrowserDownload(cachedUnlockedBytes, cachedUnlockedFileName);
          } else {
            processDownloadAndUnlock(resolveDownloadUrl(linkEl), [], true);
          }
        },
        true
      );
    }

    // Ejecutar automáticamente apenas carga la página ShowDocumentToPublic
    if (!autoUnlockStarted) {
      autoUnlockStarted = true;
      processDownloadAndUnlock(resolveDownloadUrl(linkEl), [], true);
    }
  }

  // Escuchar si background.js interceptó una descarga directa desde la DIAN
  if (chromeApi && chromeApi.runtime && chromeApi.runtime.onMessage) {
    chromeApi.runtime.onMessage.addListener(function (msg) {
      if (msg && msg.type === "INTERCEPTED_DIAN_DOWNLOAD_URL" && msg.url) {
        if (cachedUnlockedBytes) {
          triggerBrowserDownload(cachedUnlockedBytes, cachedUnlockedFileName);
        } else {
          processDownloadAndUnlock(msg.url, [], true);
        }
      }
    });
  }

  function runAll() {
    const data = parseParams();
    const cufeInput = findCufeInput();
    const nitInput = findNitInput();

    if (cufeInput && data.cufe && (!cufeInput.value || cufeInput.value.trim() !== data.cufe)) {
      setInputValue(cufeInput, data.cufe);
    }
    if (nitInput && data.nit && (!nitInput.value || nitInput.value.trim() === "")) {
      setInputValue(nitInput, data.nit);
    }
    if (nitInput && (data.nit || data.emisor)) {
      injectHelperBar(nitInput, data);
    }

    // Si estamos en la vista del documento (ShowDocumentToPublic) donde aparece "Descargar PDF"
    setupDocumentPageAutoUnlocker();
  }

  runAll();
  setTimeout(runAll, 300);
  setTimeout(runAll, 900);
  setTimeout(runAll, 1800);
})();
