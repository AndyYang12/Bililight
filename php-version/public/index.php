<?php
// © 2025-2026 AndyYang12 & loughead — AGPL-3.0-or-later
// biliLight PHP port — PHP 8.4+

declare(strict_types=1);

// ========== Config ==========
const VER = '1.0.9-php2';
const UA_DESK = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const REF = 'https://www.bilibili.com/';
const QN_MAX_ANON = 64;
const QN_NAME = [6 => '240P', 16 => '360P', 32 => '480P', 64 => '720P', 74 => '720P 60帧', 80 => '1080P', 112 => '1080P 高码率', 116 => '1080P60', 120 => '4K', 125 => 'HDR', 126 => '杜比视界', 127 => '8K'];
const TTL_MEDIA = 10800;
const TTL_API = 60;
const TTL_DM = 600;
const TTL_NAV = 10800;
const MIXIN = [46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52];
const APPKEY = '1d8b6e7d45233436';
const APPSEC = 'c2ed53a74eeefe3cf99fbd01d8c9c375';
const RIDS = [[0,'全站'],[1,'动画'],[3,'音乐'],[4,'游戏'],[5,'娱乐'],[11,'电视剧'],[23,'电影'],[129,'舞蹈'],[155,'时尚'],[160,'生活'],[188,'科技'],[217,'宠物'],[234,'运动']];

// ========== Cache dir ==========
const STORAGE_DIR = __DIR__ . '/../.storage';
const CACHE_MAX_ENTRIES = 500;
const CACHE_MAX_BYTES = 20 * 1024 * 1024;

function storage_dir(): string {
    if (!is_dir(STORAGE_DIR)) @mkdir(STORAGE_DIR, 0o755, true);
    return STORAGE_DIR;
}

function cache_key(string $url): string { return sha1($url); }

function cache_get(string $url): ?string {
    $dir = storage_dir() . '/cache';
    if (!is_dir($dir)) return null;
    $f = $dir . '/' . cache_key($url);
    $meta = $f . '.meta';
    if (!file_exists($f) || !file_exists($meta)) return null;
    $m = @json_decode(file_get_contents($meta), true);
    if (!$m || (time() - $m['age']) > $m['ttl']) { @unlink($f); @unlink($meta); return null; }
    return file_get_contents($f);
}

function cache_set(string $url, string $value, int $ttl): void {
    $dir = storage_dir() . '/cache';
    if (!is_dir($dir)) @mkdir($dir, 0o755, true);
    // Evict oldest if too many
    $files = glob($dir . '/*.meta') ?: [];
    while (count($files) >= CACHE_MAX_ENTRIES) {
        $oldestKey = null; $oldestAge = PHP_INT_MAX;
        foreach ($files as $mf) {
            $m = @json_decode(file_get_contents($mf), true);
            if (!$m) continue;
            if ($m['age'] < $oldestAge) { $oldestAge = $m['age']; $oldestKey = basename($mf, '.meta'); }
        }
        if ($oldestKey) { @unlink($dir . '/' . $oldestKey); @unlink($dir . '/' . $oldestKey . '.meta'); }
        $files = glob($dir . '/*.meta') ?: [];
    }
    $key = cache_key($url);
    file_put_contents($dir . '/' . $key, $value);
    file_put_contents($dir . '/' . $key . '.meta', json_encode(['age' => time(), 'ttl' => $ttl]));
}

// ========== State persistence (PHP is stateless!) ==========
function state_path(): string { return storage_dir() . '/state.json'; }
function state_load(): array {
    $raw = @file_get_contents(state_path());
    if ($raw === false || $raw === '') return ['b3' => '', 'b4' => '', 'fp' => '', 'lsid' => '', 'uuid' => '', 'nut' => '', 'ticket' => '', 'tex' => 0, 'at' => 0, 'nav_key' => '', 'nav_at' => 0];
    $s = @json_decode($raw, true);
    return is_array($s) ? $s : ['b3' => '', 'b4' => '', 'fp' => '', 'lsid' => '', 'uuid' => '', 'nut' => '', 'ticket' => '', 'tex' => 0, 'at' => 0, 'nav_key' => '', 'nav_at' => 0];
}
function state_save(array $s): void { file_put_contents(state_path(), json_encode($s, JSON_UNESCAPED_SLASHES)); }

// ========== Globals ==========
$CK = getenv('BILI_COOKIE') ?: '';
$UCK = '';
$DEV = state_load();
$NAV = ['key' => $DEV['nav_key'] ?? '', 'at' => $DEV['nav_at'] ?? 0];

function state_persist(): void {
    global $DEV, $NAV;
    $DEV['nav_key'] = $NAV['key'];
    $DEV['nav_at'] = $NAV['at'];
    state_save($DEV);
}

register_shutdown_function('state_persist');

