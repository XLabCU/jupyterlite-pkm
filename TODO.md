# JupyterLite PKM Extension - TODO

## Current Status
- ✅ Extension successfully builds and installs
- ✅ Welcome popup displays on startup with feature explanations
- ✅ Search functionality works for markdown content and filenames
- ✅ Auto-save implemented (2-second delay after changes)
- ✅ GitHub repository configured: https://github.com/XLabCU/jupyterlite-pkm

## Unresolved Issues

### 1. Wikilinks Not Opening Files
- **Issue**: Clicking [[wikilink]] shows "Target name is undefined for broken wikilink" 
- **Root Cause**: JupyterLab's markdown renderer transforms our custom links, losing data attributes
- **Current Approach**: Using `pkm-wikilink:` protocol with encoded data
- **Next Steps**: Debug the href parsing and data extraction in the click handler

### 2. Notebook Embeds Not Rendering
- **Issue**: ![[notebook.ipynb]] syntax not displaying embedded content
- **Status**: Parser recognizes embeds but rendering not implemented
- **Next Steps**: Implement notebook cell rendering within markdown preview

### 3. Panel Management
- **Current**: Files open in unpredictable panels
- **Desired**: 
  - Markdown source files: Always open in left panel, one at a time
  - Rendered markdown: Always open in right panel, one at a time
- **Next Steps**: Implement proper panel management in file opening logic

## Desired Enhancement

### Executable Code Blocks in Markdown
- **Feature**: Code blocks with language fence (```python) become executable
- **Behavior**: 
  - Add "Run" button to code blocks in preview
  - Execute code in Pyodide kernel
  - Insert output below as fenced code block in the source
- **Implementation Ideas**:
  - Enhance markdown renderer to add execution UI
  - Connect to JupyterLite's kernel infrastructure
  - Modify source file to include outputs

## Technical Notes
- Current wikilink approach uses custom protocol to survive JupyterLab transformations
- Need better integration with JupyterLab's document manager for file operations
- Consider using JupyterLab's layout manager for proper panel control