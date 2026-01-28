# JupyterLite PKM Deployment Guide

This guide covers deploying a JupyterLite-powered teaching site with the PKM extension via GitHub Pages.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Repository Structure](#repository-structure)
3. [GitHub Actions Workflow](#github-actions-workflow)
4. [Requirements Configuration](#requirements-configuration)
5. [JupyterLite Configuration](#jupyterlite-configuration)
6. [Content Organization](#content-organization)
7. [R Kernel Setup (WebR)](#r-kernel-setup-webr)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

1. Create a new repository from the template (or fork)
2. Add your content to the `content/` directory
3. Push to `main` branch
4. Enable GitHub Pages (Settings → Pages → Source: GitHub Actions)
5. Your site will be live at `https://<username>.github.io/<repo>/`

---

## Repository Structure

```
your-teaching-site/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions workflow
├── content/                     # Your teaching materials
│   ├── start.md                # Landing page (auto-opens)
│   ├── index.md                # Alternative landing page
│   ├── modules/                # Course modules
│   │   ├── 01-introduction.md
│   │   ├── 01-introduction.ipynb
│   │   ├── 02-data-analysis.md
│   │   └── 02-data-analysis.ipynb
│   ├── resources/              # Reference materials
│   │   ├── glossary.md
│   │   ├── references.md
│   │   └── cheatsheet.md
│   ├── examples/               # Example notebooks
│   │   ├── python-basics.ipynb
│   │   └── r-statistics.ipynb
│   └── data/                   # Data files for notebooks
│       ├── sample.csv
│       └── sample.geojson
├── files/                       # Additional files (optional)
├── jupyter-lite.json           # JupyterLite configuration
├── jupyter_lite_config.json    # Build configuration
├── requirements.txt            # Python dependencies
├── .nojekyll                   # Disable Jekyll processing
└── README.md                   # Repository documentation
```

---

## GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Build and Deploy JupyterLite

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - '*'
  # Allow manual trigger
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Cache pip packages
        uses: actions/cache@v4
        with:
          path: ~/.cache/pip
          key: ${{ runner.os }}-pip-${{ hashFiles('requirements.txt') }}
          restore-keys: |
            ${{ runner.os }}-pip-

      - name: Install Python dependencies
        run: |
          python -m pip install --upgrade pip
          python -m pip install -r requirements.txt

      - name: Install R Kernel (WebR)
        run: |
          python -m pip install jupyterlite-webr-kernel

      - name: Install PKM Extension
        run: |
          # Install from GitHub repository
          pip install git+https://github.com/XLabCU/jupyterlite-pkm.git

          # Verify installation
          jupyter labextension list

      - name: Create .nojekyll file
        run: |
          touch .nojekyll

      - name: Build JupyterLite site
        run: |
          jupyter lite build --contents content --output-dir dist

          # Copy .nojekyll to output
          cp .nojekyll dist/

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    permissions:
      pages: write
      id-token: write

    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    runs-on: ubuntu-latest
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### Workflow Features

- **Caching**: Pip packages cached for faster builds
- **Manual trigger**: Can rebuild via GitHub UI (workflow_dispatch)
- **PR previews**: Builds on PRs (doesn't deploy)
- **WebR support**: R kernel installed automatically
- **PKM extension**: Installed from GitHub

---

## Requirements Configuration

Create `requirements.txt`:

```
# =============================================================================
# JupyterLite Core (Required)
# =============================================================================
jupyterlite-core==0.5.0
jupyterlab~=4.3.4
notebook~=7.3.2

# =============================================================================
# Kernels
# =============================================================================

# Python kernel via Pyodide (recommended for teaching)
jupyterlite-pyodide-kernel==0.5.0

# JavaScript kernel (for web development courses)
jupyterlite-javascript-kernel==0.3.0

# P5.js kernel (for creative coding courses)
jupyterlite-p5-kernel==0.1.0

# R kernel - installed separately via pip install jupyterlite-webr-kernel
# See: https://github.com/r-wasm/jupyterlite-webr-kernel

# =============================================================================
# Language Packs (Optional - add as needed)
# =============================================================================
# jupyterlab-language-pack-fr-FR
# jupyterlab-language-pack-zh-CN
# jupyterlab-language-pack-es-ES
# jupyterlab-language-pack-de-DE

# =============================================================================
# File Renderers
# =============================================================================

# FASTA file renderer (bioinformatics)
jupyterlab-fasta>=3.3.0,<4

# GeoJSON file renderer (geography/GIS)
jupyterlab-geojson>=3.4.0,<4

# =============================================================================
# UI Enhancements
# =============================================================================

# Guided tour for onboarding
jupyterlab-tour

# Dark themes
jupyterlab-night
jupyterlab_miami_nights

# File system access (for local file operations)
jupyterlab-filesystem-access

# =============================================================================
# Python Libraries (Available in Pyodide)
# =============================================================================

# Interactive widgets
ipywidgets>=8.1.3,<9
ipyevents>=2.0.1

# Visualization
ipympl>=0.8.2
ipycanvas>=0.9.1
ipyleaflet

# Plotting
plotly>=5,<6
bqplot
matplotlib

# =============================================================================
# Data Science (Available in Pyodide)
# =============================================================================
# Note: These are available in Pyodide runtime, not pip installed
# - numpy
# - pandas
# - scipy
# - scikit-learn
# - networkx
```

### Minimal Requirements (Lightweight)

For a minimal deployment:

```
# Minimal requirements.txt
jupyterlite-core==0.5.0
jupyterlab~=4.3.4
notebook~=7.3.2
jupyterlite-pyodide-kernel==0.5.0
```

---

## JupyterLite Configuration

### Main Configuration: `jupyter-lite.json`

```json
{
  "jupyter-lite-schema-version": 0,
  "jupyter-config-data": {
    "appName": "My Teaching Site",
    "appVersion": "1.0.0",
    "exposeAppInBrowser": true,
    "faviconUrl": "./favicon.ico",
    "settingsOverrides": {
      "@jupyterlab/apputils-extension:themes": {
        "theme": "JupyterLab Light"
      },
      "@jupyterlab/docmanager-extension:plugin": {
        "autosave": true,
        "autosaveInterval": 60
      },
      "@jupyterlab/notebook-extension:tracker": {
        "codeCellConfig": {
          "lineNumbers": true
        }
      },
      "@jupyterlite/pkm-extension:welcome": {
        "showOnStartup": true
      }
    },
    "disabledExtensions": [],
    "federated_extensions": []
  }
}
```

### Build Configuration: `jupyter_lite_config.json`

```json
{
  "LiteBuildConfig": {
    "contents": ["content"],
    "output_dir": "dist",
    "apps": ["lab", "repl", "tree"]
  },
  "PipliteAddon": {
    "piplite_urls": []
  }
}
```

---

## Content Organization

### Landing Page: `content/start.md`

```markdown
# Welcome to [Course Name]

This interactive learning environment combines notes and executable notebooks.

## Quick Navigation

- [[modules/01-introduction|Module 1: Introduction]]
- [[modules/02-data-analysis|Module 2: Data Analysis]]
- [[resources/glossary|Glossary]]

## Getting Started

1. Click any `[[link]]` to navigate between notes
2. Use **Alt+M** to toggle between edit and preview mode
3. Use **Alt+B** to see backlinks to the current note
4. Use **Alt+F** to search across all notes

## Embedding Examples

### Embed a section from another note:
![[resources/glossary#Key Terms]]

### Embed a notebook cell:
![[examples/python-basics.ipynb#cell:0]]

---

*Tip: Create your own notes in the sidebar!*
```

### Module Template: `content/modules/01-introduction.md`

```markdown
# Module 1: Introduction

## Learning Objectives

By the end of this module, you will be able to:
- Understand the basic concepts
- Apply them in practice

## Content

This module introduces...

## Practice

Work through the exercises in the companion notebook:

[[01-introduction.ipynb|Open the notebook]]

### Key Code Example

![[01-introduction.ipynb#cell:3:code|Import statements]]

## Summary

Key takeaways:
- Point 1
- Point 2

## Next Steps

Continue to [[02-data-analysis|Module 2: Data Analysis]]

---

See also: [[resources/glossary|Glossary]] | [[resources/references|References]]
```

### Glossary Template: `content/resources/glossary.md`

```markdown
# Glossary

## Key Terms

### API
An Application Programming Interface defines how software components interact. ^api-definition

### DataFrame
A two-dimensional data structure with labeled axes (rows and columns). ^dataframe-definition

### Function
A reusable block of code that performs a specific task. ^function-definition

---

*Use `![[glossary#^api-definition]]` to embed any definition.*
```

---

## R Kernel Setup (WebR)

### Installing WebR Kernel

The WebR kernel enables R code execution in the browser via WebAssembly.

```bash
# Install the WebR kernel
pip install jupyterlite-webr-kernel
```

### WebR Configuration

Add to `jupyter-lite.json`:

```json
{
  "jupyter-config-data": {
    "litePluginSettings": {
      "@piplite/pyodide-kernel-extension:kernel": {
        "pipliteWheelUrl": ""
      }
    }
  }
}
```

### R Notebook Example: `content/examples/r-statistics.ipynb`

Create an R notebook with:

```json
{
  "cells": [
    {
      "cell_type": "markdown",
      "metadata": {},
      "source": ["# R Statistics Example\n\nThis notebook demonstrates R in JupyterLite."]
    },
    {
      "cell_type": "code",
      "execution_count": null,
      "metadata": {},
      "outputs": [],
      "source": ["# Basic R operations\nx <- c(1, 2, 3, 4, 5)\nmean(x)"]
    },
    {
      "cell_type": "code",
      "execution_count": null,
      "metadata": {},
      "outputs": [],
      "source": ["# Simple plot\nplot(1:10, main = 'Simple Plot')"]
    }
  ],
  "metadata": {
    "kernelspec": {
      "display_name": "R (webR)",
      "language": "R",
      "name": "webr"
    }
  },
  "nbformat": 4,
  "nbformat_minor": 5
}
```

### Available R Packages in WebR

WebR includes many common R packages:
- Base R (stats, graphics, utils)
- tidyverse (dplyr, ggplot2, tidyr, etc.)
- data.table
- And more: https://repo.r-wasm.org/

To use additional packages in notebooks:

```r
# Install a package (first cell of notebook)
webr::install("ggplot2")
library(ggplot2)
```

---

## Troubleshooting

### Common Issues

#### 1. Build fails with "extension not found"

```bash
# Verify PKM extension is installed
jupyter labextension list

# Should show:
# @jupyterlite/pkm-extension v0.x.x enabled OK
```

#### 2. Site shows 404 errors

- Ensure `.nojekyll` file exists in the output directory
- Check that GitHub Pages is set to deploy from GitHub Actions

#### 3. Content not appearing

- Verify `content/` directory exists and contains files
- Check `jupyter lite build` command includes `--contents content`

#### 4. R kernel not available

```bash
# Ensure webr kernel is installed
pip install jupyterlite-webr-kernel

# Rebuild the site
jupyter lite build --contents content --output-dir dist
```

#### 5. Large site builds slowly

- Reduce number of notebooks
- Use smaller data files
- Consider splitting into multiple deployments

### Debug Build Locally

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt
pip install jupyterlite-webr-kernel
pip install git+https://github.com/XLabCU/jupyterlite-pkm.git

# Build locally
jupyter lite build --contents content --output-dir dist

# Serve locally for testing
python -m http.server -d dist 8000

# Open http://localhost:8000 in browser
```

---

## Advanced: Custom Builds

### Multi-Course Deployment

For multiple courses in one site:

```
content/
├── index.md           # Course selection page
├── course-a/
│   ├── start.md
│   └── modules/
├── course-b/
│   ├── start.md
│   └── modules/
└── shared/
    └── resources/
```

### Versioned Deployments

For semester-based versioning:

```yaml
# In deploy.yml, add versioned deployments
- name: Build for current semester
  run: |
    jupyter lite build --contents content/fall-2024 --output-dir dist
```

### Custom Domain

1. Add `CNAME` file to repository root with your domain
2. Configure DNS to point to GitHub Pages
3. Update workflow to copy CNAME to dist:

```yaml
- name: Add CNAME
  run: |
    echo "teaching.example.com" > dist/CNAME
```

---

## Security Considerations for Teaching

1. **Student Data**: All data stays in the browser (IndexedDB)
2. **No Server**: No backend means no server vulnerabilities
3. **Content Protection**: Consider adding a license to your materials
4. **External Links**: The PKM extension uses `rel="noopener noreferrer"` for security

### Suggested License for Teaching Materials

Add to `content/LICENSE.md`:

```markdown
# License

These teaching materials are licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).

You are free to:
- Share: copy and redistribute the material
- Adapt: remix, transform, and build upon the material

Under the following terms:
- Attribution: Give appropriate credit
- NonCommercial: Not for commercial purposes
- ShareAlike: Distribute under the same license
```

---

## Resources

- [JupyterLite Documentation](https://jupyterlite.readthedocs.io/)
- [WebR Documentation](https://docs.r-wasm.org/webr/latest/)
- [Pyodide Documentation](https://pyodide.org/en/stable/)
- [JupyterLab Extension Development](https://jupyterlab.readthedocs.io/en/stable/extension/extension_dev.html)
