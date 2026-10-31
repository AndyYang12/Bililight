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



var PAGE_HTML = "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover\">\n<meta name=\"theme-color\" content=\"#d86da5\">\n<meta name=\"format-detection\" content=\"telephone=no\">\n<meta name=\"referrer\" content=\"no-referrer-when-downgrade\">\n<link rel=\"icon\" href=\"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7\">\n<title>biliLight \u00b7 \u8f7b\u88c5\u770bB\u7ad9</title>\n<style>\n\n*{box-sizing:border-box;-webkit-tap-highlight-color:rgba(0,0,0,0);margin:0;padding:0}\nhtml,body{height:100%}\nbody{\n  background:#eef0f3;color:#1c2126;\n  font:14px/1.5 \"Helvetica Neue\",Helvetica,\"Noto Sans CJK SC\",\"Source Han Sans CN\",\"Microsoft YaHei\",sans-serif;\n  -webkit-text-size-adjust:100%\n}\n\n.bg-grid{\n  background-image:\n    linear-gradient(0deg,rgba(28,33,38,.045) 1px,transparent 1px),\n    linear-gradient(90deg,rgba(28,33,38,.045) 1px,transparent 1px),\n    linear-gradient(0deg,rgba(28,33,38,.075) 1px,transparent 1px),\n    linear-gradient(90deg,rgba(28,33,38,.075) 1px,transparent 1px);\n  background-size:16px 16px,16px 16px,64px 64px,64px 64px\n}\n.num{font-family:\"Courier New\",DejaVu Sans Mono,Menlo,monospace;font-variant-numeric:tabular-nums;letter-spacing:0}\n.hide{display:none !important}\na{color:inherit;text-decoration:none}\nbutton{font:inherit;color:inherit;background:none;border:0;cursor:pointer}\ninput,select{font:inherit;color:inherit}\n\n#app{min-height:100%}\n.bar{\n  background:#fff;border-bottom:1px solid #aab3bc;\n  padding:0 10px;height:52px;position:relative;z-index:30\n}\n.bar .row{display:block;padding-top:9px}\n.brand{\n  float:left;font-size:19px;font-weight:700;letter-spacing:-.5px;color:#d86da5;\n  line-height:34px;padding-left:9px;border-left:3px solid #d86da5\n}\n.brand b{color:#1c2126;font-weight:700}\n.tabs{display:none;float:right;line-height:34px}\n.tabs button{\n  float:left;padding:0 12px;height:34px;line-height:34px;color:#454c54;\n  border-left:1px solid #e4e9ed;font-size:14px\n}\n.tabs button.on{color:#d86da5;background:#fdf3f8;border-bottom:3px solid #d86da5;height:34px}\n.sbox{margin:0 0 0 8px;overflow:hidden;position:relative}\n.sbox input{\n  width:100%;height:34px;border:1px solid #aab3bc;background:#e9edf1;\n  padding:0 66px 0 9px;font-size:14px;line-height:32px;outline:none\n}\n.sbox input:focus{background:#fff;border-color:#d86da5}\n.sbox .go{\n  position:absolute;right:0;top:9px;width:62px;height:34px;line-height:33px;text-align:center;\n  background:#d86da5;color:#fff;font-size:13px;border-bottom:3px solid #ae4a7b\n}\n.sbox .go:active{background:#ae4a7b;border-bottom-width:1px}\n.sug{\n  position:absolute;left:0;right:0;top:44px;background:#fff;border:1px solid #aab3bc;z-index:40;\n  box-shadow:0 2px 0 rgba(28,33,38,.12)\n}\n.sug div{padding:9px 10px;border-bottom:1px solid #e4e9ed;font-size:14px}\n.sug div:last-child{border-bottom:0}\n.sug b{color:#d86da5;font-weight:400}\n\n.wrap{max-width:1128px;margin:0 auto;padding:10px}\n.side{float:left;width:184px;display:none}\n.main{margin-left:0}\n@media (min-width:900px){\n  .side{display:block}\n  .main{margin-left:200px}\n  .tabs{display:block}\n}\n\n.side h4{font-size:11px;color:#7a828b;font-weight:400;padding:6px 8px;border-bottom:1px solid #cbd2d9;letter-spacing:1px}\n.side a{display:block;padding:8px;border-bottom:1px solid #e4e9ed;font-size:14px;color:#454c54}\n.side a.on{background:#fff;color:#d86da5;border-left:3px solid #d86da5;padding-left:7px}\n.side a i{float:right;font-style:normal;color:#a9b0b8;font-size:11px}\n\n.hd{border-bottom:1px solid #cbd2d9;padding:4px 0 6px;margin:2px 0 10px;overflow:hidden}\n.hd h2{float:left;font-size:16px;font-weight:700;line-height:22px;padding-left:8px;border-left:3px solid #d86da5}\n.hd .sp{float:right;font-size:11px;color:#7a828b;line-height:22px}\n.hd em{font-style:normal;color:#00a1d6;font-size:11px}\n\n.ticks{height:5px;border-bottom:1px solid #aab3bc;background:\n  repeating-linear-gradient(90deg,#aab3bc 0 1px,transparent 1px 8px);opacity:.7;margin:-6px 0 10px}\n\n.g{margin:0 -4px;overflow:hidden}\n.g:after{content:\"\";display:block;clear:both;height:0}\n.c{\n  float:left;width:50%;padding:0 4px 12px;\n}\n@media (min-width:600px){.c{width:33.333%}}\n@media (min-width:900px){.c{width:25%}}\n@media (min-width:1100px){.c{width:20%}}\n.c .box{background:#fff;border:1px solid #cbd2d9;padding:4px;position:relative}\n.c.tap:active .box{background:#fdf3f8;border-color:#d86da5}\n.th{position:relative;background:#0b0d0f;padding:1px;line-height:0}\n.th img{width:100%;display:block;height:auto}\n\n.th:before,.th:after,.th .b1,.th .b2{\n  content:\"\";position:absolute;width:9px;height:9px;line-height:0;font-size:0;pointer-events:none\n}\n.th:before{left:3px;top:3px;border-left:1px solid #d86da5;border-top:1px solid #d86da5}\n.th:after{right:3px;top:3px;border-right:1px solid #d86da5;border-top:1px solid #d86da5}\n.th .b1{left:3px;bottom:-21px;border-left:1px solid #d86da5;border-bottom:1px solid #d86da5}\n.th .b2{right:3px;bottom:-21px;border-right:1px solid #d86da5;border-bottom:1px solid #d86da5}\n.mt{\n  background:rgba(0,0,0,.8);color:#fff;padding:2px 5px;line-height:14px;\n  font-size:10px;overflow:hidden;white-space:nowrap;position:relative\n}\n.mt .r{float:right;color:#7fd8f5}\n.tt{font-size:13px;line-height:17px;height:34px;overflow:hidden;margin-top:4px;color:#1c2126;\n  display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}\n.ub{font-size:10px;line-height:14px;height:14px;overflow:hidden;color:#7a828b;white-space:nowrap}\n.ub .dot{color:#cbd2d9;padding:0 3px}\n.tagline{position:absolute;left:1px;top:1px;background:#d86da5;color:#fff;font-size:9px;padding:1px 4px}\n.tagline.t2{background:#00a1d6}\n\n.ls{border-top:1px solid #e4e9ed}\n.lr{background:#fff;border-bottom:1px solid #e4e9ed;padding:8px;overflow:hidden;position:relative}\n.lr:active{background:#fdf3f8}\n.lr .th{float:left;width:132px;margin-right:9px}\n@media (min-width:600px){.lr .th{width:176px}}\n.lr .in{overflow:hidden}\n.lr .tt{font-size:14px;line-height:19px;max-height:38px;margin:0 0 3px;overflow:hidden;\n  display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}\n.lr .ds{font-size:11px;color:#7a828b;line-height:16px;height:32px;overflow:hidden;\n  display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}\n.lr .mt2{font-size:10px;color:#7a828b;margin-top:4px}\n.lr .mt2 b{color:#1c2126;font-weight:400}\n\n.st{padding:26px 12px;text-align:center;color:#7a828b;font-size:13px;border:1px solid #cbd2d9;background:#fff}\n.st .cr{\n  width:26px;height:26px;margin:0 auto 10px;position:relative;\n  border:1px solid #cbd2d9\n}\n.st .cr:before,.st .cr:after{content:\"\";position:absolute;background:#d86da5}\n.st .cr:before{left:12px;top:4px;width:1px;height:18px}\n.st .cr:after{top:12px;left:4px;height:1px;width:18px}\n.spin{width:22px;height:22px;margin:0 auto;border:2px solid #cbd2d9;border-top-color:#d86da5;-webkit-animation:sp .8s linear infinite;animation:sp .8s linear infinite}\n@-webkit-keyframes sp{to{-webkit-transform:rotate(360deg)}}\n@keyframes sp{to{transform:rotate(360deg)}}\n.loadmore{display:block;width:100%;padding:11px;background:#fff;border:1px solid #cbd2d9;color:#454c54;font-size:13px;margin-top:2px}\n.loadmore:active{background:#fdf3f8;border-color:#d86da5}\n\n.plr{background:#000;position:relative;line-height:0}\n.plr video{width:100%;display:block;background:#000;min-height:120px}\n#dmz{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;line-height:normal}\n#dmz canvas{display:block;width:100%;height:100%}\n.plr .ctl{\n  position:absolute;left:0;right:0;bottom:0;background:rgba(11,13,15,.86);\n  padding:5px 8px;line-height:normal;color:#fff;font-size:11px\n}\n.plr .bar2{height:3px;background:#2a2e33;position:relative;margin-bottom:5px}\n.plr .bar2 i{display:block;height:100%;background:#d86da5;width:0}\n.plr .bar2 b{position:absolute;top:-3px;width:7px;height:9px;background:#fff;border:1px solid #d86da5;margin-left:-3px;line-height:0;font-size:0}\n.plr .btns button{float:left;padding:4px 7px;color:#fff;font-size:11px;border:1px solid transparent}\n.plr .btns button.on{color:#f3b7d3;border-color:#d86da5}\n.plr .btns button:active{background:#1b1d1f}\n.plr .btns:after{content:\"\";display:block;clear:both}\n.plr .tm{float:right;color:#a9b0b8;padding:4px 2px;line-height:16px}\n.plr .mask{position:absolute;left:0;right:0;top:0;bottom:0}\n.vhd{background:#fff;border-bottom:1px solid #cbd2d9;padding:9px 10px}\n.vhd h1{font-size:16px;line-height:22px;font-weight:700}\n.vhd .sub{font-size:11px;color:#7a828b;margin-top:4px;overflow:hidden}\n.vhd .sub span{float:left;margin-right:12px}\n.vhd .sub b{color:#1c2126;font-weight:400}\n.who{background:#fff;border-bottom:1px solid #cbd2d9;padding:8px 10px;overflow:hidden}\n.who img{float:left;width:38px;height:38px;border:1px solid #aab3bc;margin-right:9px}\n.who .n{font-size:13px;line-height:18px;color:#1c2126}\n.who .s{font-size:11px;color:#7a828b;line-height:15px;height:30px;overflow:hidden}\n.sec{background:#fff;border-bottom:1px solid #cbd2d9;margin-top:8px;padding:0 0 4px}\n.sec h3{font-size:12px;color:#7a828b;font-weight:400;padding:8px 10px 6px;border-bottom:1px solid #e4e9ed;letter-spacing:1px}\n.plist{max-height:340px;overflow-y:auto;-webkit-overflow-scrolling:touch}\n.plist a{display:block;padding:7px 10px;border-bottom:1px solid #f0f2f5;font-size:13px;overflow:hidden}\n.plist a.on{background:#fdf3f8;color:#d86da5;border-left:3px solid #d86da5;padding-left:7px}\n.plist a i{float:right;font-style:normal;color:#7a828b;font-size:10px}\n.plist a span{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}\n.chip{display:inline-block;font-size:10px;border:1px solid #aab3bc;color:#454c54;padding:1px 5px;margin:0 4px 4px 0;background:#f5f7fa}\n.chip.t{border-color:#00a1d6;color:#00a1d6;background:#f0faff}\n.chip.p{border-color:#d86da5;color:#d86da5;background:#fdf3f8}\n.cm{padding:8px 10px;border-bottom:1px solid #e4e9ed;background:#fff;overflow:hidden}\n.cm img{float:left;width:30px;height:30px;border:1px solid #cbd2d9;margin-right:8px}\n.cm .bd{overflow:hidden}\n.cm .un{font-size:11px;color:#7a828b}\n.cm .un b{color:#1c2126;font-weight:400}\n.cm .ms{font-size:13px;line-height:19px;margin-top:2px;word-break:break-all}\n.cm .lk{float:right;font-size:10px;color:#7a828b;text-align:center;padding:0 2px}\n.cm.top{background:#f0faff}\n\n.set dl{background:#fff;border-bottom:1px solid #cbd2d9;padding:8px 10px;overflow:hidden}\n.set dt{font-size:13px;line-height:26px;float:left;width:42%}\n.set dd{margin-left:44%;text-align:right}\n.set select{height:28px;border:1px solid #aab3bc;background:#e9edf1;padding:0 4px;font-size:13px;max-width:100%}\n.set input[type=text]{width:100%;border:1px solid #aab3bc;background:#e9edf1;height:28px;padding:0 6px;font-size:12px}\n.sw{display:inline-block;width:44px;height:22px;border:1px solid #aab3bc;background:#e9edf1;position:relative;vertical-align:middle}\n.sw i{position:absolute;top:1px;left:1px;width:20px;height:18px;background:#fff;border:1px solid #cbd2d9;-webkit-transition:left .12s linear;transition:left .12s linear}\n.sw.on{background:#d86da5;border-color:#ae4a7b}\n.sw.on i{left:21px}\n.hint{font-size:11px;color:#7a828b;padding:8px 10px;line-height:17px}\n.foot{text-align:center;font-size:10px;color:#7a828b;padding:14px 0 22px;line-height:17px}\n\n.tbar{position:fixed;left:0;right:0;bottom:0;height:48px;background:#fff;border-top:1px solid #aab3bc;z-index:30}\n.tbar button{float:left;width:25%;height:48px;font-size:11px;color:#7a828b;line-height:14px;padding-top:9px;border-left:1px solid #e4e9ed}\n.tbar button.on{color:#d86da5;border-bottom:3px solid #d86da5}\n.tbar:after{content:\"\";display:block;clear:both}\nbody{padding-bottom:52px}\n@media (min-width:900px){\n  .tbar{display:none}\n  body{padding-bottom:0}\n}\n\n.plr.full{position:fixed;left:0;top:0;right:0;bottom:0;z-index:90}\n.plr.full video{height:100%}\n.ul{color:#00a1d6}\n.who.link{cursor:pointer}\n.vbtns{float:right;padding-top:10px}\n.vbtns button{margin-left:6px}\n.sp{background:#fff;border:1px solid #cbd2d9;overflow:hidden}\n.sp-banner{height:110px;background:linear-gradient(120deg,#fbf0f6 0%,#f3f7fa 55%,#e7f5fb 100%)}\n.sp-info{padding:0 12px 10px;overflow:hidden}\n.sp-face{float:left;width:76px;height:76px;border:2px solid #fff;background:#eef0f3;margin-top:-38px;position:relative}\n.sp-name{font-size:17px;font-weight:700;line-height:24px;padding:12px 0 0 92px}\n.sp-name .chip{margin-left:6px;vertical-align:middle}\n.sp-sign{font-size:11px;color:#7a828b;padding:2px 0 0 92px;line-height:16px;max-height:32px;overflow:hidden}\n.sp-stat{padding:6px 0 0 92px;font-size:11px;color:#7a828b;overflow:hidden}\n.sp-stat span{float:left;margin-right:16px}\n.sp-stat b{color:#1c2126;font-weight:400;font-size:14px}\n.sptabs{border-bottom:1px solid #cbd2d9;background:#fff;margin-top:8px;padding:0 10px}\n.sptabs span{display:inline-block;padding:9px 12px;font-size:13px;color:#d86da5;border-bottom:3px solid #d86da5}\n@media (min-width:600px){\n  .sp-banner{height:150px}\n  .sp-face{width:96px;height:96px;margin-top:-48px}\n  .sp-name,.sp-sign,.sp-stat{padding-left:112px}\n}\n</style>\n</head>\n<body class=\"bg-grid\">\n<div id=\"app\">\n\n  <div class=\"bar\">\n    <div class=\"row\">\n      <a class=\"brand\" href=\"#/\">bili<b>Light</b></a>\n      <div class=\"tabs\" id=\"tabs\">\n        <button data-v=\"home\" class=\"on\">\u9996\u9875</button>\n        <button data-v=\"rank\">\u6392\u884c</button>\n        <button data-v=\"hist\">\u5386\u53f2</button>\n        <button data-v=\"set\">\u8bbe\u7f6e</button>\n      </div>\n      <div class=\"sbox\" id=\"sbox\">\n        <input type=\"search\" id=\"sq\" placeholder=\"\u641c\u7d22\u89c6\u9891 / AV\u53f7 / BV\u53f7\" autocomplete=\"off\" autocapitalize=\"off\" spellcheck=\"false\">\n        <button class=\"go\" id=\"sgo\">\u641c\u7d22</button>\n        <div class=\"sug hide\" id=\"sug\"></div>\n      </div>\n    </div>\n  </div>\n\n  <div class=\"wrap\">\n    <div class=\"side\" id=\"side\"></div>\n    <div class=\"main\" id=\"main\"></div>\n  </div>\n</div>\n\n<div class=\"tbar\" id=\"tbar\">\n  <button data-v=\"home\" class=\"on\">\u9996\u9875</button>\n  <button data-v=\"rank\">\u6392\u884c</button>\n  <button data-v=\"hist\">\u5386\u53f2</button>\n  <button data-v=\"set\">\u8bbe\u7f6e</button>\n</div>\n\n<script>\n\n(function () {\n  var u = (navigator.userAgent || '') + (navigator.vendor || '');\n  var old = /MSIE\\s[5-9]|Trident\\/[45](\\.|$)|Android\\s[1-4](\\.|\\d)*;|Silk\\/[01]|WebOS\\/1/.test(u)\n    || !window.JSON || !(document.querySelectorAll && document.addEventListener);\n  if (!old) return;\n  if (!window.JSON) window.JSON = (function () {\n    function q(s) { return '\\u0022' + String(s).replace(/\\\\/g, '\\\\\\\\').replace(/\\u0022/g, '\\\\\\u0022').replace(/\\n/g, '\\\\n').replace(/\\r/g, '\\\\r').replace(/\\t/g, '\\\\t') + '\\u0022'; }\n    function ser(v) {\n      var t = typeof v, out, i, kk;\n      if (v === null) return 'null';\n      if (t === 'number') return isFinite(v) ? String(v) : 'null';\n      if (t === 'boolean') return String(v);\n      if (t === 'string') return q(v);\n      if (v instanceof Array || t === 'array' || (v && typeof v.length === 'number')) {\n        out = []; for (i = 0; i < v.length; i++) out.push(ser(v[i])); return '[' + out.join(',') + ']';\n      }\n      if (t === 'object') { out = []; for (kk in v) if (v.hasOwnProperty(kk)) out.push(q(kk) + ':' + ser(v[kk])); return '{' + out.join(',') + '}'; }\n      return 'null';\n    }\n    return { parse: function (s) { return eval('(' + s + ')'); }, stringify: ser };\n  })();\n  var AP = Array.prototype;\n  if (!AP.forEach) AP.forEach = function (f, o) { for (var i = 0; i < this.length; i++) if (i in this) f.call(o, this[i], i, this); };\n  if (!AP.map) AP.map = function (f, o) { var r = []; for (var i = 0; i < this.length; i++) if (i in this) r.push(f.call(o, this[i], i, this)); return r; };\n  if (!AP.filter) AP.filter = function (f, o) { var r = []; for (var i = 0; i < this.length; i++) if (i in this && f.call(o, this[i], i, this)) r.push(this[i]); return r; };\n  if (!AP.indexOf) AP.indexOf = function (x, f) { for (var i = f || 0; i < this.length; i++) if (this[i] === x) return i; return -1; };\n  if (!String.prototype.trim) String.prototype.trim = function () { return String(this).replace(/^[\\s\\uFEFF]+|[\\s\\uFEFF]+$/g, ''); };\n  if (!Object.keys) Object.keys = function (o) { var r = [], k; for (k in o) if (o.hasOwnProperty(k)) r.push(k); return r; };\n  try {\n    var k = 'bl_set', cur = null;\n    try { cur = JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { }\n    if (!cur || typeof cur !== 'object') cur = {};\n    if (!cur.__oldcap) { cur.qn = 16; cur.__oldcap = 1; try { localStorage.setItem(k, JSON.stringify(cur)); } catch (e2) { } }\n  } catch (e3) { }\n})();\n</script>\n\n<script>\n\n(function () {\n  'use strict';\n\n  function $(s, r) { return (r || document).querySelector(s); }\n  function mk(t, c, h) { var e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }\n  function esc(s) {\n    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')\n      .replace(/>/g, '&gt;').replace(/\"/g, '&quot;');\n  }\n  function has(e, c) { return (' ' + e.className + ' ').indexOf(' ' + c + ' ') >= 0; }\n  function addC(e, c) { if (!has(e, c)) e.className = (e.className + ' ' + c).replace(/^\\s+/, ''); }\n  function delC(e, c) { e.className = (' ' + e.className + ' ').replace(' ' + c + ' ', ' ').replace(/^\\s+|\\s+$/g, ''); }\n  function num(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }\n  function count(v) {\n    var n = num(v);\n    if (n >= 100000000) return (n / 100000000).toFixed(1) + '\u4ebf';\n    if (n >= 10000) return (n / 10000).toFixed(1) + '\u4e07';\n    return '' + n;\n  }\n\n  function tryPlay(el) {\n    if (!el) return;\n    try {\n      var pr = el.play();\n      if (pr && pr.catch) pr.catch(function () { });\n    } catch (e) { }\n  }\n  function store(k, v) {\n    try {\n      if (v === undefined) { var s = localStorage.getItem('bl_' + k); return s ? JSON.parse(s) : null; }\n      localStorage.setItem('bl_' + k, JSON.stringify(v));\n    } catch (e) { return null; }\n  }\n  var MEM = {};\n  function sget(k, dft) { var v = store(k); return v == null ? (MEM[k] == null ? dft : MEM[k]) : v; }\n  function sset(k, v) { MEM[k] = v; store(k, v); }\n\n  function get(url, cb) {\n    var x = window.XMLHttpRequest ? new XMLHttpRequest() : null;\n    if (!x) { cb('\u6d4f\u89c8\u5668\u4e0d\u652f\u6301 XHR'); return; }\n    var done = false;\n    x.open('GET', url, true);\n    x.timeout = 20000;\n    if ('withCredentials' in x) x.withCredentials = false;\n    x.onreadystatechange = function () {\n      if (x.readyState === 4 && !done) {\n        done = true;\n        if (x.status >= 200 && x.status < 300) cb(null, x.responseText, x);\n        else cb('HTTP ' + (x.status || 0), '', x);\n      }\n    };\n    x.ontimeout = function () { if (!done) { done = true; cb('\u8bf7\u6c42\u8d85\u65f6'); } };\n    x.onerror = function () { if (!done) { done = true; cb('\u7f51\u7edc\u9519\u8bef'); } };\n    try { x.send(null); } catch (e) { if (!done) { done = true; cb('\u8bf7\u6c42\u5931\u8d25'); } }\n  }\n\n  var ERR_TXT = {\n    '-352': '\u7a0d\u540e\u518d\u8bd5',\n    '-412': '\u7a0d\u540e\u518d\u8bd5',\n    '-400': '\u53c2\u6570\u9519\u8bef',\n    '-403': '\u9700\u8981\u767b\u5f55',\n    '-101': '\u9700\u8981\u767b\u5f55',\n    '-404': '\u5185\u5bb9\u4e0d\u5b58\u5728',\n    '0': '\u7a7a\u6570\u636e',\n  };\n  function why(j) {\n    if (!j) return '\u65e0\u6570\u636e';\n    var t = ERR_TXT[String(j.code)];\n    if (t) return t;\n    var m = String(j.message || '');\n    return m && m !== String(j.code) ? m : ('\u9519\u8bef ' + j.code);\n  }\n  function api(ep, q, cb) {\n    var s = '/api?ep=' + encodeURIComponent(ep);\n    if (q) for (var k in q) if (q[k] !== undefined && q[k] !== null && q[k] !== '') s += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(q[k]);\n    get(s, function (err, txt) {\n      if (err) { cb({ code: -1, message: err }); return; }\n      var j;\n      try { j = JSON.parse(txt); } catch (e) { cb({ code: -1, message: '\u6570\u636e\u683c\u5f0f\u5f02\u5e38' }); return; }\n      cb(j);\n    });\n  }\n\n  var SET = {\n    qn: 64, dm: 1, dmspeed: 1, dmop: 80, dmarea: 100,\n    auto: 1, grid: 1, histOn: 1,\n  };\n  (function () {\n    var s = sget('set', null);\n    if (s) for (var k in s) if (SET[k] !== undefined) SET[k] = s[k];\n  })();\n  function saveSet() { sset('set', SET); }\n\n  function pushHist(v) {\n    if (!SET.histOn || !v || !v.bv) return;\n    var list = sget('hist', []) || [], out = [], i;\n    for (i = 0; i < list.length; i++) if (list[i].bv !== v.bv) out.push(list[i]);\n    out.unshift({\n      bv: v.bv, aid: v.aid, title: v.title, pic: v.pic, up: v.up, dur: v.dur,\n      view: v.view, cid: v.cid, part: v.part || '', t: Math.floor(Date.now() / 1000), pos: num(v.pos),\n    });\n    if (out.length > 80) out.length = 80;\n    sset('hist', out);\n  }\n  function histOf(bv) {\n    var list = sget('hist', []) || [];\n    for (var i = 0; i < list.length; i++) if (list[i].bv === bv) return list[i];\n    return null;\n  }\n  function updHist(bv, pos, cid) {\n    var list = sget('hist', []) || [];\n    for (var i = 0; i < list.length; i++) if (list[i].bv === bv) { list[i].pos = Math.floor(pos); list[i].cid = cid; sset('hist', list); return; }\n  }\n\n  function upSpan(it) {\n    var s = mk('span', it.mid ? 'ul' : '', esc(it.up || ''));\n    if (it.mid) s.onclick = function (e) {\n      e = e || window.event;\n      if (e.preventDefault) e.preventDefault();\n      e.returnValue = false;\n      if (e.stopPropagation) e.stopPropagation();\n      e.cancelBubble = true;\n      location.hash = '#/user/' + it.mid;\n      return false;\n    };\n    return s;\n  }\n  function card(it) {\n    var a = mk('a', 'c');\n    a.href = '#/video/' + encodeURIComponent(it.bv || ('av' + it.aid));\n    var box = mk('div', 'box');\n    var th = mk('div', 'th');\n    th.appendChild(mk('span', 'b1')); th.appendChild(mk('span', 'b2'));\n    var img = mk('img');\n    img.alt = ''; img.setAttribute('referrerpolicy', 'no-referrer');\n    img.src = it.pic || '';\n    img.onerror = function () { img.onerror = null; img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; };\n    th.appendChild(img);\n    if (it.dur) { var tg = mk('div', 'tagline t2 num'); tg.innerHTML = esc(it.dur); th.appendChild(tg); }\n    box.appendChild(th);\n    var tt = mk('div', 'tt'); tt.innerHTML = esc(it.title); box.appendChild(tt);\n    var ub = mk('div', 'ub');\n    ub.appendChild(upSpan(it));\n    ub.appendChild(mk('span', 'dot', '|'));\n    ub.appendChild(mk('span', 'num', '' + count(it.view)));\n    if (it.dan) {\n      ub.appendChild(mk('span', 'dot', '|'));\n      ub.appendChild(mk('span', 'num', '' + count(it.dan)));\n    }\n    box.appendChild(ub);\n    if (it.desc) { var d2 = mk('div', 'ub'); d2.style.color = '#454c54'; d2.innerHTML = esc(it.desc); box.appendChild(d2); }\n    a.appendChild(box);\n    return a;\n  }\n  function rowCard(it) {\n    var a = mk('a', 'lr');\n    a.href = '#/video/' + encodeURIComponent(it.bv || ('av' + it.aid));\n    var th = mk('div', 'th');\n    var img = mk('img'); img.alt = ''; img.src = it.pic || ''; img.setAttribute('referrerpolicy', 'no-referrer');\n    th.appendChild(img);\n    if (it.dur) { var tg = mk('div', 'tagline t2 num'); tg.innerHTML = esc(it.dur); th.appendChild(tg); }\n    a.appendChild(th);\n    var inr = mk('div', 'in');\n    var t = mk('div', 'tt'); t.innerHTML = esc(it.title); inr.appendChild(t);\n    if (it.desc) { var d = mk('div', 'ds'); d.innerHTML = esc(it.desc); inr.appendChild(d); }\n    var m = mk('div', 'mt2 num');\n    var bu = upSpan(it);\n    if (it.mid) bu.className = 'ul b';\n    m.appendChild(bu);\n    m.appendChild(document.createTextNode(' \u00b7 ' + count(it.view) + ' \u64ad\u653e \u00b7 ' + count(it.dan) + ' \u5f39\u5e55' +\n      (it.pubtxt ? ' \u00b7 ' + it.pubtxt : '')));\n    inr.appendChild(m);\n    a.appendChild(inr);\n    return a;\n  }\n  function grid(items) {\n    var g = mk('div', 'g'), i;\n    for (i = 0; i < items.length; i++) g.appendChild(card(items[i]));\n    return g;\n  }\n  function rows(items) {\n    var w = mk('div', 'ls'), i;\n    for (i = 0; i < items.length; i++) w.appendChild(rowCard(items[i]));\n    return w;\n  }\n  function status(txt, spin) {\n    var d = mk('div', 'st');\n    if (spin) { d.innerHTML = '<div class=\"spin\"></div><div style=\"margin-top:9px\">' + esc(txt) + '</div>'; }\n    else { d.innerHTML = '<div class=\"cr\"></div>' + esc(txt); }\n    return d;\n  }\n  function head(title, sub) {\n    var h = mk('div', 'hd');\n    h.innerHTML = '<h2>' + esc(title) + '</h2>' + (sub ? '<div class=\"sp\">' + sub + '</div>' : '');\n    var t = mk('div', 'ticks');\n    var w = mk('div');\n    w.appendChild(h); w.appendChild(t);\n    return w;\n  }\n\n  var cur = { v: '', q: '' };\n  function route() {\n    var h = location.hash || '#/home';\n    var seg = h.slice(2).split('/');\n    var view = seg[0] || 'home';\n    if (view === 'video') { videoPage(decodeURIComponent(seg[1] || '')); mark(''); return; }\n    if (view === 'search') { searchPage(decodeURIComponent(seg.slice(1).join('/') || '')); mark(''); return; }\n    if (view === 'rank') { rankPage(seg[1] || '0'); mark('rank'); return; }\n    if (view === 'hist') { histPage(); mark('hist'); return; }\n    if (view === 'set') { setPage(); mark('set'); return; }\n    if (view === 'user') { userPage(seg[1] || ''); mark(''); return; }\n    if (view === 'fav') { favPage(); mark(''); return; }\n    homePage(seg[1] || 'popular'); mark('home');\n  }\n  function mark(v) {\n    var bs = document.querySelectorAll('#tabs button,#tbar button'), i;\n    for (i = 0; i < bs.length; i++) { if (bs[i].getAttribute('data-v') === v) addC(bs[i], 'on'); else delC(bs[i], 'on'); }\n  }\n  function setMain(node) {\n    var m = $('#main');\n    m.innerHTML = '';\n    if (node) m.appendChild(node);\n    window.scrollTo(0, 0);\n  }\n  function sideNav(items, active) {\n    var s = $('#side');\n    s.innerHTML = '';\n    var h = mk('h4', null, '\u5206\u533a'); s.appendChild(h);\n    for (var i = 0; i < items.length; i++) {\n      var a = mk('a', items[i][0] === active ? 'on' : '', esc(items[i][1]) + '<i class=\"num\">' + (items[i][2] || '') + '</i>');\n      a.href = items[i][3] + items[i][0];\n      s.appendChild(a);\n    }\n  }\n\n  function homePage(mode) {\n    var box = mk('div');\n    sideNav(RID_LIST.map(function (r) { return [r[0], r[1], '', '#/rank/']; }), -1);\n    var titles = { popular: '\u7efc\u5408\u63a8\u8350', square: '\u5927\u5bb6\u90fd\u5728\u641c' };\n    box.appendChild(head(titles[mode] || '\u7efc\u5408\u63a8\u8350', ''));\n    var nav = mk('div');\n    nav.innerHTML = '<span class=\"chip p\">\u70ed\u95e8</span><a class=\"chip\" href=\"#/home/rcmd\">\u65b0\u52a8\u6001</a>' +\n      '<a class=\"chip\" href=\"#/home/square\">\u70ed\u641c\u699c</a><a class=\"chip\" href=\"#/rank/0\">\u6392\u884c\u699c</a>';\n    box.appendChild(nav);\n    var body = mk('div');\n    body.appendChild(status('\u52a0\u8f7d\u4e2d', 1));\n    box.appendChild(body);\n    setMain(box);\n    if (mode === 'square') {\n      api('square', {}, function (j) {\n        body.innerHTML = '';\n        if (j.code !== 0) { body.appendChild(status(why(j))); return; }\n        var w = mk('div');\n        var arr = j.data || [];\n        if (!arr.length) { w.appendChild(status('\u4eca\u5929\u6ca1\u6709\u70ed\u641c\u6570\u636e')); body.appendChild(w); return; }\n        for (var i = 0; i < arr.length; i++) {\n          var a = mk('a', 'lr');\n          a.href = '#/search/' + encodeURIComponent(arr[i].main || arr[i]);\n          a.innerHTML = '<span class=\"num\" style=\"float:left;width:24px;color:#d86da5\">' + (i + 1) +\n            '</span><span style=\"display:block;margin-left:26px\">' + esc(arr[i].main || arr[i]) + '</span>';\n          w.appendChild(a);\n        }\n        body.appendChild(w);\n      });\n      return;\n    }\n    api(mode, {}, function (j) {\n      body.innerHTML = '';\n      if (j.code !== 0) {\n        var st = status('\u52a0\u8f7d\u5931\u8d25 \u00b7 \u91cd\u8bd5');\n        st.onclick = function () { homePage(mode); }; st.style.cursor = 'pointer';\n        body.appendChild(st); return;\n      }\n      var list = j.data || [];\n      if (!list.length) { body.appendChild(status('\u6682\u65e0\u5185\u5bb9')); return; }\n      body.appendChild(grid(list));\n      var more = mk('button', 'loadmore', '\u52a0\u8f7d\u66f4\u591a');\n      more.onclick = function () {\n        more.innerHTML = '\u52a0\u8f7d\u4e2d\u2026'; more.disabled = true;\n        api(mode, { pn: Math.floor(list.length / 20) + 1 }, function (k) {\n          more.disabled = false;\n          if (k.code === 0 && (k.data || []).length) {\n            var g = mk('div', 'g');\n            for (var i = 0; i < k.data.length; i++) { list.push(k.data[i]); g.appendChild(card(k.data[i])); }\n            body.insertBefore(g, more);\n            more.innerHTML = '\u52a0\u8f7d\u66f4\u591a';\n          } else { more.innerHTML = why(k) === '\u63a5\u53e3\u5f02\u5e38 ' + k.code ? '\u6ca1\u6709\u66f4\u591a\u4e86' : why(k); setTimeout(function () { more.innerHTML = '\u518d\u8bd5\u4e00\u6b21'; }, 900); }\n        });\n      };\n      body.appendChild(more);\n    });\n  }\n\n  function rankPage(rid) {\n    var box = mk('div');\n    box.appendChild(head('\u6392\u884c\u699c', ''));\n    var body = mk('div'); body.appendChild(status('\u52a0\u8f7d\u4e2d', 1)); box.appendChild(body);\n    setMain(box);\n    sideNav(RID_LIST.map(function (r) { return [r[0], r[1], '', '#/rank/']; }), rid);\n    api('rank', { rid: rid }, function (j) {\n      body.innerHTML = '';\n      if (j.code !== 0) { body.appendChild(status(j.message || '\u52a0\u8f7d\u5931\u8d25')); return; }\n      body.appendChild(grid(j.data || []));\n    });\n  }\n  var RID_LIST = [[0, '\u5168\u7ad9'], [1, '\u52a8\u753b'], [3, '\u97f3\u4e50'], [4, '\u6e38\u620f'], [5, '\u5a31\u4e50'], [11, '\u7535\u89c6\u5267'],\n    [23, '\u7535\u5f71'], [129, '\u821e\u8e48'], [155, '\u65f6\u5c1a'], [160, '\u751f\u6d3b'], [188, '\u79d1\u6280'], [217, '\u5ba0\u7269'], [234, '\u8fd0\u52a8']];\n\n  var lastQ = '';\n  function searchPage(q) {\n    q = (q || '').replace(/^\\s+|\\s+$/g, '');\n    var box = mk('div');\n    if (!q) {\n      var recent = sget('slog', []) || [];\n      box.appendChild(head('\u641c\u7d22', ''));\n      if (recent.length) {\n        var w = mk('div');\n        for (var i = 0; i < recent.length; i++) {\n          var r = mk('a', 'lr');\n          r.href = '#/search/' + encodeURIComponent(recent[i]);\n          r.innerHTML = '<span style=\"color:#7a828b;font-size:11px\">\u5386\u53f2</span>&nbsp;&nbsp;' + esc(recent[i]);\n          w.appendChild(r);\n        }\n        box.appendChild(w);\n      } else box.appendChild(status('\u6682\u65e0\u641c\u7d22\u8bb0\u5f55'));\n      setMain(box);\n      return;\n    }\n    $('#sq').value = q;\n    box.appendChild(head('\u201c' + q + '\u201d', ''));\n    var body = mk('div'); body.appendChild(status('\u641c\u7d22\u4e2d', 1)); box.appendChild(body);\n    setMain(box);\n    lastQ = q;\n    api('search', { keyword: q, page: 1 }, function (j) {\n      body.innerHTML = '';\n      if (j.code !== 0) { body.appendChild(status(why(j))); return; }\n      var list = j.data || [];\n      if (!list.length) { body.appendChild(status('\u65e0\u7ed3\u679c')); return; }\n      var sl = sget('slog', []) || [], out = [q], i;\n      for (i = 0; i < sl.length && out.length < 12; i++) if (sl[i] !== q) out.push(sl[i]);\n      sset('slog', out);\n      body.appendChild(rows(list));\n      var pn = 1;\n      var more = mk('button', 'loadmore', '\u4e0b\u4e00\u9875');\n      more.onclick = function () {\n        more.innerHTML = '\u52a0\u8f7d\u4e2d\u2026'; more.disabled = true;\n        api('search', { keyword: q, page: ++pn }, function (k) {\n          more.disabled = false;\n          if (k.code === 0 && (k.data || []).length) {\n            var w = mk('div', 'ls');\n            for (var i2 = 0; i2 < k.data.length; i2++) { list.push(k.data[i2]); w.appendChild(rowCard(k.data[i2])); }\n            body.insertBefore(w, more); more.innerHTML = '\u4e0b\u4e00\u9875';\n          } else { more.innerHTML = why(k); }\n        });\n      };\n      body.appendChild(more);\n    });\n  }\n\n  function histPage() {\n    var box = mk('div');\n    var list = sget('hist', []) || [];\n    box.appendChild(head('\u89c2\u770b\u5386\u53f2', '<span class=\"num\">\u672c\u673a \u00b7 ' + list.length + ' \u6761</span>'));\n    if (!list.length) box.appendChild(status('\u6682\u65e0\u8bb0\u5f55'));\n    else {\n      var w = mk('div'), i;\n      for (i = 0; i < list.length; i++) {\n        var it = list[i], a = rowCard(it);\n        if (num(it.pos) > 5) {\n          var t = mk('div', 'tagline num bl-pos'); t.innerHTML = '\u4e0a\u6b21 ' + fmt(it.pos); t.style.left = 'auto'; t.style.right = '1px'; t.style.top = 'auto'; t.style.bottom = '23px';\n          a.querySelector('.th').appendChild(t);\n        }\n        var del = mk('button', null, '\u00d7');\n        del.style.cssText = 'position:absolute;right:6px;top:6px;width:22px;height:22px;background:#fff;border:1px solid #aab3bc;color:#7a828b;font-size:14px;line-height:20px';\n        (function (bv) { del.onclick = function (e) { e.preventDefault(); e.stopPropagation(); var l = sget('hist', []) || [], o = [], i2; for (i2 = 0; i2 < l.length; i2++) if (l[i2].bv !== bv) o.push(l[i2]); sset('hist', o); histPage(); }; })(it.bv);\n        a.appendChild(del);\n        a.href = '#/video/' + encodeURIComponent(it.bv);\n        w.appendChild(a);\n      }\n      box.appendChild(w);\n      var clr = mk('button', 'loadmore', '\u6e05\u7a7a\u5168\u90e8\u5386\u53f2');\n      clr.onclick = function () { if (confirm('\u786e\u5b9a\u6e05\u7a7a\u8fd9 ' + list.length + ' \u6761\u89c2\u770b\u8bb0\u5f55\uff1f')) { sset('hist', []); histPage(); } };\n      box.appendChild(clr);\n    }\n    setMain(box);\n  }\n  function fmt(s) { s = num(s); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + p2(m) : m) + ':' + p2(x); }\n  function p2(n) { return (n < 10 ? '0' : '') + n; }\n\n  function setPage() {\n    var box = mk('div');\n    box.appendChild(head('\u64ad\u653e\u4e0e\u754c\u9762\u8bbe\u7f6e', '<span class=\"num\">\u4fdd\u5b58\u5728\u672c\u673a</span>'));\n    var w = mk('div', 'set');\n    box.appendChild(w);\n    function sw(label, key, hint) {\n      var dl = mk('dl');\n      dl.innerHTML = '<dt>' + label + '</dt>';\n      var dd = mk('dd');\n      var s = mk('span', 'sw' + (SET[key] ? ' on' : '')); s.innerHTML = '<i></i>';\n      s.onclick = function () { SET[key] = SET[key] ? 0 : 1; saveSet(); if (SET[key]) addC(s, 'on'); else delC(s, 'on'); if (key === 'dm') dmApplyOpts(); };\n      dd.appendChild(s); dl.appendChild(dd);\n      w.appendChild(dl);\n      if (hint) { var h2 = mk('div', 'hint', hint); h2.style.paddingTop = '0'; w.appendChild(h2); }\n    }\n    function sel(label, key, opts, hint) {\n      var dl = mk('dl');\n      dl.innerHTML = '<dt>' + label + '</dt>';\n      var dd = mk('dd'), s = mk('select');\n      for (var i = 0; i < opts.length; i++) {\n        var o = mk('option', null, opts[i][1]); o.value = opts[i][0];\n        if (String(SET[key]) === String(opts[i][0])) o.selected = true;\n        s.appendChild(o);\n      }\n      s.onchange = function () { SET[key] = num(s.value) || s.value; saveSet(); if (key === 'dm') dmApplyOpts(); };\n      dd.appendChild(s); dl.appendChild(dd); w.appendChild(dl);\n      if (hint) w.appendChild(mk('div', 'hint', hint));\n    }\n    sel('\u6e05\u6670\u5ea6\u4e0a\u9650', 'qn', [[16, '360P'], [32, '480P'], [64, '720P'], [80, '1080P'], [116, '1080P60']]);\n    sw('\u5f39\u5e55\u603b\u5f00\u5173', 'dm');\n    sel('\u5f39\u5e55\u901f\u5ea6', 'dmspeed', [[0.6, '\u6162'], [1, '\u6807\u51c6'], [1.5, '\u5feb'], [2, '\u5f88\u5feb']]);\n    sel('\u5f39\u5e55\u4e0d\u900f\u660e\u5ea6', 'dmop', [[40, '40%'], [60, '60%'], [80, '80%'], [100, '100%']]);\n    sel('\u5f39\u5e55\u8986\u76d6\u5bbd\u5ea6', 'dmarea', [[60, '60%'], [80, '80%'], [100, '\u5168\u5c4f']]);\n    sw('\u81ea\u52a8\u8fde\u64ad\u4e0b\u4e00 P', 'auto');\n    sw('\u8bb0\u5f55\u89c2\u770b\u5386\u53f2', 'histOn');\n    var dl = mk('dl');\n    dl.innerHTML = '<dt>\u767b\u5f55 Cookie</dt><dd></dd>';\n    var dd = dl.querySelector('dd'), inp = mk('input');\n    inp.type = 'text'; inp.value = sget('ck', '') || '';\n    inp.placeholder = '\u7559\u7a7a\u5373\u53ef';\n    inp.onchange = function () {\n      sset('ck', inp.value.replace(/^\\s+|\\s+$/g, ''));\n    };\n    dd.appendChild(inp);\n    w.appendChild(dl);\n    var dl2 = mk('dl');\n    dl2.innerHTML = '<dt>\u6e05\u7406\u672c\u673a\u6570\u636e</dt><dd></dd>';\n    var dd2 = mk('dd'), b = mk('button', 'chip p', '\u5386\u53f2\u8bb0\u5f55 + \u641c\u7d22\u8bb0\u5f55');\n    b.onclick = function () { sset('hist', []); sset('slog', []); };\n    dd2.appendChild(b); dl2.appendChild(dd2); w.appendChild(dl2);\n    setMain(box);\n  }\n\n  var VID = { bv: '', cid: 0, pages: [], cur: 0, v: null, seg: null };\n  var videoEl = null, dmz = null, dmCv = null, dmCtx = null, dmList = [], dmRun = 0, dmIdx = 0, dmQ = [];\n  function videoPage(id) {\n    id = (id || '').replace(/^\\s+|\\s+$/g, '');\n    if (!id) { setMain(status('\u53c2\u6570\u4e0d\u5b8c\u6574')); return; }\n    var q = {};\n    if (/^BV/i.test(id)) q.bvid = id;\n    else if (/^av/i.test(id)) q.aid = id.slice(2);\n    else if (/^[0-9]+$/.test(id)) q.aid = id;\n    else { q.bvid = id; }\n    var box = mk('div');\n    box.appendChild(status('\u89e3\u6790\u89c6\u9891\u4fe1\u606f\u2026', 1));\n    setMain(box);\n    api('view', q, function (j) {\n      if (j.code !== 0) { setMain(status(j.message || '\u89c6\u9891\u4fe1\u606f\u83b7\u53d6\u5931\u8d25')); return; }\n      renderVideo(j.data);\n    });\n  }\n  function renderVideo(v) {\n    VID.bv = v.bv; VID.pages = v.pages || []; VID.v = v; VID.cur = 0;\n    var hist = histOf(v.bv);\n    if (hist && num(hist.cid)) {\n      for (var i = 0; i < VID.pages.length; i++) if (VID.pages[i].cid === num(hist.cid)) { VID.cur = i; break; }\n    }\n    var box = mk('div');\n\n    var plr = mk('div', 'plr');\n    videoEl = mk('video');\n    videoEl.setAttribute('playsinline', ''); videoEl.setAttribute('webkit-playsinline', '');\n    videoEl.setAttribute('preload', 'metadata'); videoEl.poster = v.pic || '';\n    videoEl.style.display = 'block';\n    plr.appendChild(videoEl);\n    dmz = mk('div', null); dmz.id = 'dmz';\n    dmCv = mk('canvas'); dmz.appendChild(dmCv);\n    plr.appendChild(dmz);\n    var ctl = mk('div', 'ctl');\n    ctl.innerHTML =\n      '<div class=\"bar2\" id=\"pd\"><i></i><b style=\"left:0\"></b></div>' +\n      '<div class=\"btns\">' +\n      '<button id=\"bp\">\u64ad\u653e</button>' +\n      '<button id=\"bdm\"' + (SET.dm ? ' class=\"on\"' : '') + '>' + (SET.dm ? '\u5f39\u5e55 \u5f00' : '\u5f39\u5e55 \u5173') + '</button>' +\n      '<button id=\"bq\">720P</button>' +\n      '<button id=\"bfs\">\u5168\u5c4f</button>' +\n      '<button id=\"bh\">\u5386\u53f2\u4f4d\u7f6e</button>' +\n      '<span class=\"tm num\" id=\"ptm\">0:00 / --</span>' +\n      '</div>';\n    plr.appendChild(ctl);\n    box.appendChild(plr);\n\n    var hd = mk('div', 'vhd');\n    hd.innerHTML = '<h1>' + esc(v.title) + '</h1><div class=\"sub\"><span>\u64ad\u653e <b class=\"num\">' + count(v.view) +\n      '</b></span><span>\u5f39\u5e55 <b class=\"num\">' + count(v.dan) + '</b></span><span>\u8bc4\u8bba <b class=\"num\">' + count(v.reply) +\n      '</b></span><span>' + esc(v.pubtxt) + '</span><span class=\"chip\">' + esc(v.tname) + '</span></div>';\n    box.appendChild(hd);\n    var who = mk('div', 'who link');\n    who.innerHTML = '<img src=\"' + esc(v.face) + '\" alt=\"\" referrerpolicy=\"no-referrer\"><div class=\"n\">' + esc(v.up) +\n      '</div><div class=\"s\">\u5171 ' + v.videos + ' \u4e2a\u5206 P \u00b7 \u6295\u7a3f\u4e8e ' + esc(v.pubtxt) + '</div>';\n    var vbtns = mk('div', 'vbtns');\n    var bs = mk('button', 'chip p', '\u5b57\u5e55'); var bd = mk('button', 'chip p', '\u4e0b\u8f7d');\n    bs.onclick = function (e) { e = e || window.event; e.cancelBubble = true; if (e.stopPropagation) e.stopPropagation(); openProxy('https://snapany.com/zh/bilibili-subtitle-downloader', v); };\n    bd.onclick = function (e) { e = e || window.event; e.cancelBubble = true; if (e.stopPropagation) e.stopPropagation(); openProxy('https://peanutdl.com/zh/bilibili', v); };\n    vbtns.appendChild(bs); vbtns.appendChild(bd); who.appendChild(vbtns);\n    if (v.mid) who.onclick = function () { location.hash = '#/user/' + v.mid; };\n    box.appendChild(who);\n\n    if (v.desc) {\n      var sec = mk('div', 'sec');\n      sec.innerHTML = '<h3>\u7b80\u4ecb</h3>';\n      var d = mk('div'); d.style.cssText = 'padding:8px 10px;font-size:13px;line-height:20px;white-space:pre-wrap;word-break:break-all;color:#454c54';\n      d.innerHTML = esc(v.desc.slice(0, 1500));\n      sec.appendChild(d); box.appendChild(sec);\n    }\n\n    if (VID.pages.length > 1) {\n      var sp = mk('div', 'sec');\n      sp.innerHTML = '<h3>\u9009\u96c6 <span class=\"num\" style=\"float:right\">' + VID.pages.length + ' P</span></h3>';\n      var w = mk('div', 'plist');\n      for (var k = 0; k < VID.pages.length; k++) {\n        var a = mk('a', k === VID.cur ? 'on' : '');\n        a.href = 'javascript:void(0)';\n        a.innerHTML = '<i class=\"num\">' + esc(VID.pages[k].dur || '') + '</i><span>P' + VID.pages[k].idx + ' \u00b7 ' + esc(VID.pages[k].part) + '</span>';\n        (function (ix) { a.onclick = function () { pickPart(ix); }; })(k);\n        w.appendChild(a);\n      }\n      sp.appendChild(w); box.appendChild(sp);\n    }\n\n    api('tags', { bvid: v.bv, aid: v.aid }, function (j) {\n      if (j.code !== 0 || !j.data || !j.data.length) return;\n      var s2 = mk('div', 'sec'), h2 = mk('div');\n      for (var i2 = 0; i2 < j.data.length; i2++) {\n        var c = mk('a', 'chip', esc(j.data[i2]));\n        c.href = '#/search/' + encodeURIComponent(j.data[i2]);\n        h2.appendChild(c);\n      }\n      s2.innerHTML = '<h3>\u6807\u7b7e</h3>'; s2.appendChild(h2);\n      box.insertBefore(s2, csec);\n    });\n\n    var csec = mk('div', 'sec');\n    csec.innerHTML = '<h3>\u8bc4\u8bba <span class=\"num\" style=\"float:right\">' + count(v.reply) + '</span></h3>';\n    var cw = mk('div'); cw.appendChild(status('\u52a0\u8f7d\u8bc4\u8bba', 1));\n    csec.appendChild(cw);\n    box.appendChild(csec);\n    api('reply', { oid: v.aid, next: 0 }, function (j) {\n      cw.innerHTML = '';\n      if (j.code !== 0) { cw.appendChild(status(why(j))); return; }\n      var items = (j.data && j.data.items) || [];\n      if (!items.length) { cw.appendChild(status('\u8fd8\u6ca1\u6709\u8bc4\u8bba')); return; }\n      for (var i3 = 0; i3 < items.length; i3++) {\n        var r = items[i3], el = mk('div', 'cm' + (r.top ? ' top' : ''));\n        el.innerHTML = '<img src=\"' + esc(r.face) + '\" alt=\"\"><div class=\"bd\"><div class=\"un\"><b>' + esc(r.un) +\n          '</b> \u00b7 Lv' + r.lv + ' \u00b7 ' + esc(r.time) + '</div><div class=\"ms\">' + esc(r.msg) + '</div></div>' +\n          '<div class=\"lk num\">' + count(r.like) + '<br>\u8d5e</div>';\n        cw.appendChild(el);\n      }\n    });\n\n    var rsec = mk('div', 'sec');\n    rsec.innerHTML = '<h3>\u63a5\u4e0b\u6765\u770b</h3>';\n    var rw = mk('div'); rw.appendChild(status('\u52a0\u8f7d\u4e2d', 1));\n    rsec.appendChild(rw); box.appendChild(rsec);\n    api('related', { bvid: v.bv }, function (j) {\n      rw.innerHTML = '';\n      if (j.code !== 0 || !j.data || !j.data.length) { rw.appendChild(status('\u8fd9\u4e2a\u89c6\u9891\u6ca1\u6709\u76f8\u5173\u63a8\u8350')); return; }\n      rw.appendChild(grid(j.data.slice(0, 12)));\n    });\n\n    setMain(box);\n    bindPlayer(ctl, v);\n    dmApplyOpts();                                    \n    pickPart(VID.cur, hist);\n  }\n  function pickPart(ix, hist) {\n    var p = VID.pages[ix];\n    if (!p) return;\n    VID.cur = ix; var v = VID.v;\n    var links = document.querySelectorAll('.plist a'), i;\n    for (i = 0; i < links.length; i++) { if (i === ix) addC(links[i], 'on'); else delC(links[i], 'on'); }\n    $('#bq') && ($('#bq').innerHTML = '\u5207\u6362\u4e2d\u2026');\n    dmStop();\n    get('/play?bvid=' + encodeURIComponent(v.bv) + '&cid=' + p.cid + '&qn=' + SET.qn, function (err, txt) {\n      var j;\n      try { j = JSON.parse(txt); } catch (e) { j = { code: -1, message: err || '\u8fd4\u56de\u5f02\u5e38' }; }\n      if (j.code !== 0) {\n        alert('\u64ad\u653e\u5931\u8d25\uff1a' + (why(j) || err || ''));\n        return;\n      }\n      VID.cid = p.cid;\n      VID.seg = j.data;\n      var q = $('#bq');\n      if (q) q.innerHTML = (j.data.qname || (j.data.quality + '')) + (j.data.need ? '\uff08\u5df2\u964d\u7ea7\uff09' : '');\n      videoEl.src = j.data.src;\n      videoEl.load();\n      VID.resume = 0;\n      if (hist && num(hist.cid) === p.cid && num(hist.pos) > 5) VID.resume = num(hist.pos);\n      var t = $('#bh');\n      if (t) { t.innerHTML = VID.resume ? '\u5df2\u7eed ' + fmt(VID.resume) : '\u56de\u5230\u4e0a\u6b21\u4f4d\u7f6e'; t.style.color = VID.resume ? '#f3b7d3' : ''; }\n      if (SET.dm) dmLoad(p.cid);\n      if (SET.auto && !VID.resume) { tryPlay(videoEl) }\n      pushHist({ bv: v.bv, aid: v.aid, title: v.title, pic: v.pic, up: v.up, dur: (p.dur || v.dur), view: v.view, cid: p.cid, part: p.part, pos: 0 });\n    });\n  }\n  function bindPlayer(ctl, v) {\n    var pd = $('#pd'), bar = pd.querySelector('i'), knob = pd.querySelector('b');\n    var bp = $('#bp'), ptm = $('#ptm');\n    function syncBar() {\n      var d = videoEl.duration || 0, c = videoEl.currentTime || 0;\n      var pct = d ? Math.min(100, c / d * 100) : 0;\n      bar.style.width = pct + '%'; knob.style.left = pct + '%';\n      ptm.innerHTML = fmt(c) + ' / ' + (d ? fmt(d) : (v.dur || '--'));\n    }\n    var lastSave = 0;\n    videoEl.onseeking = function () { if (videoEl.__t !== undefined && Math.abs(videoEl.currentTime - videoEl.__t) > 2) dmReset(); videoEl.__t = videoEl.currentTime; };\n    videoEl.ontimeupdate = function () { videoEl.__t = videoEl.currentTime; syncBar(); var t = videoEl.currentTime | 0; if (t - lastSave >= 5) { lastSave = t; if (VID.bv && t > 3) updHist(VID.bv, t, VID.cid); } };\n    videoEl.onprogress = syncBar;\n    videoEl.onloadedmetadata = function () {\n      syncBar(); dmSize();\n      if (VID.resume > 5) { try { videoEl.currentTime = VID.resume; } catch (e) { } VID.resume = 0; }\n      if (!dmRun && SET.dm && VID.cid) dmLoad(VID.cid);\n    };\n    videoEl.onplay = function () { bp.innerHTML = '\u6682\u505c'; if (SET.dm) dmStart(); };\n    videoEl.onpause = function () { bp.innerHTML = '\u64ad\u653e'; dmStop(); save(); };\n    videoEl.onended = function () {\n      save();\n      if (SET.auto && VID.cur + 1 < VID.pages.length) pickPart(VID.cur + 1);\n    };\n    videoEl.onerror = function () {\n      var e = videoEl.error;\n      var code = e ? e.code : 0;\n      var msg = { 1: '\u52a0\u8f7d\u4e2d\u6b62', 2: '\u7f51\u7edc\u4e2d\u65ad', 3: '\u89e3\u7801\u4e0d\u652f\u6301', 4: '\u76f4\u94fe\u5931\u6548' }[code] || ('\u9519\u8bef ' + code);\n      bp.innerHTML = '\u91cd\u8bd5';\n      if (!VID._er) { VID._er = 1; alert('\u64ad\u653e\u51fa\u9519\uff1a' + msg); }\n    };\n    bp.onclick = function () {\n      VID._er = 0;\n      if (videoEl.paused) {\n        if (!videoEl.src && VID.seg) pickPart(VID.cur);\n        tryPlay(videoEl);\n      } else { try{videoEl.pause()}catch(e){} }\n    };\n    function seek(e) {\n      var t = e.touches && e.touches[0] ? e.touches[0] : e;\n      var r = pd.getBoundingClientRect();\n      var p2 = Math.max(0, Math.min(1, (t.clientX - r.left) / r.width));\n      if (videoEl.duration) { videoEl.currentTime = p2 * videoEl.duration; syncBar(); }\n      try { e.preventDefault(); } catch (err) { }\n    }\n    pd.onclick = seek;\n    pd.ontouchstart = seek;\n    $('#bdm').onclick = function () {\n      SET.dm = SET.dm ? 0 : 1; saveSet();\n      this.innerHTML = SET.dm ? '\u5f39\u5e55 \u5f00' : '\u5f39\u5e55 \u5173';\n      if (SET.dm) addC(this, 'on'); else delC(this, 'on');\n      dmApplyOpts();\n    };\n    $('#bq').onclick = function () {\n      var opts = (VID.seg && VID.seg.formats) || [];\n      if (!opts.length) { alert('\u4ec5\u4e00\u4e2a\u6e05\u6670\u5ea6'); return; }\n      var txt = '\u5f53\u524d\uff1a' + (VID.seg.qname || '') + '\\n\u53ef\u5207\u6362\uff1a\\n';\n      for (var i = 0; i < opts.length; i++) txt += (i + 1) + '. ' + opts[i].name + ' (' + opts[i].qn + ')\\n';\n      txt += '\\n\u8f93\u5165\u5e8f\u53f7\u5207\u6362';\n      var k = prompt(txt, '');\n      if (!k) return;\n      var o = opts[num(k) - 1];\n      if (!o) return;\n      SET.qn = o.qn; saveSet();\n      VID.seg = null;\n      pickPart(VID.cur, histOf(VID.bv));\n    };\n    $('#bfs').onclick = function () {\n      var el = document.querySelector('.plr');\n      if (el.requestFullscreen) { if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen(); }\n      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();\n      else if (videoEl.webkitEnterFullscreen) videoEl.webkitEnterFullscreen();\n      else alert('\u6d4f\u89c8\u5668\u4e0d\u652f\u6301\u5168\u5c4f');\n    };\n    $('#bh').onclick = function () {\n      var h = histOf(VID.bv);\n      if (!h || !num(h.pos)) { alert('\u65e0\u5386\u53f2\u4f4d\u7f6e'); return; }\n      videoEl.currentTime = num(h.pos);\n      tryPlay(videoEl);\n    };\n    function save() { if (VID.bv && num(videoEl.currentTime) > 3) updHist(VID.bv, videoEl.currentTime, VID.cid); }\n    setInterval(save, 12000);\n    addEventListener('beforeunload', save);\n    videoEl.onclick = function () { if (videoEl.paused) { tryPlay(videoEl) } else { try{videoEl.pause()}catch(e){} } };\n  }\n\n  function dmSize() {\n    if (!dmCv) return;\n    var r = dmz.getBoundingClientRect();\n    dmCv.width = Math.max(160, r.width | 0);\n    dmCv.height = Math.max(90, r.height | 0);\n    dmCtx = dmCv.getContext ? dmCv.getContext('2d') : null;\n  }\n  function dmLoad(cid) {\n    if (!cid) return;\n    dmListReset(); lastFrame = 0;\n    get('/dm?cid=' + encodeURIComponent(cid), function (err, txt) {\n      if (err || !txt) return;\n      var doc = null;\n      try { doc = new DOMParser().parseFromString(txt, 'text/xml'); } catch (e) { }\n      if (!doc || !doc.getElementsByTagName || doc.getElementsByTagName('d').length === 0) {\n        var m = /<d p=\"([^\"]+)\">([^<]*)<\\/d>/g, one;\n        while ((one = m.exec(txt))) dmPush(one[1], one[2]);\n      } else {\n        var ns = doc.getElementsByTagName('d'), i;\n        for (i = 0; i < ns.length; i++) dmPush(ns[i].getAttribute('p'), ns[i].textContent || ns[i].innerHTML);\n      }\n      dmSort();\n      if (!videoEl.paused) dmStart();\n    });\n  }\n  function dmListReset() { dmList = []; dmQ = []; dmIdx = 0; lastFrame = 0; }\n  function dmPush(p, text) {\n    var a = String(p).split(',');\n    if (a.length < 5 || !text) return;\n    dmQ.push({ t: parseFloat(a[0]) || 0, mode: num(a[1]), size: num(a[2]) || 25, color: num(a[4]) || 16777215, txt: String(text).slice(0, 60) });\n  }\n  function dmSort() {\n    dmQ.sort(function (a, b) { return a.t - b.t; });\n    dmList = dmQ; dmIdx = 0;\n  }\n  function dmApplyOpts() {\n    if (!$('#bdm')) return;\n    var b = $('#bdm');\n    b.innerHTML = SET.dm ? '\u5f39\u5e55 \u5f00' : '\u5f39\u5e55 \u5173';\n    if (SET.dm) addC(b, 'on'); else delC(b, 'on');\n    if (!SET.dm) dmStop();\n    else if (!dmRun && videoEl && !videoEl.paused) dmStart();\n  }\n  var raf = window.requestAnimationFrame ? function (f) { window.requestAnimationFrame(f); } : function (f) { setTimeout(f, 40); };\n  function dmStart() {\n    if (!SET.dm || !dmCtx || dmRun) return;\n    dmRun = 1;\n    loop();\n  }\n  function dmStop() { dmRun = 0; }\n\n  function dmReset() {\n    dmIdx = 0;\n    for (var i = 0; i < dmList.length; i++) dmList[i].shown = 0;\n    if (dmCtx && dmCv) dmCtx.clearRect(0, 0, dmCv.width, dmCv.height);\n    if (SET.dm && videoEl && !videoEl.paused) dmStart();\n  }\n\n  var SCAN_CAP = 160;\n  function dmVisible() {\n    if (!videoEl) return [];\n    var ct = videoEl.currentTime || 0;\n    var sp = num(SET.dmspeed) / 1 || 1;\n    if (sp < 0.2) sp = 0.2;\n    var win = 6 / sp;                       \n    while (dmIdx < dmList.length && dmList[dmIdx].t < ct - win - 1) dmIdx++;\n    var out = [], i, n = 0;\n    for (i = dmIdx; i < dmList.length && n < SCAN_CAP; i++, n++) {\n      var d = dmList[i];\n      if (d.t - ct > win) break;\n      if (d.t <= ct && !d.shown) { d.shown = 1; out.push(d); }\n      if (out.length >= 22) break;\n    }\n    return out;\n  }\n  var lastFrame = 0;\n  function loop() {\n    if (!dmRun) return;\n    var now = Date.now();\n    if (now - lastFrame < 40) {            \n      raf(loop); return;\n    }\n    lastFrame = now;\n    var w = dmCv.width, h = dmCv.height;\n    dmCtx.clearRect(0, 0, w, h);\n    if (SET.dm) {\n      var area = w * (num(SET.dmarea) || 100) / 100;\n      var list = dmVisible(), rows = Math.max(2, Math.floor(h / 22)), used = [], i;\n      dmCtx.textBaseline = 'top';\n      for (i = 0; i < list.length && i < 26; i++) {\n        var d = list[i], size = 13, tt = d.txt;\n        dmCtx.font = size + 'px sans-serif';\n        var tw = Math.ceil(dmCtx.measureText ? dmCtx.measureText(tt).width : tt.length * size);\n        var row = 0, sp = num(SET.dmspeed) / 1 || 1;\n        var prog = (videoEl.currentTime - d.t) * sp / 6;\n        if (prog < 0 || prog > 1) continue;\n        for (row = 0; row < rows; row++) if (!used[row]) break;\n        if (row >= rows) row = i % rows;\n        used[row] = 1;\n        var x = area * (1 - prog) - tw * prog;\n        var col = d.color >>> 0;\n        var op = (num(SET.dmop) || 100) / 100;\n        dmCtx.globalAlpha = op;\n        dmCtx.fillStyle = '#' + ('000000' + col.toString(16)).slice(-6);\n        dmCtx.strokeStyle = 'rgba(0,0,0,.55)';\n        dmCtx.lineWidth = 2;\n        var y = 2 + row * 21;\n        if (d.mode === 5) { dmCtx.fillText(tt, w - tw - 6, y); }\n        else {\n          try { dmCtx.strokeText(tt, x, y); } catch (e) { }\n          dmCtx.fillText(tt, x, y);\n        }\n        dmCtx.globalAlpha = 1;\n      }\n    }\n    raf(loop);\n  }\n\n  function openProxy(url, v) {\n    var link = 'https://www.bilibili.com/video/' + (v.bv || ('av' + v.aid));\n    try {\n      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link);\n      else {\n        var ta = mk('textarea'); ta.value = link; ta.style.cssText = 'position:fixed;left:-9999px';\n        document.body.appendChild(ta); ta.select();\n        try { document.execCommand('copy'); } catch (e) { }\n        document.body.removeChild(ta);\n      }\n    } catch (e) { }\n    window.open(url, '_blank');\n  }\n  function userPage(mid) {\n    mid = String(mid || '').replace(/[^0-9]/g, '');\n    if (!mid) { setMain(status('\u53c2\u6570\u4e0d\u5b8c\u6574')); return; }\n    var box = mk('div');\n    box.appendChild(status('\u52a0\u8f7d\u4e2d', 1));\n    setMain(box);\n    api('user', { mid: mid }, function (j) {\n      if (j.code !== 0 || !j.data || !j.data.name) { setMain(status(why(j))); return; }\n      renderUser(j.data);\n    });\n  }\n  function renderUser(u) {\n    var box = mk('div');\n    var hd = mk('div', 'sp');\n    hd.innerHTML = '<div class=\"sp-banner\"></div><div class=\"sp-info\">' +\n      '<img class=\"sp-face\" src=\"' + esc(u.face) + '\" alt=\"\" referrerpolicy=\"no-referrer\">' +\n      '<div class=\"sp-name\">' + esc(u.name) + (u.off ? '<span class=\"chip t\">' + esc(u.off) + '</span>' : '') + '</div>' +\n      '<div class=\"sp-sign\">' + esc(u.sign || '') + '</div>' +\n      '<div class=\"sp-stat num\"><span>\u7c89\u4e1d <b>' + count(u.fans) + '</b></span><span>\u89c6\u9891 <b>' + count(u.videos) + '</b></span><span>\u83b7\u8d5e <b>' + count(u.like) + '</b></span></div>' +\n      '</div>';\n    box.appendChild(hd);\n    var tb = mk('div', 'sptabs'); tb.innerHTML = '<span>\u6295\u7a3f</span>';\n    box.appendChild(tb);\n    var body = mk('div');\n    box.appendChild(body);\n    var more = mk('button', 'loadmore', '\u52a0\u8f7d\u66f4\u591a');\n    box.appendChild(more);\n    setMain(box);\n    var pn = 0;\n    function load() {\n      pn++;\n      more.innerHTML = '\u52a0\u8f7d\u4e2d\u2026'; more.disabled = true;\n      api('uservideos', { mid: u.mid, pn: pn }, function (j) {\n        more.disabled = false; more.innerHTML = '\u52a0\u8f7d\u66f4\u591a';\n        if (j.code !== 0) {\n          if (pn === 1) body.appendChild(status(why(j)));\n          more.innerHTML = '\u6ca1\u6709\u66f4\u591a\u4e86';\n          return;\n        }\n        var arr = j.data || [], i;\n        if (!arr.length) {\n          if (pn === 1) body.appendChild(status('\u6682\u65e0\u6295\u7a3f'));\n          more.innerHTML = '\u6ca1\u6709\u66f4\u591a\u4e86';\n          return;\n        }\n        for (i = 0; i < arr.length; i++) { arr[i].up = u.name; arr[i].mid = u.mid; }\n        body.appendChild(grid(arr));\n      });\n    }\n    more.onclick = load;\n    load();\n  }\n  function boot() {\n    var tb = document.querySelectorAll('#tabs button,#tbar button'), i;\n    for (i = 0; i < tb.length; i++) {\n      tb[i].onclick = function () {\n        var v = this.getAttribute('data-v');\n        location.hash = v === 'home' ? '#/home/popular' : '#/' + v;\n      };\n    }\n    var sq = $('#sq'), sg = $('#sug'), timer = null;\n    function doSearch() {\n      var q = (sq.value || '').replace(/^\\s+|\\s+$/g, '');\n      sg.className = 'sug hide';\n      if (!q) return;\n      if (/^(BV[0-9A-Za-z]{8,14}|av[0-9]+|[0-9]{5,})$/i.test(q)) { location.hash = '#/video/' + encodeURIComponent(q); sq.blur(); return; }\n      location.hash = '#/search/' + encodeURIComponent(q);\n      sq.blur();\n    }\n    $('#sgo').onclick = doSearch;\n    sq.onkeypress = function (e) { e = e || window.event; if (e.keyCode === 13) doSearch(); };\n    function sug() {\n      var q = (sq.value || '').replace(/^\\s+|\\s+$/g, '');\n      if (!q || q.length > 30) { sg.className = 'sug hide'; return; }\n      api('square', { q: q }, function (j) { });\n      get('/api?ep=search&keyword=' + encodeURIComponent(q) + '&page_size=8', function (err, txt) {\n        var j = null; try { j = JSON.parse(txt); } catch (e) { }\n        var items = (j && j.code === 0 && j.data) ? j.data.slice(0, 7) : [];\n        if (!items.length) { sg.className = 'sug hide'; return; }\n        var html = '', i;\n        for (i = 0; i < items.length; i++) {\n          var tt = String(items[i].title).replace(/<[^>]*>/g, '');\n          html += '<div data-k=\"' + esc(tt.slice(0, 40)).replace(/\"/g, '') + '\">' + esc(tt.slice(0, 40)) + '</div>';\n        }\n        sg.innerHTML = html;\n        sg.className = 'sug';\n        var ds = sg.getElementsByTagName('div');\n        for (i = 0; i < ds.length; i++) {\n          ds[i].onclick = function () {\n            sq.value = this.getAttribute('data-k'); sg.className = 'sug hide';\n            location.hash = '#/search/' + encodeURIComponent(sq.value);\n          };\n        }\n      });\n    }\n    sq.onkeyup = function () {\n      clearTimeout(timer);\n      timer = setTimeout(sug, 320);\n    };\n    sq.onfocus = function () { if (sq.value) sug(); };\n    document.onclick = function (e) {\n      var t = e.target || e.srcElement;\n      if (t && (t.id === 'sq' || t.id === 'sgo' || (t.parentNode && t.parentNode.className === 'sug'))) return;\n      sg.className = 'sug hide';\n    };\n    var onrz = function () { dmSize(); };\n    if (window.addEventListener) { window.addEventListener('resize', onrz, false); window.addEventListener('orientationchange', onrz, false); }\n    addEventListener('hashchange', route);\n    route();\n  }\n  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(boot, 0);\n  else addEventListener('DOMContentLoaded', boot);\n})();\n\n</script>\n</body>\n</html>\n";


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
  if (CK) ck.push(CK);
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
  var text = await r.text();                       
  if (text.indexOf('"code":-352"') >= 0 || text.indexOf('"code":-412"') >= 0) {

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
async function getJson(url, noCache) {
  var t = await getText(url, noCache, 'json');
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
  uservideos: { u: 'https://api.bilibili.com/x/series/recArchivesByKeywords', nocache: 1, d: { ps: 30, keywords: '' }, pick: function (j, q) {
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
  var j = await getJson(spec.u + '?' + qs, !!spec.nocache);
  if (j && j.code === 0 && spec.pick) j = { code: 0, data: spec.pick(j, q), signed: signed ? 1 : 0 };
  else if (j && j.code !== 0) {
    if (name === 'view') {
      var pg0 = await peanutGet(params.bvid || params.bv, params.aid, envP);
      if (pg0) return { code: 0, data: peanutOne(pg0), signed: 0, peanut: 1 };
    }
    if (name === 'search') {
      var lk = pbLink(params.keyword || '');
      if (lk) {
        var pg2 = await peanutGet(lk, 0, envP);
        if (pg2) return { code: 0, data: [pbCard(pg2)], signed: signed ? 1 : 0, peanut: 1 };
      }
    }
    j = { code: j.code, message: String(j.message || j.msg || '接口返回异常').slice(0, 120) };
  }
  return j;
}


async function resolvePlay(q, env) {
  var bv = String(q.bvid || q.bv || '').slice(0, 20);
  var cid = num(q.cid), aid = num(q.aid), qn = num(q.qn);
  var hasCookie = !!(env && env.BILI_COOKIE);
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
  if (p.code !== 0) {
    var pg = await peanutGet(bv, aid, env);
    if (pg) {
      var mpg = pg.mp4 || {}, mi = (pg.info || {}).Cid ? num((pg.info || {}).Cid) : (cid || 0);
      var pq = peanutQn(mpg.info_description);
      return { code: 0, data: {
        cid: mi, quality: pq, qname: strip(mpg.info_description, 20) + ' · Peanut',
        sizeMB: Math.round(num(mpg.info_size) / 1048576 * 10) / 10,
        sec: Math.round(num(mpg.info_length) / 1000),
        src: (function () { var u = (mpg.backup_url && mpg.backup_url.length ? [mpg.player_url].concat(mpg.backup_url) : [mpg.player_url]), i, pref = /upos-zj|moyi|bcing|upzjmoe|upzj1mimoss|mirror01|mirrorcos/; for (i = 0; i < u.length; i++) if (pref.test(u[i])) return u[i]; return u[0]; })(),
        pbPick: 'mp4.player_url',
        fallbacks: 4, formats: [{ qn: pq, name: strip(mpg.info_description, 20) + ' (Peanut)', vip: 0 }],
        video_codecs: [], need: pq < qn ? 1 : 0,
      } };
    }
    return p;
  }
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

      src: (function () { var i, pref = /upos-zj|moyi|bcing|upzjmoe|upzj1mimoss|mirror01|mirrorcos/; for (i = 0; i < urls.length; i++) if (pref.test(urls[i])) return urls[i]; return urls[0]; })(),
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

  CK = (env && env.BILI_COOKIE) || '';
  if (!DEV.b3) ctx && ctx.waitUntil && ctx.waitUntil(ensureBuvid(false).catch(function () { }));
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
        cookie: !!(env && env.BILI_COOKIE), buvid: DEV.b3 ? 1 : 0, ticket: DEV.ticket ? 1 : 0,
      },
    });
    if (p === '/meta') return jsonRes({ code: 0, data: { rids: RIDS, qn: CFG.QN_NAME, max: env && env.BILI_COOKIE ? 127 : CFG.QN_MAX_ANON, ver: CFG.VER } });

    if (p === '/api') {
      var ep = String(params.get('ep') || '').replace(/[^a-z_]/g, '').slice(0, 20);
      if (!ep) return jsonRes({ code: -1, message: '缺少 ep' });
      var q = {};
      params.forEach(function (v, k) { if (k !== 'ep' && k !== 'sign' && k !== '_') q[k] = String(v).slice(0, 300); });
      var r = await apiCall(ep, q, params.get('sign') === '1', env);
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
export { handle };


export const config = {
  path: ['/', '/api', '/play', '/dm', '/health', '/meta', '/robots.txt', '/index.html'],
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

