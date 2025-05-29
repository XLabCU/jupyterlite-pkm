
⏺ PKM Extension Functionality Summary

  ✅ Core Features Implemented

  1. Wikilinks ([[target]] and [[target|display text]])

  - Basic links: [[notes]] → links to notes.md
  - Display text: [[project-ideas|My Project Ideas]] → shows "My Project Ideas" but links to project-ideas.md
  - Multi-file support: Works with .md, .ipynb, .csv, .json, .geojson files
  - Auto-creation: Clicking non-existent links prompts to create new files
  - Code span protection: Wikilinks inside backticks are ignored

  2. Mode Switching (Alt+M)

  - Toggle between edit and preview modes for markdown files
  - Persistent state: Mode choice is remembered when switching between files
  - Floating toggle button: Visual indicator and easy access
  - Shared state service: Consistent mode across all markdown files

  3. Search (Alt+F)

  - Cross-file search: Searches markdown content and notebook cells
  - Real-time results: Shows matches with context and file locations
  - Keyboard shortcut: Alt+F (changed from Cmd+Shift+F to avoid browser conflicts)

  
  🔧 Technical Architecture

  HTML Sanitization Challenge & Solution

  The most critical technical challenge was JupyterLab's aggressive HTML sanitization:

  Problem:
  - JupyterLab's markdown renderer strips ALL custom attributes (data-target, data-path)
  - Custom href protocols (href="pkm-wikilink:...") are removed
  - Only basic HTML tags, classes, and text content survive

  Solution - Lookup Table Approach:
  // Global mapping survives HTML sanitization (stored in JavaScript, not DOM)
  const wikilinkDisplayToTarget = new Map<string, string>();

  // During HTML generation:
  wikilinkDisplayToTarget.set("My Project Ideas", "project-ideas");
  wikilinkDisplayToTarget.set("My Project Ideas_PATH", "project-ideas.md");

  // During click handling:
  const displayText = link.textContent; // Only thing that survives
  const target = wikilinkDisplayToTarget.get(displayText); // Lookup original target

  Plugin Architecture

  - Modular design: Separate plugins for each feature (wikilinks, backlinks, search, mode switching)
  - Shared state service: Central state management for consistent behavior
  - Lumino widgets: Proper JupyterLab integration using standard widget lifecycle
  - Event-driven: Uses JupyterLab's tracker signals for file change detection

  File Type Support Logic

  const SUPPORTED_EXTENSIONS = ['.md', '.ipynb', '.csv', '.json', '.geojson'];

  // Smart file detection:
  // 1. Check if filename has supported extension
  // 2. Search recursively through directory structure
  // 3. Handle both 'file' and 'notebook' types
  // 4. Default to .md for extensionless links

  Mode Persistence Implementation

  - IPKMState interface: Defines shared state contract
  - Signal-based updates: Reactive state changes across components
  - Factory selection: Dynamically chooses Editor vs Markdown Preview based on current mode
  - Singleton pattern: Single state instance shared across all plugins

  