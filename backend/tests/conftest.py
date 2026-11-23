import json
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]


def load_fixture(rel_path: str) -> Any:
    return json.loads((REPO_ROOT / rel_path).read_text(encoding="utf-8"))
