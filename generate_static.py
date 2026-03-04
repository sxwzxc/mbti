#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
静态站点生成器 - 将 Flask/Jinja2 模板渲染为 EdgeOne Pages 可部署的静态 HTML
运行方式: python generate_static.py
输出目录: dist/
"""

import os
import shutil
from jinja2 import Environment, FileSystemLoader

ROOT = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(ROOT, 'templates')
DATA_DIR = os.path.join(ROOT, 'data')
STATIC_DIR = os.path.join(ROOT, 'static')
OUTPUT_DIR = os.path.join(ROOT, 'dist')


# ── Jinja2 环境 ──────────────────────────────────────────────────────────────
def make_env():
    env = Environment(
        loader=FileSystemLoader(TEMPLATE_DIR),
        autoescape=True,
    )
    # 替换 Flask 的 url_for('static', filename='...')
    def url_for(endpoint, **kwargs):
        if endpoint == 'static':
            return '/static/' + kwargs.get('filename', '')
        return '/'
    env.globals['url_for'] = url_for
    # 替换 Flask 的 get_flashed_messages()
    env.globals['get_flashed_messages'] = lambda **kw: []
    return env


# ── 数据读取 ──────────────────────────────────────────────────────────────────
def get_types_desc():
    """从 types_desc.txt 读取 16 种人格的简要描述"""
    path = os.path.join(DATA_DIR, 'types_desc.txt')
    items = []
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                parts = line.split(None, 1)
                if len(parts) == 2:
                    items.append((parts[0].upper(), parts[1]))
    return sorted(items, key=lambda i: i[0])


# ── 工具函数 ──────────────────────────────────────────────────────────────────
def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'  ✓ {os.path.relpath(path, ROOT)}')


def render(env, tpl_path, ctx=None):
    return env.get_template(tpl_path).render(**(ctx or {}))


# ── 主生成流程 ────────────────────────────────────────────────────────────────
def main():
    print('🔨 开始生成静态站点...')

    # 1. 清空输出目录
    if os.path.exists(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR)
    os.makedirs(OUTPUT_DIR)

    env = make_env()
    types_desc = get_types_desc()

    # 2. 普通静态页面
    pages = [
        ('mbti/welcome.html',      'index.html'),
        ('mbti/home.html',         'home/index.html'),
        ('mbti/about.html',        'about/index.html'),
        ('mbti/duoshuo.html',      'messageboards/index.html'),
        ('404.html',               '404.html'),
        ('500.html',               '500.html'),
    ]
    for tpl, out in pages:
        html = render(env, tpl)
        write(os.path.join(OUTPUT_DIR, out), html)

    # 3. 人格总览页（需要 types_desc 变量）
    html = render(env, 'mbti/personalities/index.html',
                  {'types_desc': types_desc})
    write(os.path.join(OUTPUT_DIR, 'personalities/index.html'), html)

    # 4. 16 种人格详情页
    all_types = [t for t, _ in types_desc]
    for t in all_types:
        tpl_name = f'mbti/personalities/{t.lower()}.html'
        tpl_path = os.path.join(TEMPLATE_DIR, tpl_name)
        if os.path.exists(tpl_path):
            html = render(env, tpl_name)
            write(os.path.join(OUTPUT_DIR, f'personalities/{t.lower()}/index.html'), html)
        else:
            print(f'  ⚠ 模板不存在: {tpl_name}')

    # 5. 测试页（使用改写后的静态版本，Questions 由 JS 动态加载）
    test_html = _build_test_page(env)
    write(os.path.join(OUTPUT_DIR, 'test/index.html'), test_html)

    # 6. 复制静态资源（CSS / JS / 图片）
    dst_static = os.path.join(OUTPUT_DIR, 'static')
    if os.path.exists(STATIC_DIR):
        shutil.copytree(STATIC_DIR, dst_static)
        print(f'  ✓ static/ 资源已复制')

    print(f'\n✅ 生成完成！输出目录: dist/')
    print('   使用以下配置部署到 EdgeOne Pages:')
    print('   - 构建命令: (无需构建命令，直接部署 dist/ 目录)')
    print('   - 输出目录: dist')
    print('   - node-functions/ 目录已提供 API 接口')


def _build_test_page(env):
    """
    生成测试页面：题目由前端通过 /api/questions 动态加载，
    结果提交到 /api/test，完全无服务端模板渲染。
    """
    # 沿用 base.html 得到 nav/footer 结构，但 container 块注入 JS 驱动的内容
    raw_base = env.get_template('base.html').source if hasattr(env.get_template('base.html'), 'source') else None

    # 直接构造完整 HTML，保留原始 base.html 的导航样式
    return """\
<!doctype html>
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
        #loading { text-align: center; margin-top: 100px; font-size: 18px; color: #888; }
        #error-msg { text-align: center; margin-top: 100px; color: red; }
    </style>
</head>
<body>
<div class="navbar navbar-default navbar-fixed-top">
    <div class="container">
        <div class="navbar-header">
            <a href="/" class="navbar-brand">MBTI-TEST</a>
            <button class="navbar-toggle" type="button" data-toggle="collapse" data-target="#navbar-main">
                <span class="icon-bar"></span>
                <span class="icon-bar"></span>
                <span class="icon-bar"></span>
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
<div id="error-msg" style="display:none"></div>
<div class="container" id="questions-container"></div>

<link rel="stylesheet" href="/static/css/app.css">
<script src="/static/js/jquery-1.10.2.min.js"></script>
<script src="/static/js/bootstrap.min.js"></script>
<script src="/static/js/svgcheckbx.js"></script>
<script src="/static/js/test.js"></script>
</body>
</html>
"""


if __name__ == '__main__':
    main()
