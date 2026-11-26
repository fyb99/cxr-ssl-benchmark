# 胸片模型评测台

[打开 GitHub Pages](https://fyb99.github.io/cxr-ssl-benchmark/)

直接在浏览器打开 `docs/index.html` 即可查看，无需安装依赖、启动后端或联网。页面区分分类和分割，ECAMP 固定在两张表首行，保留参考表中的 1%、10%、100% 三档。只有正式测试集结果进入分数列。

`data/history.jsonl` 是可追写的数据源。新模型先加一条 `model`，之后每个任务、比例分别追加 `eval`。同一模型、任务和比例以最后一条记录显示当前状态，历史测试仍可在实验记录中查看。比分用 0–100 的百分数，例如日志中的 `Test Dice: 0.75291` 记作 `75.291`；不要写验证分数、测试损失或把 AUROC 换成准确率。

例如，把以下两行保存到临时的 `new_result.jsonl`：

```jsonl
{"kind":"model","id":"example-model","name":"Example Model","label":"实验模型","description":"记录模型的预训练方法","details":["填写架构、预训练配置和权重版本"]}
{"kind":"eval","model":"example-model","task":"covidx","ratio":1,"status":"done","score":84.75,"at":"2026-11-26T13:27:21+08:00","source":"正式测试日志 · Test Accuracy"}
```

```bash
python3 build.py --append /absolute/path/new_result.jsonl
```

已有模型后续只追加 `eval`。任务 ID 为 `chexpert`、`rsna_cls`、`covidx`、`nih`、`rsna_seg`、`siim`。可记录 `running`、`waiting`、`queued` 或 `failed`，这些状态不得附带分数。普通页面修改后运行 `python3 build.py` 重新生成。

GitHub Pages 从 `main` 分支的 `/docs` 发布。追加记录并生成页面后，将 `data/history.jsonl` 和 `docs/index.html` 一起提交到 `main`，GitHub Pages 会重新发布。之前的记录留在台账和 Git 历史中。本站只发布实验信息与汇总指标，权重、数据和原始日志留在服务器。
