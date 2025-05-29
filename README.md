# JupyterLite Personal Knowledge Management Extension

A JupyterLite extension that enhances markdown editing with personal knowledge management features inspired by tools like Obsidian.

### 🔗 Wikilinks ✅
- **Basic syntax**: `[[Note Title]]` - links to other markdown files
- **Aliased links**: `[[actual-note|display text]]` - custom display text  
- **Multi-file support**: Links to `.md`, `.ipynb`, `.csv`, `.json`, `.geojson` files
- **Note creation**: Click on broken links to create new notes
- **Code span protection**: Ignores wikilinks inside backticks

### 📝 Markdown Mode Switching ✅
- **Toggle preview**: Press `Alt+M` to switch between edit and preview modes
- **Persistent state**: Mode choice remembered when switching between files
- **Floating toggle button**: Visual indicator and easy access

### 🔍 Search ✅  
- **Cross-file search**: Search markdown content and notebook cells
- **Keyboard shortcut**: Press `Alt+F` to open search
- **Real-time results**: Shows matches with context and file locations

### 🔗 Backlinks ✅
- **Side panel**: Press `Alt+B` to open backlinks panel
- **Auto-refresh**: Updates when switching between markdown files
- **Click navigation**: Click any backlink to open the source file
- **Context display**: Shows surrounding text for each backlink

## 🚧 Planned Features

### 📊 Notebook Embedding (Next)
- Embed notebook cells in markdown: `![[notebook.ipynb#cell-N]]`
- Support for code cells, outputs, and ranges
- Live references to computational work
- See `NOTEBOOK-EMBEDDING-SPEC.md` for detailed specification

## Installation

### Prerequisites
- Python 3.8+
- Node.js 16+
- JupyterLite environment

### Install from Source

1. **Clone the repository**:
```bash
git clone https://github.com/your-repo/jupyterlite-pkm-extension
cd jupyterlite-pkm-extension
```

2. **Install Python dependencies and build**:
```bash
pip install -e .
```

3. **Build the extension**:
```bash
npm install
npm run build
```

4. **Install in development mode**:
```bash
pip install -e .
```

The extension will be automatically available in your JupyterLite environment.

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

### Basic Workflow
1. **Create notes**: Create new `.md` files in JupyterLite
2. **Link notes**: Use `[[Note Name]]` to create links between notes  
3. **Navigate**: Click wikilinks to jump between notes
4. **Switch modes**: Press `Alt+M` to toggle between edit and preview
5. **View backlinks**: Press `Alt+B` to see which notes link to the current file
6. **Search content**: Press `Alt+F` to search across all notes

### Keyboard Shortcuts
- `Alt+M` - Toggle markdown edit/preview mode
- `Alt+B` - Open/close backlinks panel  
- `Alt+F` - Open search panel

### Wikilink Syntax
- `[[filename]]` - Link to filename.md
- `[[filename|Display Text]]` - Link with custom display text
- `[[data.csv]]` - Link to CSV files
- `[[notebook.ipynb]]` - Link to Jupyter notebooks

## Architecture

The extension is built as a collection of JupyterLab plugins that work together:

- **markdown-preview**: Auto-opens preview for .md files
- **wikilinks**: Handles wikilink parsing and rendering
- **wikilink-completer**: Provides auto-completion for wikilinks
- **backlinks**: Tracks and displays backlinks
- **notebook-embed**: Handles notebook cell embedding
- **search**: Provides full-text search functionality

