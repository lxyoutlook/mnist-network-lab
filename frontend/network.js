/* Pure numerical engine; shared by the UI and parity tests. No dependencies. */
(function (root) {
  'use strict';
  function forward(x, model) {
    if (!Array.isArray(x) || x.length !== 144 || x.some(v => v !== 0 && v !== 1)) {
      throw new Error('Expected 144 binary pixels');
    }
    const weighted1 = Array(128).fill(0);
    for (let i = 0; i < 144; i++) {
      for (let j = 0; j < 128; j++) weighted1[j] += x[i] * model.w1[i][j];
    }
    const z1 = weighted1.map((v, j) => v + model.b1[j]);
    const h = z1.map(v => Math.max(0, v));
    const weighted2 = Array(10).fill(0);
    for (let j = 0; j < 128; j++) {
      for (let k = 0; k < 10; k++) weighted2[k] += h[j] * model.w2[j][k];
    }
    const logits = weighted2.map((v, k) => v + model.b2[k]);
    const maxLogit = Math.max(...logits);
    const exponentials = logits.map(v => Math.exp(v - maxLogit));
    const denominator = exponentials.reduce((a, b) => a + b, 0);
    const probabilities = exponentials.map(v => v / denominator);
    const prediction = probabilities.indexOf(Math.max(...probabilities));
    return {weighted1, z1, h, weighted2, logits, exponentials, denominator, probabilities, prediction, blank: !x.some(Boolean)};
  }
  function contributions(x, model, neuron) {
    return x.map((v, i) => v * model.w1[i][neuron]);
  }
  function outputContributions(result, model, digit) {
    return result.h.map((v, i) => v * model.w2[i][digit]);
  }
  const api = {forward, contributions, outputContributions};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MnistNet = api;
})(typeof window === 'undefined' ? globalThis : window);
