"""Build a self-contained local preview and a GitHub Pages document."""

import argparse
from datetime import datetime
import json
import math
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
LEDGER = ROOT / "data/history.jsonl"
TASKS = {"chexpert", "rsna_cls", "covidx", "nih", "rsna_seg", "siim"}
RATIOS = (1, 10, 100)
STATES = {"done", "running", "waiting", "queued", "failed"}


def parse(text):
    return [json.loads(line) for line in text.splitlines() if line.strip()]


def percent(value):
    return isinstance(value, (float, int)) and not isinstance(value, bool) and math.isfinite(value) and 0 <= value <= 100


def validate(events):
    models = {}
    references = set()
    for n, row in enumerate(events, 1):
        kind = row["kind"]
        if kind == "model":
            mid = row["id"]
            if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", mid) or mid in models or not row["name"]:
                raise ValueError(f"Row {n}: invalid or duplicate model id")
            models[mid] = row
        elif kind == "reference":
            mid = row["model"]
            scores = row["scores"]
            if mid in references or not models.get(mid, {}).get("reference") or set(scores) != TASKS:
                raise ValueError(f"Row {n}: invalid reference")
            if any(len(series) != len(RATIOS) or not all(map(percent, series)) for series in scores.values()):
                raise ValueError(f"Row {n}: invalid reference score")
            references.add(mid)
        elif kind == "eval":
            if row["model"] not in models or models[row["model"]].get("reference"):
                raise ValueError(f"Row {n}: register the experiment model before its results")
            if row["task"] not in TASKS or row["ratio"] not in RATIOS or row["status"] not in STATES:
                raise ValueError(f"Row {n}: unknown task, fraction, or state")
            if datetime.fromisoformat(row["at"]).tzinfo is None:
                raise ValueError(f"Row {n}: timestamp must include its time zone")
            if not row.get("source"):
                raise ValueError(f"Row {n}: missing evidence source")
            if row["status"] == "done" and not percent(row.get("score")):
                raise ValueError(f"Row {n}: completed results need a test score on the 0–100 scale")
            if row["status"] != "done" and "score" in row:
                raise ValueError(f"Row {n}: a pending run cannot carry a score")
        else:
            raise ValueError(f"Row {n}: unknown event type {kind}")
    if next(iter(models), None) != "ecamp" or references != {"ecamp"}:
        raise ValueError("ECAMP must be the first and only reference model")


def build(events):
    template = (ROOT / "src/index.html").read_text(encoding="utf-8")
    data = json.dumps(events, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    markup = template.replace("/*__STYLE__*/", (ROOT / "src/style.css").read_text(encoding="utf-8"))
    markup = markup.replace("/*__DATA__*/", data)
    return markup.replace("/*__APP__*/", (ROOT / "src/app.js").read_text(encoding="utf-8"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--append", type=Path, help="Append validated JSONL events, then regenerate the page")
    args = parser.parse_args()
    current = LEDGER.read_text(encoding="utf-8")
    addition = args.append.read_text(encoding="utf-8").strip() if args.append else ""
    existing = parse(current)
    new = parse(addition)
    if args.append and not new:
        parser.error("No new events supplied")
    combined = existing + new
    validate(combined)
    markup = build(combined)
    if new:
        with LEDGER.open("a", encoding="utf-8") as log:
            if current and not current.endswith("\n"):
                log.write("\n")
            log.write(addition + "\n")
    output = ROOT / "docs/index.html"
    output.parent.mkdir(exist_ok=True)
    output.write_text(markup, encoding="utf-8")
    print(f"{output} — {len(combined)} ledger records")


if __name__ == "__main__":
    main()
