from typing import Protocol


class Solver(Protocol):
    def solve(self, state: str, timeout_s: int) -> list[str]: ...


class SolverTimeout(Exception):
    """The time limit stopped the search before a solution was found."""


class SolverFault(Exception):
    """The solver library failed or returned an unusable result."""


class SolverTablesMissing(Exception):
    """The solver tables have not been prepared."""
