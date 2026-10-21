"""Portable launcher: Python 3.12+, internet on first dependency installation."""
from pathlib import Path
import argparse
import os
import socket
import subprocess
import sys

ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Install dependencies and verify the model without starting the server')
    args = parser.parse_args()
    if sys.version_info < (3, 12):
        raise RuntimeError('Please install Python 3.12 or newer, then run start_demo.cmd again.')
    env_python = ROOT / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    if not env_python.exists():
        subprocess.run([sys.executable, '-m', 'venv', str(ROOT / '.venv')], check=True)
    probe = subprocess.run([str(env_python), '-c',
        "import importlib.metadata as m; assert m.version('streamlit') == '1.66.0'; assert m.version('numpy') == '2.5.4'"],
        capture_output=True)
    if probe.returncode:
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
    print(f'Opening http://127.0.0.1:{port} — keep this window open.')
    subprocess.run([str(env_python), '-m', 'streamlit', 'run', str(ROOT / 'app.py'),
                    '--server.address=127.0.0.1', f'--server.port={port}',
                    '--browser.gatherUsageStats=false'], cwd=ROOT, check=True)


if __name__ == '__main__':
    try:
        main()
    except (OSError, RuntimeError, subprocess.CalledProcessError) as exc:
        print(f'Could not start the demo: {exc}', file=sys.stderr)
        sys.exit(1)
