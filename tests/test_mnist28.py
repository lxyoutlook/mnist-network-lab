import json
import math
from pathlib import Path
import sys

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from mnist28 import center_mnist28, forward_mnist28, load_mnist28


@pytest.fixture(scope='module')
def model():
    return load_mnist28()


def test_parameters_and_raw_weight_reference(model):
    assert sum(np.asarray(l['weights']).size + len(l['biases']) for l in model['layers']) == 235146
    samples = json.loads((ROOT / 'data/mnist28_samples.json').read_text())
    reference = json.loads((ROOT / 'data/mnist28_reference.json').read_text())
    assert len(reference) == 20
    for expected in reference:
        x = np.asarray(samples[expected['sample_index']]['pixels']) / 255
        actual = forward_mnist28(x, model)
        assert actual['prediction'] == expected['prediction']
        for layer, target in zip(actual['layers'], expected['layers']):
            for key in ('weighted', 'z', 'a'):
                np.testing.assert_allclose(layer[key], target[key], rtol=1e-11, atol=1e-11)


def test_fractional_pixels_and_independent_scalar_traces(model):
    x = np.arange(784) % 256 / 255
    actual = forward_mnist28(x, model)
    a = x
    for index, layer in enumerate(model['layers']):
        for j in [0, len(layer['biases']) // 2, len(layer['biases']) - 1]:
            weighted = math.fsum(float(a[i]) * layer['weights'][i][j] for i in range(len(a)))
            assert actual['layers'][index]['weighted'][j] == pytest.approx(weighted, abs=1e-10)
            assert actual['layers'][index]['z'][j] == pytest.approx(weighted + layer['biases'][j], abs=1e-10)
        a = actual['layers'][index]['a']
    assert sum(actual['probabilities']) == pytest.approx(1)


@pytest.mark.parametrize('pixels', [[0]*783, [0]*785, [float('nan')]*784, [1.1]*784, [-.1]*784])
def test_invalid_grayscale_rejected(pixels, model):
    with pytest.raises(ValueError):
        forward_mnist28(pixels, model)


def test_reshape_and_blank(model):
    x = np.eye(28)
    assert forward_mnist28(x, model) == forward_mnist28(x.reshape(-1), model)
    assert forward_mnist28(np.zeros(784), model)['blank']


def test_wrong_mnist_layer_rejected(tmp_path, model):
    broken = dict(model, layers=[dict(model['layers'][0], weights=[[1]])] + model['layers'][1:])
    path = tmp_path / 'invalid.json'
    path.write_text(json.dumps(broken), encoding='utf-8')
    with pytest.raises(ValueError):
        load_mnist28(path)


def test_adaptation_blank_tiny_and_invalid_input():
    assert center_mnist28([0] * 784) == [0] * 784
    tiny = [0] * 784
    tiny[0] = 1 / 255
    assert center_mnist28(tiny) == tiny
    with pytest.raises(ValueError):
        center_mnist28([float('nan')] * 784)
