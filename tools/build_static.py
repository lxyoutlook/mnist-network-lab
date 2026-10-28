"""Build the standalone Cloudflare site using only Python's standard library."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]


def build():
    target = ROOT / 'dist'
    # Only this generator-owned directory is replaced. Never traverse symlinks.
    if target.is_symlink() or target.resolve().parent != ROOT.resolve():
        raise RuntimeError('Unsafe build output directory')
    if target.exists():
        shutil.rmtree(target)
    target.mkdir()
    for source in (ROOT / 'frontend').iterdir():
        if source.is_file():
            shutil.copy2(source, target / source.name)
    for source in (ROOT / 'web').iterdir():
        if source.is_file():
            shutil.copy2(source, target / source.name)
    (target / 'data').mkdir()
    for name in ('model.json', 'mnist28.json', 'MNIST28-LICENSE.txt'):
        shutil.copy2(ROOT / 'data' / name, target / 'data' / name)
    index = target / 'index.html'
    html = index.read_text(encoding='utf-8')
    html = html.replace('<title>手写数字神经网络</title>', '<title>手写数字 · 神经网络实验室</title>')
    html = html.replace('</head>', '  <link rel="stylesheet" href="standalone.css">\n</head>')
    header = '''<header class="lab-header">
  <h1>手写数字 · 神经网络实验室</h1>
  <p>画一笔，看一次真实计算。<strong id="model-summary">正在加载模型…</strong><span id="model-origin"></span></p>
  <div id="load-error" role="alert" hidden></div>
</header>'''
    html = html.replace('<body>', '<body>\n' + header)
    html = html.replace('</body>', '<script src="standalone.js"></script>\n</body>')
    index.write_text(html, encoding='utf-8')
    (target / '_headers').write_text(
        '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n',
        encoding='utf-8',
    )
    print(f'Standalone site built: {target}')


if __name__ == '__main__':
    build()
