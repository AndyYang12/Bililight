/* md5: js-md5@0.8.3, MIT, Copyright Chen, Yi-Cyuan 2014-2023 */
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







  var createOutputMethod = function (outputType) {
    return function (message) {
      return new Md5(true).update(message)[outputType]();
    };
  };



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









  var createHmacOutputMethod = function (outputType) {
    return function (key, message) {
      return new HmacMd5(key, true).update(message)[outputType]();
    };
  };



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


  Md5.prototype.toString = Md5.prototype.hex;


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


  Md5.prototype.array = Md5.prototype.digest;


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


  Md5.prototype.buffer = Md5.prototype.arrayBuffer;


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

    root.md5 = exports;
    if (AMD) {
      define(function () {
        return exports;
      });
    }
  }
})();


var md5hex = (typeof self !== 'undefined' && self.md5) || (typeof globalThis !== 'undefined' && globalThis.md5);



var PAGE_HTML = "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover\">\n<meta name=\"theme-color\" content=\"#d86da5\">\n<meta name=\"format-detection\" content=\"telephone=no\">\n<meta name=\"referrer\" content=\"no-referrer-when-downgrade\">\n<link rel=\"icon\" href=\"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7\">\n<title>biliLight · 轻装看B站</title>\n<style>\n\n*{box-sizing:border-box;-webkit-tap-highlight-color:rgba(0,0,0,0);margin:0;padding:0}\nhtml,body{height:100%}\nbody{\n  background:#eef0f3;color:#1c2126;\n  font:14px/1.5 \"Helvetica Neue\",Helvetica,\"Noto Sans CJK SC\",\"Source Han Sans CN\",\"Microsoft YaHei\",sans-serif;\n  -webkit-text-size-adjust:100%\n}\n\n.bg-grid{\n  background-image:\n    linear-gradient(0deg,rgba(28,33,38,.045) 1px,transparent 1px),\n    linear-gradient(90deg,rgba(28,33,38,.045) 1px,transparent 1px),\n    linear-gradient(0deg,rgba(28,33,38,.075) 1px,transparent 1px),\n    linear-gradient(90deg,rgba(28,33,38,.075) 1px,transparent 1px);\n  background-size:16px 16px,16px 16px,64px 64px,64px 64px\n}\n.num{font-family:\"Courier New\",DejaVu Sans Mono,Menlo,monospace;font-variant-numeric:tabular-nums;letter-spacing:0}\n.hide{display:none !important}\na{color:inherit;text-decoration:none}\nbutton{font:inherit;color:inherit;background:none;border:0;cursor:pointer}\ninput,select{font:inherit;color:inherit}\n\n#app{min-height:100%}\n.bar{\n  background:#fff;border-bottom:1px solid #aab3bc;\n  padding:0 10px;height:52px;position:relative;z-index:30\n}\n.bar .row{display:block;padding-top:9px}\n.brand{float:left;line-height:34px;height:34px;display:block}\n.brand img{height:30px;display:block;margin-top:2px}\n.tabs{display:none;float:right;line-height:34px}\n.tabs button{\n  float:left;padding:0 12px;height:34px;line-height:34px;color:#454c54;\n  border-left:1px solid #e4e9ed;font-size:14px\n}\n.tabs button.on{color:#d86da5;background:#fdf3f8;border-bottom:3px solid #d86da5;height:34px}\n.sbox{margin:0 0 0 10px;overflow:visible;position:relative}\n.sbox input{\n  width:100%;height:34px;border:1px solid #d5dbe2;border-radius:18px;background:#f2f4f7;\n  padding:0 70px 0 32px;font-size:14px;line-height:32px;outline:none;\n  -webkit-transition:box-shadow .15s linear,border-color .15s linear;transition:box-shadow .15s linear,border-color .15s linear\n}\n.sbox input:focus{background:#fff;border-color:#d86da5;box-shadow:0 0 0 3px rgba(216,109,165,.14)}\n.sbox .sico{position:absolute;left:11px;top:19px;line-height:0;z-index:1}\n.sbox .go{\n  position:absolute;right:3px;top:12px;width:58px;height:28px;line-height:27px;text-align:center;\n  border-radius:14px;background:linear-gradient(135deg,#fb7299,#d86da5);\n  color:#fff;font-size:13px;box-shadow:0 1px 3px rgba(216,109,165,.4)\n}\n.sbox .go:active{background:#ae4a7b}\n.sug{\n  position:absolute;left:0;right:0;top:40px;background:#fff;border:1px solid #e0e5ea;border-radius:10px;z-index:40;\n  overflow:hidden;box-shadow:0 6px 18px rgba(28,33,38,.14)\n}\n.sug div{padding:9px 10px;border-bottom:1px solid #e4e9ed;font-size:14px}\n.sug div:last-child{border-bottom:0}\n.sug b{color:#d86da5;font-weight:400}\n\n.wrap{max-width:1128px;margin:0 auto;padding:10px}\n.side{float:left;width:184px;display:none}\n.main{margin-left:0}\n@media (min-width:900px){\n  .side{display:block}\n  .main{margin-left:200px}\n  .tabs{display:block}\n}\n\n.side h4{font-size:11px;color:#7a828b;font-weight:400;padding:6px 8px;border-bottom:1px solid #cbd2d9;letter-spacing:1px}\n.side a{display:block;padding:8px;border-bottom:1px solid #e4e9ed;font-size:14px;color:#454c54}\n.side a.on{background:#fff;color:#d86da5;border-left:3px solid #d86da5;padding-left:7px}\n.side a i{float:right;font-style:normal;color:#a9b0b8;font-size:11px}\n\n.hd{border-bottom:1px solid #cbd2d9;padding:4px 0 6px;margin:2px 0 10px;overflow:hidden}\n.hd h2{float:left;font-size:16px;font-weight:700;line-height:22px;padding-left:8px;border-left:3px solid #d86da5}\n.hd .sp{float:right;font-size:11px;color:#7a828b;line-height:22px}\n.hd em{font-style:normal;color:#00a1d6;font-size:11px}\n\n.ticks{height:5px;border-bottom:1px solid #aab3bc;background:\n  repeating-linear-gradient(90deg,#aab3bc 0 1px,transparent 1px 8px);opacity:.7;margin:-6px 0 10px}\n\n.g{margin:0 -4px;overflow:hidden}\n.g:after{content:\"\";display:block;clear:both;height:0}\n.c{\n  float:left;width:50%;padding:0 4px 12px;\n}\n@media (min-width:600px){.c{width:33.333%}}\n@media (min-width:900px){.c{width:25%}}\n@media (min-width:1100px){.c{width:20%}}\n.c .box{background:#fff;border:1px solid #cbd2d9;padding:4px;position:relative}\n.c.tap:active .box{background:#fdf3f8;border-color:#d86da5}\n.th{position:relative;background:#0b0d0f;padding:1px;line-height:0}\n.th img{width:100%;display:block;height:auto}\n\n.th:before,.th:after,.th .b1,.th .b2{\n  content:\"\";position:absolute;width:9px;height:9px;line-height:0;font-size:0;pointer-events:none\n}\n.th:before{left:3px;top:3px;border-left:1px solid #d86da5;border-top:1px solid #d86da5}\n.th:after{right:3px;top:3px;border-right:1px solid #d86da5;border-top:1px solid #d86da5}\n.th .b1{left:3px;bottom:-21px;border-left:1px solid #d86da5;border-bottom:1px solid #d86da5}\n.th .b2{right:3px;bottom:-21px;border-right:1px solid #d86da5;border-bottom:1px solid #d86da5}\n.mt{\n  background:rgba(0,0,0,.8);color:#fff;padding:2px 5px;line-height:14px;\n  font-size:10px;overflow:hidden;white-space:nowrap;position:relative\n}\n.mt .r{float:right;color:#7fd8f5}\n.tt{font-size:13px;line-height:17px;height:34px;overflow:hidden;margin-top:4px;color:#1c2126;\n  display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}\n.ub{font-size:10px;line-height:14px;height:14px;overflow:hidden;color:#7a828b;white-space:nowrap}\n.ub .dot{color:#cbd2d9;padding:0 3px}\n.tagline{position:absolute;left:1px;top:1px;background:#d86da5;color:#fff;font-size:9px;padding:1px 4px}\n.tagline.t2{background:#00a1d6}\n\n.ls{border-top:1px solid #e4e9ed}\n.lr{background:#fff;border-bottom:1px solid #e4e9ed;padding:8px;overflow:hidden;position:relative}\n.lr:active{background:#fdf3f8}\n.lr .th{float:left;width:132px;margin-right:9px}\n@media (min-width:600px){.lr .th{width:176px}}\n.lr .in{overflow:hidden}\n.lr .tt{font-size:14px;line-height:19px;max-height:38px;margin:0 0 3px;overflow:hidden;\n  display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}\n.lr .ds{font-size:11px;color:#7a828b;line-height:16px;height:32px;overflow:hidden;\n  display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}\n.lr .mt2{font-size:10px;color:#7a828b;margin-top:4px}\n.lr .mt2 b{color:#1c2126;font-weight:400}\n\n.st{padding:26px 12px;text-align:center;color:#7a828b;font-size:13px;border:1px solid #cbd2d9;background:#fff}\n.st .cr{\n  width:26px;height:26px;margin:0 auto 10px;position:relative;\n  border:1px solid #cbd2d9\n}\n.st .cr:before,.st .cr:after{content:\"\";position:absolute;background:#d86da5}\n.st .cr:before{left:12px;top:4px;width:1px;height:18px}\n.st .cr:after{top:12px;left:4px;height:1px;width:18px}\n.spin{width:22px;height:22px;margin:0 auto;border:2px solid #cbd2d9;border-top-color:#d86da5;-webkit-animation:sp .8s linear infinite;animation:sp .8s linear infinite}\n@-webkit-keyframes sp{to{-webkit-transform:rotate(360deg)}}\n@keyframes sp{to{transform:rotate(360deg)}}\n.loadmore{display:block;width:100%;padding:11px;background:#fff;border:1px solid #cbd2d9;color:#454c54;font-size:13px;margin-top:2px}\n.loadmore:active{background:#fdf3f8;border-color:#d86da5}\n\n.plr{background:#000;position:relative;line-height:0}\n.plr video{width:100%;display:block;background:#000;min-height:120px}\n#dmz{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;line-height:normal}\n#dmz canvas{display:block;width:100%;height:100%}\n.plr .ctl{\n  position:absolute;left:0;right:0;bottom:0;background:rgba(11,13,15,.86);\n  padding:5px 8px;line-height:normal;color:#fff;font-size:11px\n}\n.plr .bar2{height:3px;background:#2a2e33;position:relative;margin-bottom:5px}\n.plr .bar2 i{display:block;height:100%;background:#d86da5;width:0}\n.plr .bar2 b{position:absolute;top:-3px;width:7px;height:9px;background:#fff;border:1px solid #d86da5;margin-left:-3px;line-height:0;font-size:0}\n.plr .btns button{float:left;padding:4px 7px;color:#fff;font-size:11px;border:1px solid transparent}\n.plr .btns button.on{color:#f3b7d3;border-color:#d86da5}\n.plr .btns button:active{background:#1b1d1f}\n.plr .btns:after{content:\"\";display:block;clear:both}\n.plr .tm{float:right;color:#a9b0b8;padding:4px 2px;line-height:16px}\n.plr .mask{position:absolute;left:0;right:0;top:0;bottom:0}\n.vhd{background:#fff;border-bottom:1px solid #cbd2d9;padding:9px 10px}\n.vhd h1{font-size:16px;line-height:22px;font-weight:700}\n.vhd .sub{font-size:11px;color:#7a828b;margin-top:4px;overflow:hidden}\n.vhd .sub span{float:left;margin-right:12px}\n.vhd .sub b{color:#1c2126;font-weight:400}\n.who{background:#fff;border-bottom:1px solid #cbd2d9;padding:8px 10px;overflow:hidden}\n.who img{float:left;width:38px;height:38px;border:1px solid #aab3bc;margin-right:9px}\n.who .n{font-size:13px;line-height:18px;color:#1c2126}\n.who .s{font-size:11px;color:#7a828b;line-height:15px;height:30px;overflow:hidden}\n.sec{background:#fff;border-bottom:1px solid #cbd2d9;margin-top:8px;padding:0 0 4px}\n.sec h3{font-size:12px;color:#7a828b;font-weight:400;padding:8px 10px 6px;border-bottom:1px solid #e4e9ed;letter-spacing:1px}\n.plist{max-height:340px;overflow-y:auto;-webkit-overflow-scrolling:touch}\n.plist a{display:block;padding:7px 10px;border-bottom:1px solid #f0f2f5;font-size:13px;overflow:hidden}\n.plist a.on{background:#fdf3f8;color:#d86da5;border-left:3px solid #d86da5;padding-left:7px}\n.plist a i{float:right;font-style:normal;color:#7a828b;font-size:10px}\n.plist a span{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}\n.chip{display:inline-block;font-size:10px;border:1px solid #aab3bc;color:#454c54;padding:1px 5px;margin:0 4px 4px 0;background:#f5f7fa}\n.chip.t{border-color:#00a1d6;color:#00a1d6;background:#f0faff}\n.chip.p{border-color:#d86da5;color:#d86da5;background:#fdf3f8}\n.cm{padding:8px 10px;border-bottom:1px solid #e4e9ed;background:#fff;overflow:hidden}\n.cm img{float:left;width:30px;height:30px;border:1px solid #cbd2d9;margin-right:8px}\n.cm .bd{overflow:hidden}\n.cm .un{font-size:11px;color:#7a828b}\n.cm .un b{color:#1c2126;font-weight:400}\n.cm .ms{font-size:13px;line-height:19px;margin-top:2px;word-break:break-all}\n.cm .lk{float:right;font-size:10px;color:#7a828b;text-align:center;padding:0 2px}\n.cm.top{background:#f0faff}\n\n.set dl{background:#fff;border-bottom:1px solid #cbd2d9;padding:8px 10px;overflow:hidden}\n.set dt{font-size:13px;line-height:26px;float:left;width:42%}\n.set dd{margin-left:44%;text-align:right}\n.set select{height:28px;border:1px solid #aab3bc;background:#e9edf1;padding:0 4px;font-size:13px;max-width:100%}\n.set input[type=text]{width:100%;border:1px solid #aab3bc;background:#e9edf1;height:28px;padding:0 6px;font-size:12px}\n.sw{display:inline-block;width:44px;height:22px;border:1px solid #aab3bc;background:#e9edf1;position:relative;vertical-align:middle}\n.sw i{position:absolute;top:1px;left:1px;width:20px;height:18px;background:#fff;border:1px solid #cbd2d9;-webkit-transition:left .12s linear;transition:left .12s linear}\n.sw.on{background:#d86da5;border-color:#ae4a7b}\n.sw.on i{left:21px}\n.hint{font-size:11px;color:#7a828b;padding:8px 10px;line-height:17px}\n.foot{text-align:center;font-size:10px;color:#7a828b;padding:14px 0 22px;line-height:17px}\n\n.tbar{position:fixed;left:0;right:0;bottom:0;height:48px;background:#fff;border-top:1px solid #aab3bc;z-index:30}\n.tbar button{float:left;width:20%;height:48px;font-size:11px;color:#7a828b;line-height:14px;padding-top:9px;border-left:1px solid #e4e9ed}\n.tbar button.on{color:#d86da5;border-bottom:3px solid #d86da5}\n.tbar:after{content:\"\";display:block;clear:both}\nbody{padding-bottom:52px}\n@media (min-width:900px){\n  .tbar{display:none}\n  body{padding-bottom:0}\n}\n\n.plr.full{position:fixed;left:0;top:0;right:0;bottom:0;z-index:90}\n.plr.full video{height:100%}\n.ul{color:#00a1d6}\n.who.link{cursor:pointer}\n.vbtns{float:right;padding-top:10px}\n.vbtns button{margin-left:6px}\n.sp-hd{background:#fff;border:1px solid #cbd2d9;overflow:hidden}\n.sp-banner{height:110px;background:linear-gradient(120deg,#fbf0f6 0%,#f3f7fa 55%,#e7f5fb 100%)}\n.sp-info{padding:0 12px 10px;overflow:hidden}\n.sp-face{float:left;width:76px;height:76px;border:2px solid #fff;background:#eef0f3;margin-top:-38px;position:relative}\n.sp-name{font-size:17px;font-weight:700;line-height:24px;padding:12px 0 0 92px}\n.sp-name .chip{margin-left:6px;vertical-align:middle}\n.sp-sign{font-size:11px;color:#7a828b;padding:2px 0 0 92px;line-height:16px;max-height:32px;overflow:hidden}\n.sp-stat{padding:6px 0 0 92px;font-size:11px;color:#7a828b;overflow:hidden}\n.sp-stat span{float:left;margin-right:16px}\n.sp-stat b{color:#1c2126;font-weight:400;font-size:14px}\n.sptabs{border-bottom:1px solid #cbd2d9;background:#fff;margin-top:8px;padding:0 10px}\n.sptabs span{display:inline-block;padding:9px 12px;font-size:13px;color:#d86da5;border-bottom:3px solid #d86da5}\n@media (min-width:600px){\n  .sp-banner{height:150px}\n  .sp-face{width:96px;height:96px;margin-top:-48px}\n  .sp-name,.sp-sign,.sp-stat{padding-left:112px}\n}\n\n#splash{position:fixed;left:0;top:0;right:0;bottom:0;background:#fff;z-index:120;display:flex;flex-direction:column;align-items:center;justify-content:center;-webkit-transition:opacity .45s linear;transition:opacity .45s linear}\n#splash.out{opacity:0}\n#splash img{max-width:76%;max-height:56vh;display:block}\n#splash .sbtn{margin-top:26px;min-width:150px;height:44px;line-height:44px;border-radius:22px;background:linear-gradient(135deg,#fb7299,#d86da5);color:#fff;font-size:16px;font-weight:700;letter-spacing:2px;box-shadow:0 4px 14px rgba(216,109,165,.45)}\n#splash .sbtn:active{background:#ae4a7b}\n#splash .sskip{margin-top:14px;font-size:11px;color:#a9b0b8}\n.authcard{background:#fff;border:1px solid #e2e7ec;border-radius:10px;padding:16px;box-shadow:0 1px 3px rgba(28,33,38,.06);max-width:520px}\n.authtabs{overflow:hidden;margin-bottom:14px;border-bottom:1px solid #e4e9ed}\n.authtabs button{float:left;padding:8px 14px;font-size:14px;color:#7a828b;border-bottom:3px solid transparent}\n.authtabs button.on{color:#d86da5;border-bottom-color:#d86da5}\n#qrbox{text-align:center;padding:6px 0;line-height:0}\n#qrbox svg{width:190px;height:190px;display:inline-block}\n.qrstate{font-size:12px;color:#7a828b;padding:6px 0;text-align:center;line-height:18px}\n.authcard textarea{width:100%;height:96px;border:1px solid #d5dbe2;border-radius:8px;background:#f7f9fb;padding:8px;font-size:12px;line-height:17px;outline:none;resize:vertical}\n.authcard textarea:focus{border-color:#d86da5;background:#fff}\n.abtn{display:inline-block;margin-top:10px;padding:8px 18px;border-radius:16px;background:linear-gradient(135deg,#fb7299,#d86da5);color:#fff;font-size:13px;cursor:pointer}\n.abtn.g{background:#eef0f3;color:#454c54;border:1px solid #d5dbe2}\n.prof{overflow:hidden;padding:4px 0 10px}\n.prof img{float:left;width:56px;height:56px;border-radius:50%;margin-right:12px;border:1px solid #e2e7ec}\n.prof .pn{font-size:16px;font-weight:700;line-height:24px}\n.prof .ps{font-size:11px;color:#7a828b}\n.bdg2{position:absolute;right:8px;top:8px;background:#fb7299;color:#fff;font-size:10px;border-radius:9px;padding:0 6px;line-height:16px}\n.bar{box-shadow:0 1px 4px rgba(28,33,38,.05)}\n.c .box{border-radius:8px;border-color:#e2e7ec;box-shadow:0 1px 3px rgba(28,33,38,.06)}\n</style>\n</head>\n<body class=\"bg-grid\">\n<div id=\"app\">\n\n  <div class=\"bar\">\n    <div class=\"row\">\n      <a class=\"brand\" href=\"#/home/popular\" id=\"brand\"><img src=\"data:image/png;base64,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\" alt=\"biliLight\"></a>\n      <div class=\"tabs\" id=\"tabs\">\n        <button data-v=\"home\" class=\"on\">首页</button>\n        <button data-v=\"rank\">排行</button>\n        <button data-v=\"hist\">历史</button>\n        <button data-v=\"auth\" id=\"tabauth\">登录</button>\n        <button data-v=\"set\">设置</button>\n      </div>\n      <div class=\"sbox\" id=\"sbox\">\n        <span class=\"sico\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#8b939c\" stroke-width=\"2.6\" stroke-linecap=\"round\"><circle cx=\"10.5\" cy=\"10.5\" r=\"6.5\"></circle><line x1=\"15.5\" y1=\"15.5\" x2=\"21\" y2=\"21\"></line></svg></span>\n        <input type=\"search\" id=\"sq\" placeholder=\"搜索视频 / AV号 / BV号\" autocomplete=\"off\" autocapitalize=\"off\" spellcheck=\"false\">\n        <button class=\"go\" id=\"sgo\">搜索</button>\n        <div class=\"sug hide\" id=\"sug\"></div>\n      </div>\n    </div>\n  </div>\n\n  <div class=\"wrap\">\n    <div class=\"side\" id=\"side\"></div>\n    <div class=\"main\" id=\"main\"></div>\n  </div>\n</div>\n\n<div id=\"splash\">\n  <img src=\"data:image/png;base64,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\" alt=\"\">\n  <button class=\"sbtn\" id=\"sgogo\">Go!</button>\n  <div class=\"sskip\">5 秒后自动进入</div>\n</div>\n\n<div class=\"tbar\" id=\"tbar\">\n  <button data-v=\"home\" class=\"on\">首页</button>\n  <button data-v=\"rank\">排行</button>\n  <button data-v=\"hist\">历史</button>\n  <button data-v=\"auth\" id=\"tbauth\">登录</button>\n  <button data-v=\"set\">设置</button>\n</div>\n\n<script>\n\n(function () {\n  var u = (navigator.userAgent || '') + (navigator.vendor || '');\n  var old = /MSIE\\s[5-9]|Trident\\/[45](\\.|$)|Android\\s[1-4](\\.|\\d)*;|Silk\\/[01]|WebOS\\/1/.test(u)\n    || !window.JSON || !(document.querySelectorAll && document.addEventListener);\n  if (!old) return;\n  if (!window.JSON) window.JSON = (function () {\n    function q(s) { return '\\u0022' + String(s).replace(/\\\\/g, '\\\\\\\\').replace(/\\u0022/g, '\\\\\\u0022').replace(/\\n/g, '\\\\n').replace(/\\r/g, '\\\\r').replace(/\\t/g, '\\\\t') + '\\u0022'; }\n    function ser(v) {\n      var t = typeof v, out, i, kk;\n      if (v === null) return 'null';\n      if (t === 'number') return isFinite(v) ? String(v) : 'null';\n      if (t === 'boolean') return String(v);\n      if (t === 'string') return q(v);\n      if (v instanceof Array || t === 'array' || (v && typeof v.length === 'number')) {\n        out = []; for (i = 0; i < v.length; i++) out.push(ser(v[i])); return '[' + out.join(',') + ']';\n      }\n      if (t === 'object') { out = []; for (kk in v) if (v.hasOwnProperty(kk)) out.push(q(kk) + ':' + ser(v[kk])); return '{' + out.join(',') + '}'; }\n      return 'null';\n    }\n    return { parse: function (s) { return eval('(' + s + ')'); }, stringify: ser };\n  })();\n  var AP = Array.prototype;\n  if (!AP.forEach) AP.forEach = function (f, o) { for (var i = 0; i < this.length; i++) if (i in this) f.call(o, this[i], i, this); };\n  if (!AP.map) AP.map = function (f, o) { var r = []; for (var i = 0; i < this.length; i++) if (i in this) r.push(f.call(o, this[i], i, this)); return r; };\n  if (!AP.filter) AP.filter = function (f, o) { var r = []; for (var i = 0; i < this.length; i++) if (i in this && f.call(o, this[i], i, this)) r.push(this[i]); return r; };\n  if (!AP.indexOf) AP.indexOf = function (x, f) { for (var i = f || 0; i < this.length; i++) if (this[i] === x) return i; return -1; };\n  if (!String.prototype.trim) String.prototype.trim = function () { return String(this).replace(/^[\\s\\uFEFF]+|[\\s\\uFEFF]+$/g, ''); };\n  if (!Object.keys) Object.keys = function (o) { var r = [], k; for (k in o) if (o.hasOwnProperty(k)) r.push(k); return r; };\n  try {\n    var k = 'bl_set', cur = null;\n    try { cur = JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { }\n    if (!cur || typeof cur !== 'object') cur = {};\n    if (!cur.__oldcap) { cur.qn = 16; cur.__oldcap = 1; try { localStorage.setItem(k, JSON.stringify(cur)); } catch (e2) { } }\n  } catch (e3) { }\n})();\n</script>\n\n<script>/**\n * Minified by jsDelivr using Terser v5.37.0.\n * Original file: /npm/qrcode-generator@1.4.4/qrcode.js\n *\n * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files\n */\nvar qrcode=function(){var t=function(t,r){var e=t,n=g[r],o=null,i=0,a=null,u=[],f={},c=function(t,r){o=function(t){for(var r=new Array(t),e=0;e<t;e+=1){r[e]=new Array(t);for(var n=0;n<t;n+=1)r[e][n]=null}return r}(i=4*e+17),l(0,0),l(i-7,0),l(0,i-7),s(),h(),d(t,r),e>=7&&v(t),null==a&&(a=p(e,n,u)),w(a,r)},l=function(t,r){for(var e=-1;e<=7;e+=1)if(!(t+e<=-1||i<=t+e))for(var n=-1;n<=7;n+=1)r+n<=-1||i<=r+n||(o[t+e][r+n]=0<=e&&e<=6&&(0==n||6==n)||0<=n&&n<=6&&(0==e||6==e)||2<=e&&e<=4&&2<=n&&n<=4)},h=function(){for(var t=8;t<i-8;t+=1)null==o[t][6]&&(o[t][6]=t%2==0);for(var r=8;r<i-8;r+=1)null==o[6][r]&&(o[6][r]=r%2==0)},s=function(){for(var t=B.getPatternPosition(e),r=0;r<t.length;r+=1)for(var n=0;n<t.length;n+=1){var i=t[r],a=t[n];if(null==o[i][a])for(var u=-2;u<=2;u+=1)for(var f=-2;f<=2;f+=1)o[i+u][a+f]=-2==u||2==u||-2==f||2==f||0==u&&0==f}},v=function(t){for(var r=B.getBCHTypeNumber(e),n=0;n<18;n+=1){var a=!t&&1==(r>>n&1);o[Math.floor(n/3)][n%3+i-8-3]=a}for(n=0;n<18;n+=1){a=!t&&1==(r>>n&1);o[n%3+i-8-3][Math.floor(n/3)]=a}},d=function(t,r){for(var e=n<<3|r,a=B.getBCHTypeInfo(e),u=0;u<15;u+=1){var f=!t&&1==(a>>u&1);u<6?o[u][8]=f:u<8?o[u+1][8]=f:o[i-15+u][8]=f}for(u=0;u<15;u+=1){f=!t&&1==(a>>u&1);u<8?o[8][i-u-1]=f:u<9?o[8][15-u-1+1]=f:o[8][15-u-1]=f}o[i-8][8]=!t},w=function(t,r){for(var e=-1,n=i-1,a=7,u=0,f=B.getMaskFunction(r),c=i-1;c>0;c-=2)for(6==c&&(c-=1);;){for(var g=0;g<2;g+=1)if(null==o[n][c-g]){var l=!1;u<t.length&&(l=1==(t[u]>>>a&1)),f(n,c-g)&&(l=!l),o[n][c-g]=l,-1==(a-=1)&&(u+=1,a=7)}if((n+=e)<0||i<=n){n-=e,e=-e;break}}},p=function(t,r,e){for(var n=A.getRSBlocks(t,r),o=b(),i=0;i<e.length;i+=1){var a=e[i];o.put(a.getMode(),4),o.put(a.getLength(),B.getLengthInBits(a.getMode(),t)),a.write(o)}var u=0;for(i=0;i<n.length;i+=1)u+=n[i].dataCount;if(o.getLengthInBits()>8*u)throw\"code length overflow. (\"+o.getLengthInBits()+\">\"+8*u+\")\";for(o.getLengthInBits()+4<=8*u&&o.put(0,4);o.getLengthInBits()%8!=0;)o.putBit(!1);for(;!(o.getLengthInBits()>=8*u||(o.put(236,8),o.getLengthInBits()>=8*u));)o.put(17,8);return function(t,r){for(var e=0,n=0,o=0,i=new Array(r.length),a=new Array(r.length),u=0;u<r.length;u+=1){var f=r[u].dataCount,c=r[u].totalCount-f;n=Math.max(n,f),o=Math.max(o,c),i[u]=new Array(f);for(var g=0;g<i[u].length;g+=1)i[u][g]=255&t.getBuffer()[g+e];e+=f;var l=B.getErrorCorrectPolynomial(c),h=k(i[u],l.getLength()-1).mod(l);for(a[u]=new Array(l.getLength()-1),g=0;g<a[u].length;g+=1){var s=g+h.getLength()-a[u].length;a[u][g]=s>=0?h.getAt(s):0}}var v=0;for(g=0;g<r.length;g+=1)v+=r[g].totalCount;var d=new Array(v),w=0;for(g=0;g<n;g+=1)for(u=0;u<r.length;u+=1)g<i[u].length&&(d[w]=i[u][g],w+=1);for(g=0;g<o;g+=1)for(u=0;u<r.length;u+=1)g<a[u].length&&(d[w]=a[u][g],w+=1);return d}(o,n)};f.addData=function(t,r){var e=null;switch(r=r||\"Byte\"){case\"Numeric\":e=M(t);break;case\"Alphanumeric\":e=x(t);break;case\"Byte\":e=m(t);break;case\"Kanji\":e=L(t);break;default:throw\"mode:\"+r}u.push(e),a=null},f.isDark=function(t,r){if(t<0||i<=t||r<0||i<=r)throw t+\",\"+r;return o[t][r]},f.getModuleCount=function(){return i},f.make=function(){if(e<1){for(var t=1;t<40;t++){for(var r=A.getRSBlocks(t,n),o=b(),i=0;i<u.length;i++){var a=u[i];o.put(a.getMode(),4),o.put(a.getLength(),B.getLengthInBits(a.getMode(),t)),a.write(o)}var g=0;for(i=0;i<r.length;i++)g+=r[i].dataCount;if(o.getLengthInBits()<=8*g)break}e=t}c(!1,function(){for(var t=0,r=0,e=0;e<8;e+=1){c(!0,e);var n=B.getLostPoint(f);(0==e||t>n)&&(t=n,r=e)}return r}())},f.createTableTag=function(t,r){t=t||2;var e=\"\";e+='<table style=\"',e+=\" border-width: 0px; border-style: none;\",e+=\" border-collapse: collapse;\",e+=\" padding: 0px; margin: \"+(r=void 0===r?4*t:r)+\"px;\",e+='\">',e+=\"<tbody>\";for(var n=0;n<f.getModuleCount();n+=1){e+=\"<tr>\";for(var o=0;o<f.getModuleCount();o+=1)e+='<td style=\"',e+=\" border-width: 0px; border-style: none;\",e+=\" border-collapse: collapse;\",e+=\" padding: 0px; margin: 0px;\",e+=\" width: \"+t+\"px;\",e+=\" height: \"+t+\"px;\",e+=\" background-color: \",e+=f.isDark(n,o)?\"#000000\":\"#ffffff\",e+=\";\",e+='\"/>';e+=\"</tr>\"}return e+=\"</tbody>\",e+=\"</table>\"},f.createSvgTag=function(t,r,e,n){var o={};\"object\"==typeof arguments[0]&&(t=(o=arguments[0]).cellSize,r=o.margin,e=o.alt,n=o.title),t=t||2,r=void 0===r?4*t:r,(e=\"string\"==typeof e?{text:e}:e||{}).text=e.text||null,e.id=e.text?e.id||\"qrcode-description\":null,(n=\"string\"==typeof n?{text:n}:n||{}).text=n.text||null,n.id=n.text?n.id||\"qrcode-title\":null;var i,a,u,c,g=f.getModuleCount()*t+2*r,l=\"\";for(c=\"l\"+t+\",0 0,\"+t+\" -\"+t+\",0 0,-\"+t+\"z \",l+='<svg version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\"',l+=o.scalable?\"\":' width=\"'+g+'px\" height=\"'+g+'px\"',l+=' viewBox=\"0 0 '+g+\" \"+g+'\" ',l+=' preserveAspectRatio=\"xMinYMin meet\"',l+=n.text||e.text?' role=\"img\" aria-labelledby=\"'+y([n.id,e.id].join(\" \").trim())+'\"':\"\",l+=\">\",l+=n.text?'<title id=\"'+y(n.id)+'\">'+y(n.text)+\"</title>\":\"\",l+=e.text?'<description id=\"'+y(e.id)+'\">'+y(e.text)+\"</description>\":\"\",l+='<rect width=\"100%\" height=\"100%\" fill=\"white\" cx=\"0\" cy=\"0\"/>',l+='<path d=\"',a=0;a<f.getModuleCount();a+=1)for(u=a*t+r,i=0;i<f.getModuleCount();i+=1)f.isDark(a,i)&&(l+=\"M\"+(i*t+r)+\",\"+u+c);return l+='\" stroke=\"transparent\" fill=\"black\"/>',l+=\"</svg>\"},f.createDataURL=function(t,r){t=t||2,r=void 0===r?4*t:r;var e=f.getModuleCount()*t+2*r,n=r,o=e-r;return I(e,e,(function(r,e){if(n<=r&&r<o&&n<=e&&e<o){var i=Math.floor((r-n)/t),a=Math.floor((e-n)/t);return f.isDark(a,i)?0:1}return 1}))},f.createImgTag=function(t,r,e){t=t||2,r=void 0===r?4*t:r;var n=f.getModuleCount()*t+2*r,o=\"\";return o+=\"<img\",o+=' src=\"',o+=f.createDataURL(t,r),o+='\"',o+=' width=\"',o+=n,o+='\"',o+=' height=\"',o+=n,o+='\"',e&&(o+=' alt=\"',o+=y(e),o+='\"'),o+=\"/>\"};var y=function(t){for(var r=\"\",e=0;e<t.length;e+=1){var n=t.charAt(e);switch(n){case\"<\":r+=\"&lt;\";break;case\">\":r+=\"&gt;\";break;case\"&\":r+=\"&amp;\";break;case'\"':r+=\"&quot;\";break;default:r+=n}}return r};return f.createASCII=function(t,r){if((t=t||1)<2)return function(t){t=void 0===t?2:t;var r,e,n,o,i,a=1*f.getModuleCount()+2*t,u=t,c=a-t,g={\"██\":\"█\",\"█ \":\"▀\",\" █\":\"▄\",\"  \":\" \"},l={\"██\":\"▀\",\"█ \":\"▀\",\" █\":\" \",\"  \":\" \"},h=\"\";for(r=0;r<a;r+=2){for(n=Math.floor((r-u)/1),o=Math.floor((r+1-u)/1),e=0;e<a;e+=1)i=\"█\",u<=e&&e<c&&u<=r&&r<c&&f.isDark(n,Math.floor((e-u)/1))&&(i=\" \"),u<=e&&e<c&&u<=r+1&&r+1<c&&f.isDark(o,Math.floor((e-u)/1))?i+=\" \":i+=\"█\",h+=t<1&&r+1>=c?l[i]:g[i];h+=\"\\n\"}return a%2&&t>0?h.substring(0,h.length-a-1)+Array(a+1).join(\"▀\"):h.substring(0,h.length-1)}(r);t-=1,r=void 0===r?2*t:r;var e,n,o,i,a=f.getModuleCount()*t+2*r,u=r,c=a-r,g=Array(t+1).join(\"██\"),l=Array(t+1).join(\"  \"),h=\"\",s=\"\";for(e=0;e<a;e+=1){for(o=Math.floor((e-u)/t),s=\"\",n=0;n<a;n+=1)i=1,u<=n&&n<c&&u<=e&&e<c&&f.isDark(o,Math.floor((n-u)/t))&&(i=0),s+=i?g:l;for(o=0;o<t;o+=1)h+=s+\"\\n\"}return h.substring(0,h.length-1)},f.renderTo2dContext=function(t,r){r=r||2;for(var e=f.getModuleCount(),n=0;n<e;n++)for(var o=0;o<e;o++)t.fillStyle=f.isDark(n,o)?\"black\":\"white\",t.fillRect(n*r,o*r,r,r)},f};t.stringToBytes=(t.stringToBytesFuncs={default:function(t){for(var r=[],e=0;e<t.length;e+=1){var n=t.charCodeAt(e);r.push(255&n)}return r}}).default,t.createStringToBytes=function(t,r){var e=function(){for(var e=S(t),n=function(){var t=e.read();if(-1==t)throw\"eof\";return t},o=0,i={};;){var a=e.read();if(-1==a)break;var u=n(),f=n()<<8|n();i[String.fromCharCode(a<<8|u)]=f,o+=1}if(o!=r)throw o+\" != \"+r;return i}(),n=\"?\".charCodeAt(0);return function(t){for(var r=[],o=0;o<t.length;o+=1){var i=t.charCodeAt(o);if(i<128)r.push(i);else{var a=e[t.charAt(o)];\"number\"==typeof a?(255&a)==a?r.push(a):(r.push(a>>>8),r.push(255&a)):r.push(n)}}return r}};var r,e,n,o,i,a=1,u=2,f=4,c=8,g={L:1,M:0,Q:3,H:2},l=0,h=1,s=2,v=3,d=4,w=5,p=6,y=7,B=(r=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]],e=1335,n=7973,i=function(t){for(var r=0;0!=t;)r+=1,t>>>=1;return r},(o={}).getBCHTypeInfo=function(t){for(var r=t<<10;i(r)-i(e)>=0;)r^=e<<i(r)-i(e);return 21522^(t<<10|r)},o.getBCHTypeNumber=function(t){for(var r=t<<12;i(r)-i(n)>=0;)r^=n<<i(r)-i(n);return t<<12|r},o.getPatternPosition=function(t){return r[t-1]},o.getMaskFunction=function(t){switch(t){case l:return function(t,r){return(t+r)%2==0};case h:return function(t,r){return t%2==0};case s:return function(t,r){return r%3==0};case v:return function(t,r){return(t+r)%3==0};case d:return function(t,r){return(Math.floor(t/2)+Math.floor(r/3))%2==0};case w:return function(t,r){return t*r%2+t*r%3==0};case p:return function(t,r){return(t*r%2+t*r%3)%2==0};case y:return function(t,r){return(t*r%3+(t+r)%2)%2==0};default:throw\"bad maskPattern:\"+t}},o.getErrorCorrectPolynomial=function(t){for(var r=k([1],0),e=0;e<t;e+=1)r=r.multiply(k([1,C.gexp(e)],0));return r},o.getLengthInBits=function(t,r){if(1<=r&&r<10)switch(t){case a:return 10;case u:return 9;case f:case c:return 8;default:throw\"mode:\"+t}else if(r<27)switch(t){case a:return 12;case u:return 11;case f:return 16;case c:return 10;default:throw\"mode:\"+t}else{if(!(r<41))throw\"type:\"+r;switch(t){case a:return 14;case u:return 13;case f:return 16;case c:return 12;default:throw\"mode:\"+t}}},o.getLostPoint=function(t){for(var r=t.getModuleCount(),e=0,n=0;n<r;n+=1)for(var o=0;o<r;o+=1){for(var i=0,a=t.isDark(n,o),u=-1;u<=1;u+=1)if(!(n+u<0||r<=n+u))for(var f=-1;f<=1;f+=1)o+f<0||r<=o+f||0==u&&0==f||a==t.isDark(n+u,o+f)&&(i+=1);i>5&&(e+=3+i-5)}for(n=0;n<r-1;n+=1)for(o=0;o<r-1;o+=1){var c=0;t.isDark(n,o)&&(c+=1),t.isDark(n+1,o)&&(c+=1),t.isDark(n,o+1)&&(c+=1),t.isDark(n+1,o+1)&&(c+=1),0!=c&&4!=c||(e+=3)}for(n=0;n<r;n+=1)for(o=0;o<r-6;o+=1)t.isDark(n,o)&&!t.isDark(n,o+1)&&t.isDark(n,o+2)&&t.isDark(n,o+3)&&t.isDark(n,o+4)&&!t.isDark(n,o+5)&&t.isDark(n,o+6)&&(e+=40);for(o=0;o<r;o+=1)for(n=0;n<r-6;n+=1)t.isDark(n,o)&&!t.isDark(n+1,o)&&t.isDark(n+2,o)&&t.isDark(n+3,o)&&t.isDark(n+4,o)&&!t.isDark(n+5,o)&&t.isDark(n+6,o)&&(e+=40);var g=0;for(o=0;o<r;o+=1)for(n=0;n<r;n+=1)t.isDark(n,o)&&(g+=1);return e+=Math.abs(100*g/r/r-50)/5*10},o),C=function(){for(var t=new Array(256),r=new Array(256),e=0;e<8;e+=1)t[e]=1<<e;for(e=8;e<256;e+=1)t[e]=t[e-4]^t[e-5]^t[e-6]^t[e-8];for(e=0;e<255;e+=1)r[t[e]]=e;var n={glog:function(t){if(t<1)throw\"glog(\"+t+\")\";return r[t]},gexp:function(r){for(;r<0;)r+=255;for(;r>=256;)r-=255;return t[r]}};return n}();function k(t,r){if(void 0===t.length)throw t.length+\"/\"+r;var e=function(){for(var e=0;e<t.length&&0==t[e];)e+=1;for(var n=new Array(t.length-e+r),o=0;o<t.length-e;o+=1)n[o]=t[o+e];return n}(),n={getAt:function(t){return e[t]},getLength:function(){return e.length},multiply:function(t){for(var r=new Array(n.getLength()+t.getLength()-1),e=0;e<n.getLength();e+=1)for(var o=0;o<t.getLength();o+=1)r[e+o]^=C.gexp(C.glog(n.getAt(e))+C.glog(t.getAt(o)));return k(r,0)},mod:function(t){if(n.getLength()-t.getLength()<0)return n;for(var r=C.glog(n.getAt(0))-C.glog(t.getAt(0)),e=new Array(n.getLength()),o=0;o<n.getLength();o+=1)e[o]=n.getAt(o);for(o=0;o<t.getLength();o+=1)e[o]^=C.gexp(C.glog(t.getAt(o))+r);return k(e,0).mod(t)}};return n}var A=function(){var t=[[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],[5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]],r=function(t,r){var e={};return e.totalCount=t,e.dataCount=r,e},e={};return e.getRSBlocks=function(e,n){var o=function(r,e){switch(e){case g.L:return t[4*(r-1)+0];case g.M:return t[4*(r-1)+1];case g.Q:return t[4*(r-1)+2];case g.H:return t[4*(r-1)+3];default:return}}(e,n);if(void 0===o)throw\"bad rs block @ typeNumber:\"+e+\"/errorCorrectionLevel:\"+n;for(var i=o.length/3,a=[],u=0;u<i;u+=1)for(var f=o[3*u+0],c=o[3*u+1],l=o[3*u+2],h=0;h<f;h+=1)a.push(r(c,l));return a},e}(),b=function(){var t=[],r=0,e={getBuffer:function(){return t},getAt:function(r){var e=Math.floor(r/8);return 1==(t[e]>>>7-r%8&1)},put:function(t,r){for(var n=0;n<r;n+=1)e.putBit(1==(t>>>r-n-1&1))},getLengthInBits:function(){return r},putBit:function(e){var n=Math.floor(r/8);t.length<=n&&t.push(0),e&&(t[n]|=128>>>r%8),r+=1}};return e},M=function(t){var r=a,e=t,n={getMode:function(){return r},getLength:function(t){return e.length},write:function(t){for(var r=e,n=0;n+2<r.length;)t.put(o(r.substring(n,n+3)),10),n+=3;n<r.length&&(r.length-n==1?t.put(o(r.substring(n,n+1)),4):r.length-n==2&&t.put(o(r.substring(n,n+2)),7))}},o=function(t){for(var r=0,e=0;e<t.length;e+=1)r=10*r+i(t.charAt(e));return r},i=function(t){if(\"0\"<=t&&t<=\"9\")return t.charCodeAt(0)-\"0\".charCodeAt(0);throw\"illegal char :\"+t};return n},x=function(t){var r=u,e=t,n={getMode:function(){return r},getLength:function(t){return e.length},write:function(t){for(var r=e,n=0;n+1<r.length;)t.put(45*o(r.charAt(n))+o(r.charAt(n+1)),11),n+=2;n<r.length&&t.put(o(r.charAt(n)),6)}},o=function(t){if(\"0\"<=t&&t<=\"9\")return t.charCodeAt(0)-\"0\".charCodeAt(0);if(\"A\"<=t&&t<=\"Z\")return t.charCodeAt(0)-\"A\".charCodeAt(0)+10;switch(t){case\" \":return 36;case\"$\":return 37;case\"%\":return 38;case\"*\":return 39;case\"+\":return 40;case\"-\":return 41;case\".\":return 42;case\"/\":return 43;case\":\":return 44;default:throw\"illegal char :\"+t}};return n},m=function(r){var e=f,n=t.stringToBytes(r),o={getMode:function(){return e},getLength:function(t){return n.length},write:function(t){for(var r=0;r<n.length;r+=1)t.put(n[r],8)}};return o},L=function(r){var e=c,n=t.stringToBytesFuncs.SJIS;if(!n)throw\"sjis not supported.\";!function(){var t=n(\"友\");if(2!=t.length||38726!=(t[0]<<8|t[1]))throw\"sjis not supported.\"}();var o=n(r),i={getMode:function(){return e},getLength:function(t){return~~(o.length/2)},write:function(t){for(var r=o,e=0;e+1<r.length;){var n=(255&r[e])<<8|255&r[e+1];if(33088<=n&&n<=40956)n-=33088;else{if(!(57408<=n&&n<=60351))throw\"illegal char at \"+(e+1)+\"/\"+n;n-=49472}n=192*(n>>>8&255)+(255&n),t.put(n,13),e+=2}if(e<r.length)throw\"illegal char at \"+(e+1)}};return i},D=function(){var t=[],r={writeByte:function(r){t.push(255&r)},writeShort:function(t){r.writeByte(t),r.writeByte(t>>>8)},writeBytes:function(t,e,n){e=e||0,n=n||t.length;for(var o=0;o<n;o+=1)r.writeByte(t[o+e])},writeString:function(t){for(var e=0;e<t.length;e+=1)r.writeByte(t.charCodeAt(e))},toByteArray:function(){return t},toString:function(){var r=\"\";r+=\"[\";for(var e=0;e<t.length;e+=1)e>0&&(r+=\",\"),r+=t[e];return r+=\"]\"}};return r},S=function(t){var r=t,e=0,n=0,o=0,i={read:function(){for(;o<8;){if(e>=r.length){if(0==o)return-1;throw\"unexpected end of file./\"+o}var t=r.charAt(e);if(e+=1,\"=\"==t)return o=0,-1;t.match(/^\\s$/)||(n=n<<6|a(t.charCodeAt(0)),o+=6)}var i=n>>>o-8&255;return o-=8,i}},a=function(t){if(65<=t&&t<=90)return t-65;if(97<=t&&t<=122)return t-97+26;if(48<=t&&t<=57)return t-48+52;if(43==t)return 62;if(47==t)return 63;throw\"c:\"+t};return i},I=function(t,r,e){for(var n=function(t,r){var e=t,n=r,o=new Array(t*r),i={setPixel:function(t,r,n){o[r*e+t]=n},write:function(t){t.writeString(\"GIF87a\"),t.writeShort(e),t.writeShort(n),t.writeByte(128),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(255),t.writeByte(255),t.writeByte(255),t.writeString(\",\"),t.writeShort(0),t.writeShort(0),t.writeShort(e),t.writeShort(n),t.writeByte(0);var r=a(2);t.writeByte(2);for(var o=0;r.length-o>255;)t.writeByte(255),t.writeBytes(r,o,255),o+=255;t.writeByte(r.length-o),t.writeBytes(r,o,r.length-o),t.writeByte(0),t.writeString(\";\")}},a=function(t){for(var r=1<<t,e=1+(1<<t),n=t+1,i=u(),a=0;a<r;a+=1)i.add(String.fromCharCode(a));i.add(String.fromCharCode(r)),i.add(String.fromCharCode(e));var f,c,g,l=D(),h=(f=l,c=0,g=0,{write:function(t,r){if(t>>>r!=0)throw\"length over\";for(;c+r>=8;)f.writeByte(255&(t<<c|g)),r-=8-c,t>>>=8-c,g=0,c=0;g|=t<<c,c+=r},flush:function(){c>0&&f.writeByte(g)}});h.write(r,n);var s=0,v=String.fromCharCode(o[s]);for(s+=1;s<o.length;){var d=String.fromCharCode(o[s]);s+=1,i.contains(v+d)?v+=d:(h.write(i.indexOf(v),n),i.size()<4095&&(i.size()==1<<n&&(n+=1),i.add(v+d)),v=d)}return h.write(i.indexOf(v),n),h.write(e,n),h.flush(),l.toByteArray()},u=function(){var t={},r=0,e={add:function(n){if(e.contains(n))throw\"dup key:\"+n;t[n]=r,r+=1},size:function(){return r},indexOf:function(r){return t[r]},contains:function(r){return void 0!==t[r]}};return e};return i}(t,r),o=0;o<r;o+=1)for(var i=0;i<t;i+=1)n.setPixel(i,o,e(i,o));var a=D();n.write(a);for(var u=function(){var t=0,r=0,e=0,n=\"\",o={},i=function(t){n+=String.fromCharCode(a(63&t))},a=function(t){if(t<0);else{if(t<26)return 65+t;if(t<52)return t-26+97;if(t<62)return t-52+48;if(62==t)return 43;if(63==t)return 47}throw\"n:\"+t};return o.writeByte=function(n){for(t=t<<8|255&n,r+=8,e+=1;r>=6;)i(t>>>r-6),r-=6},o.flush=function(){if(r>0&&(i(t<<6-r),t=0,r=0),e%3!=0)for(var o=3-e%3,a=0;a<o;a+=1)n+=\"=\"},o.toString=function(){return n},o}(),f=a.toByteArray(),c=0;c<f.length;c+=1)u.writeByte(f[c]);return u.flush(),\"data:image/gif;base64,\"+u};return t}();qrcode.stringToBytesFuncs[\"UTF-8\"]=function(t){return function(t){for(var r=[],e=0;e<t.length;e++){var n=t.charCodeAt(e);n<128?r.push(n):n<2048?r.push(192|n>>6,128|63&n):n<55296||n>=57344?r.push(224|n>>12,128|n>>6&63,128|63&n):(e++,n=65536+((1023&n)<<10|1023&t.charCodeAt(e)),r.push(240|n>>18,128|n>>12&63,128|n>>6&63,128|63&n))}return r}(t)},function(t){\"function\"==typeof define&&define.amd?define([],t):\"object\"==typeof exports&&(module.exports=t())}((function(){return qrcode}));</script>\n<script>\n\n(function () {\n  'use strict';\n\n  function $(s, r) { return (r || document).querySelector(s); }\n  function mk(t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }\n  function esc(s) {\n    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')\n      .replace(/>/g, '&gt;').replace(/\"/g, '&quot;');\n  }\n  function has(e, c) { return (' ' + e.className + ' ').indexOf(' ' + c + ' ') >= 0; }\n  function addC(e, c) { if (!has(e, c)) e.className = (e.className + ' ' + c).replace(/^\\s+/, ''); }\n  function delC(e, c) { e.className = (' ' + e.className + ' ').replace(' ' + c + ' ', ' ').replace(/^\\s+|\\s+$/g, ''); }\n  function num(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }\n  function count(v) {\n    var n = num(v);\n    if (n >= 100000000) return (n / 100000000).toFixed(1) + '亿';\n    if (n >= 10000) return (n / 10000).toFixed(1) + '万';\n    return '' + n;\n  }\n\n  function tryPlay(el) {\n    if (!el) return;\n    try {\n      var pr = el.play();\n      if (pr && pr.catch) pr.catch(function () { });\n    } catch (e) { }\n  }\n  function store(k, v) {\n    try {\n      if (v === undefined) { var s = localStorage.getItem('bl_' + k); return s ? JSON.parse(s) : null; }\n      localStorage.setItem('bl_' + k, JSON.stringify(v));\n    } catch (e) { return null; }\n  }\n  var MEM = {};\n  function sget(k, dft) { var v = store(k); return v == null ? (MEM[k] == null ? dft : MEM[k]) : v; }\n  function sset(k, v) { MEM[k] = v; store(k, v); }\n\n  function get(url, cb) {\n    var x = window.XMLHttpRequest ? new XMLHttpRequest() : null;\n    if (!x) { cb('浏览器不支持 XHR'); return; }\n    var done = false;\n    x.open('GET', url, true);\n    x.timeout = 20000;\n    var ckv = sget('ck', '') || '';\n    if (ckv) { try { x.setRequestHeader('x-bl-ck', ckv); } catch (e) { } }\n    if ('withCredentials' in x) x.withCredentials = false;\n    x.onreadystatechange = function () {\n      if (x.readyState === 4 && !done) {\n        done = true;\n        if (x.status >= 200 && x.status < 300) cb(null, x.responseText, x);\n        else cb('HTTP ' + (x.status || 0), '', x);\n      }\n    };\n    x.ontimeout = function () { if (!done) { done = true; cb('请求超时'); } };\n    x.onerror = function () { if (!done) { done = true; cb('网络错误'); } };\n    try { x.send(null); } catch (e) { if (!done) { done = true; cb('请求失败'); } }\n  }\n\n  var NAV = null, NAVQ = 0;\n  function navGet(cb) {\n    if (NAVQ) { cb(NAV); return; }\n    api('nav', {}, function (j) {\n      NAV = (j && j.code === 0 && j.data && j.data.login) ? j.data : null;\n      NAVQ = 1;\n      refreshAuthUI();\n      cb(NAV);\n    });\n  }\n  function refreshAuthUI() {\n    var bs = document.querySelectorAll('#tabauth,#tbauth'), i;\n    for (i = 0; i < bs.length; i++) bs[i].innerHTML = NAV ? esc(String(NAV.uname).slice(0, 6)) : '登录';\n  }\n  function postAct(obj, cb) {\n    var x = window.XMLHttpRequest ? new XMLHttpRequest() : null;\n    if (!x) { cb({ code: -1, message: '浏览器不支持 XHR' }); return; }\n    var ckv = sget('ck', '') || '';\n    x.open('POST', '/act', true);\n    x.timeout = 20000;\n    x.setRequestHeader('content-type', 'application/json');\n    if (ckv) { try { x.setRequestHeader('x-bl-ck', ckv); } catch (e) { } }\n    x.onreadystatechange = function () {\n      if (x.readyState === 4) {\n        var j = null;\n        try { j = JSON.parse(x.responseText); } catch (e) { }\n        cb(j || { code: -1, message: '返回异常' });\n      }\n    };\n    x.ontimeout = function () { cb({ code: -1, message: '请求超时' }); };\n    try { x.send(JSON.stringify(obj)); } catch (e) { cb({ code: -1, message: '发送失败' }); }\n  }\n\n  var ERR_TXT = {\n    '-352': '稍后再试',\n    '-412': '稍后再试',\n    '-400': '参数错误',\n    '-403': '需要登录',\n    '-101': '需要登录',\n    '-404': '内容不存在',\n    '0': '空数据',\n  };\n  function why(j) {\n    if (!j) return '无数据';\n    var t = ERR_TXT[String(j.code)];\n    if (t) return t;\n    var m = String(j.message || '');\n    return m && m !== String(j.code) ? m : ('错误 ' + j.code);\n  }\n  function b64e(s) { try { return btoa(unescape(encodeURIComponent(s))).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, ''); } catch (e) { return ''; } }\n  function api(ep, q, cb) {\n    var s = '/api?ep=' + encodeURIComponent(ep);\n    if (q) for (var k in q) if (q[k] !== undefined && q[k] !== null && q[k] !== '') {\n      if ((k === 'keyword' || k === 'q') && /[^ -~]/.test(String(q[k]))) s += '&' + k + '64=' + b64e(q[k]);\n      else s += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(q[k]);\n    }\n    get(s, function (err, txt) {\n      if (err) { cb({ code: -1, message: err }); return; }\n      var j;\n      try { j = JSON.parse(txt); } catch (e) { cb({ code: -1, message: '数据格式异常' }); return; }\n      cb(j);\n    });\n  }\n\n  var SET = {\n    qn: 64, dm: 1, dmspeed: 1, dmop: 80, dmarea: 100,\n    auto: 1, grid: 1, histOn: 1,\n  };\n  (function () {\n    var s = sget('set', null);\n    if (s) for (var k in s) if (SET[k] !== undefined) SET[k] = s[k];\n  })();\n  function saveSet() { sset('set', SET); }\n\n  function pushHist(v) {\n    if (!SET.histOn || !v || !v.bv) return;\n    var list = sget('hist', []) || [], out = [], i;\n    for (i = 0; i < list.length; i++) if (list[i].bv !== v.bv) out.push(list[i]);\n    out.unshift({\n      bv: v.bv, aid: v.aid, title: v.title, pic: v.pic, up: v.up, dur: v.dur,\n      view: v.view, cid: v.cid, part: v.part || '', t: Math.floor(Date.now() / 1000), pos: num(v.pos),\n    });\n    if (out.length > 80) out.length = 80;\n    sset('hist', out);\n  }\n  function histOf(bv) {\n    var list = sget('hist', []) || [];\n    for (var i = 0; i < list.length; i++) if (list[i].bv === bv) return list[i];\n    return null;\n  }\n  function updHist(bv, pos, cid) {\n    var list = sget('hist', []) || [];\n    for (var i = 0; i < list.length; i++) if (list[i].bv === bv) { list[i].pos = Math.floor(pos); list[i].cid = cid; sset('hist', list); return; }\n  }\n\n  function upSpan(it) {\n    var s = mk('span', it.mid ? 'ul' : '', esc(it.up || ''));\n    if (it.mid) s.onclick = function (e) {\n      e = e || window.event;\n      if (e.preventDefault) e.preventDefault();\n      e.returnValue = false;\n      if (e.stopPropagation) e.stopPropagation();\n      e.cancelBubble = true;\n      location.hash = '#/user/' + it.mid;\n      return false;\n    };\n    return s;\n  }\n  function card(it) {\n    var a = mk('a', 'c');\n    a.href = '#/video/' + encodeURIComponent(it.bv || ('av' + it.aid));\n    var box = mk('div', 'box');\n    var th = mk('div', 'th');\n    th.appendChild(mk('span', 'b1')); th.appendChild(mk('span', 'b2'));\n    var img = mk('img');\n    img.alt = ''; img.setAttribute('referrerpolicy', 'no-referrer');\n    img.src = it.pic || '';\n    img.onerror = function () { img.onerror = null; img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; };\n    th.appendChild(img);\n    if (it.dur) { var tg = mk('div', 'tagline t2 num'); tg.innerHTML = esc(it.dur); th.appendChild(tg); }\n    box.appendChild(th);\n    var tt = mk('div', 'tt'); tt.innerHTML = esc(it.title); box.appendChild(tt);\n    var ub = mk('div', 'ub');\n    ub.appendChild(upSpan(it));\n    ub.appendChild(mk('span', 'dot', '|'));\n    ub.appendChild(mk('span', 'num', '' + count(it.view)));\n    if (it.dan) {\n      ub.appendChild(mk('span', 'dot', '|'));\n      ub.appendChild(mk('span', 'num', '' + count(it.dan)));\n    }\n    box.appendChild(ub);\n    if (it.desc) { var d2 = mk('div', 'ub'); d2.style.color = '#454c54'; d2.innerHTML = esc(it.desc); box.appendChild(d2); }\n    a.appendChild(box);\n    return a;\n  }\n  function rowCard(it) {\n    var a = mk('a', 'lr');\n    a.href = '#/video/' + encodeURIComponent(it.bv || ('av' + it.aid));\n    var th = mk('div', 'th');\n    var img = mk('img'); img.alt = ''; img.src = it.pic || ''; img.setAttribute('referrerpolicy', 'no-referrer');\n    th.appendChild(img);\n    if (it.dur) { var tg = mk('div', 'tagline t2 num'); tg.innerHTML = esc(it.dur); th.appendChild(tg); }\n    a.appendChild(th);\n    var inr = mk('div', 'in');\n    var t = mk('div', 'tt'); t.innerHTML = esc(it.title); inr.appendChild(t);\n    if (it.desc) { var d = mk('div', 'ds'); d.innerHTML = esc(it.desc); inr.appendChild(d); }\n    var m = mk('div', 'mt2 num');\n    var bu = upSpan(it);\n    if (it.mid) bu.className = 'ul b';\n    m.appendChild(bu);\n    m.appendChild(document.createTextNode(' · ' + count(it.view) + ' 播放 · ' + count(it.dan) + ' 弹幕' +\n      (it.pubtxt ? ' · ' + it.pubtxt : '')));\n    inr.appendChild(m);\n    a.appendChild(inr);\n    return a;\n  }\n  function grid(items) {\n    var g = mk('div', 'g'), i;\n    for (i = 0; i < items.length; i++) g.appendChild(card(items[i]));\n    return g;\n  }\n  function rows(items) {\n    var w = mk('div', 'ls'), i;\n    for (i = 0; i < items.length; i++) w.appendChild(rowCard(items[i]));\n    return w;\n  }\n  function status(txt, spin) {\n    var d = mk('div', 'st');\n    if (spin) { d.innerHTML = '<div class=\"spin\"></div><div style=\"margin-top:9px\">' + esc(txt) + '</div>'; }\n    else { d.innerHTML = '<div class=\"cr\"></div>' + esc(txt); }\n    return d;\n  }\n  function head(title, sub) {\n    var h = mk('div', 'hd');\n    h.innerHTML = '<h2>' + esc(title) + '</h2>' + (sub ? '<div class=\"sp\">' + sub + '</div>' : '');\n    var t = mk('div', 'ticks');\n    var w = mk('div');\n    w.appendChild(h); w.appendChild(t);\n    return w;\n  }\n\n  var cur = { v: '', q: '' };\n  function route() {\n    stopQr();\n    var h = location.hash || '#/home';\n    var seg = h.slice(2).split('/');\n    var view = seg[0] || 'home';\n    if (view === 'video') { videoPage(decodeURIComponent(seg[1] || '')); mark(''); return; }\n    if (view === 'search') { searchPage(decodeURIComponent(seg.slice(1).join('/') || '')); mark(''); return; }\n    if (view === 'rank') { rankPage(seg[1] || '0'); mark('rank'); return; }\n    if (view === 'hist') { histPage(); mark('hist'); return; }\n    if (view === 'set') { setPage(); mark('set'); return; }\n    if (view === 'user') { userPage(seg[1] || ''); mark(''); return; }\n    if (view === 'auth') { authPage(); mark('auth'); return; }\n    if (view === 'msg') { msgPage(); mark('auth'); return; }\n    if (view === 'fav') { favPage(); mark('auth'); return; }\n    homePage(seg[1] || 'popular'); mark('home');\n  }\n  function mark(v) {\n    var bs = document.querySelectorAll('#tabs button,#tbar button'), i;\n    for (i = 0; i < bs.length; i++) { if (bs[i].getAttribute('data-v') === v) addC(bs[i], 'on'); else delC(bs[i], 'on'); }\n  }\n  function setMain(node) {\n    var m = $('#main');\n    m.innerHTML = '';\n    if (node) m.appendChild(node);\n    window.scrollTo(0, 0);\n  }\n  function sideNav(items, active) {\n    var s = $('#side');\n    s.innerHTML = '';\n    var ah = mk('h4', null, '账号'); s.appendChild(ah);\n    var al = [['#/auth', '登录'], ['#/msg', '私信'], ['#/fav', '收藏']], ai;\n    for (ai = 0; ai < al.length; ai++) {\n      var aa = mk('a', '', al[ai][1] + '<i>›</i>');\n      aa.href = al[ai][0];\n      s.appendChild(aa);\n    }\n    var h = mk('h4', null, '分区'); s.appendChild(h);\n    for (var i = 0; i < items.length; i++) {\n      var a = mk('a', items[i][0] === active ? 'on' : '', esc(items[i][1]) + '<i class=\"num\">' + (items[i][2] || '') + '</i>');\n      a.href = items[i][3] + items[i][0];\n      s.appendChild(a);\n    }\n  }\n\n  function homePage(mode) {\n    var box = mk('div');\n    sideNav(RID_LIST.map(function (r) { return [r[0], r[1], '', '#/rank/']; }), -1);\n    var titles = { popular: '综合推荐', square: '大家都在搜' };\n    box.appendChild(head(titles[mode] || '综合推荐', ''));\n    var nav = mk('div');\n    nav.innerHTML = '<span class=\"chip p\">热门</span><a class=\"chip\" href=\"#/home/rcmd\">新动态</a>' +\n      '<a class=\"chip\" href=\"#/home/square\">热搜榜</a><a class=\"chip\" href=\"#/rank/0\">排行榜</a>';\n    box.appendChild(nav);\n    var body = mk('div');\n    body.appendChild(status('加载中', 1));\n    box.appendChild(body);\n    setMain(box);\n    if (mode === 'square') {\n      api('square', {}, function (j) {\n        body.innerHTML = '';\n        if (j.code !== 0) { body.appendChild(status(why(j))); return; }\n        var w = mk('div');\n        var arr = j.data || [];\n        if (!arr.length) { w.appendChild(status('今天没有热搜数据')); body.appendChild(w); return; }\n        for (var i = 0; i < arr.length; i++) {\n          var a = mk('a', 'lr');\n          a.href = '#/search/' + encodeURIComponent(arr[i].main || arr[i]);\n          a.innerHTML = '<span class=\"num\" style=\"float:left;width:24px;color:#d86da5\">' + (i + 1) +\n            '</span><span style=\"display:block;margin-left:26px\">' + esc(arr[i].main || arr[i]) + '</span>';\n          w.appendChild(a);\n        }\n        body.appendChild(w);\n      });\n      return;\n    }\n    api(mode, {}, function (j) {\n      body.innerHTML = '';\n      if (j.code !== 0) {\n        var st = status('加载失败 · 重试');\n        st.onclick = function () { homePage(mode); }; st.style.cursor = 'pointer';\n        body.appendChild(st); return;\n      }\n      var list = j.data || [];\n      if (!list.length) { body.appendChild(status('暂无内容')); return; }\n      body.appendChild(grid(list));\n      var more = mk('button', 'loadmore', '加载更多');\n      more.onclick = function () {\n        more.innerHTML = '加载中…'; more.disabled = true;\n        api(mode, { pn: Math.floor(list.length / 20) + 1 }, function (k) {\n          more.disabled = false;\n          if (k.code === 0 && (k.data || []).length) {\n            var g = mk('div', 'g');\n            for (var i = 0; i < k.data.length; i++) { list.push(k.data[i]); g.appendChild(card(k.data[i])); }\n            body.insertBefore(g, more);\n            more.innerHTML = '加载更多';\n          } else { more.innerHTML = why(k) === '接口异常 ' + k.code ? '没有更多了' : why(k); setTimeout(function () { more.innerHTML = '再试一次'; }, 900); }\n        });\n      };\n      body.appendChild(more);\n    });\n  }\n\n  function rankPage(rid) {\n    var box = mk('div');\n    box.appendChild(head('排行榜', ''));\n    var body = mk('div'); body.appendChild(status('加载中', 1)); box.appendChild(body);\n    setMain(box);\n    sideNav(RID_LIST.map(function (r) { return [r[0], r[1], '', '#/rank/']; }), rid);\n    api('rank', { rid: rid }, function (j) {\n      body.innerHTML = '';\n      if (j.code !== 0) { body.appendChild(status(j.message || '加载失败')); return; }\n      body.appendChild(grid(j.data || []));\n    });\n  }\n  var RID_LIST = [[0, '全站'], [1, '动画'], [3, '音乐'], [4, '游戏'], [5, '娱乐'], [11, '电视剧'],\n    [23, '电影'], [129, '舞蹈'], [155, '时尚'], [160, '生活'], [188, '科技'], [217, '宠物'], [234, '运动']];\n\n  var lastQ = '';\n  function searchPage(q) {\n    q = (q || '').replace(/^\\s+|\\s+$/g, '');\n    var box = mk('div');\n    if (!q) {\n      var recent = sget('slog', []) || [];\n      box.appendChild(head('搜索', ''));\n      if (recent.length) {\n        var w = mk('div');\n        for (var i = 0; i < recent.length; i++) {\n          var r = mk('a', 'lr');\n          r.href = '#/search/' + encodeURIComponent(recent[i]);\n          r.innerHTML = '<span style=\"color:#7a828b;font-size:11px\">历史</span>&nbsp;&nbsp;' + esc(recent[i]);\n          w.appendChild(r);\n        }\n        box.appendChild(w);\n      } else box.appendChild(status('暂无搜索记录'));\n      setMain(box);\n      return;\n    }\n    $('#sq').value = q;\n    box.appendChild(head('“' + q + '”', ''));\n    var body = mk('div'); body.appendChild(status('搜索中', 1)); box.appendChild(body);\n    setMain(box);\n    lastQ = q;\n    api('search', { keyword: q, page: 1 }, function (j) {\n      body.innerHTML = '';\n      if (j.code !== 0) { body.appendChild(status(why(j))); return; }\n      var list = j.data || [];\n      if (!list.length) { body.appendChild(status('无结果')); return; }\n      var sl = sget('slog', []) || [], out = [q], i;\n      for (i = 0; i < sl.length && out.length < 12; i++) if (sl[i] !== q) out.push(sl[i]);\n      sset('slog', out);\n      body.appendChild(rows(list));\n      var pn = 1;\n      var more = mk('button', 'loadmore', '下一页');\n      more.onclick = function () {\n        more.innerHTML = '加载中…'; more.disabled = true;\n        api('search', { keyword: q, page: ++pn }, function (k) {\n          more.disabled = false;\n          if (k.code === 0 && (k.data || []).length) {\n            var w = mk('div', 'ls');\n            for (var i2 = 0; i2 < k.data.length; i2++) { list.push(k.data[i2]); w.appendChild(rowCard(k.data[i2])); }\n            body.insertBefore(w, more); more.innerHTML = '下一页';\n          } else { more.innerHTML = why(k); }\n        });\n      };\n      body.appendChild(more);\n    });\n  }\n\n  function histPage() {\n    var box = mk('div');\n    var list = sget('hist', []) || [];\n    box.appendChild(head('观看历史', '<span class=\"num\">本机 · ' + list.length + ' 条</span>'));\n    if (!list.length) box.appendChild(status('暂无记录'));\n    else {\n      var w = mk('div'), i;\n      for (i = 0; i < list.length; i++) {\n        var it = list[i], a = rowCard(it);\n        if (num(it.pos) > 5) {\n          var t = mk('div', 'tagline num bl-pos'); t.innerHTML = '上次 ' + fmt(it.pos); t.style.left = 'auto'; t.style.right = '1px'; t.style.top = 'auto'; t.style.bottom = '23px';\n          a.querySelector('.th').appendChild(t);\n        }\n        var del = mk('button', null, '×');\n        del.style.cssText = 'position:absolute;right:6px;top:6px;width:22px;height:22px;background:#fff;border:1px solid #aab3bc;color:#7a828b;font-size:14px;line-height:20px';\n        (function (bv) { del.onclick = function (e) { e.preventDefault(); e.stopPropagation(); var l = sget('hist', []) || [], o = [], i2; for (i2 = 0; i2 < l.length; i2++) if (l[i2].bv !== bv) o.push(l[i2]); sset('hist', o); histPage(); }; })(it.bv);\n        a.appendChild(del);\n        a.href = '#/video/' + encodeURIComponent(it.bv);\n        w.appendChild(a);\n      }\n      box.appendChild(w);\n      var clr = mk('button', 'loadmore', '清空全部历史');\n      clr.onclick = function () { if (confirm('确定清空这 ' + list.length + ' 条观看记录？')) { sset('hist', []); histPage(); } };\n      box.appendChild(clr);\n    }\n    setMain(box);\n  }\n  function fmt(s) { s = num(s); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + p2(m) : m) + ':' + p2(x); }\n  function p2(n) { return (n < 10 ? '0' : '') + n; }\n\n  function setPage() {\n    var box = mk('div');\n    box.appendChild(head('播放与界面设置', '<span class=\"num\">保存在本机</span>'));\n    var w = mk('div', 'set');\n    box.appendChild(w);\n    function sw(label, key, hint) {\n      var dl = mk('dl');\n      dl.innerHTML = '<dt>' + label + '</dt>';\n      var dd = mk('dd');\n      var s = mk('span', 'sw' + (SET[key] ? ' on' : '')); s.innerHTML = '<i></i>';\n      s.onclick = function () { SET[key] = SET[key] ? 0 : 1; saveSet(); if (SET[key]) addC(s, 'on'); else delC(s, 'on'); if (key === 'dm') dmApplyOpts(); };\n      dd.appendChild(s); dl.appendChild(dd);\n      w.appendChild(dl);\n      if (hint) { var h2 = mk('div', 'hint', hint); h2.style.paddingTop = '0'; w.appendChild(h2); }\n    }\n    function sel(label, key, opts, hint) {\n      var dl = mk('dl');\n      dl.innerHTML = '<dt>' + label + '</dt>';\n      var dd = mk('dd'), s = mk('select');\n      for (var i = 0; i < opts.length; i++) {\n        var o = mk('option', null, opts[i][1]); o.value = opts[i][0];\n        if (String(SET[key]) === String(opts[i][0])) o.selected = true;\n        s.appendChild(o);\n      }\n      s.onchange = function () { var n2 = parseFloat(s.value); SET[key] = isNaN(n2) ? s.value : n2; saveSet(); if (key === 'dm') dmApplyOpts(); };\n      dd.appendChild(s); dl.appendChild(dd); w.appendChild(dl);\n      if (hint) w.appendChild(mk('div', 'hint', hint));\n    }\n    sel('清晰度上限', 'qn', [[16, '360P'], [32, '480P'], [64, '720P'], [80, '1080P'], [116, '1080P60']]);\n    sw('弹幕总开关', 'dm');\n    sel('弹幕速度', 'dmspeed', [[0.6, '慢'], [1, '标准'], [1.5, '快'], [2, '很快']]);\n    sel('弹幕不透明度', 'dmop', [[40, '40%'], [60, '60%'], [80, '80%'], [100, '100%']]);\n    sel('弹幕覆盖宽度', 'dmarea', [[60, '60%'], [80, '80%'], [100, '全屏']]);\n    sw('自动连播下一 P', 'auto');\n    sw('记录观看历史', 'histOn');\n    var dl = mk('dl');\n    dl.innerHTML = '<dt>登录 Cookie</dt><dd></dd>';\n    var dd = dl.querySelector('dd'), inp = mk('input');\n    inp.type = 'text'; inp.value = sget('ck', '') || '';\n    inp.placeholder = '留空即可';\n    inp.onchange = function () {\n      sset('ck', inp.value.replace(/^\\s+|\\s+$/g, ''));\n    };\n    dd.appendChild(inp);\n    w.appendChild(dl);\n    var dl2 = mk('dl');\n    dl2.innerHTML = '<dt>清理本机数据</dt><dd></dd>';\n    var dd2 = mk('dd'), b = mk('button', 'chip p', '历史记录 + 搜索记录');\n    b.onclick = function () { sset('hist', []); sset('slog', []); };\n    dd2.appendChild(b); dl2.appendChild(dd2); w.appendChild(dl2);\n    setMain(box);\n  }\n\n  var VID = { bv: '', cid: 0, pages: [], cur: 0, v: null, seg: null };\n  var videoEl = null, dmz = null, dmCv = null, dmCtx = null, dmList = [], dmRun = 0, dmIdx = 0, dmQ = [];\n  function videoPage(id) {\n    id = (id || '').replace(/^\\s+|\\s+$/g, '');\n    if (!id) { setMain(status('参数不完整')); return; }\n    var q = {};\n    if (/^BV/i.test(id)) q.bvid = id;\n    else if (/^av/i.test(id)) q.aid = id.slice(2);\n    else if (/^[0-9]+$/.test(id)) q.aid = id;\n    else { q.bvid = id; }\n    var box = mk('div');\n    box.appendChild(status('解析视频信息…', 1));\n    setMain(box);\n    api('view', q, function (j) {\n      if (j.code !== 0) { setMain(status(j.message || '视频信息获取失败')); return; }\n      renderVideo(j.data);\n    });\n  }\n  function renderVideo(v) {\n    VID.bv = v.bv; VID.pages = v.pages || []; VID.v = v; VID.cur = 0;\n    var hist = histOf(v.bv);\n    if (hist && num(hist.cid)) {\n      for (var i = 0; i < VID.pages.length; i++) if (VID.pages[i].cid === num(hist.cid)) { VID.cur = i; break; }\n    }\n    var box = mk('div');\n\n    var plr = mk('div', 'plr');\n    videoEl = mk('video');\n    videoEl.setAttribute('playsinline', ''); videoEl.setAttribute('webkit-playsinline', '');\n    videoEl.setAttribute('preload', 'metadata'); videoEl.poster = v.pic || '';\n    videoEl.style.display = 'block';\n    plr.appendChild(videoEl);\n    dmz = mk('div', null); dmz.id = 'dmz';\n    dmCv = mk('canvas'); dmz.appendChild(dmCv);\n    plr.appendChild(dmz);\n    var ctl = mk('div', 'ctl');\n    ctl.innerHTML =\n      '<div class=\"bar2\" id=\"pd\"><i></i><b style=\"left:0\"></b></div>' +\n      '<div class=\"btns\">' +\n      '<button id=\"bp\">播放</button>' +\n      '<button id=\"bdm\"' + (SET.dm ? ' class=\"on\"' : '') + '>' + (SET.dm ? '弹幕 开' : '弹幕 关') + '</button>' +\n      '<button id=\"bq\">720P</button>' +\n      '<button id=\"bfs\">全屏</button>' +\n      '<button id=\"bh\">历史位置</button>' +\n      '<span class=\"tm num\" id=\"ptm\">0:00 / --</span>' +\n      '</div>';\n    plr.appendChild(ctl);\n    box.appendChild(plr);\n\n    var hd = mk('div', 'vhd');\n    hd.innerHTML = '<h1>' + esc(v.title) + '</h1><div class=\"sub\"><span>播放 <b class=\"num\">' + count(v.view) +\n      '</b></span><span>弹幕 <b class=\"num\">' + count(v.dan) + '</b></span><span>评论 <b class=\"num\">' + count(v.reply) +\n      '</b></span><span>' + esc(v.pubtxt) + '</span><span class=\"chip\">' + esc(v.tname) + '</span></div>';\n    box.appendChild(hd);\n    var who = mk('div', 'who link');\n    who.innerHTML = '<img src=\"' + esc(v.face) + '\" alt=\"\" referrerpolicy=\"no-referrer\"><div class=\"n\">' + esc(v.up) +\n      '</div><div class=\"s\">共 ' + v.videos + ' 个分 P · 投稿于 ' + esc(v.pubtxt) + '</div>';\n    var vbtns = mk('div', 'vbtns');\n    var b3 = mk('button', 'chip p', '一键三连');\n    b3.onclick = function (e) { e = e || window.event; e.cancelBubble = true; if (e.stopPropagation) e.stopPropagation(); triple(b3); };\n    var bs = mk('button', 'chip p', '字幕'); var bd = mk('button', 'chip p', '下载');\n    bs.onclick = function (e) { e = e || window.event; e.cancelBubble = true; if (e.stopPropagation) e.stopPropagation(); openProxy('https://snapany.com/zh/bilibili-subtitle-downloader', v); };\n    bd.onclick = function (e) { e = e || window.event; e.cancelBubble = true; if (e.stopPropagation) e.stopPropagation(); openProxy('https://peanutdl.com/zh/bilibili', v); };\n    vbtns.appendChild(b3); vbtns.appendChild(bs); vbtns.appendChild(bd); who.appendChild(vbtns);\n    if (v.mid) who.onclick = function () { location.hash = '#/user/' + v.mid; };\n    box.appendChild(who);\n\n    if (v.desc) {\n      var sec = mk('div', 'sec');\n      sec.innerHTML = '<h3>简介</h3>';\n      var d = mk('div'); d.style.cssText = 'padding:8px 10px;font-size:13px;line-height:20px;white-space:pre-wrap;word-break:break-all;color:#454c54';\n      d.innerHTML = esc(v.desc.slice(0, 1500));\n      sec.appendChild(d); box.appendChild(sec);\n    }\n\n    if (VID.pages.length > 1) {\n      var sp = mk('div', 'sec');\n      sp.innerHTML = '<h3>选集 <span class=\"num\" style=\"float:right\">' + VID.pages.length + ' P</span></h3>';\n      var w = mk('div', 'plist');\n      for (var k = 0; k < VID.pages.length; k++) {\n        var a = mk('a', k === VID.cur ? 'on' : '');\n        a.href = 'javascript:void(0)';\n        a.innerHTML = '<i class=\"num\">' + esc(VID.pages[k].dur || '') + '</i><span>P' + VID.pages[k].idx + ' · ' + esc(VID.pages[k].part) + '</span>';\n        (function (ix) { a.onclick = function () { pickPart(ix); }; })(k);\n        w.appendChild(a);\n      }\n      sp.appendChild(w); box.appendChild(sp);\n    }\n\n    api('tags', { bvid: v.bv, aid: v.aid }, function (j) {\n      if (j.code !== 0 || !j.data || !j.data.length) return;\n      var s2 = mk('div', 'sec'), h2 = mk('div');\n      for (var i2 = 0; i2 < j.data.length; i2++) {\n        var c = mk('a', 'chip', esc(j.data[i2]));\n        c.href = '#/search/' + encodeURIComponent(j.data[i2]);\n        h2.appendChild(c);\n      }\n      s2.innerHTML = '<h3>标签</h3>'; s2.appendChild(h2);\n      box.insertBefore(s2, csec);\n    });\n\n    var csec = mk('div', 'sec');\n    csec.innerHTML = '<h3>评论 <span class=\"num\" style=\"float:right\">' + count(v.reply) + '</span></h3>';\n    var cw = mk('div'); cw.appendChild(status('加载评论', 1));\n    csec.appendChild(cw);\n    box.appendChild(csec);\n    api('reply', { oid: v.aid, next: 0 }, function (j) {\n      cw.innerHTML = '';\n      if (j.code !== 0) { cw.appendChild(status(why(j))); return; }\n      var items = (j.data && j.data.items) || [];\n      if (!items.length) { cw.appendChild(status('还没有评论')); return; }\n      for (var i3 = 0; i3 < items.length; i3++) {\n        var r = items[i3], el = mk('div', 'cm' + (r.top ? ' top' : ''));\n        el.innerHTML = '<img src=\"' + esc(r.face) + '\" alt=\"\" referrerpolicy=\"no-referrer\"><div class=\"bd\"><div class=\"un\"><b>' + esc(r.un) +\n          '</b> · Lv' + r.lv + ' · ' + esc(r.time) + '</div><div class=\"ms\">' + esc(r.msg) + '</div></div>' +\n          '<div class=\"lk num\">' + count(r.like) + '<br>赞</div>';\n        cw.appendChild(el);\n      }\n    });\n\n    var rsec = mk('div', 'sec');\n    rsec.innerHTML = '<h3>接下来看</h3>';\n    var rw = mk('div'); rw.appendChild(status('加载中', 1));\n    rsec.appendChild(rw); box.appendChild(rsec);\n    api('related', { bvid: v.bv }, function (j) {\n      rw.innerHTML = '';\n      if (j.code !== 0 || !j.data || !j.data.length) { rw.appendChild(status('这个视频没有相关推荐')); return; }\n      rw.appendChild(grid(j.data.slice(0, 12)));\n    });\n\n    setMain(box);\n    bindPlayer(ctl, v);\n    dmApplyOpts();                                    \n    pickPart(VID.cur, hist);\n  }\n  function triple(btn) {\n    if (!sget('ck', '')) { location.hash = '#/auth'; return; }\n    if (!VID.v || !VID.v.bv) return;\n    btn.innerHTML = '三连中…'; btn.disabled = true;\n    var res = [];\n    postAct({ act: 'like', bvid: VID.v.bv }, function (j1) {\n      res.push('点赞 ' + (j1.code === 0 ? '成功' : why(j1)));\n      postAct({ act: 'coin', bvid: VID.v.bv }, function (j2) {\n        res.push('投币 ' + (j2.code === 0 ? '成功' : why(j2)));\n        postAct({ act: 'fav', bvid: VID.v.bv, aid: VID.v.aid }, function (j3) {\n          res.push('收藏 ' + (j3.code === 0 ? '成功' : why(j3)));\n          btn.innerHTML = '一键三连'; btn.disabled = false;\n          alert(res.join(' · '));\n        });\n      });\n    });\n  }\n\n  function pickPart(ix, hist) {\n    var p = VID.pages[ix];\n    if (!p) return;\n    VID.cur = ix; var v = VID.v;\n    var links = document.querySelectorAll('.plist a'), i;\n    for (i = 0; i < links.length; i++) { if (i === ix) addC(links[i], 'on'); else delC(links[i], 'on'); }\n    $('#bq') && ($('#bq').innerHTML = '切换中…');\n    dmStop();\n    get('/play?bvid=' + encodeURIComponent(v.bv) + '&cid=' + p.cid + '&qn=' + SET.qn, function (err, txt) {\n      var j;\n      try { j = JSON.parse(txt); } catch (e) { j = { code: -1, message: err || '返回异常' }; }\n      if (j.code !== 0) {\n        alert('播放失败：' + (why(j) || err || ''));\n        return;\n      }\n      VID.cid = p.cid;\n      VID.seg = j.data;\n      var q = $('#bq');\n      if (q) q.innerHTML = (j.data.qname || (j.data.quality + '')) + (j.data.need ? '（已降级）' : '');\n      videoEl.src = j.data.src;\n      videoEl.load();\n      VID.resume = 0;\n      if (hist && num(hist.cid) === p.cid && num(hist.pos) > 5) VID.resume = num(hist.pos);\n      var t = $('#bh');\n      if (t) { t.innerHTML = VID.resume ? '已续 ' + fmt(VID.resume) : '回到上次位置'; t.style.color = VID.resume ? '#f3b7d3' : ''; }\n      if (SET.dm) dmLoad(p.cid);\n      if (SET.auto && !VID.resume) { tryPlay(videoEl) }\n      pushHist({ bv: v.bv, aid: v.aid, title: v.title, pic: v.pic, up: v.up, dur: (p.dur || v.dur), view: v.view, cid: p.cid, part: p.part, pos: 0 });\n    });\n  }\n  function bindPlayer(ctl, v) {\n    var pd = $('#pd'), bar = pd.querySelector('i'), knob = pd.querySelector('b');\n    var bp = $('#bp'), ptm = $('#ptm');\n    function syncBar() {\n      var d = videoEl.duration || 0, c = videoEl.currentTime || 0;\n      var pct = d ? Math.min(100, c / d * 100) : 0;\n      bar.style.width = pct + '%'; knob.style.left = pct + '%';\n      ptm.innerHTML = fmt(c) + ' / ' + (d ? fmt(d) : (v.dur || '--'));\n    }\n    var lastSave = 0;\n    videoEl.onseeking = function () { if (videoEl.__t !== undefined && Math.abs(videoEl.currentTime - videoEl.__t) > 2) dmReset(); videoEl.__t = videoEl.currentTime; };\n    videoEl.ontimeupdate = function () { videoEl.__t = videoEl.currentTime; syncBar(); var t = videoEl.currentTime | 0; if (t - lastSave >= 5) { lastSave = t; if (VID.bv && t > 3) updHist(VID.bv, t, VID.cid); } };\n    videoEl.onprogress = syncBar;\n    videoEl.onloadedmetadata = function () {\n      syncBar(); dmSize();\n      if (VID.resume > 5) { try { videoEl.currentTime = VID.resume; } catch (e) { } VID.resume = 0; }\n      if (!dmRun && SET.dm && VID.cid) dmLoad(VID.cid);\n    };\n    videoEl.onplay = function () { bp.innerHTML = '暂停'; if (SET.dm) dmStart(); };\n    videoEl.onpause = function () { bp.innerHTML = '播放'; dmStop(); save(); };\n    videoEl.onended = function () {\n      save();\n      if (SET.auto && VID.cur + 1 < VID.pages.length) pickPart(VID.cur + 1);\n    };\n    videoEl.onerror = function () {\n      var e = videoEl.error;\n      var code = e ? e.code : 0;\n      var msg = { 1: '加载中止', 2: '网络中断', 3: '解码不支持', 4: '直链失效' }[code] || ('错误 ' + code);\n      bp.innerHTML = '重试';\n      if (!VID._er) { VID._er = 1; alert('播放出错：' + msg); }\n    };\n    bp.onclick = function () {\n      VID._er = 0;\n      if (videoEl.paused) {\n        if (!videoEl.src && VID.seg) pickPart(VID.cur);\n        tryPlay(videoEl);\n      } else { try{videoEl.pause()}catch(e){} }\n    };\n    function seek(e) {\n      var t = e.touches && e.touches[0] ? e.touches[0] : e;\n      var r = pd.getBoundingClientRect();\n      var p2 = Math.max(0, Math.min(1, (t.clientX - r.left) / r.width));\n      if (videoEl.duration) { videoEl.currentTime = p2 * videoEl.duration; syncBar(); }\n      try { e.preventDefault(); } catch (err) { }\n    }\n    pd.onclick = seek;\n    pd.ontouchstart = seek;\n    $('#bdm').onclick = function () {\n      SET.dm = SET.dm ? 0 : 1; saveSet();\n      this.innerHTML = SET.dm ? '弹幕 开' : '弹幕 关';\n      if (SET.dm) addC(this, 'on'); else delC(this, 'on');\n      dmApplyOpts();\n    };\n    $('#bq').onclick = function () {\n      var opts = (VID.seg && VID.seg.formats) || [];\n      if (!opts.length) { alert('仅一个清晰度'); return; }\n      var txt = '当前：' + (VID.seg.qname || '') + '\\n可切换：\\n';\n      for (var i = 0; i < opts.length; i++) txt += (i + 1) + '. ' + opts[i].name + ' (' + opts[i].qn + ')\\n';\n      txt += '\\n输入序号切换';\n      var k = prompt(txt, '');\n      if (!k) return;\n      var o = opts[num(k) - 1];\n      if (!o) return;\n      SET.qn = o.qn; saveSet();\n      VID.seg = null;\n      pickPart(VID.cur, histOf(VID.bv));\n    };\n    $('#bfs').onclick = function () {\n      var el = document.querySelector('.plr');\n      if (el.requestFullscreen) { if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen(); }\n      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();\n      else if (videoEl.webkitEnterFullscreen) videoEl.webkitEnterFullscreen();\n      else alert('浏览器不支持全屏');\n    };\n    $('#bh').onclick = function () {\n      var h = histOf(VID.bv);\n      if (!h || !num(h.pos)) { alert('无历史位置'); return; }\n      videoEl.currentTime = num(h.pos);\n      tryPlay(videoEl);\n    };\n    function save() { if (VID.bv && num(videoEl.currentTime) > 3) updHist(VID.bv, videoEl.currentTime, VID.cid); }\n    setInterval(save, 12000);\n    addEventListener('beforeunload', save);\n    videoEl.onclick = function () { if (videoEl.paused) { tryPlay(videoEl) } else { try{videoEl.pause()}catch(e){} } };\n    function fsChg() { setTimeout(dmSize, 80); setTimeout(dmSize, 350); }\n    if (document.addEventListener) {\n      document.addEventListener('fullscreenchange', fsChg, false);\n      document.addEventListener('webkitfullscreenchange', fsChg, false);\n    }\n  }\n\n  function dmSize() {\n    if (!dmCv) return;\n    var r = dmz.getBoundingClientRect();\n    dmCv.width = Math.max(160, r.width | 0);\n    dmCv.height = Math.max(90, r.height | 0);\n    dmCtx = dmCv.getContext ? dmCv.getContext('2d') : null;\n  }\n  function dmLoad(cid) {\n    if (!cid) return;\n    function once(tried) {\n      dmListReset();\n      get('/dm?cid=' + encodeURIComponent(cid), function (err, txt) {\n        if (err || !txt) {\n          if (tried < 1 && VID.cid === cid) { setTimeout(function () { once(1); }, 4000); }\n          return;\n        }\n        var doc = null;\n        try { doc = new DOMParser().parseFromString(txt, 'text/xml'); } catch (e) { }\n        if (!doc || !doc.getElementsByTagName || doc.getElementsByTagName('d').length === 0) {\n          var m = /<d p=\"([^\"]+)\">([^<]*)<\\/d>/g, one;\n          while ((one = m.exec(txt))) dmPush(one[1], one[2]);\n        } else {\n          var ns = doc.getElementsByTagName('d'), i;\n          for (i = 0; i < ns.length; i++) dmPush(ns[i].getAttribute('p'), ns[i].textContent || ns[i].innerHTML);\n        }\n        if (!dmQ.length && tried < 1 && VID.cid === cid) { setTimeout(function () { once(1); }, 4000); return; }\n        dmSort();\n        if (videoEl && !videoEl.paused) dmStart();\n      });\n    }\n    once(0);\n  }\n  function dmListReset() { dmList = []; dmQ = []; dmIdx = 0; lastFrame = 0; }\n  function dmPush(p, text) {\n    var a = String(p).split(',');\n    if (a.length < 5 || !text) return;\n    dmQ.push({ t: parseFloat(a[0]) || 0, mode: num(a[1]), size: num(a[2]) || 25, color: num(a[3]) || 16777215, txt: String(text).slice(0, 60) });\n  }\n  function dmSort() {\n    dmQ.sort(function (a, b) { return a.t - b.t; });\n    dmList = dmQ; dmIdx = 0;\n  }\n  function dmApplyOpts() {\n    if (!$('#bdm')) return;\n    var b = $('#bdm');\n    b.innerHTML = SET.dm ? '弹幕 开' : '弹幕 关';\n    if (SET.dm) addC(b, 'on'); else delC(b, 'on');\n    if (!SET.dm) dmStop();\n    else if (!dmRun && videoEl && !videoEl.paused) dmStart();\n  }\n  var raf = window.requestAnimationFrame ? function (f) { window.requestAnimationFrame(f); } : function (f) { setTimeout(f, 40); };\n  function dmStart() {\n    if (!SET.dm || !dmCtx || dmRun) return;\n    dmRun = 1;\n    loop();\n  }\n  function dmStop() { dmRun = 0; }\n\n  function dmReset() {\n    dmIdx = 0;\n    for (var i = 0; i < dmList.length; i++) dmList[i].shown = 0;\n    if (dmCtx && dmCv) dmCtx.clearRect(0, 0, dmCv.width, dmCv.height);\n    if (SET.dm && videoEl && !videoEl.paused) dmStart();\n  }\n\n  var SCAN_CAP = 160;\n  function dmVisible() {\n    if (!videoEl) return [];\n    var ct = videoEl.currentTime || 0;\n    var sp = parseFloat(SET.dmspeed) || 1;\n    if (sp < 0.2) sp = 0.2;\n    var win = 6 / sp;\n    while (dmIdx < dmList.length && dmList[dmIdx].t < ct - win - 6) dmIdx++;\n    var out = [], i, n = 0;\n    for (i = dmIdx; i < dmList.length && n < SCAN_CAP; i++, n++) {\n      var d = dmList[i];\n      if (d.t - ct > 0.5) break;\n      if (d.t <= ct) out.push(d);\n      if (out.length >= 22) break;\n    }\n    return out;\n  }\n  var lastFrame = 0, lastSzChk = 0, lastCt = 0;\n  function loop() {\n    if (!dmRun) return;\n    var now = Date.now();\n    if (now - lastFrame < 40) {            \n      raf(loop); return;\n    }\n    lastFrame = now;\n    if (dmz && dmCv && now - lastSzChk > 500) {\n      lastSzChk = now;\n      var rr = dmz.getBoundingClientRect();\n      if (Math.abs(rr.width - dmCv.width) > 2 || Math.abs(rr.height - dmCv.height) > 2) dmSize();\n    }\n    var ct0 = videoEl ? (videoEl.currentTime || 0) : 0;\n    if (ct0 + 0.7 < lastCt) dmIdx = 0;\n    lastCt = ct0;\n    var w = dmCv.width, h = dmCv.height;\n    dmCtx.clearRect(0, 0, w, h);\n    if (SET.dm) {\n      var area = w * (num(SET.dmarea) || 100) / 100;\n      var list = dmVisible(), rows = Math.max(2, Math.floor(h / 22)), used = [], i;\n      dmCtx.textBaseline = 'top';\n      for (i = 0; i < list.length && i < 26; i++) {\n        var d = list[i], size = 13, tt = d.txt;\n        dmCtx.font = size + 'px sans-serif';\n        var tw = Math.ceil(dmCtx.measureText ? dmCtx.measureText(tt).width : tt.length * size);\n        var sp = parseFloat(SET.dmspeed) || 1;\n        var el = videoEl.currentTime - d.t;\n        var fix = (d.mode === 5 || d.mode === 14);\n        var prog = el * sp / 6;\n        if (fix) { if (el < 0 || el > 5) continue; }\n        else if (prog < 0 || prog > 1) continue;\n        var col = d.color >>> 0;\n        var op = (num(SET.dmop) || 100) / 100;\n        dmCtx.globalAlpha = op;\n        dmCtx.fillStyle = '#' + ('000000' + col.toString(16)).slice(-6);\n        dmCtx.strokeStyle = 'rgba(0,0,0,.55)';\n        dmCtx.lineWidth = 2;\n        if (fix) {\n          dmCtx.fillText(tt, (w - tw) / 2, d.mode === 5 ? 2 : h - 20);\n        } else {\n          var row = 0;\n          for (row = 0; row < rows; row++) if (!used[row]) break;\n          if (row >= rows) row = i % rows;\n          used[row] = 1;\n          var x = area * (1 - prog) - tw * prog;\n          var y = 2 + row * 21;\n          try { dmCtx.strokeText(tt, x, y); } catch (e) { }\n          dmCtx.fillText(tt, x, y);\n        }\n        dmCtx.globalAlpha = 1;\n      }\n    }\n    raf(loop);\n  }\n\n  function openProxy(url, v) {\n    var link = 'https://www.bilibili.com/video/' + (v.bv || ('av' + v.aid));\n    try {\n      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link);\n      else {\n        var ta = mk('textarea'); ta.value = link; ta.style.cssText = 'position:fixed;left:-9999px';\n        document.body.appendChild(ta); ta.select();\n        try { document.execCommand('copy'); } catch (e) { }\n        document.body.removeChild(ta);\n      }\n    } catch (e) { }\n    window.open(url, '_blank');\n  }\n  function userPage(mid) {\n    mid = String(mid || '').replace(/[^0-9]/g, '');\n    if (!mid) { setMain(status('参数不完整')); return; }\n    var box = mk('div');\n    box.appendChild(status('加载中', 1));\n    setMain(box);\n    api('user', { mid: mid }, function (j) {\n      if (j.code !== 0 || !j.data || !j.data.name) { setMain(status(why(j))); return; }\n      renderUser(j.data);\n    });\n  }\n  function renderUser(u) {\n    var box = mk('div');\n    var hd = mk('div', 'sp-hd');\n    hd.innerHTML = '<div class=\"sp-banner\"></div><div class=\"sp-info\">' +\n      '<img class=\"sp-face\" src=\"' + esc(u.face) + '\" alt=\"\" referrerpolicy=\"no-referrer\">' +\n      '<div class=\"sp-name\">' + esc(u.name) + (u.off ? '<span class=\"chip t\">' + esc(u.off) + '</span>' : '') + '</div>' +\n      '<div class=\"sp-sign\">' + esc(u.sign || '') + '</div>' +\n      '<div class=\"sp-stat num\"><span>粉丝 <b>' + count(u.fans) + '</b></span><span>视频 <b>' + count(u.videos) + '</b></span><span>获赞 <b>' + count(u.like) + '</b></span></div>' +\n      '</div>';\n    box.appendChild(hd);\n    var tb = mk('div', 'sptabs'); tb.innerHTML = '<span>投稿</span>';\n    box.appendChild(tb);\n    var body = mk('div');\n    box.appendChild(body);\n    var more = mk('button', 'loadmore', '加载更多');\n    box.appendChild(more);\n    setMain(box);\n    var pn = 0;\n    function load() {\n      pn++;\n      more.innerHTML = '加载中…'; more.disabled = true;\n      api('uservideos', { mid: u.mid, pn: pn }, function (j) {\n        more.disabled = false; more.innerHTML = '加载更多';\n        if (j.code !== 0) {\n          if (pn === 1) body.appendChild(status(why(j)));\n          more.innerHTML = '没有更多了';\n          return;\n        }\n        var arr = j.data || [], i;\n        if (!arr.length) {\n          if (pn === 1) body.appendChild(status('暂无投稿'));\n          more.innerHTML = '没有更多了';\n          return;\n        }\n        for (i = 0; i < arr.length; i++) { arr[i].up = u.name; arr[i].mid = u.mid; }\n        body.appendChild(grid(arr));\n      });\n    }\n    more.onclick = load;\n    load();\n  }\n  var qrTimer = null, qrKey = '';\n  function stopQr() { if (qrTimer) { clearTimeout(qrTimer); qrTimer = null; } }\n  function authPage() {\n    var box = mk('div');\n    box.appendChild(head('登录', '<span class=\"num\">Cookie 仅保存在本机</span>'));\n    var card = mk('div', 'authcard');\n    box.appendChild(card);\n    setMain(box);\n    function done(n) {\n      if ((location.hash || '').split('/')[1] !== 'auth') return;\n      if (n) renderProfile(card); else renderLogin(card);\n    }\n    if (sget('ck', '')) navGet(done); else { NAVQ = 0; NAV = null; done(null); }\n  }\n  function renderProfile(card) {\n    card.innerHTML = '';\n    var pr = mk('div', 'prof');\n    pr.innerHTML = '<img src=\"' + esc(NAV.face) + '\" alt=\"\" referrerpolicy=\"no-referrer\">' +\n      '<div class=\"pn\">' + esc(NAV.uname) + (NAV.vip ? ' <span class=\"chip t\">大会员</span>' : '') + '</div>' +\n      '<div class=\"ps\">Lv' + NAV.level + ' · UID ' + NAV.mid + '</div>';\n    card.appendChild(pr);\n    var lk = mk('div');\n    var a1 = mk('a', 'abtn', '查看私信'); a1.href = '#/msg';\n    var a2 = mk('a', 'abtn', '查看收藏'); a2.href = '#/fav';\n    var out = mk('button', 'abtn g', '退出登录');\n    out.onclick = function () { sset('ck', ''); NAV = null; NAVQ = 0; refreshAuthUI(); authPage(); };\n    lk.appendChild(a1); lk.appendChild(a2); lk.appendChild(out);\n    card.appendChild(lk);\n  }\n  function renderLogin(card) {\n    card.innerHTML = '<div class=\"authtabs\"><button class=\"on\" data-t=\"qr\">扫码登录</button><button data-t=\"ck\">Cookie 登录</button></div><div id=\"authbody\"></div>';\n    var ts = card.querySelectorAll('.authtabs button'), i;\n    for (i = 0; i < ts.length; i++) {\n      ts[i].onclick = function () {\n        for (var k = 0; k < ts.length; k++) delC(ts[k], 'on');\n        addC(this, 'on');\n        if (this.getAttribute('data-t') === 'qr') qrPanel(); else ckPanel();\n      };\n    }\n    qrPanel();\n  }\n  function qrPanel() {\n    stopQr();\n    var b = $('#authbody');\n    if (!b) return;\n    b.innerHTML = '<div id=\"qrbox\"><div class=\"qrstate\">正在获取二维码…</div></div>';\n    get('/qr', function (err, txt) {\n      var j = null; try { j = JSON.parse(txt); } catch (e) { }\n      var d = j && j.code === 0 && j.data;\n      var qb = $('#qrbox');\n      if (!qb) return;\n      if (!d || !d.url) {\n        qb.innerHTML = '<div class=\"qrstate\">二维码获取失败</div>';\n        var rb = mk('button', 'abtn', '重新获取');\n        rb.style.display = 'block'; rb.style.margin = '0 auto';\n        rb.onclick = qrPanel;\n        qb.appendChild(rb);\n        return;\n      }\n      var svg = '';\n      try {\n        if (window.qrcode) { var q = qrcode(0, 'M'); q.addData(d.url); q.make(); svg = q.createSvgTag({ cellSize: 5, margin: 0 }); }\n      } catch (e) { }\n      qb.innerHTML = svg || '<div class=\"qrstate\">二维码渲染失败</div>';\n      var st = mk('div', 'qrstate', '使用哔哩哔哩手机 App 扫码登录');\n      st.style.lineHeight = '18px';\n      qb.parentNode.insertBefore(st, qb.nextSibling);\n      qrKey = d.key;\n      poll();\n    });\n    function poll() {\n      qrTimer = setTimeout(function () {\n        if ((location.hash || '').split('/')[1] !== 'auth') return;\n        get('/qrpoll?key=' + encodeURIComponent(qrKey), function (err, txt) {\n          var j = null; try { j = JSON.parse(txt); } catch (e) { }\n          var d = (j && j.data) || {};\n          var st = $('#authbody .qrstate');\n          if (d.code === 0 && d.ck) {\n            sset('ck', d.ck);\n            NAV = null; NAVQ = 0;\n            if (st) st.innerHTML = '登录成功，正在进入…';\n            navGet(function () { if ((location.hash || '').split('/')[1] === 'auth') authPage(); });\n            return;\n          }\n          if (st) st.innerHTML = d.code === 86090 ? '已扫码，请在手机上确认' :\n            d.code === 86082 ? '二维码已失效，请刷新' : '等待扫码…';\n          if (d.code === 86082) {\n            var rb = $('#authbody .abtn');\n            if (!rb) {\n              rb = mk('button', 'abtn', '重新获取二维码');\n              rb.style.display = 'block'; rb.style.margin = '6px auto 0';\n              rb.onclick = qrPanel;\n              $('#authbody').appendChild(rb);\n            }\n            return;\n          }\n          poll();\n        });\n      }, 2500);\n    }\n  }\n  function ckPanel() {\n    stopQr();\n    var b = $('#authbody');\n    if (!b) return;\n    b.innerHTML = '<textarea id=\"ckin\" placeholder=\"粘贴 B 站 Cookie（至少包含 SESSDATA、bili_jct、DedeUserID）\"></textarea>' +\n      '<div class=\"qrstate\" style=\"text-align:left\">获取方法：电脑浏览器登录 bilibili.com 后按 F12，在“应用/Application → Cookie”里复制这三项拼成 <span class=\"num\">name=value; name=value</span> 形式；整串 Cookie 也可以。</div>' +\n      '<button class=\"abtn\" id=\"cksav\">保存并验证</button> <button class=\"abtn g\" id=\"ckclr\">清除 Cookie</button>';\n    var inp = $('#ckin');\n    inp.value = sget('ck', '') || '';\n    $('#cksav').onclick = function () {\n      var v = (inp.value || '').replace(/^\\s+|\\s+$/g, '');\n      if (!v) { alert('请先粘贴 Cookie'); return; }\n      sset('ck', v);\n      NAV = null; NAVQ = 0;\n      navGet(function (n) {\n        if (n) authPage();\n        else { alert('验证失败：Cookie 可能无效或已过期'); }\n      });\n    };\n    $('#ckclr').onclick = function () { sset('ck', ''); NAV = null; NAVQ = 0; refreshAuthUI(); inp.value = ''; };\n  }\n\n  function rel(ts) {\n    var s = Math.max(0, Math.floor(Date.now() / 1000) - num(ts));\n    if (!ts) return '';\n    if (s < 60) return '刚刚';\n    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';\n    if (s < 86400) return Math.floor(s / 3600) + ' 小时前';\n    if (s < 86400 * 30) return Math.floor(s / 86400) + ' 天前';\n    var d = new Date(num(ts) * 1000);\n    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());\n  }\n  function needLogin(body) {\n    body.innerHTML = '';\n    body.appendChild(status('需要先登录'));\n    var a = mk('a', 'loadmore', '去登录');\n    a.href = '#/auth';\n    body.appendChild(a);\n  }\n  function msgPage() {\n    var box = mk('div');\n    box.appendChild(head('私信', ''));\n    var body = mk('div'); body.appendChild(status('加载中', 1)); box.appendChild(body);\n    setMain(box);\n    navGet(function (n) {\n      if (!n) { needLogin(body); return; }\n      api('msgunread', {}, function (u) {\n        var d = (u && u.code === 0 && u.data) || {};\n        var badges = mk('div');\n        badges.innerHTML = '<span class=\"chip p\">回复 ' + (d.group || 0) + '</span>' +\n          '<span class=\"chip p\">@ ' + (d.at || 0) + '</span>' +\n          '<span class=\"chip p\">私信 ' + (d.pm || 0) + '</span>' +\n          '<span class=\"chip p\">系统通知 ' + (d.news || 0) + '</span>';\n        body.innerHTML = '';\n        body.appendChild(badges);\n        postAct({ act: 'sessions' }, function (j) {\n          var w = mk('div', 'ls');\n          if (j.code !== 0) { w.appendChild(status(j.message || '暂时无法读取会话列表')); body.appendChild(w); return; }\n          var arr = j.data || [];\n          if (!arr.length) { w.appendChild(status('暂无会话')); body.appendChild(w); return; }\n          for (var i = 0; i < arr.length; i++) {\n            var s = arr[i];\n            var r = mk('a', 'lr');\n            r.href = s.mid ? '#/user/' + s.mid : 'javascript:void(0)';\n            r.innerHTML = '<div class=\"th\" style=\"width:56px\"><img src=\"' + esc(s.face) + '\" alt=\"\" referrerpolicy=\"no-referrer\"></div>' +\n              '<div class=\"in\"><div class=\"tt\">' + esc(s.name || ('UID ' + s.mid)) + '</div>' +\n              '<div class=\"ds\">' + esc(s.text || '') + '</div>' +\n              '<div class=\"mt2\">' + rel(s.ts) + '</div></div>' +\n              (s.unread ? '<span class=\"bdg2 num\">' + (s.unread > 99 ? '99+' : s.unread) + '</span>' : '');\n            w.appendChild(r);\n          }\n          body.appendChild(w);\n        });\n      });\n    });\n  }\n\n  var favSel = 0;\n  function favPage() {\n    var box = mk('div');\n    box.appendChild(head('我的收藏', ''));\n    var body = mk('div'); body.appendChild(status('加载中', 1)); box.appendChild(body);\n    setMain(box);\n    navGet(function (n) {\n      if (!n) { needLogin(body); return; }\n      api('favfolders', { up_mid: n.mid }, function (j) {\n        body.innerHTML = '';\n        var arr = (j && j.code === 0 && j.data) || [];\n        if (!arr.length) { body.appendChild(status(j && j.code !== 0 ? why(j) : '还没有收藏夹')); return; }\n        var ok = false, i;\n        for (i = 0; i < arr.length; i++) if (arr[i].id === favSel) ok = true;\n        if (!ok) favSel = arr[0].id;\n        var chips = mk('div');\n        chips.style.cssText = 'padding:4px 0 8px';\n        for (i = 0; i < arr.length; i++) {\n          var b = mk('button', 'chip' + (arr[i].id === favSel ? ' p' : ''), esc(arr[i].title) + ' (' + arr[i].cnt + ')');\n          (function (id) { b.onclick = function () { favSel = id; favPage(); }; })(arr[i].id);\n          chips.appendChild(b);\n        }\n        body.appendChild(chips);\n        var w = mk('div'); w.appendChild(status('加载中', 1));\n        body.appendChild(w);\n        api('favlist', { media_id: favSel, pn: 1 }, function (k) {\n          w.innerHTML = '';\n          if (k.code !== 0) { w.appendChild(status(why(k))); return; }\n          var list = k.data || [];\n          if (!list.length) { w.appendChild(status('这个收藏夹是空的')); return; }\n          w.appendChild(rows(list));\n        });\n      });\n    });\n  }\n\n  function boot() {\n    var tb = document.querySelectorAll('#tabs button,#tbar button'), i;\n    for (i = 0; i < tb.length; i++) {\n      tb[i].onclick = function () {\n        var v = this.getAttribute('data-v');\n        location.hash = v === 'home' ? '#/home/popular' : '#/' + v;\n      };\n    }\n    var sq = $('#sq'), sg = $('#sug'), timer = null;\n    function doSearch() {\n      var q = (sq.value || '').replace(/^\\s+|\\s+$/g, '');\n      sg.className = 'sug hide';\n      if (!q) return;\n      if (/^(BV[0-9A-Za-z]{8,14}|av[0-9]+|[0-9]{5,})$/i.test(q)) { location.hash = '#/video/' + encodeURIComponent(q); sq.blur(); return; }\n      var nh = '#/search/' + encodeURIComponent(q);\n      if (location.hash === nh) route(); else location.hash = nh;\n      sq.blur();\n    }\n    $('#sgo').onclick = doSearch;\n    sq.onkeydown = function (e) { e = e || window.event; if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault && e.preventDefault(); doSearch(); } };\n    function sug() {\n      var q = (sq.value || '').replace(/^\\s+|\\s+$/g, '');\n      if (!q || q.length > 30) { sg.className = 'sug hide'; return; }\n      api('square', { q: q }, function (j) { });\n      get('/api?ep=search&keyword64=' + b64e(q) + '&page_size=8', function (err, txt) {\n        var j = null; try { j = JSON.parse(txt); } catch (e) { }\n        var items = (j && j.code === 0 && j.data) ? j.data.slice(0, 7) : [];\n        if (!items.length) { sg.className = 'sug hide'; return; }\n        var html = '', i;\n        for (i = 0; i < items.length; i++) {\n          var tt = String(items[i].title).replace(/<[^>]*>/g, '');\n          html += '<div data-k=\"' + esc(tt.slice(0, 40)).replace(/\"/g, '') + '\">' + esc(tt.slice(0, 40)) + '</div>';\n        }\n        sg.innerHTML = html;\n        sg.className = 'sug';\n        var ds = sg.getElementsByTagName('div');\n        for (i = 0; i < ds.length; i++) {\n          ds[i].onclick = function () {\n            sq.value = this.getAttribute('data-k'); sg.className = 'sug hide';\n            location.hash = '#/search/' + encodeURIComponent(sq.value);\n          };\n        }\n      });\n    }\n    sq.onkeyup = function () {\n      clearTimeout(timer);\n      timer = setTimeout(sug, 320);\n    };\n    sq.onfocus = function () { if (sq.value) sug(); };\n    document.onclick = function (e) {\n      var t = e.target || e.srcElement;\n      if (t && (t.id === 'sq' || t.id === 'sgo' || (t.parentNode && t.parentNode.className === 'sug'))) return;\n      sg.className = 'sug hide';\n    };\n    var onrz = function () { dmSize(); };\n    if (window.addEventListener) { window.addEventListener('resize', onrz, false); window.addEventListener('orientationchange', onrz, false); }\n    addEventListener('hashchange', route);\n    if (sget('ck', '')) navGet(function () { });\n    var sp = document.getElementById('splash');\n    if (sp) {\n      var gone = false;\n      function hideSp() {\n        if (gone) return;\n        gone = true;\n        try { sessionStorage.setItem('bl_spl', '1'); } catch (e) { }\n        addC(sp, 'out');\n        setTimeout(function () { sp.style.display = 'none'; }, 460);\n      }\n      try {\n        if (sessionStorage.getItem('bl_spl') === '1') { gone = true; sp.style.display = 'none'; }\n      } catch (e2) { }\n      if (!gone) {\n        var gb = document.getElementById('sgogo');\n        if (gb) gb.onclick = hideSp;\n        setTimeout(hideSp, 5000);\n      }\n    }\n    route();\n  }\n  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(boot, 0);\n  else addEventListener('DOMContentLoaded', boot);\n})();\n\n</script>\n</body>\n</html>\n";


