# 手写数字 · 神经网络实验室

用 Streamlit 展示两个全连接神经网络的真实前向计算。权重随包提供，识别在本机运行，不需要 Excel、API 密钥或在线模型服务。

## 启动

Windows 安装 64 位 Python 3.12 或更新版本，解压完整目录后双击 `start_demo.cmd`。首次启动需要联网安装 `requirements.txt` 中的依赖；启动后保持窗口开启。

手动启动（Windows / macOS / Linux）：

```sh
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
python -m pip install -r requirements.txt
python -m streamlit run app.py
```

`python bootstrap.py --check` 可准备环境并验证两套模型，不启动页面。

## 演示内容

| 标签 | 输入与结构 | 展示内容 |
|---|---|---|
| 小画板演示 · 12×12 | 144 个二值输入 → 128 → 10 | 01 输入、02 前向传播、03 八步矩阵计算 |
| 大画板演示 · 28×28 | 784 个灰度输入 → 256 → 128 → 10 | 01 输入、02 前向传播 |

两个画板分别保留笔画和撤销记录；切换标签暂停播放，页首参数公式随模型变化。支持绘画、橡皮、撤销、清空和键盘操作。网络图显示全部神经元，仅展开所选神经元的连接；全部权重始终参与计算。

小画板逐格保留原 Excel 的 0/1 输入，不做缩放或居中，可载入 0–9 教学笔画。03 按顺序展示：展开 x → xW₁ → 加 b₁ → ReLU → hW₂ → 加 b₂ → Softmax → argmax。W₁、W₂ 提供完整数值表、双向滚动、字号切换和逐项乘加动画。

大画板提供柔边灰度画笔、笔宽和浓度调节。计算前按比例适配至 20×20，并按笔画重心居中；画板原笔画保留，02 输入层展示实际参与计算的 784 项。没有适配开关、样本选择或单独的输入预览。

播放用于逐步解释一次真实计算，不表示网络推理需要等待动画完成。浏览器执行实时计算，Python 独立复算输入和输出，只有不一致时显示错误。

## 模型与来源

### 原 Excel 模型

结构为 **144 → 128 → 10**，隐藏层 ReLU，输出 Softmax。总参数：

**(144×128＋128)＋(128×10＋10) = 19,850**。

| 阶段 | Excel 区域 | 计算 / 形状 |
|---|---|---|
| 输入 | Board!B2:M13 | 12×12，按行展开 144 个 0/1 |
| W₁ / b₁ | ReLU!C4:DZ147 / C151:DZ151 | 144×128 / 128 |
| 隐藏层 | ReLU!C155:DZ155 | max(0, xW₁+b₁) |
| W₂ / b₂ | Softmax!C4:L131 / C135:L135 | 128×10 / 10 |
| 得分 | Softmax!C139:L139 | hW₂+b₂ |
| 概率 | Softmax!C142:L142 | exp(z−max(z)) / Σexp(z−max(z)) |

参数来自用户提供的 `MNIST_Dashboard.xlsm`，没有重新训练；文件指纹和区域映射保存在 `data/model.json`。`tools/extract_model.py` 只读取工作簿压缩包，不执行宏。原 Excel 未提供训练数据处理方式、测试成绩或对外再分发授权。

### 28×28 MNIST 模型

来源：[MNIST-FeedForward-NN 的固定提交](https://github.com/bijoysannyasi19-hash/MNIST-FeedForward-NN/tree/a97cc2f5d590022f81c47b937fdc1a5a03ffa035)。使用 `models/best_model/weights_biases.npz` 的全部参数，没有重新训练、量化或转置；MIT 许可证位于 `data/MNIST28-LICENSE.txt`。

结构为 **784 → 256 → 128 → 10**，两层隐藏层 ReLU，输出 Softmax。总参数：

**(784×256＋256)＋(256×128＋128)＋(128×10＋10) = 235,146**。

复测为 **9,790 / 10,000 = 97.90%**，对应作者将全部 70,000 张 MNIST 数据按 `random_state=42` 随机分层重划分后的留出集，**不是 MNIST 官方固定测试集，也不代表鼠标手写准确率**。复测信息和混淆矩阵统一保存在 `data/mnist28.json` 的 `evaluation` 中，固定索引保存在 `data/mnist28_holdout_indices.json`。

```sh
python tools/evaluate_mnist28.py --dataset /path/to/mnist.npz
python tools/import_mnist28.py /path/to/weights_biases.npz
```

复测脚本验证数据及索引指纹；导入脚本验证原权重指纹，只读取数值，不执行上游代码。官方数据地址为 `https://storage.googleapis.com/tensorflow/tf-keras-datasets/mnist.npz`，SHA-256 为 `731c5ac602752760c8e48fbffcf8c3b850d9dc2a2aedcf2cc48468fc17b673d1`。

## 验证与文件

运行应用只依赖 Streamlit 和 NumPy。开发验证另安装 pytest；JavaScript 检查使用 Node.js，无需安装前端依赖。

```sh
python -m pytest tests -q
node tests/test_js_parity.cjs
node tests/test_mnist28_js.cjs
```

- `app.py`：页面、模型缓存、Python 独立复算。
- `network.py`、`mnist28.py`：两套 NumPy 推理及输入验证；后者还包含灰度适配。
- `frontend/`：画板、神经元图、矩阵教学、动画和浏览器数值引擎。
- `data/model.json`、`data/mnist28.json`：原始权重、来源和相关元数据。
- `data/excel_reference.json`：原 Excel 保存值，基准输入为空白。
- `data/mnist28_samples.json`、`data/mnist28_reference.json`：20 张 MNIST 原始样本及原权重逐层数值基准，仅用于开发验证，不在应用启动时加载。
- `tools/`：参数提取、导入和留出集复测工具。

20 张验证样本每个数字两张，按留出集次序取最先出现者，没有按识别结果挑选。数据来自 [Keras MNIST](https://github.com/keras-team/keras/blob/master/keras/src/datasets/mnist.py)，作者为 Yann LeCun、Corinna Cortes，遵循其注明的 [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)。

现有检查覆盖 Excel 数值基准、全部灰度样本的逐层数值、独立标量求和、非法输入、Softmax 稳定性、灰度画笔、橡皮、居中处理和 Streamlit 启动。测试数据、固定索引及许可证保留，以便核验来源与计算。

## 解释边界

- Softmax 概率不等于识别准确率，也不是经过校准的可信度。
- 空白输入仍产生模型概率，界面以“尚无笔画”提示。原 Excel 空白输出为数字 1，约 75.98%。
- 小画板教学笔画“6”可能被原模型判为“9”；界面如实保留结果，教学样本不用于声明测试准确率。
- 两个模型均可能误判；不能仅凭参数量或几个示例量化比较准确率。
- 本应用展示推理，不包含训练、反向传播或在线学习。
