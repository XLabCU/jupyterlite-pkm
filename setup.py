"""
Setup module for the JupyterLite PKM extension
"""
import json
import sys
from pathlib import Path

import setuptools

HERE = Path(__file__).parent.resolve()

# Get the package info from package.json
pkg_json = json.loads((HERE / "package.json").read_bytes())

setup_args = dict(
    name=pkg_json["name"].replace("@", "").replace("/", "-"),
    version=pkg_json["version"],
    url=pkg_json["homepage"],
    author=pkg_json["author"],
    description=pkg_json["description"],
    license=pkg_json["license"],
    long_description=(HERE / "README.md").read_text(),
    long_description_content_type="text/markdown",
    packages=setuptools.find_packages(),
    install_requires=[],
    zip_safe=False,
    include_package_data=True,
    python_requires=">=3.8",
    platforms="Linux, Mac OS X, Windows",
    keywords=["Jupyter", "JupyterLab", "JupyterLite", "PKM"],
    classifiers=[
        "License :: OSI Approved :: BSD License",
        "Programming Language :: Python",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Framework :: Jupyter",
        "Framework :: Jupyter :: JupyterLab",
        "Framework :: Jupyter :: JupyterLab :: 4",
        "Framework :: Jupyter :: JupyterLab :: Extensions",
        "Framework :: Jupyter :: JupyterLab :: Extensions :: Prebuilt",
    ],
)

if __name__ == "__main__":
    setuptools.setup(**setup_args)