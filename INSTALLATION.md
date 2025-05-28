# JupyterLite PKM Extension Installation Guide

Follow these steps to include the PKM extension in your JupyterLite build.

## Prerequisites

- Python 3.8+
- Node.js 16+
- JupyterLite installed (`pip install jupyterlite-core`)

## Step 1: Build the Extension

First, ensure the extension is built:

```bash
cd jupyterlite-pkm

# Install JavaScript dependencies
npm install
# or
jlpm install

# Build the extension
npm run build
```

## Step 2: Install the Extension Package

Install the extension as a Python package:

```bash
# From the jupyterlite-pkm-extension directory
pip install -e .

# Verify installation
jupyter labextension list
# Should show: @jupyterlite/pkm-extension
```

## Step 3: Create JupyterLite Configuration

Create a `jupyter-lite.json` file in your JupyterLite project directory:

```json
{
  "jupyter-lite-schema-version": 0,
  "jupyter-config-data": {
    "disabledExtensions": [],
    "federated_extensions": [
      {
        "extension": "./extensions",
        "load": true,
        "name": "@jupyterlite/pkm-extension"
      }
    ]
  }
}
```

## Step 4: Copy Extension to JupyterLite

Copy the built extension to your JupyterLite project:

```bash
# Create extensions directory in your JupyterLite project
mkdir -p my-jupyterlite-site/extensions/jupyterlite-pkm-extension

# Copy the built extension files
cp -r jupyterlite-pkm-extension/jupyterlite_pkm_extension/labextension/* \
  my-jupyterlite-site/extensions/jupyterlite-pkm-extension/
```

## Step 5: Build JupyterLite Site

Build your JupyterLite site with the extension:

```bash
cd my-jupyterlite-site

# Build the JupyterLite site
jupyter lite build --contents content

# The extension will be automatically included
```

## Step 6: Serve and Test

Serve your JupyterLite site locally to test:

```bash
# Serve the built site
jupyter lite serve

# Or use Python's built-in server
cd _output
python -m http.server 8000
```

Open http://localhost:8000 in your browser.

## Alternative Method 1: Using requirements.txt 

This is the simplest method if you're already using a `requirements.txt` file:

1. Add the extension to your `requirements.txt`:
```
# For local development
jupyterlite-pkm-extension @ file:///path/to/jupyterlite-pkm-extension

# Or if published to PyPI
jupyterlite-pkm-extension

# Or from GitHub
jupyterlite-pkm-extension @ git+https://github.com/XLabCU/jupyterlite-pkm.git
```

2. Build JupyterLite with the requirements file:
```bash
jupyter lite build --contents content --requirements requirements.txt
```


## Verifying Installation

Once JupyterLite is running:

1. Create a new `.md` file - preview should open automatically
2. Type `[[Test Note]]` - it should appear as a styled link
3. Press `Cmd+Shift+F` - search panel should open
4. Click a broken wikilink - prompt to create note should appear

## Troubleshooting

### Extension not loading
- Check browser console for errors
- Verify extension is listed in `jupyter labextension list`
- Ensure the extension files are in the correct directory

### Build errors
- Clear the JupyterLite build cache: `jupyter lite clean`
- Rebuild: `jupyter lite build --contents content`

### Wikilinks not working
- Ensure you're editing a `.md` file
- Check that JavaScript console shows "Wikilinks plugin activated"

## Using with GitHub Pages

To deploy with GitHub Pages:

1. Build your site as above
2. Commit the `_output` directory
3. Configure GitHub Pages to serve from the `_output` directory

Or use GitHub Actions:

```yaml
name: Build and Deploy JupyterLite

on:
  push:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.10'
    
    - name: Install dependencies
      run: |
        pip install jupyterlite-core
        pip install ./jupyterlite-pkm-extension
    
    - name: Build JupyterLite
      run: |
        jupyter lite build --contents content
    
    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./_output
```

## Configuration Options

The extension works out of the box, but you can customize behavior by modifying the source code:

- Keyboard shortcuts: Edit `src/markdown-preview.ts`
- Wikilink styling: Edit CSS in `src/wikilinks.ts`
- Search result display: Edit `src/search.ts`
- Backlinks appearance: Edit `src/backlinks.ts`

After making changes, rebuild with `npm run build` and reinstall.