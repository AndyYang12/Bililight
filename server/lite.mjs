// 极简服务端渲染页面：HTML 3.2 + 纯表格，无 CSS、无 JavaScript。
// 目标是 IE4/NetSurf/Lynx/Chrome 10 这类内核也能正常翻页、搜索、拿到播放地址。

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function num(n) {
  var v = Number(n) || 0;
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function page(title, body) {
  return '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">\n'
    + '<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8">'
    + '<meta http-equiv="Content-Language" content="zh-CN">'
    + '<title>' + esc(title) + ' - biliLight</title></head>\n'
    + '<body bgcolor="#FFFFFF" text="#000000" link="#0000CC" vlink="#551A8B" alink="#FF0000">\n'
    + '<font size="5"><b>biliLight</b></font> <font size="2">极简版</font>\n'
    + '<hr>\n' + body + '\n<hr>\n'
    + '<font size="2"><a href="/lite">首页</a> | <a href="/lite/rank">排行榜</a> | '
    + '<a href="/">完整版（需要较新的浏览器）</a></font>\n'
    + '</body></html>';
}

function searchForm(kw) {
  return '<form action="/lite/search" method="get">'
    + '<input type="text" name="keyword" size="24" value="' + esc(kw || '') + '"> '
    + '<input type="submit" value="搜索"></form>\n';
}

function navBar() {
  return '<p><a href="/lite">热门</a> | <a href="/lite/rank">排行榜</a> | '
    + '<a href="https://www.bilibili.com/">B站官网</a></p>\n';
}

function cardTable(list) {
  var rows = '';
  for (var i = 0; i < list.length; i++) {
    var it = list[i];
    if (!it || !it.bv) continue;
    rows += '<tr><td><a href="/lite/v?bvid=' + esc(it.bv) + '">' + esc(it.title) + '</a></td>'
      + '<td>' + esc(it.up || '-') + '</td>'
      + '<td align="right">' + num(it.view) + '</td>'
      + '<td align="right">' + esc(it.dur || '-') + '</td></tr>\n';
  }
  if (!rows) rows = '<tr><td colspan="4">没有结果。</td></tr>\n';
  return '<table border="1" cellpadding="4" cellspacing="0" width="100%">\n'
    + '<tr bgcolor="#EEEEEE"><td><b>标题</b></td><td><b>UP主</b></td>'
    + '<td align="right"><b>播放</b></td><td align="right"><b>时长</b></td></tr>\n'
    + rows + '</table>\n';
}

function errBlock(r) {
  return '<p><b>读取失败</b>：' + esc((r && r.message) || '上游接口异常') + '</p>\n';
}

async function home(apiCall, env) {
  var r = await apiCall('popular', { ps: 20 }, false, env);
  var body = '<h3>热门视频</h3>\n' + searchForm('') + navBar();
  body += (r && r.code === 0 && r.data && r.data.length) ? cardTable(r.data) : errBlock(r);
  return page('热门', body);
}

async function rank(apiCall, env) {
  var r = await apiCall('rank', { type: 'all' }, false, env);
  var body = '<h3>排行榜</h3>\n' + searchForm('') + navBar();
  body += (r && r.code === 0 && r.data && r.data.length) ? cardTable(r.data) : errBlock(r);
  return page('排行榜', body);
}

async function search(apiCall, env, kw, pn) {
  var q = { keyword: kw, page: pn };
  var r = await apiCall('search', q, true, env);
  var body = '<h3>搜索：' + esc(kw) + '</h3>\n' + searchForm(kw) + navBar();
  if (r && r.code === 0 && r.data && r.data.length) {
    body += cardTable(r.data);
    body += '<p>';
    if (pn > 1) body += '<a href="/lite/search?keyword=' + encodeURIComponent(kw) + '&amp;page=' + (pn - 1) + '">&lt;&lt; 上一页</a> ';
    if (r.data.length >= 20) body += '<a href="/lite/search?keyword=' + encodeURIComponent(kw) + '&amp;page=' + (pn + 1) + '">下一页 &gt;&gt;</a>';
    body += '</p>\n';
  } else if (r && r.code === 0) {
    body += '<p>没有找到结果。</p>\n';
  } else {
    body += errBlock(r);
  }
  return page('搜索 ' + kw, body);
}

async function video(apiCall, env, bv) {
  var r = await apiCall('view', { bvid: bv }, false, env);
  if (!r || r.code !== 0 || !r.data) return page('视频', '<p>读取失败：' + esc((r && r.message) || '视频不存在') + '</p><p><a href="/lite">返回首页</a></p>');
  var d = r.data;
  var body = '<h3>' + esc(d.title) + '</h3>\n';
  body += '<table border="0" cellpadding="3" cellspacing="0">\n'
    + '<tr><td>UP主</td><td>' + esc(d.up || '-') + '</td></tr>\n'
    + '<tr><td>播放</td><td>' + num(d.view) + '　弹幕 ' + num(d.dan) + '　时长 ' + esc(d.dur || '-') + '</td></tr>\n'
    + '<tr><td>分区</td><td>' + esc(d.tname || '-') + '　' + esc(d.pubtxt || '') + '</td></tr>\n'
    + '</table>\n';
  body += '<p><b>简介</b><br>' + esc(d.desc || '（无）').replace(/\n/g, '<br>\n') + '</p>\n';
  body += '<h4>分 P</h4>\n<table border="1" cellpadding="4" cellspacing="0">\n'
    + '<tr bgcolor="#EEEEEE"><td><b>#</b></td><td><b>标题</b></td><td><b>时长</b></td><td><b>播放</b></td></tr>\n';
  var ps = d.pages || [];
  for (var i = 0; i < ps.length; i++) {
    var p = ps[i] || {};
    var u = '/lite/play?bvid=' + encodeURIComponent(d.bv) + '&amp;cid=' + encodeURIComponent(p.cid) + '&amp;qn=64';
    body += '<tr><td>' + (i + 1) + '</td><td>' + esc(p.part || ('P' + (i + 1))) + '</td>'
      + '<td>' + esc(p.dur || '-') + '</td><td><a href="' + u + '">播放</a></td></tr>\n';
  }
  body += '</table>\n';
  body += '<p><a href="https://www.bilibili.com/video/' + encodeURIComponent(d.bv) + '/">在 B 站打开</a></p>\n';
  return page(d.title, body);
}

async function play(resolvePlay, env, bv, cid, qn) {
  var r = await resolvePlay({ bvid: bv, cid: cid, qn: qn }, env);
  if (!r || r.code !== 0 || !r.data) {
    return page('播放', '<p>无法取得播放地址：' + esc((r && r.message) || '未知错误') + '</p>'
      + '<p><a href="/lite/v?bvid=' + encodeURIComponent(bv) + '">返回视频页</a></p>');
  }
  var d = r.data;
  var src = String(d.src || '');
  var body = '<h3>播放地址</h3>\n'
    + '<table border="0" cellpadding="3" cellspacing="0">\n'
    + '<tr><td>清晰度</td><td>' + esc(d.qname || String(d.quality || '')) + '</td></tr>\n'
    + '<tr><td>大小</td><td>' + esc(String(d.sizeMB || 0)) + ' MB　时长 ' + esc(String(d.sec || 0)) + ' 秒</td></tr>\n'
    + '</table>\n'
    + '<p><a href="' + esc(src) + '">点此直接打开视频文件</a></p>\n'
    + '<p>如果直接打开提示 403 或无法播放，请复制下面的地址，用 VLC / PotPlayer / MPV 打开：</p>\n'
    + '<form action=""><textarea name="u" rows="4" cols="60" readonly>' + esc(src) + '</textarea></form>\n'
    + '<p><font size="2">提示：地址有时效性，过期后请回到本页重新获取。</font></p>\n'
    + '<p><a href="/lite/v?bvid=' + encodeURIComponent(bv) + '">返回视频页</a></p>';
  return page('播放', body);
}

export async function renderLite(p, params, env, apiCall, resolvePlay) {
  try {
    if (p === '/lite' || p === '/lite/' || p === '/lite/index.html') return await home(apiCall, env);
    if (p === '/lite/rank') return await rank(apiCall, env);
    if (p === '/lite/search') {
      var kw = String(params.get('keyword') || params.get('q') || '').slice(0, 80);
      var pn = parseInt(String(params.get('page') || '1'), 10) || 1;
      if (!kw) return page('搜索', '<h3>搜索</h3>\n' + searchForm('') + '<p>请输入关键词。</p>');
      return await search(apiCall, env, kw, pn);
    }
    if (p === '/lite/v') {
      var bv = String(params.get('bvid') || '').slice(0, 20);
      if (!/^BV[0-9A-Za-z]{8,12}$/.test(bv)) return page('视频', '<p>视频号不正确。</p>');
      return await video(apiCall, env, bv);
    }
    if (p === '/lite/play') {
      var bv2 = String(params.get('bvid') || '').slice(0, 20);
      var cid = String(params.get('cid') || '').replace(/[^0-9]/g, '');
      var qn = String(params.get('qn') || '64').replace(/[^0-9]/g, '') || '64';
      return await play(resolvePlay, env, bv2, cid, qn);
    }
    return page('未找到', '<p>没有这个页面。</p><p><a href="/lite">返回首页</a></p>');
  } catch (e) {
    return page('出错', '<p>页面渲染失败：' + esc(String((e && e.message) || e)) + '</p>');
  }
}

// 只在明确识别为老浏览器时自动切换，不影响现代浏览器。
export function wantsLite(request) {
  var ua = '';
  try { ua = String(request.headers.get('user-agent') || ''); } catch (e) { ua = ''; }
  if (!ua) return false;
  if (/MSIE\s+[1-9]\./i.test(ua)) return true;
  if (/Trident\/[4-7]\./i.test(ua)) return true;
  if (/NetSurf|Lynx|w3m|ELinks|Dillo|Links\s*\(|Konqueror\/[12]\.|Minimo/i.test(ua)) return true;
  var m = ua.match(/Chrome\/(\d+)/); if (m && parseInt(m[1], 10) < 49) return true;
  m = ua.match(/Firefox\/(\d+)/); if (m && parseInt(m[1], 10) < 45) return true;
  m = ua.match(/Opera\/(\d+)/); if (m && parseInt(m[1], 10) < 36) return true;
  m = ua.match(/Version\/(\d+)[^)]*Safari/); if (m && parseInt(m[1], 10) < 10) return true;
  if (/Edge\/1[0-8]\./i.test(ua)) return true;
  return false;
}
