# JupyterLite Personal Knowledge Management Extension

A JupyterLite extension that enhances markdown editing with personal knowledge management features inspired by tools like Obsidian.

Live demo as we test at [XLabCU/jupyterlite-testing](https://XLabCU.github.io/jupyterlite-testing)

### 🔗 Wikilinks ✅
- **Basic syntax**: `[[Note Title]]` - links to other markdown files
- **Aliased links**: `[[actual-note|display text]]` - custom display text  
- **Multi-file support**: Links to `.md`, `.ipynb`, `.csv`, `.json`, `.geojson` files
- **Note creation**: Click on broken links to create new notes
- **Code span protection**: Ignores wikilinks inside backticks
- **Auto complete**: Typing `[[` will open an auto-complete dropdown (Bug: if cursor is adjacent to `]]` autocomplete still tries to suggestion completions, drawing from text of the open note)

### 📝 Markdown Mode Switching ✅
- **Toggle preview**: Press `Alt+M` to switch between edit and preview modes
- **Floating toggle button**: Visual indicator and easy access

### 🔍 Search ✅  
- **Cross-file search**: Search markdown content and notebook cells
- **Keyboard shortcut**: Press `Alt+F` to open search
- **Real-time results**: Shows matches with context and file locations

### 🔗 Backlinks ✅
- **Side panel**: Press `Alt+B` to open backlinks panel
- **Manual-refresh**: Updates when panel closed/re-opened
- **Click navigation**: Click any backlink to open the source file
- **Context display**: Shows surrounding text for each backlink

### 📊 IPYNB Notebook Cell Embedding (Phase 2)

1. Cell Index Detection: Recognizes cell:N patterns in block references
2. Cell Type Support: Handles code, output, markdown, and full cell types
3. Notebook Parsing: Extracts content from .ipynb JSON structure
4. Output Handling: Processes different output types (stream, results, errors, images)
5. Enhanced Rendering:
    - Special icons for different cell types (📓💻, 📓📊, 📓📝)
    - Syntax highlighting for code cells
    - Execution count display [1]
    - Separate formatting for code vs output

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

## How to Use This Extension for Personal Knowledge Management

This extension transforms JupyterLite into a PKM system. I envision instructors using this in the context of classroom or asynchronous instruction in digital humanities; the goal is to permit students to learn both personal knowledge management, dh code development, and documentation practices. A student might then 'graduate' to using a dedicated pkm app like Tangent Notes or Obsidian etc with a development environment properly configured for their machine. But for starting out, this extension combined with jupyterlite offers a gentle on-ramp.

Here's your complete guide:

### 📝 **Creating and Organizing Notes**

1. **Create notes**: Create new `.md` files in JupyterLite for your thoughts, research, and ideas
2. **Use descriptive names**: `project-ideas.md`, `meeting-notes-2024.md`, `research-methods.md`
3. **Start with structure**: Begin each note with clear headings

```markdown
# Project Ideas

## AI Research
Content about AI research ideas...

## Web Development  
Ideas for web development projects...
```

### 🔗 **Linking Your Knowledge**

#### Basic Wikilinks
Connect related concepts using `[[double brackets]]`:

```markdown
See also [[research-methods]] for our methodology.
The findings support our [[initial-hypothesis|original theory]].
Check the [[data-analysis.ipynb]] notebook for calculations.
```

**Syntax Options:**
- `[[filename]]` - Links to filename.md
- `[[filename|Display Text]]` - Custom display text
- `[[notebook.ipynb]]` - Links to Jupyter notebooks  
- `[[data.csv]]` - Links to data files

**Autocomplete**: Type `[[` and get suggestions for existing files with ↑/↓ navigation.

### 📚 **Block Embedding for Reusable Content**

Embed content from other notes using `![[double brackets]]`:

#### Embed by Heading
```markdown
![[research-methods.md#Data Collection]]
![[literature-review.md#Introduction]]
```

#### Embed by Block ID
First, mark content in your source files:
```markdown
Our key finding is that user engagement increases by 40%. ^key-finding

The methodology involves three phases of data collection. ^methodology-overview
```

Then embed specific blocks:
```markdown
![[findings.md#key-finding]]
![[methods.md#methodology-overview|Our Research Approach]]
```

**What You Get:**
```markdown
---

**📄 findings.md#key-finding** *(🕒 5/30/2025, 11:15:30 AM)*

Our key finding is that user engagement increases by 40%.

---
```

#### Embed code blocks, markdown blocks, and output blocks from ipynb files

Format:
- ![[notebook.ipynb#cell:5]]        <!-- Full cell (code + output) -->
- ![[notebook.ipynb#cell:5:code]]   <!-- Code only -->
- ![[notebook.ipynb#cell:5:output]] <!-- Output only -->
- ![[notebook.ipynb#cell:5:markdown]] <!-- Markdown cell -->

Example Rendered Output:

---
**📓💻 analysis.ipynb#Cell 5:code** *[3]* *(🕒 timestamp)*

```python
import matplotlib.pyplot as plt
x = [1, 2, 3, 4]
plt.plot(x, [i**2 for i in x])
plt.show()
```
---



### 🎛️ **View Management**

#### Toggle Between Edit and Preview
- **Button**: Click the toggle in the bottom-left panel (still can be buggy; better to use keyboard)
- **Keyboard**: Press `Alt+M` 
- **Behavior**: Switches the current tab between source and rendered view

The button shows your current state:
- "👁 Switch to Preview" (when in edit mode)
- "📝 Switch to Edit" (when in preview mode)  
- "📄 No Markdown File" (when other files are focused)

### 🔍 **Finding and Connecting Information**

#### Cross-File Search (`Alt+F`)
- Search across all markdown files and notebooks
- Real-time results with context
- Click results to jump to that file

#### Backlinks Panel (`Alt+B`)  
- See which notes link to your current file
- Click any backlink to open the source file
- Auto-updates when you switch files

#### Navigation
- In preview click any wikilink to open the target file
- Broken links (red) let you create new files on-click
- Files open in the appropriate mode (edit/preview)

### 🧠 **PKM Workflows and Best Practices**

#### 1. **Daily Note-Taking**
```markdown
# 2024-05-30 Daily Notes

## Meetings
- [[team-standup]] - discussed [[project-alpha]]
- Key decision: ![[project-alpha.md#timeline|Project Timeline]]

## Ideas
- New research direction: [[ai-ethics-framework]]
- Follow up on [[user-research.md#pain-points]]

## Tasks
- Review [[literature-review.md#recent-studies]]
- Update [[methodology.md#data-collection]]
```

#### 2. **Research and Literature Management**
```markdown
# Literature Review

## Key Papers
[[smith-2024]] argues that ![[smith-2024.md#main-thesis]]

## Methodology Insights  
![[methods-paper-1.md#statistical-approach]]
![[methods-paper-2.md#qualitative-framework|Qualitative Methods]]

## Synthesis
The papers agree on [[common-themes]] but differ on [[methodological-approaches]].
```

#### 3. **Project Organization**
```markdown
# Project Alpha

## Overview
![[project-planning.md#objectives]]

## Current Status
- Phase 1: ![[phase-1-report.md#summary]]
- Next steps: [[phase-2-planning]]

## Resources
- Data: [[datasets.md#primary-sources]]
- Tools: [[analysis-tools.ipynb]]
- Team: [[team-contacts.md#project-alpha-team]]
```

#### 4. **Learning and Skill Development**
```markdown
# Machine Learning Study

## Concepts
- [[supervised-learning]] - basic principles
- [[neural-networks]] - ![[deep-learning-notes.md#key-concepts]]

## Practice
- Completed: [[ml-project-1.ipynb]]
- In progress: [[ml-project-2.ipynb]]

## Resources
- Course notes: ![[ml-course.md#week-3-summary]]
- Key papers: [[important-ml-papers]]
```

### ⌨️ **Keyboard Shortcuts**
- `Alt+M` - Toggle current file edit/preview mode
- `Alt+B` - Open/close backlinks panel  
- `Alt+F` - Open search panel
- `Alt+S` - Save current file (standard JupyterLite)

### 🎯 **Advanced Tips**

#### Organizing Block IDs
Use consistent naming patterns:
```markdown
Main findings go here. ^findings-2024-05
Methodology details. ^method-data-collection  
Contact information. ^contacts-updated
```

#### Creating Reference Notes
Build "index" notes that link to everything:
```markdown
# Research Index

## Active Projects
- [[project-alpha]] - AI ethics framework
- [[project-beta]] - User experience study

## Methodologies  
- ![[methods.md#quantitative|Quantitative Approaches]]
- ![[methods.md#qualitative|Qualitative Approaches]]

## Key Findings
- ![[findings-2024.md#breakthrough]]
- ![[user-study.md#main-insights]]
```

#### Mixing Notebooks and Markdown
```markdown
# Analysis Report

## Data Processing
See the full analysis in [[data-cleaning.ipynb]]

## Key Results
![[results-summary.md#main-findings]]

## Visualization
The charts in [[visualization.ipynb]] show the trends.
```

### 🚀 **Getting Started Workflow**

1. **Create your first note**: Start with `start.md` or `index.md`
2. **Add some structure**: Use headings and mark important content with `^block-ids`
3. **Create connections**: Link related concepts with `[[wikilinks]]`
4. **Embed key content**: Use `![[embeds]]` for reusable information
5. **Explore and connect**: Use search (`Alt+F`) and backlinks (`Alt+B`) to discover connections
6. **Iterate and grow**: Keep adding notes and connections as your knowledge grows

This extension turns JupyterLite into a powerful tool for building and navigating your personal knowledge network!

## Architecture

The extension is built as a collection of JupyterLab plugins that work together:

- **markdown-preview**: Auto-opens preview for .md files
- **wikilinks**: Handles wikilink parsing and rendering
- **wikilink-completer**: Provides auto-completion for wikilinks
- **backlinks**: Tracks and displays backlinks
- **notebook-embed**: Handles notebook cell embedding
- **search**: Provides full-text search functionality

