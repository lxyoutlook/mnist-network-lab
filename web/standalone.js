'use strict';

// Use the same render/message interface as the Streamlit component.
// All neural-network arithmetic stays in the existing browser engines.
(async () => {
  const heading = document.getElementById('model-summary');
  const error = document.getElementById('load-error');
  try {
    const load = async name => {
      const response = await fetch(`data/${name}`);
      if (!response.ok) throw new Error(`模型文件加载失败（HTTP ${response.status}）`);
      return response.json();
    };
    const [model, mnistModel] = await Promise.all([load('model.json'), load('mnist28.json')]);
    const describe = mode => {
      const layers = mode === 'large' ? mnistModel.layers : [
        {weights: model.w1, biases: model.b1}, {weights: model.w2, biases: model.b2},
      ];
      const formula = layers.map(layer => `(${layer.weights.length}×${layer.biases.length}＋${layer.biases.length})`).join('＋');
      const count = layers.reduce((sum, layer) => sum + (layer.weights.length + 1) * layer.biases.length, 0);
      heading.textContent = `总参数 = ${formula} = ${count.toLocaleString('en-US')}`;
      document.getElementById('model-origin').textContent = mode === 'large' ? '（MNIST 灰度模型的权重＋偏置）' : '（Excel 原模型的权重＋偏置）';
    };
    window.addEventListener('message', event => {
      if (event.source === window && event.data?.isStreamlitMessage === true && event.data.type === 'streamlit:setComponentValue') {
        describe(event.data.value?.mode);
      }
    });
    describe('full');
    window.postMessage({type: 'streamlit:render', args: {model, mnist_model: mnistModel}}, window.location.origin);
  } catch (exception) {
    heading.textContent = '模型尚未加载';
    error.textContent = `${exception.message}。请检查网络并刷新页面重试。`;
    error.hidden = false;
  }
})();
