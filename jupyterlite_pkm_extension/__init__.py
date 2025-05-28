"""JupyterLite Personal Knowledge Management Extension"""

try:
    from ._version import __version__
except ImportError:
    # Fallback when using the package in dev mode without installing
    import json
    from pathlib import Path

    __version__ = json.loads(Path(__file__).parent.parent.joinpath("package.json").read_text())["version"]

__all__ = ["__version__"]