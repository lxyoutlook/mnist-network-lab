"""Validated NumPy inference for the bundled, pretrained 28×28 MNIST MLP."""
import json
import math
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent


def center_mnist28(pixels):
    """Fit the ink to 20×20, then align its mass in a 28×28 field.

    Mirrors the browser's bilinear interpolation and positive-tie rounding.
    The raw drawing is kept separately; these are the actual model inputs.
    """
    x = np.asarray(pixels, dtype=np.float64)
    if x.shape == (28, 28):
        x = x.reshape(784)
    if x.shape != (784,) or not np.isfinite(x).all() or np.any((x < 0) | (x > 1)):
        raise ValueError('MNIST 输入必须为 784 个 0–1 灰度值')
    ink = np.flatnonzero(x > .02)
    if not len(ink):
        return x.tolist()
    left, top = int((ink % 28).min()), int((ink // 28).min())
    width, height = int((ink % 28).max()) - left + 1, int((ink // 28).max()) - top + 1
    scale = 20 / max(width, height)
    w, h = max(1, math.floor(width * scale + .5)), max(1, math.floor(height * scale + .5))
    ox, oy = (28 - w) // 2, (28 - h) // 2
    out = [0.0] * 784

    def get(px, py):
        return float(x[max(top, min(top + height - 1, py)) * 28 + max(left, min(left + width - 1, px))])

    for row in range(h):
        for col in range(w):
            sx, sy = left + (col + .5) * width / w - .5, top + (row + .5) * height / h - .5
            ix, iy = math.floor(sx), math.floor(sy)
            fx, fy = sx - ix, sy - iy
            value = ((1 - fx) * (1 - fy) * get(ix, iy) + fx * (1 - fy) * get(ix + 1, iy)
                     + (1 - fx) * fy * get(ix, iy + 1) + fx * fy * get(ix + 1, iy + 1))
            out[(row + oy) * 28 + col + ox] = max(0, min(1, value))
    mass = sum_x = sum_y = 0.0
    for i, value in enumerate(out):
        mass += value
        sum_x += value * (i % 28)
        sum_y += value * (i // 28)
    tx, ty = math.floor(13.5 - sum_x / mass + .5), math.floor(13.5 - sum_y / mass + .5)
    shifted = [0.0] * 784
    for row in range(28):
        for col in range(28):
            if 0 <= col + tx < 28 and 0 <= row + ty < 28:
                shifted[(row + ty) * 28 + col + tx] = math.floor(out[row * 28 + col] * 255 + .5) / 255
    return shifted


def load_mnist28(path=ROOT / 'data' / 'mnist28.json'):
    model = json.loads(Path(path).read_text(encoding='utf-8'))
    if model['architecture'] != [784, 256, 128, 10] or len(model['layers']) != 3:
        raise ValueError('MNIST 模型结构应为 784 → 256 → 128 → 10')
    for index, layer in enumerate(model['layers']):
        shape = (model['architecture'][index], model['architecture'][index + 1])
        w, b = np.asarray(layer['weights']), np.asarray(layer['biases'])
        if (w.shape != shape or b.shape != (shape[1],)
                or not np.isfinite(w).all() or not np.isfinite(b).all()
                or layer['activation'] != ('softmax' if index == 2 else 'relu')):
            raise ValueError(f'MNIST 第 {index + 1} 层参数无效')
    return model


def forward_mnist28(pixels, model):
    x = np.asarray(pixels, dtype=np.float64)
    if x.shape == (28, 28):
        x = x.reshape(784)
    if x.shape != (784,) or not np.isfinite(x).all() or np.any((x < 0) | (x > 1)):
        raise ValueError('MNIST 输入必须为 784 个 0–1 灰度值')
    a, traces = x, []
    for index, layer in enumerate(model['layers']):
        weighted = a @ np.asarray(layer['weights'])
        z = weighted + np.asarray(layer['biases'])
        if index == len(model['layers']) - 1:
            exp = np.exp(z - z.max())
            a = exp / exp.sum()
        else:
            a = np.maximum(z, 0)
        traces.append({'weighted': weighted.tolist(), 'z': z.tolist(), 'a': a.tolist()})
    return {'layers': traces, 'probabilities': a.tolist(),
            'prediction': int(a.argmax()), 'blank': not bool(x.any())}
