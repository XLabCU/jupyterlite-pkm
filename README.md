# JupyterLite Personal Knowledge Management Extension

Transform your JupyterLite into a Personal Knowledge Management (PKM) system with wikilinks, backlinks, search, and notebook cell embedding capabilities.

## 🌟 Overview

This extension bridges the gap between computational notebooks and knowledge management, combining:
- **Jupyter's computational power** for data analysis and code development
- **Markdown's simplicity** for note-taking and documentation  
- **PKM features** for connecting and organizing knowledge

I imagine this useful for researchers, students, and educators who want to build connected knowledge graphs while maintaining full computational capabilities. I envision instructors using this in the context of classroom or asynchronous instruction in digital humanities; the goal is to permit students to learn both personal knowledge management, dh code development, and documentation practices. A student might then 'graduate' to using a dedicated pkm app like Tangent Notes or Obsidian etc with a development environment properly configured for their machine. But for starting out, this extension combined with jupyterlite offers a gentle on-ramp.

## ✨ Key Features

### 🔗 **Wikilinks & Navigation**
- **Link syntax**: `[[Note Name]]` or `[[file|Display Text]]`
- **Multi-format support**: Link to `.md`, `.ipynb`, `.csv`, `.json`, `.geojson` files
- **Auto-completion**: Type `[[` for smart file suggestions
- **Click navigation**: Ctrl/Cmd+click to follow links
- **Broken link creation**: Click red links to create new files

### 📊 **Notebook Cell Embedding**
Embed specific cells from Jupyter notebooks:
```markdown
![[analysis.ipynb#cell:5]]        <!-- Full cell (code + output) -->
![[analysis.ipynb#cell:5:code]]   <!-- Code only -->
![[analysis.ipynb#cell:5:output]] <!-- Output only -->
```

**Cell Overview Tool**: Use `PKM: Show Notebook Cell Overview` to see all cells with their IDs, types, and previews.

### 📄 **Block Embedding**
Reference and embed content from other markdown files:
```markdown
![[research-notes#methodology]]     <!-- Embed by heading -->
![[findings#key-insight]]          <!-- Embed by block ID -->
![[summary#results|Key Results]]   <!-- With custom title -->
```

### 🔍 **Search & Discovery**
- **Global search** (`Alt+F`): Search across all markdown files and notebooks
- **Backlinks panel** (`Alt+B`): See which files link to the current file
- **Real-time results**: Live search with context previews

### 📝 **Editing**
- **Mode toggle** (`Alt+M`): Switch between edit and preview modes
- **Auto-preview startup**: Files open in preview mode by default
- **Floating toggle button**: Visual mode indicator

## 🚀 Integration with Your JupyterLite Site

### Install via GitHub Actions Integration

I haven't bundled this up for regular distribution as I'm not sure how desirable this is; I've built this for my own teaching first and foremost.

You can fork jupyterlite-as-a-website from [the Jupyterlite Demo](https://github.com/jupyterlite/demo). Then edit the deploy.yml file and make sure you have github pages enabled from workflows. Your deploy.yml should look like this (and I am also installing an R kernel, to show how that can be implemented too):

```yaml
# .github/workflows/deploy.yml
name: Build and Deploy

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - '*'

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
      
      - name: Install the dependencies
        run: |
          python -m pip install -r requirements.txt
      
      - name: Get the R Kernel
        run: |
          python -m pip install git+https://github.com/r-wasm/jupyterlite-webr-kernel.git
      
      - name: Install custom extension
        run: |
          # Try installing directly from the git repository
          pip install git+https://github.com/XLabCU/jupyterlite-pkm.git
         
      - name: Build the JupyterLite site
        run: |
          cp README.md content
          jupyter lite build --contents content --output-dir dist
      
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


## 📁 Content Structure

Organize your content directory for optimal PKM experience:

```
content/
├── start.md                 # Auto-opens on startup; use as a map-of-content or index
├── projects/
│   ├── project-alpha.md
│   ├── analysis.ipynb
│   └── data.csv
├── notes/
│   ├── daily-notes/
│   ├── research/
│   └── ideas/
└── resources/
    ├── methodologies.md
    └── references.md
```

## 🎯 Use Cases

### 📚 **Academic Research**
- Link literature reviews to data analysis notebooks
- Embed key findings across multiple papers
- Track research progression with connected notes

### 👩‍🏫 **Teaching & Learning**
- Create interconnected lesson materials
- Embed live code examples in documentation
- Build concept maps with executable content

### 💼 **Project Documentation**
- Connect project plans to implementation notebooks
- Embed analysis results in reports
- Maintain living documentation with computational backing

### 🧠 **Personal Knowledge Management**
- Build a second brain with computational capabilities
- Connect ideas across disciplines
- Maintain reproducible research notes

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+M` | Toggle edit/preview mode |
| `Alt+F` | Open global search |
| `Alt+B` | Toggle backlinks panel |
| `Ctrl/Cmd+Click` | Follow wikilink |

Open and close backlinks panel to refresh for the currently file in focus.

## 🛠️ Configuration

### Startup Behavior
The extension automatically opens `start.md` in preview mode. Create this file in your content root to customize the landing experience.

### Auto-save
Files are automatically saved every 30 seconds while editing (standard JupyterLite behavior).

### Search Indexing
Search indexes all `.md` and `.ipynb` files in your content directory and subdirectories.

## 📖 Usage Examples

### Basic Note Linking
```markdown
# Research Project Alpha

## Overview
This project builds on [[previous-research]] and explores [[new-methodology]].

## Data Analysis
See the full analysis in [[analysis.ipynb]] and key findings in [[results-summary]].

## Next Steps
- Review [[literature-review#recent-papers]]
- Update [[methodology#data-collection]]
- Prepare [[presentation-draft]]
```

### Embedding Computational Results

```markdown
# Monthly Report

## Key Metrics
![[metrics-analysis.ipynb#cell:3:output]]

## Methodology
![[analysis-methods#statistical-approach]]

## Code Implementation
![[implementation.ipynb#cell:5:code]]
```
From the command palette, there is a command `pkm: notebook overview` which if triggered when you are looking at an .ipynb file will produce a summary of cell ids so you know what targets to look for when you wish to embed code or output cells.


### Building Knowledge Networks
```markdown
# Machine Learning Concepts

## Supervised Learning
- [[linear-regression]] - ![[ml-basics#linear-models]]
- [[decision-trees]] - ![[tree-algorithms#overview]]

## Applications
- [[sentiment-analysis.ipynb#cell:0]] - Text classification example
- [[image-classification.ipynb#cell:2:output]] - CNN results
```

## 🤝 Contributing

Fork, and do what you will. I'm not likely to do much more with this.

## 📄 License

This project is licensed under the CC0 1.0 Universal - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built on [JupyterLab](https://github.com/jupyterlab/jupyterlab) and [JupyterLite](https://github.com/jupyterlite/jupyterlite)
- Inspired by [Obsidian](https://obsidian.md/), [Logseq](https://logseq.com/), and [Roam Research](https://roamresearch.com/)
- Designed for digital humanities education and computational research workflows



