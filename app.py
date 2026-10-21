"""Run with: python -m streamlit run app.py"""
from pathlib import Path

import numpy as np
import streamlit as st
from streamlit.components.v1 import declare_component

from network import forward, load_model
from mnist28 import center_mnist28, forward_mnist28, load_mnist28

ROOT = Path(__file__).resolve().parent
st.set_page_config(page_title='手写数字 · 神经网络实验室', page_icon='✍', layout='wide')
st.markdown('''<style>
.block-container{padding-top:1.6rem;padding-bottom:1rem;max-width:none;padding-left:1.2rem;padding-right:1.2rem}
[data-testid="stAppViewContainer"]{background:#f5f7fb}
header[data-testid="stHeader"]{background:transparent}
h1{font-size:2rem!important;letter-spacing:-.04em}
.intro-copy{font-size:14px;color:#65718a;line-height:1.8;margin-bottom:1rem}
.parameter-count{font-weight:750;color:#000}
</style>''', unsafe_allow_html=True)
st.title('手写数字 · 神经网络实验室')


@st.cache_data
def cached_model():
    return load_model()


@st.cache_data
def cached_mnist28():
    return load_mnist28()


try:
    model = cached_model()
    mnist_model = cached_mnist28()
except (OSError, ValueError, KeyError) as exc:
    st.error(f'无法加载模型：{exc}')
    st.stop()

intro = st.empty()
component = declare_component('mnist_network_lab', path=str(ROOT / 'frontend'))
event = component(model=model, mnist_model=mnist_model, key='network_lab', default=None)
mode = event.get('mode', 'full') if isinstance(event, dict) else 'full'
if mode == 'large':
    layers = mnist_model['layers']
    formula = '＋'.join(f"({len(layer['weights'])}×{len(layer['biases'])}＋{len(layer['biases'])})" for layer in layers)
    parameters = sum(np.asarray(layer['weights']).size + len(layer['biases']) for layer in layers)
    label = 'MNIST 灰度模型'
else:
    inputs, hidden, outputs = len(model['w1']), len(model['b1']), len(model['b2'])
    formula = f'({inputs}×{hidden}＋{hidden})＋({hidden}×{outputs}＋{outputs})'
    parameters = sum(np.asarray(model[key]).size for key in ('w1', 'b1', 'w2', 'b2'))
    label = 'Excel 原模型'
intro.markdown(
    '<p class="intro-copy">画一笔，看一次真实计算。'
    f'<strong class="parameter-count">总参数 = {formula} = {parameters:,}</strong>（{label}的权重＋偏置）</p>',
    unsafe_allow_html=True,
)
if event is not None:
    try:
        if mode not in ('full', 'large'):
            raise ValueError('模型模式无效')
        if mode == 'large':
            expected_input = center_mnist28(event['raw_pixels'])
            frontend_input = np.asarray(event['pixels'], dtype=float)
            if frontend_input.shape != (784,) or not np.allclose(frontend_input, expected_input, rtol=0, atol=1e-12):
                raise ValueError('浏览器与 Python 输入适配结果不一致')
            result = forward_mnist28(expected_input, mnist_model)
        else:
            result = forward(event['pixels'], model)
        frontend_probabilities = np.asarray(event['probabilities'], dtype=float)
        if frontend_probabilities.shape != (10,) or not np.isfinite(frontend_probabilities).all():
            raise ValueError('前端概率格式无效')
        error = float(np.max(np.abs(frontend_probabilities - result['probabilities'])))
        if error > 1e-10:
            st.error(f'浏览器与 Python 复算不一致，最大误差 {error:.3g}')
    except (ValueError, KeyError, TypeError) as exc:
        st.error(f'输入或计算结果无效：{exc}')
