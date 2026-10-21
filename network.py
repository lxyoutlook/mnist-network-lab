"""Numerically faithful inference for the original Excel 144–128–10 MLP."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent


def load_model(path: Path = ROOT / 'data' / 'model.json') -> dict:
    model = json.loads(path.read_text(encoding='utf-8'))
    for key, shape in [('w1', (144, 128)), ('b1', (128,)), ('w2', (128, 10)), ('b2', (10,))]:
        a = np.asarray(model[key], dtype=np.float64)
        if a.shape != shape or not np.isfinite(a).all():
            raise ValueError(f'模型参数 {key} 的形状或数值无效，应为 {shape}')
    return model


def forward(pixels, model: dict) -> dict:
    x = np.asarray(pixels, dtype=np.float64)
    if x.shape == (12, 12):
        x = x.reshape(144)
    if x.shape != (144,) or not np.isfinite(x).all() or not np.isin(x, [0, 1]).all():
        raise ValueError('画板必须为 144 个 0/1，或 12×12 的 0/1 矩阵')
    weighted1 = x @ np.asarray(model['w1'])
    z1 = weighted1 + np.asarray(model['b1'])
    h = np.maximum(z1, 0)
    weighted2 = h @ np.asarray(model['w2'])
    logits = weighted2 + np.asarray(model['b2'])
    shifted = logits - logits.max()
    exp = np.exp(shifted)
    probabilities = exp / exp.sum()
    return {
        'pixels': x.tolist(), 'weighted1': weighted1.tolist(),
        'preactivation': z1.tolist(), 'hidden': h.tolist(), 'weighted2': weighted2.tolist(),
        'logits': logits.tolist(), 'shifted_logits': shifted.tolist(),
        'exponentials': exp.tolist(), 'softmax_denominator': float(exp.sum()),
        'probabilities': probabilities.tolist(), 'prediction': int(probabilities.argmax()),
        'blank': bool(not x.any()),
    }
