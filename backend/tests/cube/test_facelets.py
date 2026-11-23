import copy
from typing import Any

import pytest

from app.cube.constants import SOLVED
from app.cube.facelets import CubeInputError, build_facelet_state
from tests.conftest import load_fixture


def solved_faces() -> dict[str, Any]:
    faces: dict[str, Any] = copy.deepcopy(
        load_fixture("fixtures/solve/solved.request.json")["faces"]
    )
    return faces


def test_solved_request_builds_solved_state() -> None:
    assert build_facelet_state(solved_faces()) == (
        SOLVED,
        {"U": "white", "R": "red", "F": "green", "D": "yellow", "L": "orange", "B": "blue"},
    )


def test_scramble_a_matches_fixture_initial_state() -> None:
    request = load_fixture("fixtures/solve/scramble-a.request.json")
    response = load_fixture("fixtures/solve/scramble-a.response.json")
    state, centers = build_facelet_state(request["faces"])
    assert state == response["initialState"]
    assert state == "DDFFUUULBLFDDRLLRBRUDRFLRBFBUUBDUBBLLRFRLDUDDRFFFBBULR"
    assert centers == response["centerColors"]


def test_row_major_outside_view_indices() -> None:
    faces = solved_faces()
    faces["F"][2] = "red"
    faces["R"][0] = "green"
    state, _ = build_facelet_state(faces)
    assert state[20] == "R"
    assert state[9] == "F"


def _missing_face() -> dict[str, Any]:
    faces = solved_faces()
    del faces["B"]
    return faces


def _extra_face() -> dict[str, Any]:
    faces = solved_faces()
    faces["X"] = ["white"] * 9
    return faces


def _short_face() -> dict[str, Any]:
    faces = solved_faces()
    faces["U"] = faces["U"][:8]
    return faces


def _unknown_color() -> dict[str, Any]:
    faces = solved_faces()
    faces["U"][0] = "purple"
    return faces


def _capitalised_color() -> dict[str, Any]:
    faces = solved_faces()
    faces["U"][0] = "White"
    return faces


def _duplicate_center() -> dict[str, Any]:
    faces = solved_faces()
    faces["D"][4] = "white"
    return faces


def _count_mismatch() -> dict[str, Any]:
    faces = solved_faces()
    faces["U"][0] = "red"
    return faces


@pytest.mark.parametrize(
    ("faces", "code"),
    [
        (_missing_face(), "INVALID_FACE_SHAPE"),
        (_extra_face(), "INVALID_FACE_SHAPE"),
        (_short_face(), "INVALID_FACE_SHAPE"),
        (_unknown_color(), "INVALID_FACE_SHAPE"),
        (_capitalised_color(), "INVALID_FACE_SHAPE"),
        (_duplicate_center(), "DUPLICATE_CENTER"),
        (_count_mismatch(), "COLOR_COUNT_MISMATCH"),
    ],
    ids=["missing", "extra", "eight", "purple", "White", "dup-center", "count"],
)
def test_errors(faces: dict[str, Any], code: str) -> None:
    with pytest.raises(CubeInputError) as exc:
        build_facelet_state(faces)
    assert exc.value.code == code


def test_faces_from_state_round_trips() -> None:
    from app.cube.facelets import faces_from_state

    request = load_fixture("fixtures/solve/scramble-a.request.json")
    state, centers = build_facelet_state(request["faces"])
    assert faces_from_state(state, centers) == request["faces"]
