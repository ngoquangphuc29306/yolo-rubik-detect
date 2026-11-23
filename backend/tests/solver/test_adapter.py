import os
import threading
from pathlib import Path
from typing import Any

import pytest

from app.cube.constants import SOLVED
from app.cube.moves import MOVE_TOKENS, verify_solution
from app.solver.base import SolverFault, SolverTablesMissing, SolverTimeout
from app.solver.cube_solver_adapter import (
    CubeSolverAdapter,
    from_library_repr,
    to_library_repr,
)
from tests.conftest import load_fixture

SUPERFLIP = "UBULURUFURURFRBRDRFUFLFRFDFDFDLDRDBDLULBLFLDLBUBRBLBDB"


def fixture_states() -> list[str]:
    scramble_a: str = load_fixture("fixtures/solve/scramble-a.response.json")["initialState"]
    sequences = load_fixture("fixtures/engine/move-sequences.json")["sequences"]
    finals: list[str] = [seq["states"][-1] for seq in sequences[:10]]
    return [scramble_a, *finals]


class StubLib:
    def __init__(self, terminated: bool) -> None:
        self.terminated = terminated

    def solve(self, cube: Any, timeout: int) -> None:
        return None


def stub_adapter(lib: Any) -> CubeSolverAdapter:
    adapter = CubeSolverAdapter(Path("."))
    adapter._solver = lib
    return adapter


def test_load_without_tables_raises(tmp_path: Path) -> None:
    with pytest.raises(SolverTablesMissing, match=r"python -m app\.solver\.prepare"):
        CubeSolverAdapter(tmp_path).load()


def test_load_restores_cwd(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    import cube_solver

    tables = tmp_path / "tables"
    tables.mkdir()
    (tables / "transition.npz").write_bytes(b"")
    (tables / "pruning_kociemba.npz").write_bytes(b"")
    seen: list[Path] = []

    def fake_kociemba() -> object:
        seen.append(Path.cwd())
        return object()

    monkeypatch.setattr(cube_solver, "Kociemba", fake_kociemba)
    before = os.getcwd()
    CubeSolverAdapter(tmp_path).load()
    assert seen == [tmp_path.resolve()] or seen[0].samefile(tmp_path)
    assert os.getcwd() == before


def test_notation_conversion_roundtrip() -> None:
    for state in [SOLVED, *fixture_states()]:
        assert from_library_repr(to_library_repr(state)) == state
    assert to_library_repr(SOLVED) == "W" * 9 + "O" * 9 + "G" * 9 + "R" * 9 + "B" * 9 + "Y" * 9


def test_solves_fixture_states(real_solver: CubeSolverAdapter) -> None:
    states = fixture_states()
    assert len(states) == 11
    for state in states:
        tokens = real_solver.solve(state, 30)
        assert set(tokens) <= set(MOVE_TOKENS)
        assert verify_solution(state, tokens)


def test_timeout_zero_on_superflip_raises_or_verifies(real_solver: CubeSolverAdapter) -> None:
    try:
        tokens = real_solver.solve(SUPERFLIP, 0)
    except SolverTimeout:
        return
    assert verify_solution(SUPERFLIP, tokens)


def test_concurrent_solves_are_serialized(real_solver: CubeSolverAdapter) -> None:
    states = fixture_states()[:8]
    results: dict[int, list[str]] = {}
    errors: list[BaseException] = []

    def run(i: int) -> None:
        try:
            results[i] = real_solver.solve(states[i], 30)
        except BaseException as exc:  # noqa: BLE001
            errors.append(exc)

    threads = [threading.Thread(target=run, args=(i,)) for i in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert not errors
    assert all(verify_solution(states[i], results[i]) for i in range(8))


def test_none_with_termination_is_timeout() -> None:
    with pytest.raises(SolverTimeout):
        stub_adapter(StubLib(True)).solve(fixture_states()[0], 1)


def test_none_without_termination_is_fault() -> None:
    with pytest.raises(SolverFault):
        stub_adapter(StubLib(False)).solve(fixture_states()[0], 1)
