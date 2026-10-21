"""Convert the pinned upstream numeric NPZ weights into the bundled JSON.

Usage: python tools/import_mnist28.py /path/to/weights_biases.npz
Source URL and expected SHA-256 are recorded in data/mnist28.json.
NPZ is read with allow_pickle=False; no upstream Python is imported or executed.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('weights', type=Path)
    args = parser.parse_args()
    target = ROOT / 'data/mnist28.json'
    model = json.loads(target.read_text(encoding='utf-8'))
    if hashlib.sha256(args.weights.read_bytes()).hexdigest() != model['source']['weights_sha256']:
        raise ValueError('Upstream weight SHA-256 mismatch')
    layers = []
    with np.load(args.weights, allow_pickle=False) as weights:
        for i, (n_in, n_out) in enumerate(zip(model['architecture'], model['architecture'][1:])):
            w, b = weights[f'w_{i}'], weights[f'b_{i}'].reshape(-1)
            if w.shape != (n_in, n_out) or b.shape != (n_out,) or not np.isfinite(w).all() or not np.isfinite(b).all():
                raise ValueError(f'Invalid upstream layer {i}')
            layers.append({'weights': w.tolist(), 'biases': b.tolist(),
                           'activation': 'softmax' if i == 2 else 'relu'})
    model['layers'] = layers
    target.write_text(json.dumps(model, separators=(',', ':')), encoding='utf-8')
    print('Imported 235,146 parameters without rounding or transposition.')


if __name__ == '__main__':
    main()
