import os
import sys
import time
import warnings
from pathlib import Path

from app.solver.cube_solver_adapter import TABLE_FILES, default_cache_dir


def main(cache_dir: Path | None = None) -> int:
    target = cache_dir if cache_dir is not None else default_cache_dir()
    target.mkdir(parents=True, exist_ok=True)
    print(f"Preparing solver tables in {target / 'tables'} (first build takes several minutes)")
    started = time.monotonic()
    previous = Path.cwd()
    os.chdir(target)
    try:
        with warnings.catch_warnings():
            import cube_solver

            cube_solver.Kociemba()
    finally:
        os.chdir(previous)
    elapsed = time.monotonic() - started
    for name in TABLE_FILES:
        path = target / "tables" / name
        if not path.is_file():
            print(f"error: {path} was not created", file=sys.stderr)
            return 1
        print(f"{name}: {path.stat().st_size / 1e6:.1f} MB")
    print(f"done in {elapsed:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
