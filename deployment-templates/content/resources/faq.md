# Frequently Asked Questions

## Navigation

### How do I navigate between notes?

Click any blue [[start|wiki-style link]] to open that note. Links are created with double brackets: `[[note-name]]`.

### What does a red link mean?

A red link means the target note doesn't exist yet. Click it to create a new note with that name.

### How do I switch between editing and previewing?

Press **Alt+M** to toggle between edit mode (raw markdown) and preview mode (rendered output).

### How do I search for something?

Press **Alt+F** to open the search panel, then type your query.

### How do I see what links to the current note?

Press **Alt+B** to open the backlinks panel on the right side.

## Notebooks

### How do I run a code cell?

Click inside the cell and press **Shift+Enter** to run it and move to the next cell, or **Ctrl+Enter** to run it and stay in place.

### Can I use R instead of Python?

Yes! When creating a new notebook, select the "R (webR)" kernel. Note that WebR loads R packages via WebAssembly, so the first run may be slower.

### How do I install Python packages?

In a code cell, use:

```python
import micropip
await micropip.install("package-name")
```

Note: Only packages available in Pyodide can be installed. See the [Pyodide packages list](https://pyodide.org/en/stable/usage/packages-in-pyodide.html).

### How do I install R packages?

In an R code cell:

```r
webr::install("package-name")
library(package-name)
```

## Saving and Data

### Is my work saved automatically?

Yes. Markdown files are auto-saved after 2 seconds of inactivity. Notebooks save when you run a cell.

### Where is my data stored?

All data is stored in your browser's local storage (IndexedDB). It persists between sessions unless you clear your browser data.

### How do I export my notes?

Press **Alt+E** or use the command palette (Ctrl+Shift+C) and search for "PKM: Export All Notes".

### What happens if I clear my browser data?

All your notes and notebooks will be lost. Use the export feature to back up your work regularly.

## Creating Content

### How do I create a new note?

1. Right-click in the file browser and select "New File"
2. Name it with a `.md` extension (e.g., `my-note.md`)
3. Or click a red (broken) wikilink to create a note automatically

### How do I link to another note?

In edit mode, type `[[` followed by the note name:

```markdown
See [[other-note]] for more details.
See [[other-note|custom display text]] for aliased links.
```

### How do I embed content from another note?

Use the block embedding syntax:

```markdown
![[source-note#Heading Name]]     Embed a section by heading
![[source-note#^block-id]]        Embed a block by ID
![[notebook.ipynb#cell:0]]        Embed a full notebook cell
![[notebook.ipynb#cell:0:code]]   Embed code only
![[notebook.ipynb#cell:0:output]] Embed output only
```

---

**Back to:** [[../start|Home]] | [[glossary|Glossary]] | [[cheatsheet|Cheatsheet]]
