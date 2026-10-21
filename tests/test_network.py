import json
import math
from pathlib import Path
import sys

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from network import forward, load_model


@pytest.fixture(scope='module')
def model():
    return load_model()


def test_original_excel_saved_values(model):
    """Golden values come from Excel, rather than a copy of our implementation."""
    reference = json.loads((ROOT / 'data' / 'excel_reference.json').read_text(encoding='utf-8'))
    actual = forward(reference['pixels'], model)
    for key in ['hidden', 'logits', 'probabilities']:
        np.testing.assert_allclose(actual[key], reference[key], atol=1e-12, rtol=1e-12)
    assert actual['prediction'] == reference['prediction'] == 1
    assert actual['blank'] is True


@pytest.mark.parametrize('kind', ['one_pixel', 'ones', 'diagonal', 'checkerboard', 'random'])
def test_trace_against_independent_scalar_sums(model, kind):
    rng = np.random.default_rng(20261021)
    x = np.zeros(144, dtype=int)
    if kind == 'one_pixel':
        x[67] = 1
    elif kind == 'ones':
        x[:] = 1
    elif kind == 'diagonal':
        x[np.arange(12) * 13] = 1
    elif kind == 'checkerboard':
        x = (np.indices((12,12)).sum(axis=0) % 2).reshape(-1)
    else:
        x = rng.integers(0,2,144)
    actual = forward(x, model)
    # Check a non-vectorized, high-precision sum for every hidden and output neuron.
    weighted1 = [math.fsum(float(x[i]) * model['w1'][i][j] for i in range(144)) for j in range(128)]
    pre = [weighted1[j] + model['b1'][j] for j in range(128)]
    h = [max(0, v) for v in pre]
    weighted2 = [math.fsum(h[j] * model['w2'][j][k] for j in range(128)) for k in range(10)]
    logits = [weighted2[k] + model['b2'][k] for k in range(10)]
    np.testing.assert_allclose(actual['weighted1'], weighted1, rtol=1e-12, atol=1e-12)
    np.testing.assert_allclose(actual['weighted2'], weighted2, rtol=1e-12, atol=1e-12)
    assert len(actual['weighted1']) == 128 and len(actual['weighted2']) == 10
    np.testing.assert_allclose(actual['preactivation'], pre, rtol=1e-12, atol=1e-12)
    np.testing.assert_allclose(actual['logits'], logits, rtol=1e-12, atol=1e-12)
    assert math.isclose(sum(actual['probabilities']), 1, abs_tol=1e-14)
    assert min(actual['hidden']) >= 0
    assert all(0 <= p <= 1 for p in actual['probabilities'])
    assert actual['prediction'] == int(np.argmax(logits))


@pytest.mark.parametrize('pixels', [[0]*143, [0]*145, [float('nan')]*144, [2]*144, [-1]*144])
def test_invalid_pixels_fail(pixels, model):
    with pytest.raises(ValueError):
        forward(pixels, model)


def test_matrix_input_and_flattening(model):
    x = np.eye(12, dtype=int)
    assert forward(x, model) == forward(x.reshape(-1), model)


def test_softmax_stays_finite_when_logits_are_large(model):
    exaggerated = dict(model, b2=[v + 10000 for v in model['b2']])
    normal = forward([0]*144, model)
    actual = forward([0]*144, exaggerated)
    np.testing.assert_allclose(actual['probabilities'], normal['probabilities'], atol=1e-12)
    assert np.isfinite(actual['probabilities']).all()


def test_model_rejects_wrong_shapes(tmp_path, model):
    broken = dict(model, w1=[[0]])
    path = tmp_path / 'bad.json'
    path.write_text(json.dumps(broken), encoding='utf-8')
    with pytest.raises(ValueError):
        load_model(path)


def test_streamlit_page_boots():
    from streamlit.testing.v1 import AppTest
    app = AppTest.from_file(str(ROOT / 'app.py')).run(timeout=30)
    assert not app.exception
    assert '神经网络实验室' in app.title[0].value
