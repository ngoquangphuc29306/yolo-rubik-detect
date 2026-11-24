import json
from typing import Any

from app.schemas import ScanError, ScanFrameResult, ScanReady
from tests.conftest import REPO_ROOT
from tests.crosscheck.record_ws_messages import record

IDS = [
    "ready",
    "frame_result_valid",
    "frame_result_missing_cell",
    "frame_result_ambiguous_cell",
    "error_invalid_frame",
    "error_frame_too_large",
]


def test_recorded_messages_match_backend_models() -> None:
    doc: dict[str, Any] = json.loads(
        (REPO_ROOT / "fixtures" / "vision" / "ws-messages.json").read_text(encoding="utf-8")
    )
    assert doc["schema"] == "ws-messages/1"
    assert [m["id"] for m in doc["messages"]] == IDS
    models = {"ready": ScanReady, "frame_result": ScanFrameResult, "error": ScanError}
    for m in doc["messages"]:
        msg = m["message"]
        models[msg["type"]].model_validate(msg)


def test_fixture_is_up_to_date_with_the_real_backend() -> None:
    stored = json.loads(
        (REPO_ROOT / "fixtures" / "vision" / "ws-messages.json").read_text(encoding="utf-8")
    )
    assert record() == stored
