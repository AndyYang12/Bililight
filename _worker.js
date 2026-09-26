/* =====================================================================
   biliLight · Cloudflare Worker（B站网页版轻量客户端）
   部署：Workers 控制台 → Create → 粘贴本文件（已含前端）→ Deploy。无需 wrangler。

   路由
     GET  /                    前端页面
     GET  /api?ep=<端点>&...   B站数据（端点白名单；按需 WBI 签名）
     GET  /dm?cid=<数字>       弹幕 XML（同源转发，绕 CORS）
     GET|HEAD /m?e..&u..&s..   视频流代理（HMAC 令牌 + Range 透传 + 浏览器 UA）

   实测依据（都在这轮验证过，不是猜的）：
     · popular/ranking/rcmd/search 匿名不签名即 code=0；ranking 加签名反而 -352
     · 匿名播放上限 720P（qn=127 → quality=64），playurl 用 platform=html5&fnval=1 出 mp4
     · CDN 认 User-Agent（curl/8 → 403；浏览器 UA → 200），Range → 206，所以拖动可用
     · x/frontend/finger/spa 已 404；x/space/wbi/arc/search 匿名 -412/-352 → 不做该功能
   ===================================================================== */

/* ===== 内嵌 MD5：js-md5@0.8.3 (MIT)，Workers 无 window/process/module/define ===== */
/* ===== MD5：来自 js-md5@0.8.3 (MIT)，已改造为 Worker 可直接使用的形式 =====
 * Workers 运行时没有 window / process / module / define，因此把库里的环境探测常量
 * 直接写死为 false；nodeWrap 里两处 require 摘掉（NODE_JS 恒 false，分支不可达）。
 * 保留文件尾部的 root.md5 = exports 导出点，root 用 globalThis。
 */
/**
 * [js-md5]{@link https://github.com/emn178/js-md5}
 *
 * @namespace md5
 * @version 0.8.3
 * @author Chen, Yi-Cyuan [emn178@gmail.com]
 * @copyright Chen, Yi-Cyuan 2014-2023
 * @license MIT
 */