// ========== Utils ==========
function num(mixed $v): int { if ($v === null || $v === '' || $v === false) return 0; return (int)$v; }
function strip(mixed $v, int $n = 80): string {
    if ($v === null) return '';
    $s = trim((string)$v);
    if (function_exists('mb_substr')) return mb_substr($s, 0, $n, 'UTF-8');
    return substr($s, 0, $n);
}
function enc(string $s): string { return rawurlencode($s); }
function pic(?string $u, string $size = '480w_300h_1c.webp'): string {
    if (!$u) return '';
    $s = preg_replace('#^http:#i', 'https:', $u);
    $s = preg_replace('#^//#', 'https://', $s);
    if (preg_match('#^https://((?:i[0-9]|avatar)\.hdslb\.com)/(bfs/[A-Za-z0-9_.\-/]+(?:jpg|jpeg|png|webp|gif))(@[0-9a-zA-Z._-]+)?(?:\?.*)?$#i', $s, $m)) {
        $path = $m[2] . ($m[3] ?? '');
        if (!str_contains($path, '@') && !preg_match('/\.gif$/i', $path)) $path .= '@' . $size;
        return 'https://' . $m[1] . '/' . $path;
    }
    return '';
}
function dur(mixed $v): string {
    $s = num($v); if (!$s) return '';
    $h = (int)($s / 3600); $m = (int)($s % 3600 / 60); $x = $s % 60;
    return ($h ? $h . ':' . str_pad((string)$m, 2, '0', STR_PAD_LEFT) : $m) . ':' . str_pad((string)$x, 2, '0', STR_PAD_LEFT);
}
function ago(int $ts): string {
    if (!$ts) return '';
    $s = max(0, time() - $ts);
    if ($s < 3600) return max(1, (int)($s / 60)) . ' 分钟前';
    if ($s < 86400) return (int)($s / 3600) . ' 小时前';
    if ($s < 86400 * 30) return (int)($s / 86400) . ' 天前';
    return date('Y-m-d', $ts);
}
function hex_rand(int $n): string { return bin2hex(random_bytes($n)); }
function gen_uuid(): string {
    $s = ''; for ($i = 0; $i < 32; $i++) $s .= dechex(random_int(0, 15));
    return implode('-', [substr($s,0,8), substr($s,8,4), substr($s,12,4), substr($s,16,4), substr($s,20,12)])
        . substr(strval(time() % 10000), -5) . 'infoc';
}
function bname(string $u): string {
    $s = substr($u, strrpos($u, '/') + 1);
    return explode('.', $s)[0] ?? $s;
}
function mixin_key(string $a, string $b): string {
    $raw = $a . $b;
    $o = '';
    foreach (MIXIN as $i) if (isset($raw[$i])) $o .= $raw[$i];
    return $o;
}

// ========== HTTP ==========
function h_api(): array {
    global $CK, $UCK, $DEV;
    $h = [
        'user-agent: ' . UA_DESK,
        'referer: ' . REF,
        'accept: application/json, text/plain, */*',
        'accept-language: zh-CN,zh;q=0.9,en;q=0.8',
        'sec-fetch-dest: empty',
        'sec-fetch-mode: cors',
        'sec-fetch-site: same-site',
    ];
    $ck = [];
    if ($UCK) $ck[] = $UCK; elseif ($CK) $ck[] = $CK;
    $ck = array_merge($ck, dev_cookies());
    if ($ck) $h[] = 'cookie: ' . implode('; ', $ck);
    return $h;
}
function h_api_m(): array {
    return ['user-agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15', 'referer: https://m.bilibili.com/', 'accept: application/json'];
}
function dev_cookies(): array {
    global $DEV;
    $c = [];
    foreach ($DEV as $k => $v) if ($v && $v !== '' && $v !== 0) {
        if ($k === 'b3') $c[] = 'buvid3=' . $v;
        elseif ($k === 'b4') $c[] = 'buvid4=' . $v;
        elseif ($k === 'fp') $c[] = 'buvid_fp=' . $v;
        elseif ($k === 'lsid') $c[] = 'b_lsid=' . $v;
        elseif ($k === 'uuid') $c[] = '_uuid=' . $v;
        elseif ($k === 'nut') $c[] = 'b_nut=' . $v;
        elseif ($k === 'ticket') $c[] = 'bili_ticket=' . $v;
    }
    if (!empty($DEV['ticket']) && !empty($DEV['tex'])) $c[] = 'bili_ticket_expires=' . $DEV['tex'];
    return $c;
}

function curl_get(string $url, array $headers = [], int $timeout = 15): array {
    $ch = curl_init($url);
    $respHeaders = [];
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_ENCODING => '',
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_HEADERFUNCTION => function ($ch, $line) use (&$respHeaders) {
            $len = strlen($line);
            $t = trim($line);
            if ($t) $respHeaders[] = $t;
            return $len;
        },
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $code, 'body' => $body ?: '', 'headers' => $respHeaders];
}
function curl_post(string $url, array $headers, string $body, int $timeout = 15): array {
    $ch = curl_init($url);
    $respHeaders = [];
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout,
        CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_ENCODING => '',
        CURLOPT_HTTPHEADER => $headers, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body,
        CURLOPT_HEADERFUNCTION => function ($ch, $line) use (&$respHeaders) {
            $len = strlen($line); $t = trim($line); if ($t) $respHeaders[] = $t; return $len;
        },
    ]);
    $b = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    return ['code' => $code, 'body' => $b ?: '', 'headers' => $respHeaders];
}

