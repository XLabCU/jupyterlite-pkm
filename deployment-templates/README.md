# JupyterLite PKM Deployment Templates

This directory contains template files for deploying a JupyterLite-powered teaching site with the PKM extension.

## Quick Start

1. Create a new GitHub repository for your teaching site
2. Copy these files to your repository:
   - `.github/workflows/deploy.yml` - GitHub Actions workflow
   - `.nojekyll` - Disables Jekyll processing
   - `requirements.txt` - Python dependencies
   - `jupyter-lite.json` - JupyterLite configuration
   - `content/` - Example content structure

3. Customize the content in `content/` with your teaching materials
4. Push to GitHub
5. Enable GitHub Pages (Settings → Pages → Source: GitHub Actions)

## Files Included

```
deployment-templates/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions workflow
├── .nojekyll                   # Disable Jekyll processing
├── content/                    # Example teaching content
│   ├── start.md               # Landing page
│   ├── modules/
│   │   ├── 01-introduction.md
│   │   ├── 01-introduction.ipynb
│   │   ├── 02-data-basics.md
│   │   └── 02-data-basics.ipynb
│   ├── resources/
│   │   ├── glossary.md
│   │   └── cheatsheet.md
│   └── examples/
│       └── r-example.ipynb
├── jupyter-lite.json           # JupyterLite config
├── requirements.txt            # Full dependencies
└── requirements-minimal.txt    # Minimal dependencies
```

## Customization

### Change Site Name

Edit `jupyter-lite.json`:
```json
{
  "jupyter-config-data": {
    "appName": "Your Course Name"
  }
}
```

### Add/Remove Kernels

Edit `requirements.txt` to enable/disable kernels:
- Python: `jupyterlite-pyodide-kernel`
- R: Installed via workflow (`jupyterlite-webr-kernel`)
- JavaScript: `jupyterlite-javascript-kernel`
- P5.js: `jupyterlite-p5-kernel`

### Minimal Build

For faster builds, rename `requirements-minimal.txt` to `requirements.txt`.

## Documentation

See the full [Deployment Guide](../docs/DEPLOYMENT_GUIDE.md) for detailed instructions.