(function () {
  'use strict';

  var INPUT_ERROR = 'input is invalid type';
  var FINALIZE_ERROR = 'finalize already called';
  var WINDOW = false;
  var root = globalThis;
  if (root.JS_MD5_NO_WINDOW) {
    WINDOW = false;
  }
  var WEB_WORKER = !WINDOW && typeof self === 'object';
  var NODE_JS = false;
  if (NODE_JS) {
    root = global;
  } else if (WEB_WORKER) {
    root = self;
  }
  var COMMON_JS = false;
  var AMD = false;
  var ARRAY_BUFFER = !root.JS_MD5_NO_ARRAY_BUFFER && typeof ArrayBuffer !== 'undefined';
  var HEX_CHARS = '0123456789abcdef'.split('');
  var EXTRA = [128, 32768, 8388608, -2147483648];
  var SHIFT = [0, 8, 16, 24];
  var OUTPUT_TYPES = ['hex', 'array', 'digest', 'buffer', 'arrayBuffer', 'base64'];
  var BASE64_ENCODE_CHAR = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('');

  var blocks = [], buffer8;
  if (ARRAY_BUFFER) {
    var buffer = new ArrayBuffer(68);
    buffer8 = new Uint8Array(buffer);
    blocks = new Uint32Array(buffer);
  }

  var isArray = Array.isArray;
  if (root.JS_MD5_NO_NODE_JS || !isArray) {
    isArray = function (obj) {
      return Object.prototype.toString.call(obj) === '[object Array]';
    };
  }

  var isView = ArrayBuffer.isView;
  if (ARRAY_BUFFER && (root.JS_MD5_NO_ARRAY_BUFFER_IS_VIEW || !isView)) {
    isView = function (obj) {
      return typeof obj === 'object' && obj.buffer && obj.buffer.constructor === ArrayBuffer;
    };
  }

  // [message: string, isString: bool]
  var formatMessage = function (message) {
    var type = typeof message;
    if (type === 'string') {
      return [message, true];
    }
    if (type !== 'object' || message === null) {
      throw new Error(INPUT_ERROR);
    }
    if (ARRAY_BUFFER && message.constructor === ArrayBuffer) {
      return [new Uint8Array(message), false];
    }
    if (!isArray(message) && !isView(message)) {
      throw new Error(INPUT_ERROR);
    }
    return [message, false];
  }

  /**
   * @method hex
   * @memberof md5
   * @description Output hash as hex string
   * @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
   * @returns {String} Hex string
   * @example
   * md5.hex('The quick brown fox jumps over the lazy dog');
   * // equal to
   * md5('The quick brown fox jumps over the lazy dog');
   */
  /**
   * @method digest
   * @memberof md5
   * @description Output hash as bytes array
   * @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
   * @returns {Array} Bytes array
   * @example
   * md5.digest('The quick brown fox jumps over the lazy dog');
   */
  /**
   * @method array
   * @memberof md5
   * @description Output hash as bytes array
   * @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
   * @returns {Array} Bytes array
   * @example
   * md5.array('The quick brown fox jumps over the lazy dog');
   */
  /**
   * @method arrayBuffer
   * @memberof md5
   * @description Output hash as ArrayBuffer
   * @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
   * @returns {ArrayBuffer} ArrayBuffer
   * @example
   * md5.arrayBuffer('The quick brown fox jumps over the lazy dog');
   */
  /**
   * @method buffer
   * @deprecated This maybe confuse with Buffer in node.js. Please use arrayBuffer instead.
   * @memberof md5
   * @description Output hash as ArrayBuffer
   * @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
   * @returns {ArrayBuffer} ArrayBuffer
   * @example
   * md5.buffer('The quick brown fox jumps over the lazy dog');
   */
  /**
   * @method base64
   * @memberof md5
   * @description Output hash as base64 string
   * @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
   * @returns {String} base64 string
   * @example
   * md5.base64('The quick brown fox jumps over the lazy dog');
   */
  var createOutputMethod = function (outputType) {
    return function (message) {
      return new Md5(true).update(message)[outputType]();
    };
  };

  /**
   * @method create
   * @memberof md5
   * @description Create Md5 object
   * @returns {Md5} Md5 object.
   * @example
   * var hash = md5.create();
   */
  /**
   * @method update
   * @memberof md5
   * @description Create and update Md5 object
   * @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
   * @returns {Md5} Md5 object.
   * @example
   * var hash = md5.update('The quick brown fox jumps over the lazy dog');
   * // equal to
   * var hash = md5.create();
   * hash.update('The quick brown fox jumps over the lazy dog');
   */
  var createMethod = function () {
    var method = createOutputMethod('hex');
    if (NODE_JS) {
      method = nodeWrap(method);
    }
    method.create = function () {
      return new Md5();
    };
    method.update = function (message) {
      return method.create().update(message);
    };
    for (var i = 0; i < OUTPUT_TYPES.length; ++i) {
      var type = OUTPUT_TYPES[i];
      method[type] = createOutputMethod(type);
    }
    return method;
  };

  var nodeWrap = function (method) {
    var crypto = null;
    var Buffer = null;
    var bufferFrom;
    if (Buffer.from && !root.JS_MD5_NO_BUFFER_FROM) {
      bufferFrom = Buffer.from;
    } else {
      bufferFrom = function (message) {
        return new Buffer(message);
      };
    }
    var nodeMethod = function (message) {
      if (typeof message === 'string') {
        return crypto.createHash('md5').update(message, 'utf8').digest('hex');
      } else {
        if (message === null || message === undefined) {
          throw new Error(INPUT_ERROR);
        } else if (message.constructor === ArrayBuffer) {
          message = new Uint8Array(message);
        }
      }
      if (isArray(message) || isView(message) ||
        message.constructor === Buffer) {
        return crypto.createHash('md5').update(bufferFrom(message)).digest('hex');
      } else {
        return method(message);
      }
    };
    return nodeMethod;
  };

  /**
   * @namespace md5.hmac
   */
  /**
   * @method hex
   * @memberof md5.hmac
   * @description Output hash as hex string
   * @param {String|Array|Uint8Array|ArrayBuffer} key key
   * @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
   * @returns {String} Hex string
   * @example
   * md5.hmac.hex('key', 'The quick brown fox jumps over the lazy dog');
   * // equal to
   * md5.hmac('key', 'The quick brown fox jumps over the lazy dog');
   */

  /**
   * @method digest
   * @memberof md5.hmac
   * @description Output hash as bytes array
   * @param {String|Array|Uint8Array|ArrayBuffer} key key
   * @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
   * @returns {Array} Bytes array
   * @example
   * md5.hmac.digest('key', 'The quick brown fox jumps over the lazy dog');
   */
  /**
   * @method array
   * @memberof md5.hmac
   * @description Output hash as bytes array
   * @param {String|Array|Uint8Array|ArrayBuffer} key key
   * @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
   * @returns {Array} Bytes array
   * @example
   * md5.hmac.array('key', 'The quick brown fox jumps over the lazy dog');
   */
  /**
   * @method arrayBuffer
   * @memberof md5.hmac
   * @description Output hash as ArrayBuffer
   * @param {String|Array|Uint8Array|ArrayBuffer} key key
   * @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
   * @returns {ArrayBuffer} ArrayBuffer
   * @example
   * md5.hmac.arrayBuffer('key', 'The quick brown fox jumps over the lazy dog');
   */
  /**
   * @method buffer
   * @deprecated This maybe confuse with Buffer in node.js. Please use arrayBuffer instead.
   * @memberof md5.hmac
   * @description Output hash as ArrayBuffer
   * @param {String|Array|Uint8Array|ArrayBuffer} key key
   * @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
   * @returns {ArrayBuffer} ArrayBuffer
   * @example
   * md5.hmac.buffer('key', 'The quick brown fox jumps over the lazy dog');
   */
  /**
   * @method base64
   * @memberof md5.hmac
   * @description Output hash as base64 string
   * @param {String|Array|Uint8Array|ArrayBuffer} key key
   * @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
   * @returns {String} base64 string
   * @example
   * md5.hmac.base64('key', 'The quick brown fox jumps over the lazy dog');
   */
  var createHmacOutputMethod = function (outputType) {
    return function (key, message) {
      return new HmacMd5(key, true).update(message)[outputType]();
    };
  };

  /**
   * @method create
   * @memberof md5.hmac
   * @description Create HmacMd5 object
   * @param {String|Array|Uint8Array|ArrayBuffer} key key
   * @returns {HmacMd5} HmacMd5 object.
   * @example
   * var hash = md5.hmac.create('key');
   */
  /**
   * @method update
   * @memberof md5.hmac
   * @description Create and update HmacMd5 object
   * @param {String|Array|Uint8Array|ArrayBuffer} key key
   * @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
   * @returns {HmacMd5} HmacMd5 object.
   * @example
   * var hash = md5.hmac.update('key', 'The quick brown fox jumps over the lazy dog');
   * // equal to
   * var hash = md5.hmac.create('key');
   * hash.update('The quick brown fox jumps over the lazy dog');
   */
  var createHmacMethod = function () {
    var method = createHmacOutputMethod('hex');
    method.create = function (key) {
      return new HmacMd5(key);
    };
    method.update = function (key, message) {
      return method.create(key).update(message);
    };
    for (var i = 0; i < OUTPUT_TYPES.length; ++i) {
      var type = OUTPUT_TYPES[i];
      method[type] = createHmacOutputMethod(type);
    }
    return method;
  };

  /**
   * Md5 class
   * @class Md5
   * @description This is internal class.
   * @see {@link md5.create}
   */
  function Md5(sharedMemory) {
    if (sharedMemory) {
      blocks[0] = blocks[16] = blocks[1] = blocks[2] = blocks[3] =
      blocks[4] = blocks[5] = blocks[6] = blocks[7] =
      blocks[8] = blocks[9] = blocks[10] = blocks[11] =
      blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
      this.blocks = blocks;
      this.buffer8 = buffer8;
    } else {
      if (ARRAY_BUFFER) {
        var buffer = new ArrayBuffer(68);
        this.buffer8 = new Uint8Array(buffer);
        this.blocks = new Uint32Array(buffer);
      } else {
        this.blocks = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      }
    }
    this.h0 = this.h1 = this.h2 = this.h3 = this.start = this.bytes = this.hBytes = 0;
    this.finalized = this.hashed = false;
    this.first = true;
  }

  /**
   * @method update
   * @memberof Md5
   * @instance
   * @description Update hash
   * @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
   * @returns {Md5} Md5 object.
   * @see {@link md5.update}
   */
  Md5.prototype.update = function (message) {
    if (this.finalized) {
      throw new Error(FINALIZE_ERROR);
    }

    var result = formatMessage(message);
    message = result[0];
    var isString = result[1];
    var code, index = 0, i, length = message.length, blocks = this.blocks;
    var buffer8 = this.buffer8;

    while (index < length) {
      if (this.hashed) {
        this.hashed = false;
        blocks[0] = blocks[16];
        blocks[16] = blocks[1] = blocks[2] = blocks[3] =
        blocks[4] = blocks[5] = blocks[6] = blocks[7] =
        blocks[8] = blocks[9] = blocks[10] = blocks[11] =
        blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
      }

      if (isString) {
        if (ARRAY_BUFFER) {
          for (i = this.start; index < length && i < 64; ++index) {
            code = message.charCodeAt(index);
            if (code < 0x80) {
              buffer8[i++] = code;
            } else if (code < 0x800) {
              buffer8[i++] = 0xc0 | (code >>> 6);
              buffer8[i++] = 0x80 | (code & 0x3f);
            } else if (code < 0xd800 || code >= 0xe000) {
              buffer8[i++] = 0xe0 | (code >>> 12);
              buffer8[i++] = 0x80 | ((code >>> 6) & 0x3f);
              buffer8[i++] = 0x80 | (code & 0x3f);
            } else {
              code = 0x10000 + (((code & 0x3ff) << 10) | (message.charCodeAt(++index) & 0x3ff));
              buffer8[i++] = 0xf0 | (code >>> 18);
              buffer8[i++] = 0x80 | ((code >>> 12) & 0x3f);
              buffer8[i++] = 0x80 | ((code >>> 6) & 0x3f);
              buffer8[i++] = 0x80 | (code & 0x3f);
            }
          }
        } else {
          for (i = this.start; index < length && i < 64; ++index) {
            code = message.charCodeAt(index);
            if (code < 0x80) {
              blocks[i >>> 2] |= code << SHIFT[i++ & 3];
            } else if (code < 0x800) {
              blocks[i >>> 2] |= (0xc0 | (code >>> 6)) << SHIFT[i++ & 3];
              blocks[i >>> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
            } else if (code < 0xd800 || code >= 0xe000) {
              blocks[i >>> 2] |= (0xe0 | (code >>> 12)) << SHIFT[i++ & 3];
              blocks[i >>> 2] |= (0x80 | ((code >>> 6) & 0x3f)) << SHIFT[i++ & 3];
              blocks[i >>> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
            } else {
              code = 0x10000 + (((code & 0x3ff) << 10) | (message.charCodeAt(++index) & 0x3ff));
              blocks[i >>> 2] |= (0xf0 | (code >>> 18)) << SHIFT[i++ & 3];
              blocks[i >>> 2] |= (0x80 | ((code >>> 12) & 0x3f)) << SHIFT[i++ & 3];
              blocks[i >>> 2] |= (0x80 | ((code >>> 6) & 0x3f)) << SHIFT[i++ & 3];
              blocks[i >>> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
            }
          }
        }
      } else {
        if (ARRAY_BUFFER) {
          for (i = this.start; index < length && i < 64; ++index) {
            buffer8[i++] = message[index];
          }
        } else {
          for (i = this.start; index < length && i < 64; ++index) {
            blocks[i >>> 2] |= message[index] << SHIFT[i++ & 3];
          }
        }
      }
      this.lastByteIndex = i;
      this.bytes += i - this.start;
      if (i >= 64) {
        this.start = i - 64;
        this.hash();
        this.hashed = true;
      } else {
        this.start = i;
      }
    }
    if (this.bytes > 4294967295) {
      this.hBytes += this.bytes / 4294967296 << 0;
      this.bytes = this.bytes % 4294967296;
    }
    return this;
  };

  Md5.prototype.finalize = function () {
    if (this.finalized) {
      return;
    }
    this.finalized = true;
    var blocks = this.blocks, i = this.lastByteIndex;
    blocks[i >>> 2] |= EXTRA[i & 3];
    if (i >= 56) {
      if (!this.hashed) {
        this.hash();
      }
      blocks[0] = blocks[16];
      blocks[16] = blocks[1] = blocks[2] = blocks[3] =
      blocks[4] = blocks[5] = blocks[6] = blocks[7] =
      blocks[8] = blocks[9] = blocks[10] = blocks[11] =
      blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
    }
    blocks[14] = this.bytes << 3;
    blocks[15] = this.hBytes << 3 | this.bytes >>> 29;
    this.hash();
  };

  Md5.prototype.hash = function () {
    var a, b, c, d, bc, da, blocks = this.blocks;

    if (this.first) {
      a = blocks[0] - 680876937;
      a = (a << 7 | a >>> 25) - 271733879 << 0;
      d = (-1732584194 ^ a & 2004318071) + blocks[1] - 117830708;
      d = (d << 12 | d >>> 20) + a << 0;
      c = (-271733879 ^ (d & (a ^ -271733879))) + blocks[2] - 1126478375;
      c = (c << 17 | c >>> 15) + d << 0;
      b = (a ^ (c & (d ^ a))) + blocks[3] - 1316259209;
      b = (b << 22 | b >>> 10) + c << 0;
    } else {
      a = this.h0;
      b = this.h1;
      c = this.h2;
      d = this.h3;
      a += (d ^ (b & (c ^ d))) + blocks[0] - 680876936;
      a = (a << 7 | a >>> 25) + b << 0;
      d += (c ^ (a & (b ^ c))) + blocks[1] - 389564586;
      d = (d << 12 | d >>> 20) + a << 0;
      c += (b ^ (d & (a ^ b))) + blocks[2] + 606105819;
      c = (c << 17 | c >>> 15) + d << 0;
      b += (a ^ (c & (d ^ a))) + blocks[3] - 1044525330;
      b = (b << 22 | b >>> 10) + c << 0;
    }

    a += (d ^ (b & (c ^ d))) + blocks[4] - 176418897;
    a = (a << 7 | a >>> 25) + b << 0;
    d += (c ^ (a & (b ^ c))) + blocks[5] + 1200080426;
    d = (d << 12 | d >>> 20) + a << 0;
    c += (b ^ (d & (a ^ b))) + blocks[6] - 1473231341;
    c = (c << 17 | c >>> 15) + d << 0;
    b += (a ^ (c & (d ^ a))) + blocks[7] - 45705983;
    b = (b << 22 | b >>> 10) + c << 0;
    a += (d ^ (b & (c ^ d))) + blocks[8] + 1770035416;
    a = (a << 7 | a >>> 25) + b << 0;
    d += (c ^ (a & (b ^ c))) + blocks[9] - 1958414417;
    d = (d << 12 | d >>> 20) + a << 0;
    c += (b ^ (d & (a ^ b))) + blocks[10] - 42063;
    c = (c << 17 | c >>> 15) + d << 0;
    b += (a ^ (c & (d ^ a))) + blocks[11] - 1990404162;
    b = (b << 22 | b >>> 10) + c << 0;
    a += (d ^ (b & (c ^ d))) + blocks[12] + 1804603682;
    a = (a << 7 | a >>> 25) + b << 0;
    d += (c ^ (a & (b ^ c))) + blocks[13] - 40341101;
    d = (d << 12 | d >>> 20) + a << 0;
    c += (b ^ (d & (a ^ b))) + blocks[14] - 1502002290;
    c = (c << 17 | c >>> 15) + d << 0;
    b += (a ^ (c & (d ^ a))) + blocks[15] + 1236535329;
    b = (b << 22 | b >>> 10) + c << 0;
    a += (c ^ (d & (b ^ c))) + blocks[1] - 165796510;
    a = (a << 5 | a >>> 27) + b << 0;
    d += (b ^ (c & (a ^ b))) + blocks[6] - 1069501632;
    d = (d << 9 | d >>> 23) + a << 0;
    c += (a ^ (b & (d ^ a))) + blocks[11] + 643717713;
    c = (c << 14 | c >>> 18) + d << 0;
    b += (d ^ (a & (c ^ d))) + blocks[0] - 373897302;
    b = (b << 20 | b >>> 12) + c << 0;
    a += (c ^ (d & (b ^ c))) + blocks[5] - 701558691;
    a = (a << 5 | a >>> 27) + b << 0;
    d += (b ^ (c & (a ^ b))) + blocks[10] + 38016083;
    d = (d << 9 | d >>> 23) + a << 0;
    c += (a ^ (b & (d ^ a))) + blocks[15] - 660478335;
    c = (c << 14 | c >>> 18) + d << 0;
    b += (d ^ (a & (c ^ d))) + blocks[4] - 405537848;
    b = (b << 20 | b >>> 12) + c << 0;
    a += (c ^ (d & (b ^ c))) + blocks[9] + 568446438;
    a = (a << 5 | a >>> 27) + b << 0;
    d += (b ^ (c & (a ^ b))) + blocks[14] - 1019803690;
    d = (d << 9 | d >>> 23) + a << 0;
    c += (a ^ (b & (d ^ a))) + blocks[3] - 187363961;
    c = (c << 14 | c >>> 18) + d << 0;
    b += (d ^ (a & (c ^ d))) + blocks[8] + 1163531501;
    b = (b << 20 | b >>> 12) + c << 0;
    a += (c ^ (d & (b ^ c))) + blocks[13] - 1444681467;
    a = (a << 5 | a >>> 27) + b << 0;
    d += (b ^ (c & (a ^ b))) + blocks[2] - 51403784;
    d = (d << 9 | d >>> 23) + a << 0;
    c += (a ^ (b & (d ^ a))) + blocks[7] + 1735328473;
    c = (c << 14 | c >>> 18) + d << 0;
    b += (d ^ (a & (c ^ d))) + blocks[12] - 1926607734;
    b = (b << 20 | b >>> 12) + c << 0;
    bc = b ^ c;
    a += (bc ^ d) + blocks[5] - 378558;
    a = (a << 4 | a >>> 28) + b << 0;
    d += (bc ^ a) + blocks[8] - 2022574463;
    d = (d << 11 | d >>> 21) + a << 0;
    da = d ^ a;
    c += (da ^ b) + blocks[11] + 1839030562;
    c = (c << 16 | c >>> 16) + d << 0;
    b += (da ^ c) + blocks[14] - 35309556;
    b = (b << 23 | b >>> 9) + c << 0;
    bc = b ^ c;
    a += (bc ^ d) + blocks[1] - 1530992060;
    a = (a << 4 | a >>> 28) + b << 0;
    d += (bc ^ a) + blocks[4] + 1272893353;
    d = (d << 11 | d >>> 21) + a << 0;
    da = d ^ a;
    c += (da ^ b) + blocks[7] - 155497632;
    c = (c << 16 | c >>> 16) + d << 0;
    b += (da ^ c) + blocks[10] - 1094730640;
    b = (b << 23 | b >>> 9) + c << 0;
    bc = b ^ c;
    a += (bc ^ d) + blocks[13] + 681279174;
    a = (a << 4 | a >>> 28) + b << 0;
    d += (bc ^ a) + blocks[0] - 358537222;
    d = (d << 11 | d >>> 21) + a << 0;
    da = d ^ a;
    c += (da ^ b) + blocks[3] - 722521979;
    c = (c << 16 | c >>> 16) + d << 0;
    b += (da ^ c) + blocks[6] + 76029189;
    b = (b << 23 | b >>> 9) + c << 0;
    bc = b ^ c;
    a += (bc ^ d) + blocks[9] - 640364487;
    a = (a << 4 | a >>> 28) + b << 0;
    d += (bc ^ a) + blocks[12] - 421815835;
    d = (d << 11 | d >>> 21) + a << 0;
    da = d ^ a;
    c += (da ^ b) + blocks[15] + 530742520;
    c = (c << 16 | c >>> 16) + d << 0;
    b += (da ^ c) + blocks[2] - 995338651;
    b = (b << 23 | b >>> 9) + c << 0;
    a += (c ^ (b | ~d)) + blocks[0] - 198630844;
    a = (a << 6 | a >>> 26) + b << 0;
    d += (b ^ (a | ~c)) + blocks[7] + 1126891415;
    d = (d << 10 | d >>> 22) + a << 0;
    c += (a ^ (d | ~b)) + blocks[14] - 1416354905;
    c = (c << 15 | c >>> 17) + d << 0;
    b += (d ^ (c | ~a)) + blocks[5] - 57434055;
    b = (b << 21 | b >>> 11) + c << 0;
    a += (c ^ (b | ~d)) + blocks[12] + 1700485571;
    a = (a << 6 | a >>> 26) + b << 0;
    d += (b ^ (a | ~c)) + blocks[3] - 1894986606;
    d = (d << 10 | d >>> 22) + a << 0;
    c += (a ^ (d | ~b)) + blocks[10] - 1051523;
    c = (c << 15 | c >>> 17) + d << 0;
    b += (d ^ (c | ~a)) + blocks[1] - 2054922799;
    b = (b << 21 | b >>> 11) + c << 0;
    a += (c ^ (b | ~d)) + blocks[8] + 1873313359;
    a = (a << 6 | a >>> 26) + b << 0;
    d += (b ^ (a | ~c)) + blocks[15] - 30611744;
    d = (d << 10 | d >>> 22) + a << 0;
    c += (a ^ (d | ~b)) + blocks[6] - 1560198380;
    c = (c << 15 | c >>> 17) + d << 0;
    b += (d ^ (c | ~a)) + blocks[13] + 1309151649;
    b = (b << 21 | b >>> 11) + c << 0;
    a += (c ^ (b | ~d)) + blocks[4] - 145523070;
    a = (a << 6 | a >>> 26) + b << 0;
    d += (b ^ (a | ~c)) + blocks[11] - 1120210379;
    d = (d << 10 | d >>> 22) + a << 0;
    c += (a ^ (d | ~b)) + blocks[2] + 718787259;
    c = (c << 15 | c >>> 17) + d << 0;
    b += (d ^ (c | ~a)) + blocks[9] - 343485551;
    b = (b << 21 | b >>> 11) + c << 0;

    if (this.first) {
      this.h0 = a + 1732584193 << 0;
      this.h1 = b - 271733879 << 0;
      this.h2 = c - 1732584194 << 0;
      this.h3 = d + 271733878 << 0;
      this.first = false;
    } else {
      this.h0 = this.h0 + a << 0;
      this.h1 = this.h1 + b << 0;
      this.h2 = this.h2 + c << 0;
      this.h3 = this.h3 + d << 0;
    }
  };

  /**
   * @method hex
   * @memberof Md5
   * @instance
   * @description Output hash as hex string
   * @returns {String} Hex string
   * @see {@link md5.hex}
   * @example
   * hash.hex();
   */
  Md5.prototype.hex = function () {
    this.finalize();

    var h0 = this.h0, h1 = this.h1, h2 = this.h2, h3 = this.h3;

    return HEX_CHARS[(h0 >>> 4) & 0x0F] + HEX_CHARS[h0 & 0x0F] +
      HEX_CHARS[(h0 >>> 12) & 0x0F] + HEX_CHARS[(h0 >>> 8) & 0x0F] +
      HEX_CHARS[(h0 >>> 20) & 0x0F] + HEX_CHARS[(h0 >>> 16) & 0x0F] +
      HEX_CHARS[(h0 >>> 28) & 0x0F] + HEX_CHARS[(h0 >>> 24) & 0x0F] +
      HEX_CHARS[(h1 >>> 4) & 0x0F] + HEX_CHARS[h1 & 0x0F] +
      HEX_CHARS[(h1 >>> 12) & 0x0F] + HEX_CHARS[(h1 >>> 8) & 0x0F] +
      HEX_CHARS[(h1 >>> 20) & 0x0F] + HEX_CHARS[(h1 >>> 16) & 0x0F] +
      HEX_CHARS[(h1 >>> 28) & 0x0F] + HEX_CHARS[(h1 >>> 24) & 0x0F] +
      HEX_CHARS[(h2 >>> 4) & 0x0F] + HEX_CHARS[h2 & 0x0F] +
      HEX_CHARS[(h2 >>> 12) & 0x0F] + HEX_CHARS[(h2 >>> 8) & 0x0F] +
      HEX_CHARS[(h2 >>> 20) & 0x0F] + HEX_CHARS[(h2 >>> 16) & 0x0F] +
      HEX_CHARS[(h2 >>> 28) & 0x0F] + HEX_CHARS[(h2 >>> 24) & 0x0F] +
      HEX_CHARS[(h3 >>> 4) & 0x0F] + HEX_CHARS[h3 & 0x0F] +
      HEX_CHARS[(h3 >>> 12) & 0x0F] + HEX_CHARS[(h3 >>> 8) & 0x0F] +
      HEX_CHARS[(h3 >>> 20) & 0x0F] + HEX_CHARS[(h3 >>> 16) & 0x0F] +
      HEX_CHARS[(h3 >>> 28) & 0x0F] + HEX_CHARS[(h3 >>> 24) & 0x0F];
  };

  /**
   * @method toString
   * @memberof Md5
   * @instance
   * @description Output hash as hex string
   * @returns {String} Hex string
   * @see {@link md5.hex}
   * @example
   * hash.toString();
   */
  Md5.prototype.toString = Md5.prototype.hex;

  /**
   * @method digest
   * @memberof Md5
   * @instance
   * @description Output hash as bytes array
   * @returns {Array} Bytes array
   * @see {@link md5.digest}
   * @example
   * hash.digest();
   */
  Md5.prototype.digest = function () {
    this.finalize();

    var h0 = this.h0, h1 = this.h1, h2 = this.h2, h3 = this.h3;
    return [
      h0 & 0xFF, (h0 >>> 8) & 0xFF, (h0 >>> 16) & 0xFF, (h0 >>> 24) & 0xFF,
      h1 & 0xFF, (h1 >>> 8) & 0xFF, (h1 >>> 16) & 0xFF, (h1 >>> 24) & 0xFF,
      h2 & 0xFF, (h2 >>> 8) & 0xFF, (h2 >>> 16) & 0xFF, (h2 >>> 24) & 0xFF,
      h3 & 0xFF, (h3 >>> 8) & 0xFF, (h3 >>> 16) & 0xFF, (h3 >>> 24) & 0xFF
    ];
  };

  /**
   * @method array
   * @memberof Md5
   * @instance
   * @description Output hash as bytes array
   * @returns {Array} Bytes array
   * @see {@link md5.array}
   * @example
   * hash.array();
   */
  Md5.prototype.array = Md5.prototype.digest;

  /**
   * @method arrayBuffer
   * @memberof Md5
   * @instance
   * @description Output hash as ArrayBuffer
   * @returns {ArrayBuffer} ArrayBuffer
   * @see {@link md5.arrayBuffer}
   * @example
   * hash.arrayBuffer();
   */
  Md5.prototype.arrayBuffer = function () {
    this.finalize();

    var buffer = new ArrayBuffer(16);
    var blocks = new Uint32Array(buffer);
    blocks[0] = this.h0;
    blocks[1] = this.h1;
    blocks[2] = this.h2;
    blocks[3] = this.h3;
    return buffer;
  };

  /**
   * @method buffer
   * @deprecated This maybe confuse with Buffer in node.js. Please use arrayBuffer instead.
   * @memberof Md5
   * @instance
   * @description Output hash as ArrayBuffer
   * @returns {ArrayBuffer} ArrayBuffer
   * @see {@link md5.buffer}
   * @example
   * hash.buffer();
   */
  Md5.prototype.buffer = Md5.prototype.arrayBuffer;

  /**
   * @method base64
   * @memberof Md5
   * @instance
   * @description Output hash as base64 string
   * @returns {String} base64 string
   * @see {@link md5.base64}
   * @example
   * hash.base64();
   */
  Md5.prototype.base64 = function () {
    var v1, v2, v3, base64Str = '', bytes = this.array();
    for (var i = 0; i < 15;) {
      v1 = bytes[i++];
      v2 = bytes[i++];
      v3 = bytes[i++];
      base64Str += BASE64_ENCODE_CHAR[v1 >>> 2] +
        BASE64_ENCODE_CHAR[(v1 << 4 | v2 >>> 4) & 63] +
        BASE64_ENCODE_CHAR[(v2 << 2 | v3 >>> 6) & 63] +
        BASE64_ENCODE_CHAR[v3 & 63];
    }
    v1 = bytes[i];
    base64Str += BASE64_ENCODE_CHAR[v1 >>> 2] +
      BASE64_ENCODE_CHAR[(v1 << 4) & 63] +
      '==';
    return base64Str;
  };

  /**
   * HmacMd5 class
   * @class HmacMd5
   * @extends Md5
   * @description This is internal class.
   * @see {@link md5.hmac.create}
   */
  function HmacMd5(key, sharedMemory) {
    var i, result = formatMessage(key);
    key = result[0];
    if (result[1]) {
      var bytes = [], length = key.length, index = 0, code;
      for (i = 0; i < length; ++i) {
        code = key.charCodeAt(i);
        if (code < 0x80) {
          bytes[index++] = code;
        } else if (code < 0x800) {
          bytes[index++] = (0xc0 | (code >>> 6));
          bytes[index++] = (0x80 | (code & 0x3f));
        } else if (code < 0xd800 || code >= 0xe000) {
          bytes[index++] = (0xe0 | (code >>> 12));
          bytes[index++] = (0x80 | ((code >>> 6) & 0x3f));
          bytes[index++] = (0x80 | (code & 0x3f));
        } else {
          code = 0x10000 + (((code & 0x3ff) << 10) | (key.charCodeAt(++i) & 0x3ff));
          bytes[index++] = (0xf0 | (code >>> 18));
          bytes[index++] = (0x80 | ((code >>> 12) & 0x3f));
          bytes[index++] = (0x80 | ((code >>> 6) & 0x3f));
          bytes[index++] = (0x80 | (code & 0x3f));
        }
      }
      key = bytes;
    }

    if (key.length > 64) {
      key = (new Md5(true)).update(key).array();
    }

    var oKeyPad = [], iKeyPad = [];
    for (i = 0; i < 64; ++i) {
      var b = key[i] || 0;
      oKeyPad[i] = 0x5c ^ b;
      iKeyPad[i] = 0x36 ^ b;
    }

    Md5.call(this, sharedMemory);

    this.update(iKeyPad);
    this.oKeyPad = oKeyPad;
    this.inner = true;
    this.sharedMemory = sharedMemory;
  }
  HmacMd5.prototype = new Md5();

  HmacMd5.prototype.finalize = function () {
    Md5.prototype.finalize.call(this);
    if (this.inner) {
      this.inner = false;
      var innerHash = this.array();
      Md5.call(this, this.sharedMemory);
      this.update(this.oKeyPad);
      this.update(innerHash);
      Md5.prototype.finalize.call(this);
    }
  };

  var exports = createMethod();
  exports.md5 = exports;
  exports.md5.hmac = createHmacMethod();

  if (COMMON_JS) {
    module.exports = exports;
  } else {
    /**
     * @method md5
     * @description Md5 hash function, export to global in browsers.
     * @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
     * @returns {String} md5 hashes
     * @example
     * md5(''); // d41d8cd98f00b204e9800998ecf8427e
     * md5('The quick brown fox jumps over the lazy dog'); // 9e107d9d372bb6826bd81d3542a419d6
     * md5('The quick brown fox jumps over the lazy dog.'); // e4d909c290d0fb1ca068ffaddf22cbd0
     *
     * // It also supports UTF-8 encoding
     * md5('中文'); // a7bac2239fcdcb3a067903d8077c4a07
     *
     * // It also supports byte `Array`, `Uint8Array`, `ArrayBuffer`
     * md5([]); // d41d8cd98f00b204e9800998ecf8427e
     * md5(new Uint8Array([])); // d41d8cd98f00b204e9800998ecf8427e
     */
    root.md5 = exports;
    if (AMD) {
      define(function () {
        return exports;
      });
    }
  }
})();

/* 取全局导出，供 Worker 内部使用 */
var md5hex = (typeof self !== 'undefined' && self.md5) || (typeof globalThis !== 'undefined' && globalThis.md5);


/* ===== 内嵌前端 ===== */
var PAGE_HTML = "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover\">\n<meta name=\"theme-color\" content=\"#d86da5\">\n<meta name=\"format-detection\" content=\"telephone=no\">\n<meta name=\"referrer\" content=\"no-referrer-when-downgrade\">\n<link rel=\"icon\" href=\"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7\">\n<title>biliLight · 轻装看B站</title>\n<style>\n/* ============ biliLight HUD 前端 | 纯 ES5/CSS，无框架、无图片依赖、无圆角 ============\n   兼容目标：Chrome 80+ 与 Android 4.x 老 WebView（Chrome 30 级别）\n   → 因此：不用 CSS 变量 / flex gap / object-fit / sticky / Promise / fetch / 模板字符串 */\n*{box-sizing:border-box;-webkit-tap-highlight-color:rgba(0,0,0,0);margin:0;padding:0}\nhtml,body{height:100%}\nbody{\n  background:#eef0f3;color:#1c2126;\n  font:14px/1.5 \"Helvetica Neue\",Helvetica,\"Noto Sans CJK SC\",\"Source Han Sans CN\",\"Microsoft YaHei\",sans-serif;\n  -webkit-text-size-adjust:100%\n}\n/* 网格底纹：用渐变画，不占任何图片资源 */\n.bg-grid{\n  background-image:\n    linear-gradient(0deg,rgba(28,33,38,.045) 1px,transparent 1px),\n    linear-gradient(90deg,rgba(28,33,38,.045) 1px,transparent 1px),\n    linear-gradient(0deg,rgba(28,33,38,.075) 1px,transparent 1px),\n    linear-gradient(90deg,rgba(28,33,38,.075) 1px,transparent 1px);\n  background-size:16px 16px,16px 16px,64px 64px,64px 64px\n}\n.num{font-family:\"Courier New\",DejaVu Sans Mono,Menlo,monospace;font-variant-numeric:tabular-nums;letter-spacing:0}\n.hide{display:none !important}\na{color:inherit;text-decoration:none}\nbutton{font:inherit;color:inherit;background:none;border:0;cursor:pointer}\ninput,select{font:inherit;color:inherit}\n\n/* ---------------- 布局骨架：桌面左栏 + 右内容；窄屏上下堆叠 ---------------- */\n#app{min-height:100%}\n.bar{\n  background:#fff;border-bottom:1px solid #aab3bc;\n  padding:0 10px;height:52px;position:relative;z-index:30\n}\n.bar .row{display:block;padding-top:9px}\n.brand{\n  float:left;font-size:19px;font-weight:700;letter-spacing:-.5px;color:#d86da5;\n  line-height:34px;padding-left:9px;border-left:3px solid #d86da5\n}\n.brand b{color:#1c2126;font-weight:700}\n.tabs{float:right;line-height:34px}\n.tabs button{\n  float:left;padding:0 12px;height:34px;line-height:34px;color:#454c54;\n  border-left:1px solid #e4e9ed;font-size:14px\n}\n.tabs button.on{color:#d86da5;background:#fdf3f8;border-bottom:3px solid #d86da5;height:34px}\n.sbox{margin:0 0 0 8px;overflow:hidden;position:relative}\n.sbox input{\n  width:100%;height:34px;border:1px solid #aab3bc;background:#e9edf1;\n  padding:0 66px 0 9px;font-size:14px;line-height:32px;outline:none\n}\n.sbox input:focus{background:#fff;border-color:#d86da5}\n.sbox .go{\n  position:absolute;right:0;top:9px;width:62px;height:34px;line-height:33px;text-align:center;\n  background:#d86da5;color:#fff;font-size:13px;border-bottom:3px solid #ae4a7b\n}\n.sbox .go:active{background:#ae4a7b;border-bottom-width:1px}\n.sug{\n  position:absolute;left:0;right:0;top:44px;background:#fff;border:1px solid #aab3bc;z-index:40;\n  box-shadow:0 2px 0 rgba(28,33,38,.12)\n}\n.sug div{padding:9px 10px;border-bottom:1px solid #e4e9ed;font-size:14px}\n.sug div:last-child{border-bottom:0}\n.sug b{color:#d86da5;font-weight:400}\n\n.wrap{max-width:1128px;margin:0 auto;padding:10px}\n.side{float:left;width:184px;display:none}\n.main{margin-left:0}\n@media (min-width:900px){\n  .side{display:block}\n  .main{margin-left:200px}\n  .tabs{display:block}\n}\n/* 侧栏：分区选择 */\n.side h4{font-size:11px;color:#7a828b;font-weight:400;padding:6px 8px;border-bottom:1px solid #cbd2d9;letter-spacing:1px}\n.side a{display:block;padding:8px;border-bottom:1px solid #e4e9ed;font-size:14px;color:#454c54}\n.side a.on{background:#fff;color:#d86da5;border-left:3px solid #d86da5;padding-left:7px}\n.side a i{float:right;font-style:normal;color:#a9b0b8;font-size:11px}\n\n/* ---------------- 区块标题 ---------------- */\n.hd{border-bottom:1px solid #cbd2d9;padding:4px 0 6px;margin:2px 0 10px;overflow:hidden}\n.hd h2{float:left;font-size:16px;font-weight:700;line-height:22px;padding-left:8px;border-left:3px solid #d86da5}\n.hd .sp{float:right;font-size:11px;color:#7a828b;line-height:22px}\n.hd em{font-style:normal;color:#00a1d6;font-size:11px}\n/* 刻度尺装饰 */\n.ticks{height:5px;border-bottom:1px solid #aab3bc;background:\n  repeating-linear-gradient(90deg,#aab3bc 0 1px,transparent 1px 8px);opacity:.7;margin:-6px 0 10px}\n\n/* ---------------- 卡片栅格（float，兼容老 WebView） ---------------- */\n.g{margin:0 -4px;overflow:hidden}\n.g:after{content:\"\";display:block;clear:both;height:0}\n.c{\n  float:left;width:50%;padding:0 4px 12px;\n}\n@media (min-width:600px){.c{width:33.333%}}\n@media (min-width:900px){.c{width:25%}}\n@media (min-width:1100px){.c{width:20%}}\n.c .box{background:#fff;border:1px solid #cbd2d9;padding:4px;position:relative}\n.c.tap:active .box{background:#fdf3f8;border-color:#d86da5}\n.th{position:relative;background:#0b0d0f;padding:1px;line-height:0}\n.th img{width:100%;display:block;height:auto}\n/* 四角括号：纯 CSS，不用图片 */\n.th:before,.th:after,.th .b1,.th .b2{\n  content:\"\";position:absolute;width:9px;height:9px;line-height:0;font-size:0;pointer-events:none\n}\n.th:before{left:3px;top:3px;border-left:1px solid #d86da5;border-top:1px solid #d86da5}\n.th:after{right:3px;top:3px;border-right:1px solid #d86da5;border-top:1px solid #d86da5}\n.th .b1{left:3px;bottom:-21px;border-left:1px solid #d86da5;border-bottom:1px solid #d86da5}\n.th .b2{right:3px;bottom:-21px;border-right:1px solid #d86da5;border-bottom:1px solid #d86da5}\n.mt{\n  background:rgba(0,0,0,.8);color:#fff;padding:2px 5px;line-height:14px;\n  font-size:10px;overflow:hidden;white-space:nowrap;position:relative\n}\n.mt .r{float:right;color:#7fd8f5}\n.tt{font-size:13px;line-height:17px;height:34px;overflow:hidden;margin-top:4px;color:#1c2126;\n  display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}\n.ub{font-size:10px;line-height:14px;height:14px;overflow:hidden;color:#7a828b;white-space:nowrap}\n.ub .dot{color:#cbd2d9;padding:0 3px}\n.tagline{position:absolute;left:1px;top:1px;background:#d86da5;color:#fff;font-size:9px;padding:1px 4px}\n.tagline.t2{background:#00a1d6}\n\n/* 行卡（长列表：结果页/收藏/历史） */\n.ls{border-top:1px solid #e4e9ed}\n.lr{background:#fff;border-bottom:1px solid #e4e9ed;padding:8px;overflow:hidden;position:relative}\n.lr:active{background:#fdf3f8}\n.lr .th{float:left;width:132px;margin-right:9px}\n@media (min-width:600px){.lr .th{width:176px}}\n.lr .in{overflow:hidden}\n.lr .tt{font-size:14px;line-height:19px;max-height:38px;margin:0 0 3px;overflow:hidden;\n  display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}\n.lr .ds{font-size:11px;color:#7a828b;line-height:16px;height:32px;overflow:hidden;\n  display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}\n.lr .mt2{font-size:10px;color:#7a828b;margin-top:4px}\n.lr .mt2 b{color:#1c2126;font-weight:400}\n\n/* ---------------- 状态块 ---------------- */\n.st{padding:26px 12px;text-align:center;color:#7a828b;font-size:13px;border:1px solid #cbd2d9;background:#fff}\n.st .cr{\n  width:26px;height:26px;margin:0 auto 10px;position:relative;\n  border:1px solid #cbd2d9\n}\n.st .cr:before,.st .cr:after{content:\"\";position:absolute;background:#d86da5}\n.st .cr:before{left:12px;top:4px;width:1px;height:18px}\n.st .cr:after{top:12px;left:4px;height:1px;width:18px}\n.spin{width:22px;height:22px;margin:0 auto;border:2px solid #cbd2d9;border-top-color:#d86da5;-webkit-animation:sp .8s linear infinite;animation:sp .8s linear infinite}\n@-webkit-keyframes sp{to{-webkit-transform:rotate(360deg)}}\n@keyframes sp{to{transform:rotate(360deg)}}\n.loadmore{display:block;width:100%;padding:11px;background:#fff;border:1px solid #cbd2d9;color:#454c54;font-size:13px;margin-top:2px}\n.loadmore:active{background:#fdf3f8;border-color:#d86da5}\n\n/* ---------------- 播放页 ---------------- */\n.plr{background:#000;position:relative;line-height:0}\n.plr video{width:100%;display:block;background:#000;min-height:120px}\n#dmz{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;line-height:normal}\n#dmz canvas{display:block;width:100%;height:100%}\n.plr .ctl{\n  position:absolute;left:0;right:0;bottom:0;background:rgba(11,13,15,.86);\n  padding:5px 8px;line-height:normal;color:#fff;font-size:11px\n}\n.plr .bar2{height:3px;background:#2a2e33;position:relative;margin-bottom:5px}\n.plr .bar2 i{display:block;height:100%;background:#d86da5;width:0}\n.plr .bar2 b{position:absolute;top:-3px;width:7px;height:9px;background:#fff;border:1px solid #d86da5;margin-left:-3px;line-height:0;font-size:0}\n.plr .btns button{float:left;padding:4px 7px;color:#fff;font-size:11px;border:1px solid transparent}\n.plr .btns button.on{color:#f3b7d3;border-color:#d86da5}\n.plr .btns button:active{background:#1b1d1f}\n.plr .btns:after{content:\"\";display:block;clear:both}\n.plr .tm{float:right;color:#a9b0b8;padding:4px 2px;line-height:16px}\n.plr .mask{position:absolute;left:0;right:0;top:0;bottom:0}\n.vhd{background:#fff;border-bottom:1px solid #cbd2d9;padding:9px 10px}\n.vhd h1{font-size:16px;line-height:22px;font-weight:700}\n.vhd .sub{font-size:11px;color:#7a828b;margin-top:4px;overflow:hidden}\n.vhd .sub span{float:left;margin-right:12px}\n.vhd .sub b{color:#1c2126;font-weight:400}\n.who{background:#fff;border-bottom:1px solid #cbd2d9;padding:8px 10px;overflow:hidden}\n.who img{float:left;width:38px;height:38px;border:1px solid #aab3bc;margin-right:9px}\n.who .n{font-size:13px;line-height:18px;color:#1c2126}\n.who .s{font-size:11px;color:#7a828b;line-height:15px;height:30px;overflow:hidden}\n.sec{background:#fff;border-bottom:1px solid #cbd2d9;margin-top:8px;padding:0 0 4px}\n.sec h3{font-size:12px;color:#7a828b;font-weight:400;padding:8px 10px 6px;border-bottom:1px solid #e4e9ed;letter-spacing:1px}\n.plist{max-height:340px;overflow-y:auto;-webkit-overflow-scrolling:touch}\n.plist a{display:block;padding:7px 10px;border-bottom:1px solid #f0f2f5;font-size:13px;overflow:hidden}\n.plist a.on{background:#fdf3f8;color:#d86da5;border-left:3px solid #d86da5;padding-left:7px}\n.plist a i{float:right;font-style:normal;color:#7a828b;font-size:10px}\n.plist a span{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}\n.chip{display:inline-block;font-size:10px;border:1px solid #aab3bc;color:#454c54;padding:1px 5px;margin:0 4px 4px 0;background:#f5f7fa}\n.chip.t{border-color:#00a1d6;color:#00a1d6;background:#f0faff}\n.chip.p{border-color:#d86da5;color:#d86da5;background:#fdf3f8}\n.cm{padding:8px 10px;border-bottom:1px solid #e4e9ed;background:#fff;overflow:hidden}\n.cm img{float:left;width:30px;height:30px;border:1px solid #cbd2d9;margin-right:8px}\n.cm .bd{overflow:hidden}\n.cm .un{font-size:11px;color:#7a828b}\n.cm .un b{color:#1c2126;font-weight:400}\n.cm .ms{font-size:13px;line-height:19px;margin-top:2px;word-break:break-all}\n.cm .lk{float:right;font-size:10px;color:#7a828b;text-align:center;padding:0 2px}\n.cm.top{background:#f0faff}\n/* 设置 */\n.set dl{background:#fff;border-bottom:1px solid #cbd2d9;padding:8px 10px;overflow:hidden}\n.set dt{font-size:13px;line-height:26px;float:left;width:42%}\n.set dd{margin-left:44%;text-align:right}\n.set select{height:28px;border:1px solid #aab3bc;background:#e9edf1;padding:0 4px;font-size:13px;max-width:100%}\n.set input[type=text]{width:100%;border:1px solid #aab3bc;background:#e9edf1;height:28px;padding:0 6px;font-size:12px}\n.sw{display:inline-block;width:44px;height:22px;border:1px solid #aab3bc;background:#e9edf1;position:relative;vertical-align:middle}\n.sw i{position:absolute;top:1px;left:1px;width:20px;height:18px;background:#fff;border:1px solid #cbd2d9;-webkit-transition:left .12s linear;transition:left .12s linear}\n.sw.on{background:#d86da5;border-color:#ae4a7b}\n.sw.on i{left:21px}\n.hint{font-size:11px;color:#7a828b;padding:8px 10px;line-height:17px}\n.foot{text-align:center;font-size:10px;color:#7a828b;padding:14px 0 22px;line-height:17px}\n/* 底部导航（窄屏） */\n.tbar{position:fixed;left:0;right:0;bottom:0;height:48px;background:#fff;border-top:1px solid #aab3bc;z-index:30}\n.tbar button{float:left;width:25%;height:48px;font-size:11px;color:#7a828b;line-height:14px;padding-top:9px;border-left:1px solid #e4e9ed}\n.tbar button.on{color:#d86da5;border-bottom:3px solid #d86da5}\n.tbar:after{content:\"\";display:block;clear:both}\nbody{padding-bottom:52px}\n@media (min-width:900px){\n  .tbar{display:none}\n  body{padding-bottom:0}\n}\n/* 全屏 */\n.plr.full{position:fixed;left:0;top:0;right:0;bottom:0;z-index:90}\n.plr.full video{height:100%}\n</style>\n</head>\n<body class=\"bg-grid\">\n<div id=\"app\">\n\n  <div class=\"bar\">\n    <div class=\"row\">\n      <a class=\"brand\" href=\"#/\">bili<b>Light</b></a>\n      <div class=\"tabs\" id=\"tabs\">\n        <button data-v=\"home\" class=\"on\">首页</button>\n        <button data-v=\"rank\">排行</button>\n        <button data-v=\"hist\">历史</button>\n        <button data-v=\"set\">设置</button>\n      </div>\n      <div class=\"sbox\" id=\"sbox\">\n        <input type=\"search\" id=\"sq\" placeholder=\"搜索视频 / AV号 / BV号\" autocomplete=\"off\" autocapitalize=\"off\" spellcheck=\"false\">\n        <button class=\"go\" id=\"sgo\">搜索</button>\n        <div class=\"sug hide\" id=\"sug\"></div>\n      </div>\n    </div>\n  </div>\n\n  <div class=\"wrap\">\n    <div class=\"side\" id=\"side\"></div>\n    <div class=\"main\" id=\"main\"></div>\n  </div>\n</div>\n\n<div class=\"tbar\" id=\"tbar\">\n  <button data-v=\"home\" class=\"on\">首页</button>\n  <button data-v=\"rank\">排行</button>\n  <button data-v=\"hist\">历史</button>\n  <button data-v=\"set\">设置</button>\n</div>\n\n<script>\n/* ============ biliLight 客户端：纯 ES5，无 Promise/fetch/classList/模板字符串 ============\n   目标：Android 4.x 老 WebView(≈Chrome 30) 到 Chrome 80+ 都能跑。\n   仅用 var/function/JSON/DOMParser/requestAnimationFrame(带 setTimeout 兜底)。 */\n(function () {\n  'use strict';\n\n  /* -------------------------------------------------- 小工具 */\n  function $(s, r) { return (r || document).querySelector(s); }\n  function mk(t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }\n  function esc(s) {\n    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')\n      .replace(/>/g, '&gt;').replace(/\"/g, '&quot;');\n  }\n  function has(e, c) { return (' ' + e.className + ' ').indexOf(' ' + c + ' ') >= 0; }\n  function addC(e, c) { if (!has(e, c)) e.className = (e.className + ' ' + c).replace(/^\\s+/, ''); }\n  function delC(e, c) { e.className = (' ' + e.className + ' ').replace(' ' + c + ' ', ' ').replace(/^\\s+|\\s+$/g, ''); }\n  function num(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }\n  function count(v) {\n    var n = num(v);\n    if (n >= 100000000) return (n / 100000000).toFixed(1) + '亿';\n    if (n >= 10000) return (n / 10000).toFixed(1) + '万';\n    return '' + n;\n  }\n  /* play() 在老内核返回 undefined，新内核返回 Promise；\n     直接 try/catch 抓不到异步拒绝（SPA 换页时会喷 pageerror），统一走 tryPlay */\n  function tryPlay(el) {\n    if (!el) return;\n    try {\n      var pr = el.play();\n      if (pr && pr.catch) pr.catch(function () { });\n    } catch (e) { /* 老内核：需要用户手势，忽略 */ }\n  }\n  function store(k, v) {\n    try {\n      if (v === undefined) { var s = localStorage.getItem('bl_' + k); return s ? JSON.parse(s) : null; }\n      localStorage.setItem('bl_' + k, JSON.stringify(v));\n    } catch (e) { return null; }\n  }\n  var MEM = {};\n  function sget(k, dft) { var v = store(k); return v == null ? (MEM[k] == null ? dft : MEM[k]) : v; }\n  function sset(k, v) { MEM[k] = v; store(k, v); }\n\n  /* -------------------------------------------------- 网络（XHR） */\n  function get(url, cb) {\n    var x = window.XMLHttpRequest ? new XMLHttpRequest() : null;\n    if (!x) { cb('浏览器不支持 XHR'); return; }\n    var done = false;\n    x.open('GET', url, true);\n    x.timeout = 20000;\n    if ('withCredentials' in x) x.withCredentials = false;\n    x.onreadystatechange = function () {\n      if (x.readyState === 4 && !done) {\n        done = true;\n        if (x.status >= 200 && x.status < 300) cb(null, x.responseText, x);\n        else cb('HTTP ' + (x.status || 0), '', x);\n      }\n    };\n    x.ontimeout = function () { if (!done) { done = true; cb('请求超时'); } };\n    x.onerror = function () { if (!done) { done = true; cb('网络错误'); } };\n    try { x.send(null); } catch (e) { if (!done) { done = true; cb('请求失败'); } }\n  }\n  /* B站错误码翻译成人话（-352/-412 是风控，不是用户做错了什么） */\n  var ERR_TXT = {\n    '-352': 'B站风控暂时拦了一下，稍等十几秒再试',\n    '-412': 'B站拒绝了这次请求（通常是访问太快），稍后再试',\n    '-400': 'B站说参数不对，换个条目试试',\n    '-403': '这个内容不许匿名访问，去设置里填 Cookie',\n    '-101': '需要登录才能看，去设置里填 Cookie',\n    '-404': 'B站说这个内容不存在',\n    '0': 'B站返回了空数据',\n  };\n  function why(j) {\n    if (!j) return '没有收到数据';\n    var t = ERR_TXT[String(j.code)];\n    if (t) return t;\n    var m = String(j.message || '');\n    return m && m !== String(j.code) ? m : ('接口异常 ' + j.code);\n  }\n  function api(ep, q, cb) {\n    var s = '/api?ep=' + encodeURIComponent(ep);\n    if (q) for (var k in q) if (q[k] !== undefined && q[k] !== null && q[k] !== '') s += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(q[k]);\n    get(s, function (err, txt) {\n      if (err) { cb({ code: -1, message: err }); return; }\n      var j;\n      try { j = JSON.parse(txt); } catch (e) { cb({ code: -1, message: '数据格式异常' }); return; }\n      cb(j);\n    });\n  }\n\n  /* -------------------------------------------------- 设置 */\n  var SET = {\n    qn: 64, dm: 1, dmspeed: 1, dmop: 80, dmarea: 100,\n    auto: 1, grid: 1, histOn: 1,\n  };\n  (function () {\n    var s = sget('set', null);\n    if (s) for (var k in s) if (SET[k] !== undefined) SET[k] = s[k];\n  })();\n  function saveSet() { sset('set', SET); }\n\n  /* -------------------------------------------------- 历史（本地） */\n  function pushHist(v) {\n    if (!SET.histOn || !v || !v.bv) return;\n    var list = sget('hist', []) || [], out = [], i;\n    for (i = 0; i < list.length; i++) if (list[i].bv !== v.bv) out.push(list[i]);\n    out.unshift({\n      bv: v.bv, aid: v.aid, title: v.title, pic: v.pic, up: v.up, dur: v.dur,\n      view: v.view, cid: v.cid, part: v.part || '', t: Math.floor(Date.now() / 1000), pos: num(v.pos),\n    });\n    if (out.length > 80) out.length = 80;\n    sset('hist', out);\n  }\n  function histOf(bv) {\n    var list = sget('hist', []) || [];\n    for (var i = 0; i < list.length; i++) if (list[i].bv === bv) return list[i];\n    return null;\n  }\n  function updHist(bv, pos, cid) {\n    var list = sget('hist', []) || [];\n    for (var i = 0; i < list.length; i++) if (list[i].bv === bv) { list[i].pos = Math.floor(pos); list[i].cid = cid; sset('hist', list); return; }\n  }\n\n  /* -------------------------------------------------- 卡片渲染 */\n  function card(it) {\n    var a = mk('a', 'c');\n    a.href = '#/video/' + encodeURIComponent(it.bv || ('av' + it.aid));\n    var box = mk('div', 'box');\n    var th = mk('div', 'th');\n    th.appendChild(mk('span', 'b1')); th.appendChild(mk('span', 'b2'));\n    var img = mk('img');\n    img.alt = ''; img.setAttribute('referrerpolicy', 'no-referrer');\n    img.src = it.pic || '';\n    img.onerror = function () { img.onerror = null; img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; };\n    th.appendChild(img);\n    if (it.dur) { var tg = mk('div', 'tagline t2 num'); tg.innerHTML = esc(it.dur); th.appendChild(tg); }\n    box.appendChild(th);\n    var tt = mk('div', 'tt'); tt.innerHTML = esc(it.title); box.appendChild(tt);\n    var ub = mk('div', 'ub');\n    ub.innerHTML = '<span>' + esc(it.up || '') + '</span>' +\n      '<span class=\"dot\">|</span><span class=\"num\">' + count(it.view) + '</span>' +\n      '<span class=\"dot\">|</span><span class=\"num\">' + count(it.dan) + '</span>';\n    box.appendChild(ub);\n    if (it.desc) { var d2 = mk('div', 'ub'); d2.style.color = '#454c54'; d2.innerHTML = esc(it.desc); box.appendChild(d2); }\n    a.appendChild(box);\n    return a;\n  }\n  function rowCard(it) {\n    var a = mk('a', 'lr');\n    a.href = '#/video/' + encodeURIComponent(it.bv || ('av' + it.aid));\n    var th = mk('div', 'th');\n    var img = mk('img'); img.alt = ''; img.src = it.pic || ''; img.setAttribute('referrerpolicy', 'no-referrer');\n    th.appendChild(img);\n    if (it.dur) { var tg = mk('div', 'tagline t2 num'); tg.innerHTML = esc(it.dur); th.appendChild(tg); }\n    a.appendChild(th);\n    var inr = mk('div', 'in');\n    var t = mk('div', 'tt'); t.innerHTML = esc(it.title); inr.appendChild(t);\n    if (it.desc) { var d = mk('div', 'ds'); d.innerHTML = esc(it.desc); inr.appendChild(d); }\n    var m = mk('div', 'mt2 num');\n    m.innerHTML = '<b>' + esc(it.up || '') + '</b> · ' + count(it.view) + ' 播放 · ' + count(it.dan) + ' 弹幕' +\n      (it.pubtxt ? ' · ' + esc(it.pubtxt) : '');\n    inr.appendChild(m);\n    a.appendChild(inr);\n    return a;\n  }\n  function grid(items) {\n    var g = mk('div', 'g'), i;\n    for (i = 0; i < items.length; i++) g.appendChild(card(items[i]));\n    return g;\n  }\n  function rows(items) {\n    var w = mk('div', 'ls'), i;\n    for (i = 0; i < items.length; i++) w.appendChild(rowCard(items[i]));\n    return w;\n  }\n  function status(txt, spin) {\n    var d = mk('div', 'st');\n    if (spin) { d.innerHTML = '<div class=\"spin\"></div><div style=\"margin-top:9px\">' + esc(txt) + '</div>'; }\n    else { d.innerHTML = '<div class=\"cr\"></div>' + esc(txt); }\n    return d;\n  }\n  function head(title, sub) {\n    var h = mk('div', 'hd');\n    h.innerHTML = '<h2>' + esc(title) + '</h2>' + (sub ? '<div class=\"sp\">' + sub + '</div>' : '');\n    var t = mk('div', 'ticks');\n    var w = mk('div');\n    w.appendChild(h); w.appendChild(t);\n    return w;\n  }\n\n  /* -------------------------------------------------- 路由 */\n  var cur = { v: '', q: '' };\n  function route() {\n    var h = location.hash || '#/home';\n    var seg = h.slice(2).split('/');\n    var view = seg[0] || 'home';\n    if (view === 'video') { videoPage(decodeURIComponent(seg[1] || '')); mark(''); return; }\n    if (view === 'search') { searchPage(decodeURIComponent(seg.slice(1).join('/') || '')); mark(''); return; }\n    if (view === 'rank') { rankPage(seg[1] || '0'); mark('rank'); return; }\n    if (view === 'hist') { histPage(); mark('hist'); return; }\n    if (view === 'set') { setPage(); mark('set'); return; }\n    if (view === 'fav') { favPage(); mark(''); return; }\n    homePage(seg[1] || 'popular'); mark('home');\n  }\n  function mark(v) {\n    var bs = document.querySelectorAll('#tabs button,#tbar button'), i;\n    for (i = 0; i < bs.length; i++) { if (bs[i].getAttribute('data-v') === v) addC(bs[i], 'on'); else delC(bs[i], 'on'); }\n  }\n  function setMain(node) {\n    var m = $('#main');\n    m.innerHTML = '';\n    if (node) m.appendChild(node);\n    window.scrollTo(0, 0);\n  }\n  function sideNav(items, active) {\n    var s = $('#side');\n    s.innerHTML = '';\n    var h = mk('h4', null, '分区'); s.appendChild(h);\n    for (var i = 0; i < items.length; i++) {\n      var a = mk('a', items[i][0] === active ? 'on' : '', esc(items[i][1]) + '<i class=\"num\">' + (items[i][2] || '') + '</i>');\n      a.href = items[i][3] + items[i][0];\n      s.appendChild(a);\n    }\n  }\n\n  /* -------------------------------------------------- 首页 */\n  function homePage(mode) {\n    var box = mk('div');\n    sideNav(RID_LIST.map(function (r) { return [r[0], r[1], '', '#/rank/']; }), -1);\n    var titles = { popular: '综合推荐', square: '大家都在搜' };\n    box.appendChild(head(titles[mode] || '综合推荐', '<em class=\"num\">biliLight</em>'));\n    var nav = mk('div');\n    nav.innerHTML = '<span class=\"chip p\">热门</span><a class=\"chip\" href=\"#/home/rcmd\">新动态</a>' +\n      '<a class=\"chip\" href=\"#/home/square\">热搜榜</a><a class=\"chip\" href=\"#/rank/0\">排行榜</a>';\n    box.appendChild(nav);\n    var body = mk('div');\n    body.appendChild(status('正在拉取数据', 1));\n    box.appendChild(body);\n    setMain(box);\n    if (mode === 'square') {\n      api('square', {}, function (j) {\n        body.innerHTML = '';\n        if (j.code !== 0) { body.appendChild(status(why(j))); return; }\n        var w = mk('div');\n        var arr = j.data || [];\n        if (!arr.length) { w.appendChild(status('今天没有热搜数据')); body.appendChild(w); return; }\n        for (var i = 0; i < arr.length; i++) {\n          var a = mk('a', 'lr');\n          a.href = '#/search/' + encodeURIComponent(arr[i].main || arr[i]);\n          a.innerHTML = '<span class=\"num\" style=\"float:left;width:24px;color:#d86da5\">' + (i + 1) +\n            '</span><span style=\"display:block;margin-left:26px\">' + esc(arr[i].main || arr[i]) + '</span>';\n          w.appendChild(a);\n        }\n        body.appendChild(w);\n      });\n      return;\n    }\n    api(mode, {}, function (j) {\n      body.innerHTML = '';\n      if (j.code !== 0) {\n        var st = status((j.message || '加载失败') + ' — 点此重试');\n        st.onclick = function () { homePage(mode); }; st.style.cursor = 'pointer';\n        body.appendChild(st); return;\n      }\n      var list = j.data || [];\n      if (!list.length) { body.appendChild(status('这个入口暂时没有内容')); return; }\n      body.appendChild(grid(list));\n      var more = mk('button', 'loadmore', '加载更多');\n      more.onclick = function () {\n        more.innerHTML = '加载中…'; more.disabled = true;\n        api(mode, { pn: Math.floor(list.length / 20) + 1 }, function (k) {\n          more.disabled = false;\n          if (k.code === 0 && (k.data || []).length) {\n            var g = mk('div', 'g');\n            for (var i = 0; i < k.data.length; i++) { list.push(k.data[i]); g.appendChild(card(k.data[i])); }\n            body.insertBefore(g, more);\n            more.innerHTML = '加载更多';\n          } else { more.innerHTML = why(k) === '接口异常 ' + k.code ? '没有更多了' : why(k); setTimeout(function () { more.innerHTML = '再试一次'; }, 900); }\n        });\n      };\n      body.appendChild(more);\n    });\n  }\n\n  /* -------------------------------------------------- 排行 */\n  function rankPage(rid) {\n    var box = mk('div');\n    box.appendChild(head('排行榜', '<em class=\"num\">rid ' + esc(rid) + '</em>'));\n    var body = mk('div'); body.appendChild(status('加载中', 1)); box.appendChild(body);\n    setMain(box);\n    sideNav(RID_LIST.map(function (r) { return [r[0], r[1], '', '#/rank/']; }), rid);\n    api('rank', { rid: rid }, function (j) {\n      body.innerHTML = '';\n      if (j.code !== 0) { body.appendChild(status(j.message || '加载失败')); return; }\n      body.appendChild(grid(j.data || []));\n    });\n  }\n  var RID_LIST = [[0, '全站'], [1, '动画'], [3, '音乐'], [4, '游戏'], [5, '娱乐'], [11, '电视剧'],\n    [23, '电影'], [129, '舞蹈'], [155, '时尚'], [160, '生活'], [188, '科技'], [217, '宠物'], [234, '运动']];\n\n  /* -------------------------------------------------- 搜索 */\n  var lastQ = '';\n  function searchPage(q) {\n    q = (q || '').replace(/^\\s+|\\s+$/g, '');\n    var box = mk('div');\n    if (!q) {\n      var recent = sget('slog', []) || [];\n      box.appendChild(head('搜索', recent.length ? '' : '<span class=\"num\">输入关键词</span>'));\n      if (recent.length) {\n        var w = mk('div');\n        for (var i = 0; i < recent.length; i++) {\n          var r = mk('a', 'lr');\n          r.href = '#/search/' + encodeURIComponent(recent[i]);\n          r.innerHTML = '<span style=\"color:#7a828b;font-size:11px\">历史</span>&nbsp;&nbsp;' + esc(recent[i]);\n          w.appendChild(r);\n        }\n        box.appendChild(w);\n      } else box.appendChild(status('在上方输入关键词开始搜索'));\n      setMain(box);\n      return;\n    }\n    $('#sq').value = q;\n    box.appendChild(head('“' + q + '”', '<span class=\"num\">按回车可换词</span>'));\n    var body = mk('div'); body.appendChild(status('搜索中', 1)); box.appendChild(body);\n    setMain(box);\n    lastQ = q;\n    api('search', { keyword: q, page: 1 }, function (j) {\n      body.innerHTML = '';\n      if (j.code !== 0) { body.appendChild(status(why(j))); return; }\n      var list = j.data || [];\n      if (!list.length) { body.appendChild(status('没有找到相关视频，换个词试试')); return; }\n      var sl = sget('slog', []) || [], out = [q], i;\n      for (i = 0; i < sl.length && out.length < 12; i++) if (sl[i] !== q) out.push(sl[i]);\n      sset('slog', out);\n      body.appendChild(rows(list));\n      var pn = 1;\n      var more = mk('button', 'loadmore', '下一页');\n      more.onclick = function () {\n        more.innerHTML = '加载中…'; more.disabled = true;\n        api('search', { keyword: q, page: ++pn }, function (k) {\n          more.disabled = false;\n          if (k.code === 0 && (k.data || []).length) {\n            var w = mk('div', 'ls');\n            for (var i2 = 0; i2 < k.data.length; i2++) { list.push(k.data[i2]); w.appendChild(rowCard(k.data[i2])); }\n            body.insertBefore(w, more); more.innerHTML = '下一页';\n          } else { more.innerHTML = why(k); }\n        });\n      };\n      body.appendChild(more);\n    });\n  }\n\n  /* -------------------------------------------------- 历史 */\n  function histPage() {\n    var box = mk('div');\n    var list = sget('hist', []) || [];\n    box.appendChild(head('观看历史', '<span class=\"num\">本机 · ' + list.length + ' 条</span>'));\n    if (!list.length) box.appendChild(status('还没有记录。看过任意视频后会自动记在这里（含上次看到的位置）。'));\n    else {\n      var w = mk('div'), i;\n      for (i = 0; i < list.length; i++) {\n        var it = list[i], a = rowCard(it);\n        if (num(it.pos) > 5) {\n          var t = mk('div', 'tagline num bl-pos'); t.innerHTML = '上次 ' + fmt(it.pos); t.style.left = 'auto'; t.style.right = '1px'; t.style.top = 'auto'; t.style.bottom = '23px';\n          a.querySelector('.th').appendChild(t);\n        }\n        var del = mk('button', null, '×');\n        del.style.cssText = 'position:absolute;right:6px;top:6px;width:22px;height:22px;background:#fff;border:1px solid #aab3bc;color:#7a828b;font-size:14px;line-height:20px';\n        (function (bv) { del.onclick = function (e) { e.preventDefault(); e.stopPropagation(); var l = sget('hist', []) || [], o = [], i2; for (i2 = 0; i2 < l.length; i2++) if (l[i2].bv !== bv) o.push(l[i2]); sset('hist', o); histPage(); }; })(it.bv);\n        a.appendChild(del);\n        a.href = '#/video/' + encodeURIComponent(it.bv);\n        w.appendChild(a);\n      }\n      box.appendChild(w);\n      var clr = mk('button', 'loadmore', '清空全部历史');\n      clr.onclick = function () { if (confirm('确定清空这 ' + list.length + ' 条观看记录？')) { sset('hist', []); histPage(); } };\n      box.appendChild(clr);\n    }\n    setMain(box);\n  }\n  function fmt(s) { s = num(s); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + p2(m) : m) + ':' + p2(x); }\n  function p2(n) { return (n < 10 ? '0' : '') + n; }\n\n  /* -------------------------------------------------- 设置 */\n  function setPage() {\n    var box = mk('div');\n    box.appendChild(head('播放与界面设置', '<span class=\"num\">保存在本机</span>'));\n    var w = mk('div', 'set');\n    box.appendChild(w);\n    function sw(label, key, hint) {\n      var dl = mk('dl');\n      dl.innerHTML = '<dt>' + label + '</dt>';\n      var dd = mk('dd');\n      var s = mk('span', 'sw' + (SET[key] ? ' on' : '')); s.innerHTML = '<i></i>';\n      s.onclick = function () { SET[key] = SET[key] ? 0 : 1; saveSet(); if (SET[key]) addC(s, 'on'); else delC(s, 'on'); if (key === 'dm') dmApplyOpts(); };\n      dd.appendChild(s); dl.appendChild(dd);\n      w.appendChild(dl);\n      if (hint) { var h2 = mk('div', 'hint', hint); h2.style.paddingTop = '0'; w.appendChild(h2); }\n    }\n    function sel(label, key, opts, hint) {\n      var dl = mk('dl');\n      dl.innerHTML = '<dt>' + label + '</dt>';\n      var dd = mk('dd'), s = mk('select');\n      for (var i = 0; i < opts.length; i++) {\n        var o = mk('option', null, opts[i][1]); o.value = opts[i][0];\n        if (String(SET[key]) === String(opts[i][0])) o.selected = true;\n        s.appendChild(o);\n      }\n      s.onchange = function () { SET[key] = num(s.value) || s.value; saveSet(); if (key === 'dm') dmApplyOpts(); };\n      dd.appendChild(s); dl.appendChild(dd); w.appendChild(dl);\n      if (hint) w.appendChild(mk('div', 'hint', hint));\n    }\n    sel('清晰度上限', 'qn', [[16, '360P 省流量'], [32, '480P'], [64, '720P（匿名最高）'], [80, '1080P（需 Cookie）'], [116, '1080P60（需 Cookie）']],\n      '<div class=\"hint\">B站未登录最高只给 720P。想要 1080P，在下方填自己的 buvid/SESSDATA Cookie。</div>');\n    sw('弹幕总开关', 'dm');\n    sel('弹幕速度', 'dmspeed', [[0.6, '慢'], [1, '标准'], [1.5, '快'], [2, '很快']]);\n    sel('弹幕不透明度', 'dmop', [[40, '40%'], [60, '60%'], [80, '80%'], [100, '100%']]);\n    sel('弹幕覆盖宽度', 'dmarea', [[60, '60%'], [80, '80%'], [100, '全屏']]);\n    sw('自动连播下一 P', 'auto');\n    sw('记录观看历史', 'histOn');\n    var dl = mk('dl');\n    dl.innerHTML = '<dt>登录 Cookie</dt><dd></dd>';\n    var dd = dl.querySelector('dd'), inp = mk('input');\n    inp.type = 'text'; inp.value = sget('ck', '') || '';\n    inp.placeholder = '留空即可';\n    inp.onchange = function () {\n      sset('ck', inp.value.replace(/^\\s+|\\s+$/g, ''));\n      box.appendChild(mk('div', 'hint', '已存到本机。<b>注意：</b>本页地址会被 Worker 记录 Cookie 的话有隐私风险，建议只在自建 Worker 上用，或改用 Workers 环境变量 BILI_COOKIE。'));\n    };\n    dd.appendChild(inp);\n    w.appendChild(dl);\n    w.appendChild(mk('div', 'hint', 'Cookie 更安全的做法：在 Cloudflare 控制台给本 Worker 加环境变量 <b>BILI_COOKIE</b>（值形如 SESSDATA=xxx; bili_jct=yyy; buvid3=zzz），代码会自动带上。</div>'));\n    var dl2 = mk('dl');\n    dl2.innerHTML = '<dt>清理本机数据</dt><dd></dd>';\n    var dd2 = mk('dd'), b = mk('button', 'chip p', '历史记录 + 搜索记录');\n    b.onclick = function () { sset('hist', []); sset('slog', []); };\n    dd2.appendChild(b); dl2.appendChild(dd2); w.appendChild(dl2);\n    var h = sget('hist', []) || [];\n    w.appendChild(mk('div', 'hint', '本机已记录 ' + h.length + ' 条历史。数据只存在这台设备的 localStorage，不会上传。'));\n    setMain(box);\n  }\n\n  /* -------------------------------------------------- 播放页 */\n  var VID = { bv: '', cid: 0, pages: [], cur: 0, v: null, seg: null };\n  var videoEl = null, dmz = null, dmCv = null, dmCtx = null, dmList = [], dmRun = 0, dmIdx = 0, dmQ = [];\n  function videoPage(id) {\n    id = (id || '').replace(/^\\s+|\\s+$/g, '');\n    if (!id) { setMain(status('参数不完整')); return; }\n    var q = {};\n    if (/^BV/i.test(id)) q.bvid = id;\n    else if (/^av/i.test(id)) q.aid = id.slice(2);\n    else if (/^[0-9]+$/.test(id)) q.aid = id;\n    else { q.bvid = id; }\n    var box = mk('div');\n    box.appendChild(status('解析视频信息…', 1));\n    setMain(box);\n    api('view', q, function (j) {\n      if (j.code !== 0) { setMain(status(j.message || '视频信息获取失败')); return; }\n      renderVideo(j.data);\n    });\n  }\n  function renderVideo(v) {\n    VID.bv = v.bv; VID.pages = v.pages || []; VID.v = v; VID.cur = 0;\n    var hist = histOf(v.bv);\n    if (hist && num(hist.cid)) {\n      for (var i = 0; i < VID.pages.length; i++) if (VID.pages[i].cid === num(hist.cid)) { VID.cur = i; break; }\n    }\n    var box = mk('div');\n\n    /* 播放器 */\n    var plr = mk('div', 'plr');\n    videoEl = mk('video');\n    videoEl.setAttribute('playsinline', ''); videoEl.setAttribute('webkit-playsinline', '');\n    videoEl.setAttribute('preload', 'metadata'); videoEl.poster = v.pic || '';\n    videoEl.style.display = 'block';\n    plr.appendChild(videoEl);\n    dmz = mk('div', null); dmz.id = 'dmz';\n    dmCv = mk('canvas'); dmz.appendChild(dmCv);\n    plr.appendChild(dmz);\n    var ctl = mk('div', 'ctl');\n    ctl.innerHTML =\n      '<div class=\"bar2\" id=\"pd\"><i></i><b style=\"left:0\"></b></div>' +\n      '<div class=\"btns\">' +\n      '<button id=\"bp\">▶ 播放</button>' +\n      '<button id=\"bdm\"' + (SET.dm ? ' class=\"on\"' : '') + '>' + (SET.dm ? '弹幕 开' : '弹幕 关') + '</button>' +\n      '<button id=\"bq\">720P</button>' +\n      '<button id=\"bfs\">全屏</button>' +\n      '<button id=\"bh\">历史位置</button>' +\n      '<span class=\"tm num\" id=\"ptm\">0:00 / --</span>' +\n      '</div>';\n    plr.appendChild(ctl);\n    box.appendChild(plr);\n\n    /* 标题区 */\n    var hd = mk('div', 'vhd');\n    hd.innerHTML = '<h1>' + esc(v.title) + '</h1><div class=\"sub\"><span>播放 <b class=\"num\">' + count(v.view) +\n      '</b></span><span>弹幕 <b class=\"num\">' + count(v.dan) + '</b></span><span>评论 <b class=\"num\">' + count(v.reply) +\n      '</b></span><span>' + esc(v.pubtxt) + '</span><span class=\"chip\">' + esc(v.tname) + '</span></div>';\n    box.appendChild(hd);\n    var who = mk('div', 'who');\n    who.innerHTML = '<img src=\"' + esc(v.face) + '\" alt=\"\"><div class=\"n\">' + esc(v.up) +\n      '</div><div class=\"s\">共 ' + v.videos + ' 个分 P · 投稿于 ' + esc(v.pubtxt) + (v.pid ? '' : '') + '</div>';\n    box.appendChild(who);\n\n    /* 简介 */\n    if (v.desc) {\n      var sec = mk('div', 'sec');\n      sec.innerHTML = '<h3>简介</h3>';\n      var d = mk('div'); d.style.cssText = 'padding:8px 10px;font-size:13px;line-height:20px;white-space:pre-wrap;word-break:break-all;color:#454c54';\n      d.innerHTML = esc(v.desc.slice(0, 1500));\n      sec.appendChild(d); box.appendChild(sec);\n    }\n    /* 分 P */\n    if (VID.pages.length > 1) {\n      var sp = mk('div', 'sec');\n      sp.innerHTML = '<h3>选集 <span class=\"num\" style=\"float:right\">' + VID.pages.length + ' P</span></h3>';\n      var w = mk('div', 'plist');\n      for (var k = 0; k < VID.pages.length; k++) {\n        var a = mk('a', k === VID.cur ? 'on' : '');\n        a.href = 'javascript:void(0)';\n        a.innerHTML = '<i class=\"num\">' + esc(VID.pages[k].dur || '') + '</i><span>P' + VID.pages[k].idx + ' · ' + esc(VID.pages[k].part) + '</span>';\n        (function (ix) { a.onclick = function () { pickPart(ix); }; })(k);\n        w.appendChild(a);\n      }\n      sp.appendChild(w); box.appendChild(sp);\n    }\n    /* 标签 */\n    api('tags', { bvid: v.bv, aid: v.aid }, function (j) {\n      if (j.code !== 0 || !j.data || !j.data.length) return;\n      var s2 = mk('div', 'sec'), h2 = mk('div');\n      for (var i2 = 0; i2 < j.data.length; i2++) {\n        var c = mk('a', 'chip', esc(j.data[i2]));\n        c.href = '#/search/' + encodeURIComponent(j.data[i2]);\n        h2.appendChild(c);\n      }\n      s2.innerHTML = '<h3>标签</h3>'; s2.appendChild(h2);\n      box.insertBefore(s2, csec);\n    });\n    /* 评论 */\n    var csec = mk('div', 'sec');\n    csec.innerHTML = '<h3>评论 <span class=\"num\" style=\"float:right\">' + count(v.reply) + '</span></h3>';\n    var cw = mk('div'); cw.appendChild(status('加载评论', 1));\n    csec.appendChild(cw);\n    box.appendChild(csec);\n    api('reply', { oid: v.aid, next: 0 }, function (j) {\n      cw.innerHTML = '';\n      if (j.code !== 0) { cw.appendChild(status(why(j) + '（部分视频的评论接口不对外）')); return; }\n      var items = (j.data && j.data.items) || [];\n      if (!items.length) { cw.appendChild(status('还没有评论')); return; }\n      for (var i3 = 0; i3 < items.length; i3++) {\n        var r = items[i3], el = mk('div', 'cm' + (r.top ? ' top' : ''));\n        el.innerHTML = '<img src=\"' + esc(r.face) + '\" alt=\"\"><div class=\"bd\"><div class=\"un\"><b>' + esc(r.un) +\n          '</b> · Lv' + r.lv + ' · ' + esc(r.time) + '</div><div class=\"ms\">' + esc(r.msg) + '</div></div>' +\n          '<div class=\"lk num\">' + count(r.like) + '<br>赞</div>';\n        cw.appendChild(el);\n      }\n    });\n    /* 相关推荐 */\n    var rsec = mk('div', 'sec');\n    rsec.innerHTML = '<h3>接下来看</h3>';\n    var rw = mk('div'); rw.appendChild(status('加载中', 1));\n    rsec.appendChild(rw); box.appendChild(rsec);\n    api('related', { bvid: v.bv }, function (j) {\n      rw.innerHTML = '';\n      if (j.code !== 0 || !j.data || !j.data.length) { rw.appendChild(status('这个视频没有相关推荐')); return; }\n      rw.appendChild(grid(j.data.slice(0, 12)));\n    });\n\n    setMain(box);\n    bindPlayer(ctl, v);\n    dmApplyOpts();                                    // 按当前设置校准弹幕按钮与循环\n    pickPart(VID.cur, hist);\n  }\n  function pickPart(ix, hist) {\n    var p = VID.pages[ix];\n    if (!p) return;\n    VID.cur = ix; var v = VID.v;\n    var links = document.querySelectorAll('.plist a'), i;\n    for (i = 0; i < links.length; i++) { if (i === ix) addC(links[i], 'on'); else delC(links[i], 'on'); }\n    $('#bq') && ($('#bq').innerHTML = '切换中…');\n    dmStop();\n    get('/play?bvid=' + encodeURIComponent(v.bv) + '&cid=' + p.cid + '&qn=' + SET.qn, function (err, txt) {\n      var j;\n      try { j = JSON.parse(txt); } catch (e) { j = { code: -1, message: err || '返回异常' }; }\n      if (j.code !== 0) {\n        alert('播放地址获取失败：\\n' + (why(j) || err || '') + '\\n\\n可以试试：换一页 / 降低清晰度 / 该视频可能是会员或付费内容。');\n        return;\n      }\n      VID.cid = p.cid;\n      VID.seg = j.data;\n      var q = $('#bq');\n      if (q) q.innerHTML = (j.data.qname || (j.data.quality + '')) + (j.data.need ? '（已降级）' : '');\n      videoEl.src = j.data.src;\n      videoEl.load();\n      VID.resume = 0;\n      if (hist && num(hist.cid) === p.cid && num(hist.pos) > 5) VID.resume = num(hist.pos);\n      var t = $('#bh');\n      if (t) { t.innerHTML = VID.resume ? '已续 ' + fmt(VID.resume) : '回到上次位置'; t.style.color = VID.resume ? '#f3b7d3' : ''; }\n      if (SET.dm) dmLoad(p.cid);\n      if (SET.auto && !VID.resume) { tryPlay(videoEl) }\n      pushHist({ bv: v.bv, aid: v.aid, title: v.title, pic: v.pic, up: v.up, dur: (p.dur || v.dur), view: v.view, cid: p.cid, part: p.part, pos: 0 });\n    });\n  }\n  function bindPlayer(ctl, v) {\n    var pd = $('#pd'), bar = pd.querySelector('i'), knob = pd.querySelector('b');\n    var bp = $('#bp'), ptm = $('#ptm');\n    function syncBar() {\n      var d = videoEl.duration || 0, c = videoEl.currentTime || 0;\n      var pct = d ? Math.min(100, c / d * 100) : 0;\n      bar.style.width = pct + '%'; knob.style.left = pct + '%';\n      ptm.innerHTML = fmt(c) + ' / ' + (d ? fmt(d) : (v.dur || '--'));\n    }\n    var lastSave = 0;\n    videoEl.onseeking = function () { if (videoEl.__t !== undefined && Math.abs(videoEl.currentTime - videoEl.__t) > 2) dmReset(); videoEl.__t = videoEl.currentTime; };\n    videoEl.ontimeupdate = function () { videoEl.__t = videoEl.currentTime; syncBar(); var t = videoEl.currentTime | 0; if (t - lastSave >= 5) { lastSave = t; if (VID.bv && t > 3) updHist(VID.bv, t, VID.cid); } };\n    videoEl.onprogress = syncBar;\n    videoEl.onloadedmetadata = function () {\n      syncBar(); dmSize();\n      if (VID.resume > 5) { try { videoEl.currentTime = VID.resume; } catch (e) { } VID.resume = 0; }\n      if (!dmRun && SET.dm && VID.cid) dmLoad(VID.cid);\n    };\n    videoEl.onplay = function () { bp.innerHTML = '❚❚ 暂停'; if (SET.dm) dmStart(); };\n    videoEl.onpause = function () { bp.innerHTML = '▶ 播放'; dmStop(); save(); };\n    videoEl.onended = function () {\n      save();\n      if (SET.auto && VID.cur + 1 < VID.pages.length) pickPart(VID.cur + 1);\n    };\n    videoEl.onerror = function () {\n      var e = videoEl.error;\n      var code = e ? e.code : 0;\n      var msg = { 1: '加载被中止（可能是点了暂停）', 2: '网络中断：拖动或重连', 3: '解码失败：这台设备可能不支持该编码', 4: '直链不支持：换 480P/360P 试试' }[code] || ('错误 ' + code);\n      bp.innerHTML = '▶ 重试';\n      if (!VID._er) { VID._er = 1; alert('播放出错：' + msg + '\\n\\n（该视频的直链可能已过期，重新点播放会重新取地址）'); }\n    };\n    bp.onclick = function () {\n      VID._er = 0;\n      if (videoEl.paused) {\n        if (!videoEl.src && VID.seg) pickPart(VID.cur);\n        tryPlay(videoEl);\n      } else { try{videoEl.pause()}catch(e){} }\n    };\n    function seek(e) {\n      var t = e.touches && e.touches[0] ? e.touches[0] : e;\n      var r = pd.getBoundingClientRect();\n      var p2 = Math.max(0, Math.min(1, (t.clientX - r.left) / r.width));\n      if (videoEl.duration) { videoEl.currentTime = p2 * videoEl.duration; syncBar(); }\n      try { e.preventDefault(); } catch (err) { }\n    }\n    pd.onclick = seek;\n    pd.ontouchstart = seek;\n    $('#bdm').onclick = function () {\n      SET.dm = SET.dm ? 0 : 1; saveSet();\n      this.innerHTML = SET.dm ? '弹幕 开' : '弹幕 关';\n      if (SET.dm) addC(this, 'on'); else delC(this, 'on');\n      dmApplyOpts();\n    };\n    $('#bq').onclick = function () {\n      var opts = (VID.seg && VID.seg.formats) || [];\n      if (!opts.length) { alert('这个视频只提供了一个清晰度'); return; }\n      var txt = '当前：' + (VID.seg.qname || '') + '\\n可切换：\\n';\n      for (var i = 0; i < opts.length; i++) txt += (i + 1) + '. ' + opts[i].name + ' (' + opts[i].qn + ')\\n';\n      txt += '\\n输入序号切换（未登录时更高清晰度会被 B站降级）';\n      var k = prompt(txt, '');\n      if (!k) return;\n      var o = opts[num(k) - 1];\n      if (!o) return;\n      SET.qn = o.qn; saveSet();\n      VID.seg = null;\n      pickPart(VID.cur, histOf(VID.bv));\n    };\n    $('#bfs').onclick = function () {\n      var el = document.querySelector('.plr');\n      if (el.requestFullscreen) { if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen(); }\n      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();\n      else if (videoEl.webkitEnterFullscreen) videoEl.webkitEnterFullscreen();\n      else alert('这台设备的浏览器不支持网页全屏，可以用设备自带的旋转/全屏按钮。');\n    };\n    $('#bh').onclick = function () {\n      var h = histOf(VID.bv);\n      if (!h || !num(h.pos)) { alert('本机没有这个视频的历史位置'); return; }\n      videoEl.currentTime = num(h.pos);\n      tryPlay(videoEl);\n    };\n    function save() { if (VID.bv && num(videoEl.currentTime) > 3) updHist(VID.bv, videoEl.currentTime, VID.cid); }\n    setInterval(save, 12000);\n    addEventListener('beforeunload', save);\n    videoEl.onclick = function () { if (videoEl.paused) { tryPlay(videoEl) } else { try{videoEl.pause()}catch(e){} } };\n  }\n\n  /* -------------------------------------------------- 弹幕（canvas，2.x WebView 友好） */\n  function dmSize() {\n    if (!dmCv) return;\n    var r = dmz.getBoundingClientRect();\n    dmCv.width = Math.max(160, r.width | 0);\n    dmCv.height = Math.max(90, r.height | 0);\n    dmCtx = dmCv.getContext ? dmCv.getContext('2d') : null;\n  }\n  function dmLoad(cid) {\n    if (!cid) return;\n    dmListReset(); lastFrame = 0;\n    get('/dm?cid=' + encodeURIComponent(cid), function (err, txt) {\n      if (err || !txt) return;\n      var doc = null;\n      try { doc = new DOMParser().parseFromString(txt, 'text/xml'); } catch (e) { }\n      if (!doc || !doc.getElementsByTagName || doc.getElementsByTagName('d').length === 0) {\n        var m = /<d p=\"([^\"]+)\">([^<]*)<\\/d>/g, one;\n        while ((one = m.exec(txt))) dmPush(one[1], one[2]);\n      } else {\n        var ns = doc.getElementsByTagName('d'), i;\n        for (i = 0; i < ns.length; i++) dmPush(ns[i].getAttribute('p'), ns[i].textContent || ns[i].innerHTML);\n      }\n      dmSort();\n      if (!videoEl.paused) dmStart();\n    });\n  }\n  function dmListReset() { dmList = []; dmQ = []; dmIdx = 0; lastFrame = 0; }\n  function dmPush(p, text) {\n    var a = String(p).split(',');\n    if (a.length < 5 || !text) return;\n    dmQ.push({ t: parseFloat(a[0]) || 0, mode: num(a[1]), size: num(a[2]) || 25, color: num(a[4]) || 16777215, txt: String(text).slice(0, 60) });\n  }\n  function dmSort() {\n    dmQ.sort(function (a, b) { return a.t - b.t; });\n    dmList = dmQ; dmIdx = 0;\n  }\n  function dmApplyOpts() {\n    if (!$('#bdm')) return;\n    var b = $('#bdm');\n    b.innerHTML = SET.dm ? '弹幕 开' : '弹幕 关';\n    if (SET.dm) addC(b, 'on'); else delC(b, 'on');\n    if (!SET.dm) dmStop();\n    else if (!dmRun && videoEl && !videoEl.paused) dmStart();\n  }\n  var raf = window.requestAnimationFrame ? function (f) { window.requestAnimationFrame(f); } : function (f) { setTimeout(f, 40); };\n  function dmStart() {\n    if (!SET.dm || !dmCtx || dmRun) return;\n    dmRun = 1;\n    loop();\n  }\n  function dmStop() { dmRun = 0; }\n  /* 进度回跳时重置游标与已展示标记，否则拖回去就再没有弹幕 */\n  function dmReset() {\n    dmIdx = 0;\n    for (var i = 0; i < dmList.length; i++) dmList[i].shown = 0;\n    if (dmCtx && dmCv) dmCtx.clearRect(0, 0, dmCv.width, dmCv.height);\n    if (SET.dm && videoEl && !videoEl.paused) dmStart();\n  }\n  /* 关键：弹幕表可能上万条，绝不能每帧从头扫（老设备会直接卡死）。\n     dmIdx 单调前移，每帧最多看 SCAN_CAP 条，画完就丢进 dmDone。 */\n  var SCAN_CAP = 160;\n  function dmVisible() {\n    if (!videoEl) return [];\n    var ct = videoEl.currentTime || 0;\n    var sp = num(SET.dmspeed) / 1 || 1;\n    if (sp < 0.2) sp = 0.2;\n    var win = 6 / sp;                       // 一条弹幕在屏上的秒数\n    while (dmIdx < dmList.length && dmList[dmIdx].t < ct - win - 1) dmIdx++;\n    var out = [], i, n = 0;\n    for (i = dmIdx; i < dmList.length && n < SCAN_CAP; i++, n++) {\n      var d = dmList[i];\n      if (d.t - ct > win) break;\n      if (d.t <= ct && !d.shown) { d.shown = 1; out.push(d); }\n      if (out.length >= 22) break;\n    }\n    return out;\n  }\n  var lastFrame = 0;\n  function loop() {\n    if (!dmRun) return;\n    var now = Date.now();\n    if (now - lastFrame < 40) {            // 限制到 ~25fps，与原版弹幕引擎一致\n      raf(loop); return;\n    }\n    lastFrame = now;\n    var w = dmCv.width, h = dmCv.height;\n    dmCtx.clearRect(0, 0, w, h);\n    if (SET.dm) {\n      var area = w * (num(SET.dmarea) || 100) / 100;\n      var list = dmVisible(), rows = Math.max(2, Math.floor(h / 22)), used = [], i;\n      dmCtx.textBaseline = 'top';\n      for (i = 0; i < list.length && i < 26; i++) {\n        var d = list[i], size = 13, tt = d.txt;\n        dmCtx.font = size + 'px sans-serif';\n        var tw = Math.ceil(dmCtx.measureText ? dmCtx.measureText(tt).width : tt.length * size);\n        var row = 0, sp = num(SET.dmspeed) / 1 || 1;\n        var prog = (videoEl.currentTime - d.t) * sp / 6;\n        if (prog < 0 || prog > 1) continue;\n        for (row = 0; row < rows; row++) if (!used[row]) break;\n        if (row >= rows) row = i % rows;\n        used[row] = 1;\n        var x = area * (1 - prog) - tw * prog;\n        var col = d.color >>> 0;\n        var op = (num(SET.dmop) || 100) / 100;\n        dmCtx.globalAlpha = op;\n        dmCtx.fillStyle = '#' + ('000000' + col.toString(16)).slice(-6);\n        dmCtx.strokeStyle = 'rgba(0,0,0,.55)';\n        dmCtx.lineWidth = 2;\n        var y = 2 + row * 21;\n        if (d.mode === 5) { dmCtx.fillText(tt, w - tw - 6, y); }\n        else {\n          try { dmCtx.strokeText(tt, x, y); } catch (e) { }\n          dmCtx.fillText(tt, x, y);\n        }\n        dmCtx.globalAlpha = 1;\n      }\n    }\n    raf(loop);\n  }\n\n  /* -------------------------------------------------- 启动 */\n  function boot() {\n    var tb = document.querySelectorAll('#tabs button,#tbar button'), i;\n    for (i = 0; i < tb.length; i++) {\n      tb[i].onclick = function () {\n        var v = this.getAttribute('data-v');\n        location.hash = v === 'home' ? '#/home/popular' : '#/' + v;\n      };\n    }\n    var sq = $('#sq'), sg = $('#sug'), timer = null;\n    function doSearch() {\n      var q = (sq.value || '').replace(/^\\s+|\\s+$/g, '');\n      sg.className = 'sug hide';\n      if (!q) return;\n      if (/^(BV[0-9A-Za-z]{8,14}|av[0-9]+|[0-9]{5,})$/i.test(q)) { location.hash = '#/video/' + encodeURIComponent(q); sq.blur(); return; }\n      location.hash = '#/search/' + encodeURIComponent(q);\n      sq.blur();\n    }\n    $('#sgo').onclick = doSearch;\n    sq.onkeypress = function (e) { e = e || window.event; if (e.keyCode === 13) doSearch(); };\n    function sug() {\n      var q = (sq.value || '').replace(/^\\s+|\\s+$/g, '');\n      if (!q || q.length > 30) { sg.className = 'sug hide'; return; }\n      api('square', { q: q }, function (j) { });\n      get('/api?ep=search&keyword=' + encodeURIComponent(q) + '&page_size=8', function (err, txt) {\n        var j = null; try { j = JSON.parse(txt); } catch (e) { }\n        var items = (j && j.code === 0 && j.data) ? j.data.slice(0, 7) : [];\n        if (!items.length) { sg.className = 'sug hide'; return; }\n        var html = '', i;\n        for (i = 0; i < items.length; i++) {\n          var tt = String(items[i].title).replace(/<[^>]*>/g, '');\n          html += '<div data-k=\"' + esc(tt.slice(0, 40)).replace(/\"/g, '') + '\">' + esc(tt.slice(0, 40)) + '</div>';\n        }\n        sg.innerHTML = html;\n        sg.className = 'sug';\n        var ds = sg.getElementsByTagName('div');\n        for (i = 0; i < ds.length; i++) {\n          ds[i].onclick = function () {\n            sq.value = this.getAttribute('data-k'); sg.className = 'sug hide';\n            location.hash = '#/search/' + encodeURIComponent(sq.value);\n          };\n        }\n      });\n    }\n    sq.onkeyup = function () {\n      clearTimeout(timer);\n      timer = setTimeout(sug, 320);\n    };\n    sq.onfocus = function () { if (sq.value) sug(); };\n    document.onclick = function (e) {\n      var t = e.target || e.srcElement;\n      if (t && (t.id === 'sq' || t.id === 'sgo' || (t.parentNode && t.parentNode.className === 'sug'))) return;\n      sg.className = 'sug hide';\n    };\n    var onrz = function () { dmSize(); };\n    if (window.addEventListener) { window.addEventListener('resize', onrz, false); window.addEventListener('orientationchange', onrz, false); }\n    addEventListener('hashchange', route);\n    try {\n      get('/health', function (err, txt) {\n        var j = null; try { j = JSON.parse(txt); } catch (e) { }\n        if (j && j.code === 0 && j.data && !j.data.md5) {\n          document.body.appendChild(mk('div', 'hint', '⚠ Worker 内置 MD5 未就绪，部分需要签名的接口会不可用。'));\n        }\n      });\n    } catch (e) { }\n    route();\n  }\n  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(boot, 0);\n  else addEventListener('DOMContentLoaded', boot);\n})();\n\n</script>\n</body>\n</html>\n";

/* ---------------------------------------------------------------- 配置 */
var CFG = {
  VER: '1.0.1-bl1',
  UA_DESK: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  REF: 'https://www.bilibili.com/',
  QN_MAX_ANON: 64,
  QN_NAME: { 6: '240P', 16: '360P', 32: '480P', 64: '720P', 74: '720P 60帧', 80: '1080P', 112: '1080P 高码率', 116: '1080P60', 120: '4K', 125: 'HDR', 126: '杜比视界', 127: '8K' },
  TTL_MEDIA: 10800, TTL_API: 60, TTL_DM: 600, TTL_NAV: 10800,
};

var MIXIN = [46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17,
  0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52];

/* 排行榜分区：全部实测 code=0（13/17/165/203 会 -400，已剔除） */
var RIDS = [
  [0, '全站'], [1, '动画'], [3, '音乐'], [4, '游戏'], [5, '娱乐'],
  [11, '电视剧'], [23, '电影'], [129, '舞蹈'], [155, '时尚'],
  [160, '生活'], [188, '科技'], [217, '宠物'], [234, '运动'],
];

/* ---------------------------------------------------------------- 小工具 */
function num(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var n = parseInt(String(v == null ? '' : v).replace(/,/g, ''), 10);
  return isNaN(n) ? 0 : n;
}
function enc(s) {
  return encodeURIComponent(String(s)).replace(/!/g, '%21').replace(/'/g, '%27')
    .replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\*/g, '%2A');
}
function strip(s, n) {
  var t = String(s == null ? '' : s).replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, function (m, d) { var c = +d; return (c > 0 && c < 1114112) ? String.fromCharCode(c) : ''; })
    .replace(/\s+/g, ' ').trim();
  n = n || 160;
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function dur(v) {
  if (typeof v === 'string' && /^[0-9:]+$/.test(v)) return v;
  var s = num(v); if (!s) return '';
  var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return (h ? h + ':' + pad2(m) : String(m)) + ':' + pad2(x);
}
/** 封面/头像不能直连：hdslb 有防盗链（实测 127.0.0.1 页面里全 403 + ORB 拦截），
 *  所以改走本站 /img 转发。只允许 i0..i2/avatar.hdslb.com + 固定路径格式，
 *  不给签名也能保持“不是开放代理”。 */
function pic(u, size) {
  if (!u) return '';
  var s = String(u).replace(/^http:/, 'https:').replace(/^\/\//, 'https://');
  var m = s.match(/^https:\/\/((?:i[0-9]|avatar)\.hdslb\.com)\/(bfs\/[A-Za-z0-9_.\/-]+\.(?:jpg|jpeg|png|webp|gif))(@[0-9a-zA-Z._-]+)?(?:\?[^\s]*)?$/i);
  if (!m) return '';
  var host = m[1], path = m[2] + (m[3] || '');
  if (path.indexOf('@') < 0 && !/\.gif$/i.test(path)) path += '@' + (size || '480w_300h_1c.webp');
  var h = host.split('.')[0];
  return '/img?h=' + encodeURIComponent(h) + '&f=' + encodeURIComponent('/' + path);
}
function imgProxyable(hostKey, path) {
  var h = String(hostKey || '');
  if (!/^(i[0-9]|avatar)$/.test(h)) return null;
  if (path.indexOf('..') >= 0 || path.indexOf('//') === 0) return null;
  /* 允许 pic() 附加的 @宽w_高h_1c.webp 尺寸指令（B站图片 CDN 语法） */
  if (!/^\/bfs\/[A-Za-z0-9_.\/-]+\.(jpg|jpeg|png|webp|gif)(@[0-9a-zA-Z._-]+)?$/i.test(path)) return null;
  return 'https://' + h + '.hdslb.com' + path;
}
function ago(ts) {
  var s = Math.max(0, Math.floor(Date.now() / 1000) - num(ts));
  if (!ts) return '';
  if (s < 3600) return Math.max(1, Math.floor(s / 60)) + ' 分钟前';
  if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
  if (s < 86400 * 30) return Math.floor(s / 86400) + ' 天前';
  var d = new Date(num(ts) * 1000);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

/* ---------------------------------------------------------------- WBI */
function bname(u) { var s = String(u).slice(String(u).lastIndexOf('/') + 1); return s.split('.')[0]; }
function mixinKey(a, b) {
  var raw = a + b, o = '';
  for (var i = 0; i < 32; i++) o += raw.charAt(MIXIN[i]);
  return o;
}
var nav = { key: '', at: 0 };

/* A/B 实测：头太素（只 UA、或 UA+referer）会 -352；GET 带 origin: https://www.bilibili.com
   也会 -352。所以这里给一套自洽的“浏览器 GET”头，并且坚决不发 origin。 */
var BUVID = '', BNU_T = String(Math.floor(Date.now() / 1000)), buvidAt = 0;
var CK = '';   /* biliLight-patch: env.BILI_COOKIE 缓存值，随每个上游请求带上（README 声明的行为） */
function hApi() {
  var h = {
    'user-agent': CFG.UA_DESK,
    referer: CFG.REF,
    accept: 'application/json, text/plain, */*',
    'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-site',
  };
  if (CK || BUVID) {
    var ck = [];
    if (CK) ck.push(CK);
    if (BUVID) ck.push('buvid3=' + BUVID, 'b_nut=' + BNU_T);
    h.cookie = ck.join('; ');
  }
  return h;
}
function hImg() {
  return {
    'user-agent': CFG.UA_DESK, referer: CFG.REF,
    accept: 'image/webp,image/apng,image/*,*/*;q=0.8', 'accept-language': 'zh-CN,zh;q=0.9',
    'sec-fetch-dest': 'image', 'sec-fetch-mode': 'no-cors', 'sec-fetch-site': 'cross-site',
  };
}
/* 匿名指纹：x/frontend/finger/spa 已 404，只能从首页 Set-Cookie 自举（实测可拿到） */
async function ensureBuvid(force) {
  var now = Date.now();
  if (!force && BUVID && now - buvidAt < 3600 * 1000) return BUVID;
  try {
    var hd = {
      'user-agent': CFG.UA_DESK,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'accept-language': 'zh-CN,zh;q=0.9',
    };
    if (CK) hd.cookie = CK;   /* biliLight-patch: 自举也带上登录 cookie，与浏览器形态一致 */
    var r = await fetch('https://www.bilibili.com/', { headers: hd });
    var sc = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie().join('|') : (r.headers.get('set-cookie') || '');
    var m = sc.match(/buvid3=([^;]+)/);
    if (m) { BUVID = decodeURIComponent(m[1]); buvidAt = now; BNU_T = String(Math.floor(now / 1000)); }
  } catch (e) { /* 拿不到就裸请求 */ }
  return BUVID;
}

async function wbiKey() {
  var now = Date.now();
  if (nav.key && now - nav.at < CFG.TTL_NAV * 1000) return nav.key;
  try {
    var j = await getText('https://api.bilibili.com/x/web-interface/nav', true).then(function (t) { return JSON.parse(t); });
    var w = j && j.data && j.data.wbi_img;
    if (!w || !w.img_url || !w.sub_url) return nav.key;
    var k = mixinKey(bname(w.img_url), bname(w.sub_url));
    if (k.length === 32) nav = { key: k, at: now };
    return k;
  } catch (e) { return nav.key; }
}

/* ---------------------------------------------------------------- 上游取数（带边缘缓存） */
async function getText(url, noCache, kind) {
  var hit = null;
  if (!noCache && typeof caches !== 'undefined' && caches.default) {
    try {
      hit = await caches.default.match(new Request(url, { headers: hApi() }));
      if (hit) {
        var age = num(hit.headers.get('x-bl-age'));
        var ttl = kind === 'xml' ? CFG.TTL_DM : CFG.TTL_API;
        if (age && Date.now() - age < ttl * 1000) return await hit.text();
      }
    } catch (e) { hit = null; }
  }
  var r = await fetch(url, { headers: hApi() });
  var text = await r.text();                       // Workers 自动解 gzip
  if (text.indexOf('"code":-352"') >= 0 || text.indexOf('"code":-412"') >= 0) {
    /* 风控：补一次匿名指纹再试；仍失败则把原错误交给前端翻译 */
    await ensureBuvid(true);
    r = await fetch(url, { headers: hApi() });
    text = await r.text();
  }
  /* biliLight-patch: 风控错误(HTTP 200 + code:-352/-412)不落边缘缓存，避免把封禁固化 TTL 时长 */
  var banned = text.indexOf('"code":-352"') >= 0 || text.indexOf('"code":-412"') >= 0;
  if (!banned && !noCache && typeof caches !== 'undefined' && caches.default && r.status === 200 && text) {
    try {
      await caches.default.put(new Request(url, { headers: hApi() }), new Response(text, {
        headers: { 'content-type': kind === 'xml' ? 'text/xml; charset=utf-8' : 'application/json; charset=utf-8', 'x-bl-age': String(Date.now()) },
      }));
    } catch (e) { }
  }
  return text;
}
async function getJson(url, noCache) {
  var t = await getText(url, noCache, 'json');
  try { return JSON.parse(t); } catch (e) { return { code: -1, message: '上游返回非 JSON（HTTP 层异常）' }; }
}

/* ---------------------------------------------------------------- 端点白名单 */
/* sig=需要 WBI；nocache=不缓存；pick=归一化 */
var EP = {
  popular: { u: 'https://api.bilibili.com/x/web-interface/popular', d: { ps: 20 }, pick: function (j) { return cards((j.data && (j.data.list || j.data.items)) || []); } },
  rank: { u: 'https://api.bilibili.com/x/web-interface/ranking/v2', d: { type: 'all' }, pick: function (j) { return cards((j.data && j.data.list) || []); } },
  search: { u: 'https://api.bilibili.com/x/web-interface/wbi/search/type', sig: 1, nocache: 1, d: { search_type: 'video', page_size: 30 }, pick: function (j) { return cards((j.data && j.data.result) || [], 1); } },
  square: { u: 'https://api.bilibili.com/x/web-interface/wbi/search/square', d: { limit: 10 }, pick: function (j) { return hot(j.data); } },
  view: { u: 'https://api.bilibili.com/x/web-interface/view', pick: function (j) { return one(j.data); } },
  related: { u: 'https://api.bilibili.com/x/web-interface/archive/related', pick: function (j) { return cards(j.data || []); } },
  tags: { u: 'https://api.bilibili.com/x/tag/archive/tags', pick: function (j) { return (j.data || []).map(function (t) { return strip(t.tag_name, 30); }).filter(Boolean).slice(0, 12); } },
  reply: { u: 'https://api.bilibili.com/x/v2/reply/main', d: { type: 1, mode: 3, ps: 20 }, pick: function (j) { return replies(j.data); } },
  playurl: { u: 'https://api.bilibili.com/x/player/playurl', nocache: 1, d: { fnval: 1, fnver: 0, fourk: 1, platform: 'html5', high_quality: 1 } },
};

function cards(arr, isSearch) {
  var out = [];
  for (var i = 0; i < (arr || []).length; i++) {
    var it = arr[i]; if (!it) continue;
    var st = it.stat || {};
    out.push({
      bv: it.bvid || '', aid: num(it.aid || it.id),
      title: strip(it.title, 160), pic: pic(it.pic || it.cover || it.pic_url),
      up: (it.owner && it.owner.name) || it.author || it.upname || '',
      view: num(isSearch ? it.play : (st.view != null ? st.view : it.play)),
      dan: num(isSearch ? it.danmaku : (st.danmaku != null ? st.danmaku : it.danmaku_view)),
      dur: dur(isSearch ? it.duration : (it.duration_text || it.duration)),
      pub: num(it.pubdate || it.senddate || it.stime),
      desc: isSearch ? strip(it.description, 130) : '',
    });
  }
  return out;
}
function partsOf(arr) {
  return (arr || []).map(function (p) {
    return { cid: num(p.cid), part: strip(p.part, 80), dur: dur(p.duration), idx: num(p.page) };
  });
}
function one(d) {
  if (!d) return null;
  var st = d.stat || {}, o = d.owner || {}, ps = partsOf(d.pages);
  return {
    bv: d.bvid || '', aid: num(d.aid), cid: num((ps[0] || {}).cid || d.cid),
    title: strip(d.title, 200), desc: String(d.desc || '').slice(0, 2000), pic: pic(d.pic, '960w_600h_1c.webp'),
    up: strip(o.name, 40), mid: num(o.mid), face: pic(o.face, '96w_96h_1c.webp'),
    view: num(st.view), dan: num(st.danmaku), reply: num(st.reply), like: num(st.like),
    coin: num(st.coin), fav: num(st.favorite), share: num(st.share),
    pub: num(d.pubdate), pubtxt: ago(d.pubdate), dur: dur(d.duration),
    tname: strip(d.tname, 20), pages: ps, videos: num(d.videos) || ps.length,
    pay: num(d.rights && d.rights.pay), ugcPay: num(d.ugc_pay), tm: num((d.pages && d.pages[0] && d.pages[0].dimension && d.pages[0].dimension.height) || 0),
  };
}
function replies(d) {
  var out = [], src = [], top = d && d.upper && d.upper.top;
  if (top) src.push(top);
  src = src.concat((d && d.replies) || []);
  for (var i = 0; i < src.length; i++) {
    var r = src[i]; if (!r) continue;
    out.push({
      un: strip(r.member && r.member.uname, 40), face: pic(r.member && r.member.avatar, '64w_64h_1c.webp'),
      msg: strip(r.content && r.content.message, 600), like: num(r.like), cnt: num(r.rcount),
      time: ago(r.ctime), lv: num(r.member && r.member.level_rank), top: top && r === top ? 1 : 0,
    });
  }
  return { total: num(d && d.cursor && d.cursor.all_count), next: num(d && d.cursor && d.cursor.next_pager), items: out };
}
/* 实测结构：data.trending.list[{keyword,show_name,icon,heat_score}]（one_key 已不存在） */
function hot(d) {
  var out = [], src = [], i;
  var tr = d && d.trending;
  if (tr && Array.isArray(tr.list)) src = tr.list;
  else if (tr && Array.isArray(tr.hotword)) src = tr.hotword;
  else if (Array.isArray(d && d.list)) src = d.list;
  for (i = 0; i < Math.min(src.length, 12); i++) {
    var it = src[i] || {};
    var txt = it.keyword || it.show_name || it.main || it.value || (typeof it === 'string' ? it : '');
    txt = strip(txt, 40);
    if (txt) out.push({ main: txt, icon: pic(it.icon, '48w_48h_1c.webp') });
  }
  return out;
}

/* ---------------------------------------------------------------- 请求签名 URL */
async function apiCall(name, params, forceSign) {
  var spec = EP[name];
  if (!spec) return { code: -1, message: '未知端点：' + name };
  var q = {}, k;
  for (k in spec.d) q[k] = spec.d[k];
  for (k in params) if (params[k] !== undefined && params[k] !== null && params[k] !== '') q[k] = params[k];
  var signed = false;
  var qs;
  if ((spec.sig || forceSign)) {
    var key = await wbiKey();
    if (key) {
      q.wts = String(Math.floor(Date.now() / 1000));
      var norm = {}, ks = Object.keys(q).sort();
      for (var i = 0; i < ks.length; i++) norm[ks[i]] = String(q[ks[i]]).replace(/[!'()*]/g, '');
      var s = ks.map(function (kk) { return enc(kk) + '=' + enc(norm[kk]); }).join('&');
      qs = s + '&w_rid=' + md5hex(s + key);
      signed = true;
    }
  }
  if (!qs) qs = Object.keys(q).sort().map(function (kk) { return enc(kk) + '=' + enc(q[kk]); }).join('&');
  var j = await getJson(spec.u + '?' + qs, !!spec.nocache);
  if (j && j.code === 0 && spec.pick) j = { code: 0, data: spec.pick(j), signed: signed ? 1 : 0 };
  else if (j && j.code !== 0) j = { code: j.code, message: String(j.message || j.msg || '接口返回异常').slice(0, 120) };
  return j;
}

/* ---------------------------------------------------------------- 播放地址 */
async function resolvePlay(q, env) {
  var bv = String(q.bvid || q.bv || '').slice(0, 20);
  var cid = num(q.cid), aid = num(q.aid), qn = num(q.qn);
  var hasCookie = !!(env && env.BILI_COOKIE);
  var max = (env && num(env.QN_MAX)) || CFG.QN_MAX_ANON;
  if (!hasCookie) max = Math.min(max, CFG.QN_MAX_ANON);
  if (!qn || qn > max) qn = max;
  if (!cid && !bv && !aid) return { code: -1, message: '缺少视频参数' };
  if (!cid) {
    var v = await apiCall('view', { bvid: bv, aid: aid });
    if (v.code !== 0) return v;
    cid = num(v.data.cid);
    if (!v.data.pages.length) return { code: -2, message: '这个视频没有可播的分 P' };
  }
  var p = await apiCall('playurl', { bvid: bv, aid: aid, cid: cid, qn: qn });
  if (p.code !== 0) return p;
  var d = p.data || {};
  var seg = (d.durl || [])[0];
  var urls = seg ? [seg.url].concat(seg.backup_url || []) : [];
  urls = urls.filter(function (u) { return typeof u === 'string' && /^https?:/i.test(u); });
  if (!urls.length) return { code: -3, message: '没有可直连的 mp4（付费/会员/版权限制）' };
  var fmts = (d.support_formats || []).filter(function (f) { return num(f.quality) > 0 && num(f.quality) <= max; })
    .map(function (f) {
      return {
        qn: num(f.quality),
        name: String(f.display_desc || f.new_description || f.description || CFG.QN_NAME[num(f.quality)] || '').replace(/\s+/g, ' ').trim(),
        vip: num(f.need_vip) ? 1 : 0,
      };
    })
    .sort(function (a, b) { return b.qn - a.qn; });
  return {
    code: 0, data: {
      cid: num(d.cid) || cid, quality: num(d.quality), qname: CFG.QN_NAME[num(d.quality)] || '',
      sizeMB: Math.round(num(seg.size) / 1048576 * 10) / 10, sec: Math.round(num(seg.length || d.timelength) / 1000),
      src: await mediaUrl(urls, env), fallbacks: urls.length, formats: fmts,
      video_codecs: (d.video_codecs || []).map(function (c) { return c.width + 'x' + c.height + ' ' + c.codecs; }).slice(0, 4),
      need: num(d.quality) < qn ? 1 : 0,
    },
  };
}

/* ---------------------------------------------------------------- 媒体令牌（避免变成开放代理） */
async function hmacKey(env) {
  var secret = (env && env.SECRET) || 'bililight-v1';
  return await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
function b64(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64(s) {
  var t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  return decodeURIComponent(escape(atob(t)));
}
async function sigOf(msg, env) {
  var b = await crypto.subtle.sign('HMAC', await hmacKey(env), new TextEncoder().encode(msg));
  return b64(String.fromCharCode.apply(null, new Uint8Array(b)));
}
async function mediaUrl(urls, env) {
  var exp = Math.floor(Date.now() / 1000) + CFG.TTL_MEDIA;
  var body = b64(JSON.stringify(urls.slice(0, 4)));
  return '/m?e=' + exp + '&u=' + encodeURIComponent(body) + '&s=' + encodeURIComponent(await sigOf(exp + '|' + body, env));
}
async function mediaRead(params, env) {
  var exp = num(params.get('e')), body = params.get('u') || '', s = params.get('s') || '';
  if (!exp || !body) return null;
  if (exp < Math.floor(Date.now() / 1000)) return null;
  if (s !== await sigOf(exp + '|' + body, env)) return null;
  var urls;
  try { urls = JSON.parse(unb64(body)); } catch (e) { return null; }
  if (!Array.isArray(urls) || !urls.length) return null;
  for (var i = 0; i < urls.length; i++) {
    var h;
    try { h = new URL(urls[i]).hostname; } catch (e) { return null; }
    if (!/(^|\.)(bilivideo\.(com|cn)|upbilibres\.clpyun\.com|mcdnbta\.com|bilitile\.com|uphoscxacp\.com|bilivideo\.moe|bas.bilibili\.com|hdslb\.com)$/i.test(h)) return null;
  }
  return urls;
}

/* ---------------------------------------------------------------- 媒体转发 */
async function serveMedia(params, request, env) {
  var urls = await mediaRead(params, env);
  if (!urls) return new Response('bad token', { status: 403, headers: { 'content-type': 'text/plain' } });
  var hdrs = { 'user-agent': CFG.UA_DESK, referer: CFG.REF, 'accept-encoding': 'identity' };
  var rng = request.headers.get('range');
  if (rng) hdrs.range = rng;
  var r = null, err = '';
  for (var i = 0; i < urls.length && !r; i++) {
    try { r = await fetch(urls[i], { headers: hdrs, redirect: 'follow' }); }
    catch (e) { err = String(e && e.message || e).slice(0, 60); }
    if (r && r.status >= 500) { var bad = r; r = null; err = 'CDN ' + bad.status; }
  }
  if (!r) return new Response('media fetch failed: ' + err, { status: 502, headers: { 'content-type': 'text/plain' } });
  var h = new Headers();
  h.set('content-type', r.headers.get('content-type') || 'video/mp4');
  h.set('accept-ranges', 'bytes');
  h.set('cache-control', 'private, max-age=0, must-revalidate');
  h.set('access-control-allow-origin', '*');
  h.set('x-content-type-options', 'nosniff');
  ['content-length', 'content-range', 'last-modified', 'etag'].forEach(function (k) {
    var v = r.headers.get(k); if (v) h.set(k, v);
  });
  return new Response(r.body, { status: r.status, headers: h });
}

async function serveImg(params, env) {
  var u = imgProxyable(params.get('h'), params.get('f'));
  if (!u) return new Response('bad', { status: 400, headers: { 'content-type': 'text/plain' } });
  try {
    var r = await fetch(u, { headers: hImg() });
    if (!r.ok) return new Response('', { status: 404 });
    var h = new Headers();
    h.set('content-type', r.headers.get('content-type') || 'image/webp');
    h.set('cache-control', 'public, max-age=86400, immutable');
    h.set('access-control-allow-origin', '*');
    h.set('x-content-type-options', 'nosniff');
    return new Response(r.body, { status: 200, headers: h });
  } catch (e) { return new Response('', { status: 502 }); }
}

/* ---------------------------------------------------------------- 弹幕 */
async function serveDm(params) {
  var cid = num(params.get('cid'));
  if (!cid) return new Response('<?xml version="1.0" encoding="UTF-8"?><i></i>', { status: 400, headers: { 'content-type': 'text/xml; charset=utf-8' } });
  var txt;
  try { txt = await getText('https://comment.bilibili.com/' + cid + '.xml', false, 'xml'); }
  catch (e) { txt = '<?xml version="1.0" encoding="UTF-8"?><i></i>'; }
  if (!/^\s*(\u003c\u003fxml|<\?xml|<i>)/.test(txt) && txt.indexOf('<i>') < 0) {
    txt = '<?xml version="1.0" encoding="UTF-8"?><i></i>';   // 上游吐 HTML 错误页时兜底
  }
  return new Response(txt, {
    headers: { 'content-type': 'text/xml; charset=utf-8', 'cache-control': 'public, max-age=' + CFG.TTL_DM, 'access-control-allow-origin': '*' },
  });
}

/* ---------------------------------------------------------------- 路由 */
function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'range, content-type',
    'access-control-allow-methods': 'GET, HEAD, OPTIONS',
    'access-control-expose-headers': 'content-range, content-length, accept-ranges',
  };
}
function jsonRes(o, status, extra) {
  var h = Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }, cors(), extra || {});
  return new Response(JSON.stringify(o), { status: status || 200, headers: h });
}

async function handle(request, env, ctx) {
  /* biliLight-patch: 每请求先同步 cookie 环境变量；buvid 自举不受 cookie 影响（真实浏览器两者并存） */
  CK = (env && env.BILI_COOKIE) || '';
  if (!BUVID) ctx && ctx.waitUntil && ctx.waitUntil(ensureBuvid(false).catch(function () { }));
  var url = new URL(request.url);
  var p = url.pathname, params = url.searchParams;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
  if (request.method !== 'GET' && request.method !== 'HEAD') return jsonRes({ code: -1, message: '只支持 GET' }, 405);

  try {
    if (p === '/' || p === '/index.html') {
      return new Response(PAGE_HTML, {
        headers: {
          'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache',
          'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer-when-downgrade',
        },
      });
    }
    if (p === '/robots.txt') return new Response('User-agent: *\nDisallow: /api\nDisallow: /m\n', { headers: { 'content-type': 'text/plain' } });
    if (p === '/health') return jsonRes({
      code: 0, data: {
        app: 'biliLight', ver: CFG.VER, md5: typeof md5hex === 'function' ? 1 : 0,
        cookie: !!(env && env.BILI_COOKIE), buvid: BUVID ? 1 : 0,
      },
    });
    if (p === '/meta') return jsonRes({ code: 0, data: { rids: RIDS, qn: CFG.QN_NAME, max: env && env.BILI_COOKIE ? 127 : CFG.QN_MAX_ANON, ver: CFG.VER } });

    if (p === '/api') {
      var ep = String(params.get('ep') || '').replace(/[^a-z_]/g, '').slice(0, 20);
      if (!ep) return jsonRes({ code: -1, message: '缺少 ep' });
      var q = {};
      params.forEach(function (v, k) { if (k !== 'ep' && k !== 'sign' && k !== '_') q[k] = String(v).slice(0, 300); });
      var r = await apiCall(ep, q, params.get('sign') === '1');
      return jsonRes(r, 200);
    }
    if (p === '/play') return jsonRes(await resolvePlay({ bvid: params.get('bvid'), aid: params.get('aid'), cid: params.get('cid'), qn: params.get('qn') }, env), 200);
    if (p === '/dm') return await serveDm(params);
    if (p === '/m') return await serveMedia(params, request, env);
    if (p === '/img') return await serveImg(params, env);
    if (p === '/favicon.ico') return new Response('', { status: 204 });
    return jsonRes({ code: -404, message: '没有这个路径' }, 404);
  } catch (e) {
    return jsonRes({ code: -9, message: ('' + (e && e.stack || e)).slice(0, 240) }, 500);
  }
}

export default { fetch: handle };
export { handle, apiCall, EP, RIDS, resolvePlay, mediaUrl, mediaRead, serveMedia };