// ========== Device / Fingerprint ==========
function hmac_dev(string $msg): string { return hash_hmac('sha256', $msg, 'XgwSnGZ1p'); }

function dev_ticket(bool $force = false): void {
    global $DEV;
    $now = time();
    if (!$force && !empty($DEV['ticket']) && $now < ($DEV['tex'] ?? 0) - 86400) return;
    $sig = hmac_dev('ts' . $now);
    $hd = ['user-agent: ' . UA_DESK, 'referer: ' . REF, 'accept: application/json, text/plain, */*', 'content-type: application/x-www-form-urlencoded'];
    $cks = dev_cookies(); if ($cks) $hd[] = 'cookie: ' . implode('; ', $cks);
    $r = curl_post('https://api.bilibili.com/bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket?key_id=ec02&hexsign=' . $sig . '&context%5Bts%5D=' . $now, $hd, '');
    $j = @json_decode($r['body'], true);
    $d = $j['data'] ?? null;
    if ($d && !empty($d['ticket'])) { $DEV['ticket'] = (string)$d['ticket']; $DEV['tex'] = (num($d['created_at']) ?: $now) + 259200; }
}

function ensure_buvid(bool $force = false): string {
    global $DEV;
    $nowMs = (int)(microtime(true) * 1000);
    if (!$force && !empty($DEV['b3']) && ($nowMs - ($DEV['at'] ?? 0)) < 3600000) {
        dev_ticket(false);
        return $DEV['b3'];
    }
    if (empty($DEV['nut'])) $DEV['nut'] = (string)floor($nowMs / 1000);
    if (empty($DEV['fp'])) $DEV['fp'] = hex_rand(16);
    if (empty($DEV['lsid'])) $DEV['lsid'] = strtoupper(hex_rand(4)) . '_' . strtoupper(dechex($nowMs));
    if (empty($DEV['uuid'])) $DEV['uuid'] = gen_uuid();
    // SPI endpoint
    $r = curl_get('https://api.bilibili.com/x/frontend/finger/spi', h_api());
    $j = @json_decode($r['body'], true); $d = $j['data'] ?? null;
    if ($d && !empty($d['b_3'])) $DEV['b3'] = (string)$d['b_3'];
    if ($d && !empty($d['b_4']) && strlen($d['b_4']) < 150) $DEV['b4'] = (string)$d['b_4'];
    // Fallback: scrape from main page set-cookie
    if (empty($DEV['b3'])) {
        $hd = ['user-agent: ' . UA_DESK]; if ($GLOBALS['CK']) $hd[] = 'cookie: ' . $GLOBALS['CK'];
        $r2 = curl_get('https://www.bilibili.com/', $hd);
        foreach ($r2['headers'] as $h) {
            if (stripos($h, 'set-cookie:') === 0 && preg_match('/buvid3=([^;]+)/i', $h, $m)) {
                $DEV['b3'] = urldecode($m[1]); break;
            }
        }
    }
    $DEV['at'] = $nowMs;
    dev_ticket(false);
    return $DEV['b3'] ?? '';
}

function wbi_key(): string {
    global $NAV;
    $now = (int)microtime(true);
    if ($NAV['key'] && ($now - $NAV['at']) < TTL_NAV) return $NAV['key'];
    ensure_buvid(false);
    $t = get_text('https://api.bilibili.com/x/web-interface/nav', true);
    $j = @json_decode($t, true);
    $w = $j['data']['wbi_img'] ?? null;
    if (!$w || empty($w['img_url']) || empty($w['sub_url'])) return $NAV['key'];
    $k = mixin_key(bname($w['img_url']), bname($w['sub_url']));
    if (strlen($k) === 32) $NAV = ['key' => $k, 'at' => $now];
    return $k;
}

function get_text(string $url, bool $noCache = false, string $kind = 'json', ?array $hd = null): string {
    $ttl = $kind === 'xml' ? TTL_DM : TTL_API;
    if (!$noCache && !$hd) {
        $hit = cache_get($url);
        if ($hit !== null) return $hit;
    }
    $headers = $hd ?? h_api();
    $r = curl_get($url, $headers);
    $text = $r['body'] ?? '';
    // Anti-spam retry
    if ($text && !is_array(@json_decode($text, true)) && ($r['code'] ?? 0) !== 200) {
        ensure_buvid(true);
        $r = curl_get($url, h_api());
        $text = $r['body'] ?? '';
    }
    if (!$noCache && !$hd && ($r['code'] ?? 0) === 200 && $text) cache_set($url, $text, $ttl);
    return $text;
}

function get_json(string $url, bool $noCache = false, ?array $hd = null): array {
    $t = get_text($url, $noCache, 'json', $hd);
    $j = @json_decode($t, true);
    return is_array($j) ? $j : ['code' => -1, 'message' => '上游返回非 JSON'];
}

