# JupyterLite Personal Knowledge Management Extension

A JupyterLite extension that enhances markdown editing with personal knowledge management features inspired by tools like Obsidian.

At least, that's the plan. Work in progress, some of this documentation is more aspirational than actual.

## Features

### 🔗 Wikilinks
- **Basic syntax**: `[[Note Title]]` - links to other markdown files
- **Aliased links**: `[[actual-note|display text]]` - custom display text
- **Auto-completion**: Type `[[` to see suggestions of existing notes
- **Note creation**: Click on broken links to create new notes

### 📝 Markdown Preview
- Automatically opens preview pane when editing .md files
- Toggle preview with `Shift+Cmd+T`
- Per-note preview state (not global)

### 🔍 Search
- Full-text search across all markdown files
- Access via command palette or `Cmd+Shift+F`
- Shows matched text with context

### 🔙 Backlinks
- Displays all notes that link to the current note
- Shown at the bottom of each markdown preview
- Click to navigate to linking notes

### 📊 Notebook Embedding
- Embed notebook cells in markdown: `![[notebook.ipynb#cell-id]]`
- Supports code cells, markdown cells, and outputs
- Embedded cells are executable and share kernel state
- Visual indicators for embedded content and modifications

## Installation


```bash
git clone https://github.com/XLabCU/jupyterlite-pkm
cd jupyterlite-pkm
pip install -e .
```

## Development

### Setup

```bash
# Clone the repo
git clone https://github.com/XLabCU/jupyterlite-pkm
cd jupyterlite-pkm

# Install dependencies
npm install

# Build the extension
npm run build

# Watch for changes
npm run watch
```

### Building

```bash
# Build for development
npm run build

# Build for production
npm run build:prod

# Build Python package
python -m build
```

## Usage

Once installed, the extension automatically enhances your JupyterLite markdown editing experience:

1. **Create notes**: Create new `.md` files in JupyterLite
2. **Link notes**: Use `[[Note Name]]` to create links between notes
3. **Navigate**: Click wikilinks to jump between notes
4. **Search**: Use `Cmd+Shift+F` to search across all notes
5. **Embed notebooks**: Use `![[notebook.ipynb#cell-id]]` to embed notebook cells

## Architecture

The extension is built as a collection of JupyterLab plugins that work together:

- **markdown-preview**: Auto-opens preview for .md files
- **wikilinks**: Handles wikilink parsing and rendering
- **wikilink-completer**: Provides auto-completion for wikilinks
- **backlinks**: Tracks and displays backlinks
- **notebook-embed**: Handles notebook cell embedding
- **search**: Provides full-text search functionality

