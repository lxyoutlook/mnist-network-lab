"""Portable launcher: 64-bit Python 3.12–3.14; internet on first installation."""
from pathlib import Path
import argparse
import os
import socket
import struct
import subprocess
import sys

ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Install dependencies and verify the model without starting the server')
    parser.add_argument('--headless', action='store_true', help='Start without opening a browser')
    args = parser.parse_args()
    if not (3, 12) <= sys.version_info[:2] < (3, 15) or struct.calcsize('P') != 8:
        raise RuntimeError('请安装 64 位 Python 3.12（推荐），支持 3.12–3.14，再运行 start_demo.bat。')
    for name in ('data/model.json', 'data/mnist28.json', 'frontend/index.html'):
        if not (ROOT / name).is_file():
            raise RuntimeError(f'缺少 {name}，请先完整解压 ZIP，再运行 start_demo.bat。')
    env_python = ROOT / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    if not env_python.exists():
        print('正在创建本项目的 Python 环境…', flush=True)
        subprocess.run([sys.executable, '-m', 'venv', str(ROOT / '.venv')], check=True)
    probe = subprocess.run([str(env_python), '-c',
        "import importlib.metadata as m; assert m.version('streamlit') == '1.66.0'; assert m.version('numpy') == '2.5.4'"],
        capture_output=True)
    if probe.returncode:
        print('首次运行正在安装依赖，需要联网，请稍候…', flush=True)
        subprocess.run([str(env_python), '-m', 'pip', 'install', '-r', str(ROOT / 'requirements.txt')], check=True)
    if args.check:
        subprocess.run([str(env_python), '-c',
            "from network import load_model, forward; from mnist28 import load_mnist28, forward_mnist28; "
            "m=load_model(); r=forward([0]*144,m); assert r['prediction']==1; "
            "g=load_mnist28(); p=forward_mnist28([0]*784,g); assert len(p['probabilities'])==10; "
            "print('Excel and grayscale MNIST models verified.')"],
            cwd=ROOT, check=True)
        return
    for port in range(8521, 8561):
        with socket.socket() as sock:
            try:
                sock.bind(('127.0.0.1', port))
            except OSError:
                continue
            break
    else:
        raise RuntimeError('No available local port in 8521–8560.')
    print(f'演示地址：http://127.0.0.1:{port} — 运行期间请保持此窗口开启。', flush=True)
    subprocess.run([str(env_python), '-X', 'utf8', '-m', 'streamlit', 'run', str(ROOT / 'app.py'),
                    '--server.address=127.0.0.1', f'--server.port={port}',
                    f'--server.headless={str(args.headless).lower()}',
                    '--browser.gatherUsageStats=false'], cwd=ROOT, check=True)


if __name__ == '__main__':
    try:
        main()
    except (OSError, RuntimeError, subprocess.CalledProcessError) as exc:
        print(f'启动失败：{exc}', file=sys.stderr)
        sys.exit(1)