// ========== Media signing ==========
function hmac_media_key(): string { static $k = null; return $k ??= getenv('SECRET') ?: 'bililight-v1'; }
function b64url_encode(string $s): string { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function b64url_decode(string $s): string { $s = strtr($s, '-_', '+/'); while (strlen($s) % 4) $s .= '='; return base64_decode($s); }
function sig_of(string $msg): string { return b64url_encode(hash_hmac('sha256', $msg, hmac_media_key(), true)); }
function media_url(array $urls, string $ck = ''): string {
    $exp = time() + TTL_MEDIA;
    $body = b64url_encode(json_encode(array_slice($urls, 0, 4), JSON_UNESCAPED_SLASHES));
    $c = $ck ? b64url_encode($ck) : '';
    return '/m?e=' . $exp . '&u=' . urlencode($body) . '&c=' . urlencode($c) . '&s=' . urlencode(sig_of($exp . '|' . $body . '|' . $c));
}

// ========== API Endpoints ==========
$EP = [
    'popular'   => ['u' => 'https://api.bilibili.com/x/web-interface/popular',      'd' => ['ps' => 20], 'pick' => 'pick_cards'],
    'rank'      => ['u' => 'https://api.bilibili.com/x/web-interface/ranking/v2',   'd' => ['type' => 'all'], 'pick' => 'pick_cards'],
    'search'    => ['u' => 'https://api.bilibili.com/x/web-interface/wbi/search/type', 'sig' => 1, 'nocache' => 1, 'd' => ['search_type' => 'video', 'page_size' => 30], 'pick' => 'pick_search'],
    'square'    => ['u' => 'https://api.bilibili.com/x/web-interface/wbi/search/square', 'd' => ['limit' => 10]],
    'view'      => ['u' => 'https://api.bilibili.com/x/web-interface/view', 'pick' => 'pick_one'],
    'related'   => ['u' => 'https://api.bilibili.com/x/web-interface/archive/related', 'pick' => 'pick_cards'],
    'playurl'   => ['u' => 'https://api.bilibili.com/x/player/playurl', 'nocache' => 1, 'd' => ['fnval' => 1, 'fnver' => 0, 'fourk' => 1, 'platform' => 'html5', 'high_quality' => 1]],
    'reply'     => ['u' => 'https://api.bilibili.com/x/v2/reply/main', 'd' => ['type' => 1, 'mode' => 3, 'ps' => 20], 'pick' => 'pick_replies'],
    'nav'       => ['u' => 'https://api.bilibili.com/x/web-interface/nav', 'nocache' => 1],
];

function pick_cards(array $d, bool $isSearch = false): array {
    $list = $d['list'] ?? $d['items'] ?? $d['result'] ?? [];
    if (!is_array($list)) $list = [];
    $out = [];
    foreach ($list as $it) {
        if (!is_array($it)) continue;
        $st = $it['stat'] ?? [];
        $owner = $it['owner'] ?? [];
        $out[] = [
            'bv' => $it['bvid'] ?? '', 'aid' => num($it['aid'] ?? $it['id'] ?? 0),
            'mid' => num($it['mid'] ?? $owner['mid'] ?? 0),
            'title' => strip($it['title'] ?? '', 160),
            'pic' => pic($it['pic'] ?? $it['cover'] ?? $it['pic_url'] ?? ''),
            'up' => $owner['name'] ?? $it['author'] ?? $it['upname'] ?? '',
            'view' => num($isSearch ? ($it['play'] ?? 0) : (($st['view'] ?? $it['play'] ?? 0))),
            'dan' => num($isSearch ? ($it['danmaku'] ?? 0) : (($st['danmaku'] ?? $it['danmaku_view'] ?? 0))),
            'dur' => dur($isSearch ? ($it['duration'] ?? 0) : ($it['duration_text'] ?? $it['duration'] ?? 0)),
            'pub' => num($it['pubdate'] ?? $it['senddate'] ?? $it['stime'] ?? 0),
            'desc' => $isSearch ? strip($it['description'] ?? '', 130) : '',
        ];
    }
    return $out;
}
function pick_search(array $d): array { return pick_cards($d, true); }
function pick_one(array $d): array {
    if (!$d) return [];
    $st = $d['stat'] ?? []; $o = $d['owner'] ?? [];
    $pages = [];
    foreach (($d['pages'] ?? []) as $p) $pages[] = ['cid' => num($p['cid'] ?? 0), 'part' => strip($p['part'] ?? '', 80), 'dur' => dur($p['duration'] ?? 0), 'idx' => num($p['page'] ?? 0)];
    return [
        'bv' => $d['bvid'] ?? '', 'aid' => num($d['aid'] ?? 0), 'cid' => num(($pages[0]['cid'] ?? 0) ?: ($d['cid'] ?? 0)),
        'title' => strip($d['title'] ?? '', 200), 'desc' => strip($d['desc'] ?? '', 2000),
        'pic' => pic($d['pic'] ?? '', '960w_600h_1c.webp'),
        'up' => strip($o['name'] ?? '', 40), 'mid' => num($o['mid'] ?? 0), 'face' => pic($o['face'] ?? '', '96w_96h_1c.webp'),
        'view' => num($st['view'] ?? 0), 'dan' => num($st['danmaku'] ?? 0), 'reply' => num($st['reply'] ?? 0),
        'like' => num($st['like'] ?? 0), 'coin' => num($st['coin'] ?? 0), 'fav' => num($st['favorite'] ?? 0), 'share' => num($st['share'] ?? 0),
        'pub' => num($d['pubdate'] ?? 0), 'pubtxt' => ago(num($d['pubdate'] ?? 0)),
        'dur' => dur($d['duration'] ?? 0), 'tname' => strip($d['tname'] ?? '', 20),
        'pages' => $pages, 'videos' => num($d['videos'] ?? 0) ?: count($pages),
    ];
}
function pick_replies(array $d): array {
    $out = [];
    $top = $d['upper']['top'] ?? null;
    $src = $top ? [$top] : [];
    $src = array_merge($src, ($d['replies'] ?? []));
    foreach ($src as $r) {
        if (!is_array($r)) continue;
        $m = $r['member'] ?? []; $c = $r['content'] ?? [];
        $out[] = [
            'un' => strip($m['uname'] ?? '', 40), 'face' => pic($m['avatar'] ?? '', '64w_64h_1c.webp'),
            'msg' => strip($c['message'] ?? '', 600), 'like' => num($r['like'] ?? 0),
            'cnt' => num($r['rcount'] ?? 0), 'time' => ago(num($r['ctime'] ?? 0)),
        ];
    }
    return ['total' => num($d['cursor']['all_count'] ?? 0), 'items' => $out];
}

function api_call(string $name, array $params, bool $forceSign = false): array {
    global $EP;
    $spec = $EP[$name] ?? null;
    if (!$spec) return ['code' => -1, 'message' => '未知端点: ' . $name];
    ensure_buvid(false);
    $q = $spec['d'] ?? [];
    foreach ($params as $k => $v) if ($v !== null && $v !== '' && $v !== false) $q[$k] = $v;
    $signed = false;
    $qs = '';
    if (($spec['sig'] ?? false) || $forceSign) {
        $key = wbi_key();
        if ($key) {
            $q['wts'] = (string)floor(microtime(true));
            ksort($q);
            $norm = [];
            foreach ($q as $k => $v) $norm[$k] = str_replace(["'", '!', '(', ')', '*'], '', (string)$v);
            ksort($norm);
            $s = ''; foreach ($norm as $k => $v) $s .= enc($k) . '=' . enc($v) . '&';
            $s = rtrim($s, '&');
            $qs = $s . '&w_rid=' . md5($s . $key);
            $signed = true;
        }
    }
    if (!$qs) {
        ksort($q);
        $s = ''; foreach ($q as $k => $v) $s .= enc($k) . '=' . enc((string)$v) . '&';
        $qs = rtrim($s, '&');
    }
    $hd = ($spec['m'] ?? false) ? h_api_m() : null;
    $j = get_json($spec['u'] . '?' . $qs, (bool)($spec['nocache'] ?? false), $hd);
    if (($j['code'] ?? -1) === 0 && !empty($spec['pick'])) {
        $d = is_array($j['data'] ?? null) ? $j['data'] : [];
        $picked = match ($spec['pick']) {
            'pick_cards' => pick_cards($d),
            'pick_search' => pick_search($d),
            'pick_one' => pick_one($d),
            'pick_replies' => pick_replies($d),
            default => $d,
        };
        return ['code' => 0, 'data' => $picked, 'signed' => $signed ? 1 : 0];
    }
    return $j;
}

function resolve_play(array $q): array {
    global $CK, $UCK;
    $bv = strip($q['bvid'] ?? $q['bv'] ?? '', 20);
    $cid = num($q['cid'] ?? 0); $aid = num($q['aid'] ?? 0); $qn = num($q['qn'] ?? 0);
    $hasCookie = $CK || $UCK;
    $max = $hasCookie ? 127 : QN_MAX_ANON;
    if (!$qn || $qn > $max) $qn = $max;
    if (!$cid && !$bv && !$aid) return ['code' => -1, 'message' => '缺少视频参数'];
    if (!$cid) {
        $v = api_call('view', ['bvid' => $bv, 'aid' => $aid]);
        if (($v['code'] ?? -1) !== 0) return $v;
        $cid = num($v['data']['cid'] ?? 0);
    }
    $p = api_call('playurl', ['bvid' => $bv, 'aid' => $aid, 'cid' => $cid, 'qn' => $qn]);
    if (($p['code'] ?? -1) !== 0) return $p;
    $d = $p['data'] ?? [];
    $seg = $d['durl'][0] ?? null;
    $urls = $seg ? array_values(array_filter(array_merge([$seg['url']], $seg['backup_url'] ?? []), fn($u) => is_string($u) && preg_match('#^https?://#i', $u))) : [];
    if (!$urls) return ['code' => -3, 'message' => '没有可直连的 mp4（付费/会员/版权限制）'];
    $fmts = [];
    foreach (($d['support_formats'] ?? []) as $f) {
        $fq = num($f['quality'] ?? 0);
        if ($fq > 0 && $fq <= $max) $fmts[] = [
            'qn' => $fq,
            'name' => $f['display_desc'] ?? $f['new_description'] ?? QN_NAME[$fq] ?? '',
            'vip' => num($f['need_vip'] ?? 0),
        ];
    }
    usort($fmts, fn($a, $b) => $b['qn'] <=> $a['qn']);
    return ['code' => 0, 'data' => [
        'cid' => num($d['cid'] ?? $cid), 'quality' => num($d['quality'] ?? 0),
        'qname' => QN_NAME[num($d['quality'] ?? 0)] ?? '',
        'sizeMB' => round(num($seg['size'] ?? 0) / 1048576, 1),
        'sec' => round(num($seg['length'] ?? $d['timelength'] ?? 0) / 1000),
        'src' => media_url($urls, $UCK ?: $CK),
        'fallbacks' => count($urls), 'formats' => $fmts,
        'need' => num($d['quality'] ?? 0) < $qn ? 1 : 0,
    ]];
}

// ========== Image proxy helpers ==========
function h_img(): array {
    return [
        'user-agent: ' . UA_DESK,
        'referer: ' . REF,
        'accept: image/webp,image/apng,image/*,*/*;q=0.8',
        'accept-language: zh-CN,zh;q=0.9',
        'sec-fetch-dest: image',
        'sec-fetch-mode: no-cors',
        'sec-fetch-site: cross-site',
    ];
}
function img_proxyable(string $hostKey, string $path): ?string {
    $h = trim($hostKey);
    if (!preg_match('/^(i[0-9]|avatar)$/', $h)) return null;
    if (str_contains($path, '..') || str_starts_with($path, '//')) return null;
    if (!preg_match('#^/bfs/[A-Za-z0-9_.\-/]+\\.(jpg|jpeg|png|webp|gif)(@[0-9a-zA-Z._-]+)?$#i', $path)) return null;
    return 'https://' . $h . '.hdslb.com' . $path;
}
function serve_img(): never {
    $u = img_proxyable((string)($_GET['h'] ?? ''), (string)($_GET['f'] ?? ''));
    if (!$u) { http_response_code(400); echo 'bad'; exit; }
    $r = curl_get($u, h_img(), 10);
    if (($r['code'] ?? 0) >= 400 || empty($r['body'])) { http_response_code(404); exit; }
    header('content-type: ' . (extract_http_header($r['headers'], 'content-type') ?: 'image/webp'));
    header('cache-control: public, max-age=86400, immutable');
    header('access-control-allow-origin: *');
    header('x-content-type-options: nosniff');
    echo $r['body']; exit;
}

// ========== Act helpers ==========
function act_post(string $url, string $form, array $hdrs): array {
    $hd = array_merge($hdrs, ['content-type: application/x-www-form-urlencoded', 'origin: https://www.bilibili.com']);
    $r = curl_post($url, $hd, $form);
    $j = @json_decode($r['body'], true);
    return is_array($j) ? $j : ['code' => -1, 'message' => '上游返回非 JSON'];
}
function serve_act(): never {
    global $UCK;
    if (!$UCK) json_res(['code' => -101, 'message' => '需要登录']);
    $body = file_get_contents('php://input');
    $ab = $body ? @json_decode($body, true) : null;
    if (!is_array($ab)) json_res(['code' => -1, 'message' => '请求体异常']);
    $act = preg_replace('/[^a-z_]/', '', (string)($ab['act'] ?? ''));
    $act = substr($act, 0, 20);
    $csrf = '';
    if (preg_match('/(?:^|;\s*)bili_jct=([^;]+)/', $UCK, $m)) $csrf = $m[1];
    $av = substr((string)($ab['bvid'] ?? ''), 0, 20);
    $aaid = num($ab['aid'] ?? 0);
    $ah = array_merge(h_api(), ['content-type: application/x-www-form-urlencoded', 'origin: https://www.bilibili.com']);
    if ($act === 'like') {
        json_res(act_post('https://api.bilibili.com/x/web-interface/archive/like',
            'bvid=' . enc($av) . '&csrf=' . enc($csrf) . '&spar=', $ah));
    }
    if ($act === 'coin') {
        json_res(act_post('https://api.bilibili.com/x/web-interface/archive/coin',
            'bvid=' . enc($av) . '&multiply=2&select=0&csrf=' . enc($csrf), $ah));
    }
    if ($act === 'fav') {
        $amid = '';
        if (preg_match('/DedeUserID=([^;]+)/', $UCK, $m)) $amid = $m[1];
        if (!$amid) json_res(['code' => -1, 'message' => 'Cookie 缺少 DedeUserID']);
        $fj = get_json('https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=' . enc($amid), true);
        $fl = $fj['data']['list'] ?? [];
        if (!is_array($fl) || !$fl) json_res(['code' => -1, 'message' => '没有可用的收藏夹']);
        $fid = num($fl[0]['id'] ?? 0);
        $fbase = 'rid=' . $aaid . '&add_media_ids=' . enc('[' . $fid . ']') . '&del_media_ids=' . enc('[]') . '&csrf=' . enc($csrf);
        $fres = act_post('https://api.bilibili.com/x/v3/fav/resource/deal', $fbase . '&type=12', $ah);
        if (num($fres['code'] ?? -1) !== 0) {
            $fres2 = act_post('https://api.bilibili.com/x/v3/fav/resource/deal', $fbase . '&type=2', $ah);
            if (num($fres2['code'] ?? -1) === 0) $fres = $fres2;
        }
        json_res($fres ?: ['code' => -1, 'message' => '收藏失败']);
    }
    if ($act === 'sessions') {
        $hd = [
            'user-agent: ' . UA_DESK, 'referer: https://message.bilibili.com/',
            'cookie: ' . $UCK, 'content-type: application/json', 'csrf: ' . $csrf,
        ];
        $bodyArr = json_encode(['device' => 1, 'fetch_all' => 0, 'session_list' => ['count' => 20, 'exemplar' => -1, 'area' => 2, 'area2' => 0]], JSON_UNESCAPED_UNICODE);
        $r = curl_post('https://message.bilibili.com/x/sync/msg', $hd, $bodyArr);
        $sj = @json_decode($r['body'], true);
        if (!is_array($sj) || num($sj['code'] ?? -1) !== 0) {
            json_res(['code' => is_array($sj) ? num($sj['code'] ?? -1) : -1,
                'message' => strip($sj['message'] ?? '', 60) ?: '私信接口异常', 'data' => []]);
        }
        $sl = $sj['data']['session_list'] ?? [];
        $profs = $sj['data']['profiles'] ?? [];
        $sout = [];
        if (is_array($sl)) foreach ($sl as $ss) {
            if (!is_array($ss)) continue;
            $lm = $ss['latest_message'] ?? [];
            $mc = $lm['message_content'] ?? [];
            $txt = ($mc['text']['content'] ?? '') ?: ($mc['content'] ?? '') ?: ($lm['content'] ?? '');
            $tk = $profs[(string)($ss['talker_id'] ?? '')] ?? $ss['talker'] ?? [];
            $sout[] = [
                'mid' => num($ss['talker_id'] ?? 0),
                'name' => strip($tk['name'] ?? $tk['uname'] ?? '', 40),
                'face' => pic($tk['face'] ?? $tk['src'] ?? '', '64w_64h_1c.webp'),
                'text' => strip($txt, 120),
                'ts' => num($lm['timestamp'] ?? 0),
                'unread' => num($ss['unread_count'] ?? 0),
            ];
        }
        json_res(['code' => 0, 'data' => $sout]);
    }
    json_res(['code' => -1, 'message' => '未知操作']);
}

// ========== Response helpers ==========
function json_res(mixed $o, int $status = 200, array $extra = []): never {
    http_response_code($status);
    header('content-type: application/json; charset=utf-8');
    header('cache-control: no-store');
    header('access-control-allow-origin: *');
    foreach ($extra as $k => $v) header("$k: $v");
    echo json_encode($o, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function extract_http_header(array $headers, string $name): string {
    foreach ($headers as $h) {
        $colon = strpos($h, ':');
        if ($colon === false) continue;
        [$k, $v] = explode(':', $h, 2);
        if (strcasecmp(trim($k), $name) === 0) return trim($v);
    }
    return '';
}

// ========== ROUTER ==========
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

if ($method === 'OPTIONS') {
    http_response_code(204);
    header('access-control-allow-origin: *');
    header('access-control-allow-methods: GET, HEAD, POST, OPTIONS');
    exit;
}

// Read user cookie header
$UCK = preg_match('/^[A-Za-z0-9%=;:._\-&+ ]{1,3000}$/', $_SERVER['HTTP_X_BL_CK'] ?? '') ? $_SERVER['HTTP_X_BL_CK'] : '';

// Ensure fingerprint (best-effort, non-blocking on warm-up)
try { ensure_buvid(false); } catch (\Throwable) {}

try {
    if ($uri === '/' || $uri === '/index.html') {
        header('content-type: text/html; charset=utf-8');
        header('cache-control: no-cache');
        readfile(__DIR__ . '/page.html');
        exit;
    }
    if ($uri === '/health') {
        json_res(['code' => 0, 'data' => ['app' => 'biliLight', 'ver' => VER, 'cookie' => !empty($CK), 'buvid' => !empty($DEV['b3']), 'ticket' => !empty($DEV['ticket'])]]);
    }
    if ($uri === '/meta') {
        $max = $CK ? 127 : QN_MAX_ANON;
        json_res(['code' => 0, 'data' => ['rids' => RIDS, 'qn' => QN_NAME, 'max' => $max, 'ver' => VER]]);
    }
    if ($uri === '/api') {
        $ep = preg_replace('/[^a-z_]/', '', $_GET['ep'] ?? '');
        $ep = substr($ep, 0, 20);
        if (!$ep) json_res(['code' => -1, 'message' => '缺少 ep']);
        $q = [];
        foreach ($_GET as $k => $v) if (!in_array($k, ['ep', 'sign', '_'], true) && $v !== '') $q[$k] = substr((string)$v, 0, 300);
        if (isset($q['keyword64'])) { $q['keyword'] = mb_substr(b64url_decode($q['keyword64']), 0, 80); unset($q['keyword64']); }
        if (isset($q['q64'])) { $q['q'] = mb_substr(b64url_decode($q['q64']), 0, 80); unset($q['q64']); }
        json_res(api_call($ep, $q, ($_GET['sign'] ?? '') === '1'));
    }
    if ($uri === '/play') {
        json_res(resolve_play([
            'bvid' => $_GET['bvid'] ?? '', 'aid' => $_GET['aid'] ?? 0,
            'cid' => $_GET['cid'] ?? 0, 'qn' => $_GET['qn'] ?? 0,
        ]));
    }
    if ($uri === '/dm') {
        $cid = num($_GET['cid'] ?? 0);
        if (!$cid) { header('content-type: text/xml; charset=utf-8'); http_response_code(400); echo '<?xml version="1.0"?><i></i>'; exit; }
        $txt = get_text('https://comment.bilibili.com/' . $cid . '.xml', false, 'xml');
        if (!$txt || (!str_contains($txt, '<?xml') && !str_contains($txt, '<i>'))) $txt = '<?xml version="1.0"?><i></i>';
        header('content-type: text/xml; charset=utf-8');
        header('cache-control: public, max-age=' . TTL_DM);
        header('access-control-allow-origin: *');
        echo $txt; exit;
    }
    if ($uri === '/qr') {
        $j = get_json('https://passport.bilibili.com/x/passport-login/web/qrcode/generate', true);
        $dg = $j['data'] ?? [];
        json_res(['code' => num($j['code'] ?? -1), 'message' => strip($j['message'] ?? '', 60),
            'data' => !empty($dg['url']) ? ['url' => strip($dg['url'], 300), 'key' => strip($dg['qrcode_key'] ?? '', 64)] : null]);
    }
    if ($uri === '/qrpoll') {
        $qkey = preg_replace('/[^A-Za-z0-9]/', '', (string)($_GET['key'] ?? ''));
        $qkey = substr($qkey, 0, 64);
        if (!$qkey) json_res(['code' => -1, 'message' => '缺少 key']);
        $r = curl_get('https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=' . $qkey);
        $pj = @json_decode($r['body'], true) ?: []; $pd = $pj['data'] ?? [];
        $code = num($pd['code'] ?? $pj['code'] ?? -1);
        $po = ['code' => $code, 'message' => strip($pd['message'] ?? $pj['message'] ?? '', 40)];
        if ($code === 0) {
            $parts = [];
            foreach ($r['headers'] as $h) {
                if (stripos($h, 'set-cookie:') === 0 && preg_match_all('/(SESSDATA|bili_jct|DedeUserID|DedeUserID__ckMd5|sid)=([^;]+)/i', $h, $mm)) {
                    foreach ($mm[1] as $i => $n) $parts[] = $n . '=' . $mm[2][$i];
                }
            }
            $po['ck'] = implode('; ', $parts);
        }
        json_res(['code' => 0, 'data' => $po]);
    }
    if ($uri === '/m') {
        $exp = num($_GET['e'] ?? 0); $body = (string)($_GET['u'] ?? ''); $s = (string)($_GET['s'] ?? ''); $c = (string)($_GET['c'] ?? '');
        if (!$exp || !$body || $exp < time() || !hash_equals(sig_of($exp . '|' . $body . '|' . $c), $s)) {
            http_response_code(403); echo 'bad token'; exit;
        }
        $urls = @json_decode(b64url_decode($body), true);
        if (!is_array($urls) || !$urls) { http_response_code(403); echo 'bad token'; exit; }
        $ck = ''; if ($c) { $d = b64url_decode($c); if (preg_match('/^[A-Za-z0-9%=;:._\-&+ ]{1,3000}$/', $d)) $ck = $d; }
        $hdrs = ['user-agent: ' . UA_DESK, 'referer: ' . REF, 'accept-encoding: identity'];
        $useCk = $ck ?: ($UCK ?: $CK);
        if ($useCk) $hdrs[] = 'cookie: ' . $useCk;
        if (!empty($_SERVER['HTTP_RANGE'])) $hdrs[] = 'range: ' . $_SERVER['HTTP_RANGE'];
        $res = null;
        foreach ($urls as $u) {
            if (!preg_match('#^https?://#i', $u)) continue;
            $tmp = curl_get($u, $hdrs, 30);
            $code = $tmp['code'] ?? 0;
            if ($code >= 200 && $code < 500) { $res = $tmp; break; }
        }
        if (!$res) { http_response_code(502); echo 'media fetch failed'; exit; }
        header('content-type: ' . (extract_http_header($res['headers'], 'content-type') ?: 'video/mp4'));
        header('accept-ranges: bytes');
        header('cache-control: private, max-age=0, must-revalidate');
        header('access-control-allow-origin: *');
        foreach (['content-length', 'content-range', 'last-modified', 'etag'] as $h) {
            $v = extract_http_header($res['headers'], $h);
            if ($v) header($h . ': ' . $v);
        }
        http_response_code($res['code'] ?? 200);
        echo $res['body'] ?? ''; exit;
    }
    if ($uri === '/img') {
        serve_img();
    }
    if ($uri === '/act') {
        if ($method !== 'POST') json_res(['code' => -1, 'message' => '只支持 POST'], 405);
        serve_act();
    }
    if ($uri === '/favicon.ico') { http_response_code(204); exit; }
    if ($uri === '/robots.txt') { header('content-type: text/plain'); echo "User-agent: *\nDisallow: /api\nDisallow: /m\n"; exit; }
    json_res(['code' => -404, 'message' => '没有这个路径'], 404);
} catch (\Throwable $e) {
    json_res(['code' => -9, 'message' => substr($e->getMessage(), 0, 200)], 500);
}
