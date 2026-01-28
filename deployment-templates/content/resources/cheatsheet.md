# Quick Reference Cheatsheet

## PKM Navigation Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+M` | Toggle edit/preview mode |
| `Alt+B` | Show/hide backlinks panel |
| `Alt+F` | Open search |
| `Ctrl+S` | Save current file |

## Wiki Link Syntax

```markdown
[[note-name]]                    # Link to note-name.md
[[folder/note]]                  # Link to note in folder
[[note|Display Text]]            # Link with custom text
[[notebook.ipynb]]               # Link to notebook
[[https://example.com|Website]]  # External link
```

## Block Embedding Syntax

```markdown
![[file#Heading]]               # Embed section by heading
![[file#^block-id]]             # Embed by block ID
![[notebook.ipynb#cell:0]]      # Embed full cell
![[notebook.ipynb#cell:0:code]] # Embed code only
![[notebook.ipynb#cell:0:output]] # Embed output only
```

## Jupyter Shortcuts

| Shortcut | Mode | Action |
|----------|------|--------|
| `Shift+Enter` | Both | Run cell, move to next |
| `Ctrl+Enter` | Both | Run cell, stay in place |
| `Enter` | Command | Enter edit mode |
| `Esc` | Edit | Enter command mode |
| `A` | Command | Insert cell above |
| `B` | Command | Insert cell below |
| `DD` | Command | Delete cell |
| `M` | Command | Change to markdown |
| `Y` | Command | Change to code |

## Python Basics

```python
# Variables
x = 10
name = "Alice"

# Lists
numbers = [1, 2, 3, 4, 5]

# Loops
for i in range(5):
    print(i)

# Functions
def greet(name):
    return f"Hello, {name}!"

# Conditionals
if x > 5:
    print("Big")
else:
    print("Small")
```

## R Basics

```r
# Variables
x <- 10
name <- "Alice"

# Vectors
numbers <- c(1, 2, 3, 4, 5)

# Loops
for (i in 1:5) {
    print(i)
}

# Functions
greet <- function(name) {
    paste("Hello,", name)
}

# Conditionals
if (x > 5) {
    print("Big")
} else {
    print("Small")
}
```

## Common Libraries

### Python
```python
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
```

### R
```r
library(tidyverse)
library(ggplot2)
library(dplyr)
```

---

**Back to:** [[../start|Home]] | [[glossary|Glossary]]
