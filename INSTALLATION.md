# JupyterLite PKM Extension Installation Guide

Follow these steps to include the PKM extension in your JupyterLite build.

## Prerequisites

- Python 3.8+
- Node.js 16+
- JupyterLite installed (`pip install jupyterlite-core`)

## Quick Installation (Recommended)

The simplest way to install the extension:

```bash
# Clone the repository
git clone https://github.com/your-repo/jupyterlite-pkm-extension
cd jupyterlite-pkm-extension

# Install the extension (automatically builds and installs)
pip install -e .
```

That's it! The extension will be automatically available in your JupyterLite environment.

## Manual Installation (Alternative)

If you prefer step-by-step control:

### Step 1: Build the Extension

```bash
cd jupyterlite-pkm-extension

# Install JavaScript dependencies
npm install

# Build the extension
npm run build
```

### Step 2: Install the Extension Package

```bash
# Install as Python package
pip install -e .

# Verify installation
pip list | grep jupyterlite-pkm
# Should show: jupyterlite-pkm
```

## Using the Extension

Once installed, the extension is automatically available in any JupyterLite environment. No additional configuration required!

### Testing the Installation

1. **Create a markdown file**: In JupyterLite, create a new `.md` file
2. **Test wikilinks**: Type `[[test-note]]` and see it become a clickable link
3. **Test shortcuts**: 
   - `Alt+M` - Toggle edit/preview mode
   - `Alt+B` - Open backlinks panel
   - `Alt+F` - Open search panel

## Building a JupyterLite Site with the Extension

If you're creating a custom JupyterLite site:

```bash
# Create your JupyterLite site directory
mkdir my-jupyterlite-site
cd my-jupyterlite-site

# Create content directory and add markdown files
mkdir content
echo "# Welcome\n\nThis is a [[test-note]] example." > content/index.md

# Build the site (extension will be included automatically)
jupyter lite build --contents content

# Serve locally
jupyter lite serve
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


## Features Available After Installation

Once installed, you'll have access to:

### ✅ Wikilinks
- `[[note-name]]` - Link to other files
- `[[note-name|Display Text]]` - Custom display text
- Works with `.md`, `.ipynb`, `.csv`, `.json`, `.geojson` files
- Click broken links to create new files

### ✅ Keyboard Shortcuts
- `Alt+M` - Toggle markdown edit/preview mode
- `Alt+B` - Open/close backlinks panel
- `Alt+F` - Open search across all files

### ✅ Automatic Features
- Persistent mode switching (remembers edit vs preview per file)
- Cross-file search with context
- Backlinks tracking and navigation

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