var CFG = {
  VER: '1.0.9-n5',
  UA_DESK: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  REF: 'https://www.bilibili.com/',
  QN_MAX_ANON: 64,
  QN_NAME: { 6: '240P', 16: '360P', 32: '480P', 64: '720P', 74: '720P 60帧', 80: '1080P', 112: '1080P 高码率', 116: '1080P60', 120: '4K', 125: 'HDR', 126: '杜比视界', 127: '8K' },
  TTL_MEDIA: 10800, TTL_API: 60, TTL_DM: 600, TTL_NAV: 10800,
};

var MIXIN = [46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17,
  0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52];


var RIDS = [
  [0, '全站'], [1, '动画'], [3, '音乐'], [4, '游戏'], [5, '娱乐'],
  [11, '电视剧'], [23, '电影'], [129, '舞蹈'], [155, '时尚'],
  [160, '生活'], [188, '科技'], [217, '宠物'], [234, '运动'],
];


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

function pic(u, size) {
  if (!u) return '';
  var s = String(u).replace(/^http:/, 'https:').replace(/^\/\//, 'https://');
  var m = s.match(/^https:\/\/((?:i[0-9]|avatar)\.hdslb\.com)\/(bfs\/[A-Za-z0-9_.\/-]+\.(?:jpg|jpeg|png|webp|gif))(@[0-9a-zA-Z._-]+)?(?:\?[^\s]*)?$/i);
  if (!m) return '';
  var host = m[1], path = m[2] + (m[3] || '');
  if (path.indexOf('@') < 0 && !/\.gif$/i.test(path)) path += '@' + (size || '480w_300h_1c.webp');
  return 'https://' + host + '/' + path;
}
function imgProxyable(hostKey, path) {
  var h = String(hostKey || '');
  if (!/^(i[0-9]|avatar)$/.test(h)) return null;
  if (path.indexOf('..') >= 0 || path.indexOf('//') === 0) return null;

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
function dstr(ts) {
  var d = new Date(num(ts) * 1000);
  if (isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}


function bname(u) { var s = String(u).slice(String(u).lastIndexOf('/') + 1); return s.split('.')[0]; }
function mixinKey(a, b) {
  var raw = a + b, o = '';
  for (var i = 0; i < 32; i++) o += raw.charAt(MIXIN[i]);
  return o;
}
var nav = { key: '', at: 0 };



var CK = '';
var UCK = '';
var DEV = { b3: '', b4: '', fp: '', lsid: '', uuid: '', nut: '', ticket: '', tex: 0, at: 0 };
function hexRand(n) {
  var g = new Uint8Array(n); crypto.getRandomValues(g);
  var s = '', i; for (i = 0; i < n; i++) s += (g[i] < 16 ? '0' : '') + g[i].toString(16);
  return s;
}
function genUuid() {
  var pool = '0123456789ABCDEF', s = '', i, o = 0, P = [8, 4, 4, 4, 12], parts = [];
  for (i = 0; i < 32; i++) s += pool.charAt(Math.floor(Math.random() * 16));
  for (i = 0; i < P.length; i++) { parts.push(s.substr(o, P[i])); o += P[i]; }
  var t = String(Date.now() % 100000); while (t.length < 5) t = '0' + t;
  return parts.join('-') + t + 'infoc';
}
function devCookies() {
  var c = [];
  if (DEV.b3) c.push('buvid3=' + DEV.b3);
  if (DEV.b4) c.push('buvid4=' + DEV.b4);
  if (DEV.fp) c.push('buvid_fp=' + DEV.fp);
  if (DEV.lsid) c.push('b_lsid=' + DEV.lsid);
  if (DEV.uuid) c.push('_uuid=' + DEV.uuid);
  if (DEV.nut) c.push('b_nut=' + DEV.nut);
  if (DEV.ticket) { c.push('bili_ticket=' + DEV.ticket); c.push('bili_ticket_expires=' + DEV.tex); }
  return c;
}
async function devHmac(msg) {
  var k = await crypto.subtle.importKey('raw', new TextEncoder().encode('XgwSnGZ1p'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  var b = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  var a = new Uint8Array(b), s = '', i;
  for (i = 0; i < a.length; i++) s += (a[i] < 16 ? '0' : '') + a[i].toString(16);
  return s;
}
async function devTicket(force) {
  var now = Math.floor(Date.now() / 1000);
  if (!force && DEV.ticket && now < DEV.tex - 24 * 3600) return;
  try {
    var sig = await devHmac('ts' + now);
    var hd = {
      'user-agent': CFG.UA_DESK, referer: CFG.REF,
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/x-www-form-urlencoded',
    };
    var cks = []; if (CK) cks.push(CK);
    cks = cks.concat(devCookies());
    if (cks.length) hd.cookie = cks.join('; ');
    var r = await fetch('https://api.bilibili.com/bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket?key_id=ec02&hexsign=' + sig + '&context%5Bts%5D=' + now,
      { method: 'POST', headers: hd, body: '' });
    var j = await r.json(); var d = j && j.data;
    if (d && d.ticket) { DEV.ticket = String(d.ticket); DEV.tex = (num(d.created_at) || now) + 259200; }
  } catch (e) { }
}
function hApi() {
  var h = {
    'user-agent': CFG.UA_DESK,
    referer: CFG.REF,
    accept: 'application/json, text/plain, */*',
    'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-site',
  };
  var ck = [];
  if (UCK) ck.push(UCK); else if (CK) ck.push(CK);
  ck = ck.concat(devCookies());
  if (ck.length) h.cookie = ck.join('; ');
  return h;
}
function hImg() {
  return {
    'user-agent': CFG.UA_DESK, referer: CFG.REF,
    accept: 'image/webp,image/apng,image/*,*/*;q=0.8', 'accept-language': 'zh-CN,zh;q=0.9',
    'sec-fetch-dest': 'image', 'sec-fetch-mode': 'no-cors', 'sec-fetch-site': 'cross-site',
  };
}

async function ensureBuvid(force) {
  var nowMs = Date.now();
  if (!force && DEV.b3 && nowMs - DEV.at < 3600 * 1000) { await devTicket(false); return DEV.b3; }
  if (!DEV.nut) DEV.nut = String(Math.floor(nowMs / 1000));
  if (!DEV.fp) DEV.fp = hexRand(16);
  if (!DEV.lsid) DEV.lsid = hexRand(4).toUpperCase() + '_' + nowMs.toString(16).toUpperCase();
  if (!DEV.uuid) DEV.uuid = genUuid();
  try {
    var r = await fetch('https://api.bilibili.com/x/frontend/finger/spi', { headers: hApi() });
    var j = await r.json(); var d = j && j.data;
    if (d && d.b_3) DEV.b3 = String(d.b_3);
    if (d && d.b_4 && String(d.b_4).length < 150) DEV.b4 = String(d.b_4);
  } catch (e) { }
  if (!DEV.b3) {
    try {
      var hd = {
        'user-agent': CFG.UA_DESK,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'accept-language': 'zh-CN,zh;q=0.9',
      };
      if (CK) hd.cookie = CK;
      var r2 = await fetch('https://www.bilibili.com/', { headers: hd });
      var sc = typeof r2.headers.getSetCookie === 'function' ? r2.headers.getSetCookie().join('|') : (r2.headers.get('set-cookie') || '');
      var m = sc.match(/buvid3=([^;]+)/);
      if (m) DEV.b3 = decodeURIComponent(m[1]);
    } catch (e) { }
  }
  DEV.at = nowMs;
  await devTicket(false);
  return DEV.b3;
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


function hApiM() {
  return {
    'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    referer: 'https://m.bilibili.com/',
    accept: 'application/json',
  };
}
async function getText(url, noCache, kind, hd) {
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
  var r = await fetch(url, { headers: hd || hApi() });
  var text = await r.text();
  if (!hd && (text.indexOf('"code":-352"') >= 0 || text.indexOf('"code":-412"') >= 0)) {
    await ensureBuvid(true);
    r = await fetch(url, { headers: hApi() });
    text = await r.text();
  }

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
async function getJson(url, noCache, hd) {
  var t = await getText(url, noCache, 'json', hd);
  try { return JSON.parse(t); } catch (e) { return { code: -1, message: '上游返回非 JSON（HTTP 层异常）' }; }
}



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
  user: { u: 'https://api.bilibili.com/x/web-interface/card', pick: function (j) {
    var c = (j.data && j.data.card) || {};
    return { mid: num(c.mid), name: strip(c.name, 40), face: pic(c.face, '120w_120h_1c.webp'),
      sign: strip(c.sign, 120), fans: num(c.fans),
      off: (c.Official && c.Official.role > 0) ? strip(c.Official.title, 30) : '',
      videos: num(j.data && j.data.archive_count), like: num(j.data && j.data.like_num) };
  } },
  uservideos: { u: 'https://api.bilibili.com/x/space/arc/search', m: 1, nocache: 1, d: { ps: 30, pn: 1, order: 'pubdate' }, pick: function (j) {
    var d = j.data || {}, arr = (d.list && d.list.vlist) || [], out = [], i;
    for (i = 0; i < arr.length; i++) {
      var it = arr[i]; if (!it) continue;
      out.push({ bv: it.bvid || '', aid: num(it.aid), title: strip(it.title, 160), pic: pic(it.pic),
        up: strip(it.author, 40), mid: num(it.mid), view: num(it.play), dan: num(it.video_review),
        dur: dur(it.duration), pub: num(it.pubdate), desc: dstr(it.pubdate) });
    }
    return out;
  } },
  uservideosW: { u: 'https://api.bilibili.com/x/space/wbi/arc/search', sig: 1, nocache: 1, d: { ps: 30, pn: 1, order: 'pubdate', platform: 'web' }, pick: function (j) {
    var d = j.data || {}, arr = (d.list && d.list.vlist) || [], out = [], i;
    for (i = 0; i < arr.length; i++) {
      var it = arr[i]; if (!it) continue;
      out.push({ bv: it.bvid || '', aid: num(it.aid), title: strip(it.title, 160), pic: pic(it.pic),
        up: strip(it.author, 40), mid: num(it.mid), view: num(it.plays), dan: num(it.video_review),
        dur: dur(it.duration), pub: num(it.pubdate), desc: dstr(it.pubdate) });
    }
    return out;
  } },
  uservideosR: { u: 'https://api.bilibili.com/x/series/recArchivesByKeywords', nocache: 1, d: { ps: 30, keywords: '' }, pick: function (j, q) {
    var mid = String(q.mid || ''), out = [], arr = (j.data && j.data.archives) || [], i;
    for (i = 0; i < arr.length; i++) {
      var it = arr[i];
      if (!it || String(it.upMid) !== mid) continue;
      out.push({ bv: it.bvid || '', aid: num(it.aid), title: strip(it.title, 160), pic: pic(it.pic),
        up: '', mid: num(it.upMid), view: num(it.stat && it.stat.view), dan: 0,
        dur: dur(it.duration), pub: num(it.pubdate), desc: dstr(it.pubdate) });
    }
    return out;
  } },
  nav: { u: 'https://api.bilibili.com/x/web-interface/nav', nocache: 1, pick: function (j) {
    var d = j.data || {};
    return { login: !!d.is_login, mid: num(d.mid), uname: strip(d.uname, 40), face: pic(d.face, '120w_120h_1c.webp'),
      level: num(d.level_info && d.level_info.current_level), vip: num(d.vipStatus) ? 1 : 0 };
  } },
  msgunread: { u: 'https://api.bilibili.com/x/msgfeed/unread', nocache: 1, pick: function (j) {
    var d = j.data || {};
    return { at: num(d.at), pm: num(d.pm), group: num(d.group), news: num(d.news), authorize: num(d.authorize) };
  } },
  favfolders: { u: 'https://api.bilibili.com/x/v3/fav/folder/created/list-all', nocache: 1, pick: function (j) {
    var arr = (j.data && j.data.list) || [], out = [], i;
    for (i = 0; i < arr.length; i++) {
      var f = arr[i]; if (!f) continue;
      out.push({ id: num(f.id), title: strip(f.name, 40), cnt: num(f.media_count), cover: pic(f.cover) });
    }
    return out;
  } },
  favlist: { u: 'https://api.bilibili.com/x/v3/fav/resource/list', nocache: 1, d: { ps: 20, pn: 1 }, pick: function (j) {
    var arr = (j.data && j.data.medias) || [], out = [], i;
    for (i = 0; i < arr.length; i++) {
      var m = arr[i]; if (!m) continue;
      out.push({ bv: m.bvid || '', aid: num(m.id), title: strip(m.title, 160), pic: pic(m.cover),
        up: strip(m.upper && m.upper.name, 40), mid: num(m.upper && m.upper.mid),
        view: num(m.cnt && m.cnt.play), dan: 0, dur: dur(m.duration), pub: num(m.ptime), desc: ago(m.ptime) });
    }
    return out;
  } },
};

function cards(arr, isSearch) {
  var out = [];
  for (var i = 0; i < (arr || []).length; i++) {
    var it = arr[i]; if (!it) continue;
    var st = it.stat || {};
    out.push({
      bv: it.bvid || '', aid: num(it.aid || it.id), mid: num(it.mid || (it.owner && it.owner.mid)),
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


var PB_TIMEOUT = 5500;
function pbOff(env) {
  try { if (env && env.PB_OFF) return true; } catch (e) { }
  try { if (typeof process !== 'undefined' && process.env && process.env.PB_OFF) return true; } catch (e) { }
  return false;
}
function pbLink(raw) {
  var s = String(raw || '').trim().slice(0, 300);
  var mu = s.match(/https?:\/\/[^\s<>"']*(?:bilibili\.com|b23\.tv)[^\s<>"']*/i);
  if (mu) return mu[0];
  var mb = s.match(/\b(BV[0-9A-Za-z]{10})\b/i);
  if (mb) return 'https://www.bilibili.com/video/' + mb[1];
  var ma = s.match(/\bav(\d+)\b/i);
  if (ma) return 'https://www.bilibili.com/video/av' + ma[1];
  return '';
}
function pbResolveTimeoutMs() { return PB_TIMEOUT - 4000; }
var PB_ALPHA = 'fZodR9XQDSUm21yCkr6zBqiveYah8bt4xsWpHnJE7jL5VG3guMTKNPAwcF', PB_S = [11, 10, 3, 8, 4, 6], PB_X = 177451812, PB_Y = 8728348608;
function av2bv(av) {
  av = ((num(av) ^ PB_X) + PB_Y);
  var r = 'BV1  4 1 7 2'.split(''), i;
  for (i = 0; i < 6; i++) r[PB_S[i]] = PB_ALPHA.charAt(Math.floor(av / Math.pow(58, i)) % 58);
  return r.join('');
}
async function pbResolve(link) {
  var s = String(link || '');
  var mb = s.match(/BV[0-9A-Za-z]{10}/);
  if (mb) return 'https://www.bilibili.com/video/' + mb[0];
  var ma = s.match(/\bav(\d+)\b/i);
  if (ma) return 'https://www.bilibili.com/video/' + av2bv(ma[1]);
  if (!/^https?:\/\//i.test(s)) return '';
  var ac = null, to = null;
  try { ac = new AbortController(); to = setTimeout(function () { ac.abort(); }, pbResolveTimeoutMs()); } catch (e) { }
  try {
    var r = await fetch(s, { redirect: 'follow', signal: ac ? ac.signal : undefined, headers: { accept: 'text/html,*/*' } });
    var t = '';
    try { t = await r.text(); } catch (e) { t = ''; }
    var fin = String((r && r.url) || s);
    var mm = t.match(/"bvid"\s*:\s*"(BV[0-9A-Za-z]{10})"/i) || fin.match(/\/video\/(BV[0-9A-Za-z]{10})/) || t.match(/BV[0-9A-Za-z]{10}/);
    if (mm) return 'https://www.bilibili.com/video/' + String(mm[1] || mm[0]).toUpperCase();
  } catch (e) { } finally { if (to) clearTimeout(to); }
  return '';
}
async function peanutGet(bvid, aid, env) {
  if (pbOff(env)) return null;
  var link = pbLink(bvid) || (/^BV[0-9A-Za-z]{6,15}$/.test(String(bvid || '')) ? 'https://www.bilibili.com/video/' + String(bvid).slice(0, 20)
    : (num(aid) ? 'https://www.bilibili.com/video/av' + num(aid) : ''));
  if (!link) return null;
  link = (await pbResolve(link)) || link;
  var ac = null, to = null;
  try { ac = new AbortController(); to = setTimeout(function () { ac.abort(); }, PB_TIMEOUT); } catch (e) { }
  try {
    var r = await fetch('https://xapi.peanutdl.com/beibei', {
      method: 'POST', signal: ac ? ac.signal : undefined,
      headers: { 'content-type': 'application/json', referer: 'https://peanutdl.com/zh/bilibili' },
      body: JSON.stringify({ api: 'BEIBEI', url: link, captcha: '', id: '', captcha_code: '', captcha_id: '', turnstile_token: '', captcha_type: '' }),
    });
    var j = await r.json();
    if (num(j && j.status) !== 0 || !j.mp4 || !j.mp4.player_url || !j.info) return null;
    return j;
  } catch (e) { return null; }
  finally { if (to) clearTimeout(to); }
}
function pbEpoch(iso) { var t = Date.parse(String(iso || '').replace(' ', 'T')); return isNaN(t) ? 0 : Math.floor(t / 1000); }
function pbCard(pg) {
  var info = pg.info || {}, mp4 = pg.mp4 || {};
  var sec = Math.round(num(mp4.info_length) / 1000);
  return { bv: String(info.Bvid || info.Urlend || ''), aid: num(info.Aid),
    title: strip(info.Title, 160), pic: pic(info.Pic), up: strip(info.Name, 40),
    view: 0, dan: 0, dur: dur(sec), pub: pbEpoch(info.Time),
    desc: 'Peanut 直解 · ' + strip(info.Titlep, 60) };
}
function peanutOne(pg) {
  var info = pg.info || {}, mp4 = pg.mp4 || {};
  var pts = Date.parse(String(info.Time || '')) || 0;
  var sec = Math.round(num(mp4.info_length) / 1000);
  return {
    bv: String(info.Bvid || info.Urlend || ''), aid: num(info.Aid), cid: num(info.Cid),
    title: strip(info.Title, 200), desc: String(info.Desc2 || info.Desc || '').slice(0, 2000),
    pic: pic(info.Pic, '960w_600h_1c.webp'),
    up: strip(info.Name, 40), mid: 0, face: '',
    view: 0, dan: 0, reply: 0, like: 0, coin: 0, fav: 0, share: 0,
    pub: Math.floor(pts / 1000), pubtxt: ago(Math.floor(pts / 1000)), dur: dur(sec), 
    tname: '', videos: 1, pay: 0, ugcPay: 0, tm: 0,
    pages: [{ cid: num(info.Cid), part: strip(info.Titlep || info.Title, 80), dur: dur(sec), idx: 1 }],
  };
}
function peanutQn(desc) {
  var m = String(desc || '').match(/(\d+)\s*[Pp]/);
  var q = m ? num(m[1]) : 720;
  var map = { 2160: 120, 1440: 116, 1080: 80, 720: 64, 480: 32, 360: 16, 240: 6, 120: 6 };
  return map[q] || 64;
}


var APPKEY = '1d8b6e7d45233436', APPSEC = 'c2ed53a74eeefe3cf99fbd01d8c9c375';
async function appSearch(kw, page) {
  var q = { appkey: APPKEY, build: '7290300', device: 'iphone', keyword: String(kw || '').slice(0, 80), mobi_app: 'iphone_bilibili', page: String(num(page) || 1), ps: '20' };
  var ks = Object.keys(q).sort();
  var s = ks.map(function (k) { return enc(k) + '=' + enc(q[k]); }).join('&');
  var j = await getJson('https://app.bilibili.com/x/v2/search?' + s + '&sign=' + md5hex(s + APPSEC), true,
    { 'user-agent': 'bili-universal/7290300 os/ios model/iPhone 15 mobi_app/iphone_bilibili osVer/17.0 network/2', referer: 'https://www.bilibili.com/' });
  var arr = (j && j.data && j.data.item) || [], out = [], i;
  for (i = 0; i < arr.length; i++) {
    var it = arr[i];
    if (!it || (it.goto && it.goto !== 'video') || !it.param) continue;
    out.push({ bv: it.bvid || '', aid: num(it.param), title: strip(it.title, 160), pic: pic(it.cover || it.url),
      up: strip(it.author || it.nickname, 40), mid: num(it.mid), view: num(it.play), dan: num(it.danmaku),
      dur: dur(it.duration), pub: num(it.senddate || it.pubdate), desc: strip(it.desc, 130) });
  }
  return out;
}

var BUVID_CK = '', BUVID_TS = 0;
async function buvidSearch(kw, page) {
  if (!BUVID_CK || Date.now() - BUVID_TS > 30 * 60 * 1000) {
    var sj = await getJson('https://api.bilibili.com/x/frontend/finger/spi', true,
      { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' });
    if (sj && sj.code === 0 && sj.data && sj.data.b_3) {
      BUVID_CK = 'buvid3=' + sj.data.b_3 + '; buvid4=' + (sj.data.b_4 || '') + ';';
      BUVID_TS = Date.now();
    }
  }
  if (!BUVID_CK) return [];
  var j = await getJson('https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword='
    + enc(String(kw || '').slice(0, 80)) + '&page=' + (num(page) || 1) + '&page_size=20', true,
    { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36', cookie: BUVID_CK, referer: 'https://search.bilibili.com/' });
  var arr = (j && j.data && j.data.result) || [], out = [], i;
  for (i = 0; i < arr.length; i++) {
    var it = arr[i];
    if (!it || !it.bvid) continue;
    out.push({ bv: it.bvid, aid: num(it.aid), title: strip(it.title, 160), pic: pic(it.picurl || it.pic),
      up: strip(it.author, 40), mid: num(it.mid), view: num(it.play), dan: num(it.video_review),
      dur: dur(it.duration), pub: num(it.senddate || it.pubdate), desc: strip(it.description, 130) });
  }
  return out;
}

async function apiCall(name, params, forceSign, envP) {
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
  var j = await getJson(spec.u + '?' + qs, !!spec.nocache, spec.m ? hApiM() : undefined);
  if (j && j.code === 0 && spec.pick) j = { code: 0, data: spec.pick(j, q), signed: signed ? 1 : 0 };
  else if (j && j.code !== 0) {
    if (name === 'view') {
      var pg0 = await peanutGet(params.bvid || params.bv, params.aid, envP);
      if (pg0) return { code: 0, data: peanutOne(pg0), signed: 0, peanut: 1 };
    }
    if (name === 'search') {
      var bj = await buvidSearch(params.keyword || '', params.page || 1);
      if (bj.length) return { code: 0, data: bj, signed: 0, buvid: 1 };
      var aj = await appSearch(params.keyword || '', params.page || 1);
      if (aj.length) return { code: 0, data: aj, signed: 0, app: 1 };
      var lk = pbLink(params.keyword || '');
      if (lk) {
        var pg2 = await peanutGet(lk, 0, envP);
        if (pg2) return { code: 0, data: [pbCard(pg2)], signed: signed ? 1 : 0, peanut: 1 };
      }
    }
    if (name === 'uservideos') {
      var wj = await apiCall('uservideosW', params, false, envP);
      if (!(wj && wj.code === 0 && wj.data && wj.data.length)) wj = await apiCall('uservideosR', params, false, envP);
      if (wj && wj.code === 0 && wj.data && wj.data.length) return wj;
    }
    j = { code: j.code, message: String(j.message || j.msg || '接口返回异常').slice(0, 120) };
  }
  if (name === 'search' && j && j.code === 0 && (!j.data || !j.data.length)) {
    var bj0 = await buvidSearch(params.keyword || '', params.page || 1);
    if (bj0.length) return { code: 0, data: bj0, signed: 0, buvid: 1 };
    var aj0 = await appSearch(params.keyword || '', params.page || 1);
    if (aj0.length) return { code: 0, data: aj0, signed: 0, app: 1 };
  }
  return j;
}


async function pbPlayData(pg, cid, qn, env) {
  var mpg = pg.mp4 || {}, mi = (pg.info || {}).Cid ? num((pg.info || {}).Cid) : (cid || 0);
  var pq = peanutQn(mpg.info_description);
  var u = (mpg.backup_url && mpg.backup_url.length ? [mpg.player_url].concat(mpg.backup_url) : [mpg.player_url])
    .filter(function (x) { return typeof x === 'string' && /^https?:/i.test(x); });
  var pref = /upos-zj|moyi|bcing|upzjmoe|upzj1mimoss|mirror01|mirrorcos/;
  u.sort(function (a, b) { return (pref.test(b) ? 1 : 0) - (pref.test(a) ? 1 : 0); });
  return {
    cid: mi, quality: pq, qname: strip(mpg.info_description, 20) + ' · Peanut',
    sizeMB: Math.round(num(mpg.info_size) / 1048576 * 10) / 10,
    sec: Math.round(num(mpg.info_length) / 1000),
    src: u.length ? await mediaUrl(u, env, UCK || CK) : '',
    pbPick: 'mp4.player_url',
    fallbacks: u.length, formats: [{ qn: pq, name: strip(mpg.info_description, 20) + ' (Peanut)', vip: 0 }],
    video_codecs: [], need: pq < qn ? 1 : 0,
  };
}


async function resolvePlay(q, env) {
  var bv = String(q.bvid || q.bv || '').slice(0, 20);
  var cid = num(q.cid), aid = num(q.aid), qn = num(q.qn);
  var hasCookie = !!(env && env.BILI_COOKIE) || !!UCK;
  var max = (env && num(env.QN_MAX)) || CFG.QN_MAX_ANON;
  if (!hasCookie) max = Math.min(max, CFG.QN_MAX_ANON);
  if (!qn || qn > max) qn = max;
  if (!cid && !bv && !aid) return { code: -1, message: '缺少视频参数' };
  if (!cid) {
    var v = await apiCall('view', { bvid: bv, aid: aid }, false, env);
    if (v.code !== 0) return v;
    cid = num(v.data.cid);
    if (!v.data.pages.length) return { code: -2, message: '这个视频没有可播的分 P' };
  }
  var p = await apiCall('playurl', { bvid: bv, aid: aid, cid: cid, qn: qn });
  var pbTry = null;
  if (p.code !== 0) pbTry = await peanutGet(bv, aid, env);
  if (p.code !== 0 && pbTry) return { code: 0, data: await pbPlayData(pbTry, cid, qn, env) };
  if (p.code !== 0) return p;
  var d = p.data || {};
  var seg = (d.durl || [])[0];
  var urls = seg ? [seg.url].concat(seg.backup_url || []) : [];
  urls = urls.filter(function (u) { return typeof u === 'string' && /^https?:/i.test(u); });
  if (!urls.length) {
    if (!pbTry) pbTry = await peanutGet(bv, aid, env);
    if (pbTry) return { code: 0, data: await pbPlayData(pbTry, cid, qn, env) };
    return { code: -3, message: '没有可直连的 mp4（付费/会员/版权限制）' };
  }
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

      src: await mediaUrl(urls, env, UCK || CK),
      fallbacks: urls.length, formats: fmts,
      video_codecs: (d.video_codecs || []).map(function (c) { return c.width + 'x' + c.height + ' ' + c.codecs; }).slice(0, 4),
      need: num(d.quality) < qn ? 1 : 0,
    },
  };
}


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
async function mediaUrl(urls, env, ck) {
  var exp = Math.floor(Date.now() / 1000) + CFG.TTL_MEDIA;
  var body = b64(JSON.stringify(urls.slice(0, 4)));
  var c = ck ? b64(String(ck)) : '';
  return '/m?e=' + exp + '&u=' + encodeURIComponent(body) + '&c=' + encodeURIComponent(c) + '&s=' + encodeURIComponent(await sigOf(exp + '|' + body + '|' + c, env));
}
async function mediaRead(params, env) {
  var exp = num(params.get('e')), body = params.get('u') || '', s = params.get('s') || '', c = params.get('c') || '';
  if (!exp || !body) return null;
  if (exp < Math.floor(Date.now() / 1000)) return null;
  if (s !== await sigOf(exp + '|' + body + '|' + c, env)) return null;
  var urls;
  try { urls = JSON.parse(unb64(body)); } catch (e) { return null; }
  if (!Array.isArray(urls) || !urls.length) return null;
  for (var i = 0; i < urls.length; i++) {
    var h;
    try { h = new URL(urls[i]).hostname; } catch (e) { return null; }
    if (!/(^|\.)(bilivideo\.(com|cn)|upbilibres\.clpyun\.com|mcdnbta\.com|bilitile\.com|uphoscxacp\.com|bilivideo\.moe|bas.bilibili\.com|hdslb\.com)$/i.test(h)) return null;
  }
  var ck = '';
  try { ck = c ? unb64(c) : ''; } catch (e) { ck = ''; }
  return { urls: urls, ck: /^[A-Za-z0-9%=;:._\-&+ ]{1,3000}$/.test(ck) ? ck : '' };
}


async function serveMedia(params, request, env) {
  var m = await mediaRead(params, env);
  if (!m) return new Response('bad token', { status: 403, headers: { 'content-type': 'text/plain' } });
  var urls = m.urls;
  var hdrs = { 'user-agent': CFG.UA_DESK, referer: CFG.REF, 'accept-encoding': 'identity' };
  var useCk = m.ck || UCK || CK;
  if (useCk) hdrs.cookie = useCk;
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


async function serveDm(params) {
  var cid = num(params.get('cid'));
  if (!cid) return new Response('<?xml version="1.0" encoding="UTF-8"?><i></i>', { status: 400, headers: { 'content-type': 'text/xml; charset=utf-8' } });
  var txt;
  try { txt = await getText('https://comment.bilibili.com/' + cid + '.xml', false, 'xml'); }
  catch (e) { txt = '<?xml version="1.0" encoding="UTF-8"?><i></i>'; }
  if (!/^\s*(\u003c\u003fxml|<\?xml|<i>)/.test(txt) && txt.indexOf('<i>') < 0) {
    txt = '<?xml version="1.0" encoding="UTF-8"?><i></i>';   
  }
  return new Response(txt, {
    headers: { 'content-type': 'text/xml; charset=utf-8', 'cache-control': 'public, max-age=' + CFG.TTL_DM, 'access-control-allow-origin': '*' },
  });
}


function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'range, content-type, x-bl-ck',
    'access-control-allow-methods': 'GET, HEAD, POST, OPTIONS',
    'access-control-expose-headers': 'content-range, content-length, accept-ranges',
  };
}
function jsonRes(o, status, extra) {
  var h = Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }, cors(), extra || {});
  return new Response(JSON.stringify(o), { status: status || 200, headers: h });
}

async function handle(request, env, ctx) {

  CK = (env && env.BILI_COOKIE) || '';
  var rawCk = '';
  try { rawCk = String(request.headers.get('x-bl-ck') || ''); } catch (e) { rawCk = ''; }
  UCK = /^[A-Za-z0-9%=;:._\-&+ ]{1,3000}$/.test(rawCk) ? rawCk : '';
  if (!DEV.b3) ctx && ctx.waitUntil && ctx.waitUntil(ensureBuvid(false).catch(function () { }));
  var url = new URL(request.url);
  var p = url.pathname, params = url.searchParams;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
  if (request.method !== 'GET' && request.method !== 'HEAD' && !(request.method === 'POST' && p === '/act')) return jsonRes({ code: -1, message: '只支持 GET' }, 405);

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
        cookie: !!(env && env.BILI_COOKIE), buvid: DEV.b3 ? 1 : 0, ticket: DEV.ticket ? 1 : 0,
      },
    });
    if (p === '/meta') return jsonRes({ code: 0, data: { rids: RIDS, qn: CFG.QN_NAME, max: env && env.BILI_COOKIE ? 127 : CFG.QN_MAX_ANON, ver: CFG.VER } });

    if (p === '/api') {
      var ep = String(params.get('ep') || '').replace(/[^a-z_]/g, '').slice(0, 20);
      if (!ep) return jsonRes({ code: -1, message: '缺少 ep' });
      var q = {};
      params.forEach(function (v, k) { if (k !== 'ep' && k !== 'sign' && k !== '_') q[k] = String(v).slice(0, 300); });
      if (q.keyword64) { try { q.keyword = unb64(q.keyword64).slice(0, 80); } catch (e) { } delete q.keyword64; }
      if (q.q64) { try { q.q = unb64(q.q64).slice(0, 80); } catch (e) { } delete q.q64; }
      var r = await apiCall(ep, q, params.get('sign') === '1', env);
      return jsonRes(r, 200);
    }
    if (p === '/play') return jsonRes(await resolvePlay({ bvid: params.get('bvid'), aid: params.get('aid'), cid: params.get('cid'), qn: params.get('qn') }, env), 200);
    if (p === '/dm') return await serveDm(params);
    if (p === '/m') return await serveMedia(params, request, env);
    if (p === '/img') return await serveImg(params, env);
    if (p === '/qr') {
      var jg = await getJson('https://passport.bilibili.com/x/passport-login/web/qrcode/generate', true);
      var dg = (jg && jg.data) || {};
      return jsonRes({ code: num(jg && jg.code), message: String((jg && jg.message) || '').slice(0, 60),
        data: dg.url ? { url: String(dg.url).slice(0, 300), key: String(dg.qrcode_key || '').slice(0, 64) } : null });
    }
    if (p === '/qrpoll') {
      var qkey = String(params.get('key') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 64);
      if (!qkey) return jsonRes({ code: -1, message: '缺少 key' });
      var pr = await fetch('https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=' + qkey, { headers: hApi() });
      var pj = await pr.json();
      var pd = (pj && pj.data) || {};
      var po = { code: num(pd.code != null ? pd.code : pj.code), message: strip(pd.message || (pj && pj.message) || '', 40) };
      if (num(pd.code) === 0) {
        var scs = typeof pr.headers.getSetCookie === 'function' ? pr.headers.getSetCookie() : [String(pr.headers.get('set-cookie') || '')];
        var want = { SESSDATA: 1, bili_jct: 1, DedeUserID: 1, DedeUserID__ckMd5: 1, sid: 1 }, parts = [], si;
        for (si = 0; si < scs.length; si++) {
          var sm = String(scs[si]).match(/^([^=;]+)=([^;]*)/);
          if (sm && want[sm[1]] && sm[2]) parts.push(sm[1] + '=' + sm[2]);
        }
        po.ck = parts.join('; ');
      }
      return jsonRes({ code: 0, data: po });
    }
    if (p === '/act') {
      if (!UCK) return jsonRes({ code: -101, message: '需要登录' });
      var ab = null;
      try { ab = await request.json(); } catch (e) { ab = null; }
      if (!ab) return jsonRes({ code: -1, message: '请求体异常' });
      var act = String(ab.act || '').replace(/[^a-z_]/g, '').slice(0, 20);
      var csrf = (UCK.match(/(?:^|;\s*)bili_jct=([^;]+)/) || [])[1] || '';
      var av = String(ab.bvid || '').slice(0, 20), aaid = num(ab.aid);
      var ah = hApi();
      ah['content-type'] = 'application/x-www-form-urlencoded';
      ah.origin = 'https://www.bilibili.com';
      async function apost(u, form) {
        try { var rr = await fetch(u, { method: 'POST', headers: ah, body: form }); return await rr.json(); }
        catch (e) { return { code: -1, message: '请求上游失败' }; }
      }
      if (act === 'like') return jsonRes(await apost('https://api.bilibili.com/x/web-interface/archive/like', 'bvid=' + enc(av) + '&csrf=' + enc(csrf) + '&spar='));
      if (act === 'coin') return jsonRes(await apost('https://api.bilibili.com/x/web-interface/archive/coin', 'bvid=' + enc(av) + '&multiply=2&select=0&csrf=' + enc(csrf)));
      if (act === 'fav') {
        var amid = (UCK.match(/DedeUserID=([^;]+)/) || [])[1] || '';
        if (!amid) return jsonRes({ code: -1, message: 'Cookie 缺少 DedeUserID' });
        var fj = await getJson('https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=' + enc(amid), true);
        var fl = (fj && fj.data && fj.data.list) || [];
        if (!fl.length) return jsonRes({ code: -1, message: '没有可用的收藏夹' });
        var fid = num(fl[0].id);
        var fbase = 'rid=' + aaid + '&add_media_ids=' + enc('[' + fid + ']') + '&del_media_ids=' + enc('[]') + '&csrf=' + enc(csrf);
        var fres = await apost('https://api.bilibili.com/x/v3/fav/resource/deal', fbase + '&type=12');
        if (num(fres && fres.code) !== 0) {
          var fres2 = await apost('https://api.bilibili.com/x/v3/fav/resource/deal', fbase + '&type=2');
          if (num(fres2 && fres2.code) === 0) fres = fres2;
        }
        return jsonRes(fres || { code: -1, message: '收藏失败' });
      }
      if (act === 'sessions') {
        var sr = null;
        try {
          sr = await fetch('https://message.bilibili.com/x/sync/msg', {
            method: 'POST',
            headers: { 'user-agent': CFG.UA_DESK, referer: 'https://message.bilibili.com/', cookie: UCK, 'content-type': 'application/json', csrf: csrf },
            body: JSON.stringify({ device: 1, fetch_all: 0, session_list: { count: 20, exemplar: -1, area: 2, area2: 0 } }),
          });
        } catch (e) { return jsonRes({ code: -1, message: '私信接口请求失败' }); }
        var sj = null;
        try { sj = await sr.json(); } catch (e) { sj = null; }
        if (!sj || num(sj.code) !== 0) return jsonRes({ code: sj ? num(sj.code) : -1, message: strip(sj && sj.message, 60) || '私信接口异常', data: [] });
        var sl = (sj.data && sj.data.session_list) || [];
        var profs = (sj.data && sj.data.profiles) || {};
        var sout = [], s2;
        for (s2 = 0; s2 < sl.length; s2++) {
          var ss = sl[s2] || {};
          var lm = ss.latest_message || {};
          var mc = lm.message_content || {};
          var txt = (mc.text && mc.text.content) || mc.content || lm.content || '';
          var tk = profs[String(ss.talker_id)] || ss.talker || {};
          sout.push({ mid: num(ss.talker_id), name: strip(tk.name || tk.uname || '', 40), face: pic(tk.face || tk.src, '64w_64h_1c.webp'),
            text: strip(txt, 120), ts: num(lm.timestamp), unread: num(ss.unread_count) });
        }
        return jsonRes({ code: 0, data: sout });
      }
      return jsonRes({ code: -1, message: '未知操作' });
    }
    if (p === '/favicon.ico') return new Response('', { status: 204 });
    return jsonRes({ code: -404, message: '没有这个路径' }, 404);
  } catch (e) {
    return jsonRes({ code: -9, message: ('' + (e && e.stack || e)).slice(0, 240) }, 500);
  }
}
export { handle };


export const config = {
  path: ['/', '/api', '/play', '/dm', '/m', '/img', '/qr', '/qrpoll', '/act', '/health', '/meta', '/robots.txt', '/index.html'],
};
var NETLIFY_ENV = {
  BILI_COOKIE: (typeof process !== 'undefined' && process.env.BILI_COOKIE) || '',
  SECRET: (typeof process !== 'undefined' && process.env.SECRET) || '',
  QN_MAX: (typeof process !== 'undefined' && process.env.QN_MAX) || '',
  PB_OFF: (typeof process !== 'undefined' && process.env.PB_OFF) || '',
};
export default async function (request, context) {

  if (!request || typeof request.url !== 'string') {
    if (request && request.stage === 'warmUp') return;
    return new Response('ok', { status: 200 });
  }
  var c = { waitUntil: function (p) {
    p = Promise.resolve(p).catch(function () { });
    try { if (context && context.waitUntil) context.waitUntil(p); } catch (e) { }
    return p;
  } };
  return handle(request, NETLIFY_ENV, c);
};

