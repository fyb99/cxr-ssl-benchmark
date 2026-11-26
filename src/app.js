(() => {
  "use strict";
  const data = JSON.parse(document.getElementById("benchmark-data").textContent);
  const ratios = [1, 10, 100];
  const groups = [
    {name: "分类", tasks: [
      {id: "chexpert", name: "CheXpert", metric: "AUC"},
      {id: "rsna_cls", name: "RSNA", metric: "AUC"},
      {id: "covidx", name: "COVIDx", metric: "ACC"},
      {id: "nih", name: "NIH", metric: "AUROC"},
    ]},
    {name: "分割", tasks: [
      {id: "rsna_seg", name: "RSNA", metric: "Dice"},
      {id: "siim", name: "SIIM", metric: "Dice"},
    ]},
  ];
  const tasks = groups.flatMap(group => group.tasks);
  const models = data.filter(event => event.kind === "model");
  const modelById = new Map(models.map(model => [model.id, model]));
  const reference = data.find(event => event.kind === "reference");
  const events = data.filter(event => event.kind === "eval");
  const key = (model, task, ratio) => [model, task, ratio].join(":");
  const results = new Map(events.map(event => [key(event.model, event.task, event.ratio), event]));
  const labels = {done: "已完成", running: "运行中", waiting: "待上一档", queued: "排队中", failed: "失败"};
  const date = new Intl.DateTimeFormat("zh-CN", {timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"});
  const showDate = s => date.format(new Date(s));
  const byId = id => document.getElementById(id);
  function element(tag, text, css) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (css) node.className = css;
    return node;
  }
  function resultFor(model, task, ratio) {
    if (model.reference) return {status: "done", score: reference.scores[task.id][ratios.indexOf(ratio)]};
    return results.get(key(model.id, task.id, ratio));
  }
  function columns(group, fractions) {
    return group.tasks.flatMap(task => fractions.map((ratio, i) => ({task, ratio, border: i === 0})));
  }
  function renderTable(group, fractions) {
    const card = element("article", undefined, "card");
    const title = element("div", undefined, "card-heading");
    title.append(element("h3", group.name), element("span", group.tasks.length + " 个评测项"));
    const wrap = element("div", undefined, "table-wrap");
    wrap.tabIndex = 0;
    wrap.setAttribute("role", "region");
    wrap.setAttribute("aria-label", group.name + "结果表，可横向滚动");
    const table = element("table");
    const top = element("tr");
    const first = element("th", "模型", "model-col");
    first.scope = "col";
    first.rowSpan = 2;
    top.append(first);
    for (const task of group.tasks) {
      const th = element("th", task.name, "dataset boundary");
      th.scope = "colgroup";
      th.colSpan = fractions.length;
      th.append(element("small", task.metric));
      top.append(th);
    }
    const headers = element("tr");
    const cols = columns(group, fractions);
    for (const {ratio, border} of cols) {
      const th = element("th", ratio + "%", "ratio" + (border ? " boundary" : ""));
      th.scope = "col";
      headers.append(th);
    }
    const head = element("thead");
    head.append(top, headers);
    const body = element("tbody");
    for (const model of models) {
      const row = element("tr", undefined, model.reference ? "reference" : undefined);
      const name = element("th", undefined, "model-col");
      name.scope = "row";
      name.append(element("span", model.name, "model-name"), element("span", model.label || "实验模型", "model-mark"));
      row.append(name);
      for (const {task, ratio, border} of cols) {
        const td = element("td", undefined, border ? "boundary" : undefined);
        const result = resultFor(model, task, ratio);
        if (result?.status === "done") {
          td.classList.add("numeric");
          td.append(element("strong", result.score.toFixed(2)));
          if (!model.reference) {
            const delta = result.score - reference.scores[task.id][ratios.indexOf(ratio)];
            td.append(element("small", (delta >= 0 ? "+" : "−") + Math.abs(delta).toFixed(2),
              "change " + (delta >= 0 ? "up" : "down")));
          }
        } else if (result) {
          td.append(element("span", labels[result.status], "state " + result.status));
        } else {
          const label = model.id === "am-radio" && task.id === "chexpert" ? "跳过" : "—";
          const state = element("span", label, "state");
          state.title = label === "—" ? "未评测" : "本轮不评测 CheXpert";
          td.append(state);
        }
        if (result?.source) td.title = result.source + " · " + showDate(result.at);
        row.append(td);
      }
      body.append(row);
    }
    table.append(head, body);
    wrap.append(table);
    card.append(title, wrap);
    return card;
  }
  function render(fractions) {
    byId("boards").replaceChildren(...groups.map(group => renderTable(group, fractions)));
  }
  for (const button of document.querySelectorAll("[data-ratio]")) {
    button.addEventListener("click", () => {
      for (const peer of document.querySelectorAll("[data-ratio]")) peer.setAttribute("aria-pressed", String(peer === button));
      render(button.dataset.ratio === "all" ? ratios : [Number(button.dataset.ratio)]);
    });
  }
  const current = models.filter(model => !model.reference).at(-1);
  if (current) {
    const relevant = [...results.values()].filter(result => result.model === current.id);
    const time = relevant.map(e => e.at).sort((a, b) => new Date(b) - new Date(a))[0];
    byId("current-name").textContent = current.name;
    byId("progress-count").textContent = relevant.filter(x => x.status === "done").length + " / " + relevant.length + " 已完成";
    for (const state of ["done", "running", "waiting", "queued", "failed"]) {
      for (const _ of relevant.filter(x => x.status === state)) byId("progress-bar").append(element("span", undefined, state));
    }
    byId("last-updated").textContent = time ? "状态快照 " + showDate(time) + "（北京时间）" : "待录入评测记录";
  }
  const modelPanel = byId("model-details");
  modelPanel.append(element("h3", "模型与来源"));
  for (const model of models) {
    const detail = element("details");
    detail.open = current?.id === model.id;
    detail.append(element("summary", model.name), element("p", model.description || ""));
    const source = element("ul");
    for (const line of model.details || []) source.append(element("li", line));
    detail.append(source);
    if (model.checkpoint) detail.append(element("p", model.checkpoint, "checkpoint"));
    modelPanel.append(detail);
  }
  for (const result of events.filter(r => r.status === "done").sort((a, b) => new Date(b.at) - new Date(a.at))) {
    const task = tasks.find(task => task.id === result.task);
    const label = result.task === "rsna_seg" ? "RSNA 分割" : result.task === "rsna_cls" ? "RSNA 分类" : task.name;
    const row = element("li");
    row.append(element("strong", `${modelById.get(result.model).name} · ${label} ${result.ratio}%`),
      element("strong", `${result.score.toFixed(2)}% ${task.metric}`),
      element("small", showDate(result.at) + " · " + result.source));
    byId("timeline").append(row);
  }
  byId("export").addEventListener("click", () => {
    const rows = [["model", "task", "metric", "train_percentage", "test_score_percentage", "state", "observed_at"]];
    for (const model of models) for (const task of tasks) for (const ratio of ratios) {
      const result = resultFor(model, task, ratio);
      rows.push([model.name, task.id, task.metric, ratio, result?.score ?? "", result?.status ?? "not_run", result?.at ?? ""]);
    }
    const csv = rows.map(row => row.map(value => '"' + String(value).replaceAll('"', '""') + '"').join(",")).join("\n") + "\n";
    const link = element("a");
    link.href = URL.createObjectURL(new Blob(["\ufeff", csv], {type: "text/csv;charset=utf-8"}));
    link.download = "cxr-benchmark.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
  render(ratios);
})();
