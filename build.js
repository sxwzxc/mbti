/**
 * EdgeOne Pages 静态站点构建脚本
 * 使用 Nunjucks（兼容 Jinja2）将模板渲染为静态 HTML
 * 运行: node build.js  或  npm run build
 */

import nunjucks from 'nunjucks';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const ROOT         = __dirname;
const TEMPLATE_DIR = path.join(ROOT, 'templates');
const DATA_DIR     = path.join(ROOT, 'data');
const STATIC_DIR   = path.join(ROOT, 'static');
const OUTPUT_DIR   = path.join(ROOT, 'dist');

// ── Jinja2 with 语法兼容处理 ─────────────────────────────────────────────────
// Nunjucks 不支持 {% with var = expr %}...{% endwith %}
// 在加载模板时将其替换为 {% set %}
class CompatLoader extends nunjucks.FileSystemLoader {
  getSource(name) {
    const src = super.getSource(name);
    if (!src) return src;
    // 将 {% with foo = bar %} 替换为 {% set foo = bar %}，{% endwith %} 替换为空
    src.src = src.src
      .replace(/{%[-\s]*with\s+([\w]+)\s*=\s*(.+?)[-\s]*%}/g, '{% set $1 = $2 %}')
      .replace(/{%[-\s]*endwith[-\s]*%}/g, '');
    return src;
  }
}

// ── Nunjucks 环境 ────────────────────────────────────────────────────────────
const loader = new CompatLoader(TEMPLATE_DIR, { noCache: true });
const env = new nunjucks.Environment(loader, { autoescape: true });

// Flask 的 url_for('static', filename='...')  →  /static/...
env.addGlobal('url_for', (endpoint, kwargs) => {
  if (endpoint === 'static' && kwargs && kwargs.filename) {
    return '/static/' + kwargs.filename;
  }
  return '/';
});

// Flask 的 get_flashed_messages() → []
env.addGlobal('get_flashed_messages', () => []);

// ── 数据加载 ─────────────────────────────────────────────────────────────────
function getTypesDesc() {
  const txt = fs.readFileSync(path.join(DATA_DIR, 'types_desc.txt'), 'utf-8');
  const items = [];
  for (const line of txt.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const [type, ...rest] = t.split(/\s+/);
    if (type && rest.length) {
      items.push([type.toUpperCase(), rest.join(' ')]);
    }
  }
  return items.sort((a, b) => a[0].localeCompare(b[0]));
}

// ── 文件写入 ─────────────────────────────────────────────────────────────────
function write(relPath, content) {
  const abs = path.join(OUTPUT_DIR, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf-8');
  console.log('  ✓', relPath);
}

function render(tpl, ctx) {
  return env.render(tpl, ctx || {});
}

// ── 目录复制 ─────────────────────────────────────────────────────────────────
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

// ── 测试页（完全静态，题目由 JS 动态加载）────────────────────────────────────
const TEST_HTML = `<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="description" content="A website for MBTI test">
    <meta name="viewport" content="width=device-width">
    <title>测试中 | MBTI-TEST</title>
    <link rel="shortcut icon" href="/static/img/favicon.ico">
    <link rel="stylesheet" href="/static/css/bootstrap.min.css">
    <link rel="stylesheet" href="/static/css/svgcheckbx.css">
    <style>
        #loading { text-align:center; margin-top:100px; font-size:18px; color:#888; }
        #error-msg { text-align:center; margin-top:100px; color:red; display:none; }
    </style>
</head>
<body>
<div class="navbar navbar-default navbar-fixed-top">
    <div class="container">
        <div class="navbar-header">
            <a href="/" class="navbar-brand">MBTI-TEST</a>
            <button class="navbar-toggle" type="button" data-toggle="collapse" data-target="#navbar-main">
                <span class="icon-bar"></span><span class="icon-bar"></span><span class="icon-bar"></span>
            </button>
        </div>
        <div class="navbar-collapse collapse" id="navbar-main">
            <ul class="nav navbar-nav">
                <li><a href="/home/">首页</a></li>
                <li><a href="/personalities/">十六种人格简介</a></li>
                <li><a href="/about/">关于本站</a></li>
                <li><a href="/messageboards/">留言板</a></li>
            </ul>
        </div>
    </div>
</div>
<div id="loading">题目加载中，请稍候…</div>
<div id="error-msg"></div>
<div class="container" id="questions-container"></div>
<link rel="stylesheet" href="/static/css/app.css">
<script src="/static/js/jquery-1.10.2.min.js"></script>
<script src="/static/js/bootstrap.min.js"></script>
<script src="/static/js/svgcheckbx.js"></script>
<script src="/static/js/test.js"></script>
</body>
</html>`;

// ── 主流程 ───────────────────────────────────────────────────────────────────
function main() {
  console.log('🔨 构建 EdgeOne Pages 静态站点...\n');

  // 清空输出目录
  if (fs.existsSync(OUTPUT_DIR)) fs.rmSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(OUTPUT_DIR);

  const typesDesc = getTypesDesc();

  // 普通静态页面
  const pages = [
    ['mbti/welcome.html',    'index.html'],
    ['mbti/home.html',       'home/index.html'],
    ['mbti/about.html',      'about/index.html'],
    ['mbti/duoshuo.html',    'messageboards/index.html'],
    ['404.html',             '404.html'],
    ['500.html',             '500.html'],
  ];
  for (const [tpl, out] of pages) {
    write(out, render(tpl));
  }

  // 人格总览页（需要 types_desc 变量）
  write('personalities/index.html', render('mbti/personalities/index.html', { types_desc: typesDesc }));

  // 16 种人格详情页（目录名与 personalities/index.html 链接保持一致：大写）
  for (const [type] of typesDesc) {
    const tpl = `mbti/personalities/${type.toLowerCase()}.html`;
    const tplPath = path.join(TEMPLATE_DIR, tpl);
    if (fs.existsSync(tplPath)) {
      write(`personalities/${type.toUpperCase()}/index.html`, render(tpl));
    } else {
      console.warn('  ⚠ 模板不存在:', tpl);
    }
  }

  // 测试页（纯静态，题目由前端 JS 加载）
  write('test/index.html', TEST_HTML);

  // 复制静态资源
  if (fs.existsSync(STATIC_DIR)) {
    copyDir(STATIC_DIR, path.join(OUTPUT_DIR, 'static'));
    console.log('  ✓ static/ 资源已复制');
  }

  console.log('\n✅ 构建完成！输出目录: dist/');
}

main();
