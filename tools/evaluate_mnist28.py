"""Re-evaluate the bundled pretrained model on its documented split using NumPy.

Usage: python tools/evaluate_mnist28.py --dataset /path/to/mnist.npz
The Keras archive must match the official SHA-256. No training is performed.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from mnist28 import load_mnist28


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dataset', type=Path, required=True)
    args = parser.parse_args()
    model = load_mnist28()
    expected = model['evaluation']
    if hashlib.sha256(args.dataset.read_bytes()).hexdigest() != expected['dataset_sha256']:
        raise ValueError('Dataset SHA-256 does not match the official Keras MNIST archive')
    index_path = ROOT / 'data/mnist28_holdout_indices.json'
    if hashlib.sha256(index_path.read_bytes()).hexdigest() != expected['indices_sha256']:
        raise ValueError('Holdout index SHA-256 mismatch')
    indices = np.asarray(json.loads(index_path.read_text()))
    with np.load(args.dataset, allow_pickle=False) as dataset:
        x = np.concatenate([dataset['x_train'], dataset['x_test']])[indices].reshape(-1, 784).astype(np.float32) / 255
        y = np.concatenate([dataset['y_train'], dataset['y_test']])[indices]
    confusion = np.zeros((10, 10), dtype=int)
    layers = [(np.asarray(l['weights']), np.asarray(l['biases'])) for l in model['layers']]
    for start in range(0, len(x), 256):
        a = x[start:start + 256]
        for i, (w, b) in enumerate(layers):
            a = a @ w + b
            if i < len(layers) - 1:
                a = np.maximum(a, 0)
        np.add.at(confusion, (y[start:start + len(a)], a.argmax(axis=1)), 1)
    correct = int(confusion.trace())
    print(f'Upstream-rule holdout: {correct}/{len(y)} = {correct / len(y):.2%}')
    print('Not the official fixed MNIST test split; not a freehand-writing accuracy estimate.')
    if confusion.tolist() != expected['confusion_matrix']:
        raise ValueError('Recomputed results differ from the bundled evaluation')


if __name__ == '__main__':
    main()
