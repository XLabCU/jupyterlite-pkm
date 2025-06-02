import { IEditorTracker } from '@jupyterlab/fileeditor';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { Contents } from '@jupyterlab/services';

/**
 * Interface for file info used in autocomplete
 */
interface FileInfo {
  name: string;
  path: string;
  type: 'md' | 'ipynb' | 'other';
}

/**
 * Collect all linkable files in the workspace (.md and .ipynb)
 */
async function getAllLinkableFiles(
  docManager: IDocumentManager
): Promise<FileInfo[]> {
  const contents = docManager.services.contents;
  const files: FileInfo[] = [];

  async function collectFiles(path: string) {
    try {
      const listing = await contents.get(path, { content: true });
      
      if (listing.type !== 'directory' || !listing.content) {
        return;
      }

      for (const item of listing.content as Contents.IModel[]) {
        if (item.type === 'file' || item.type === 'notebook') {
          if (item.name.endsWith('.md')) {
            // Store filename without extension for .md files
            const nameWithoutExt = item.name.slice(0, -3);
            files.push({
              name: nameWithoutExt,
              path: item.path,
              type: 'md'
            });
          } else if (item.name.endsWith('.ipynb')) {
            // Store full filename for .ipynb files (extension required for linking)
            files.push({
              name: item.name,
              path: item.path,
              type: 'ipynb'
            });
          }
        } else if (item.type === 'directory') {
          await collectFiles(item.path);
        }
      }
    } catch (error) {
      console.error(`Error collecting files from ${path}:`, error);
    }
  }

  await collectFiles('');
  return files;
}

/**
 * Create autocomplete dropdown element
 */
function createAutocompleteDropdown(): HTMLElement {
  const dropdown = document.createElement('div');
  dropdown.className = 'pkm-autocomplete-dropdown';
  dropdown.style.cssText = `
    position: absolute;
    background: var(--jp-layout-color1);
    border: 1px solid var(--jp-border-color1);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    max-height: 200px;
    overflow-y: auto;
    z-index: 1000;
    display: none;
    font-family: var(--jp-code-font-family);
    font-size: var(--jp-code-font-size);
  `;
  document.body.appendChild(dropdown);
  return dropdown;
}

/**
 * Position dropdown relative to the [[ position, not cursor
 */
function positionDropdown(dropdown: HTMLElement, editor: any, wikilinkStartColumn: number): void {
  try {
    const position = editor.getCursorPosition();
    
    // Create a temporary position at the start of the wikilink
    const wikilinkPosition = {
      line: position.line,
      column: wikilinkStartColumn
    };
    
    const coords = editor.getCoordinateForPosition(wikilinkPosition);
    const editorRect = editor.host.getBoundingClientRect();
    
    // Ensure coordinates are valid
    if (coords && editorRect) {
      const left = Math.max(0, editorRect.left + (coords.left || 0));
      const top = Math.max(0, editorRect.top + (coords.top || 0));
      
      dropdown.style.left = `${left}px`;
      dropdown.style.top = `${top}px`;
    }
  } catch (error) {
    console.warn('Failed to position dropdown:', error);
    // Fallback positioning
    dropdown.style.left = '100px';
    dropdown.style.top = '100px';
  }
}

/**
 * Setup wikilink auto-completion for markdown editors
 */
export function setupWikilinkCompletion(
  editorTracker: IEditorTracker,
  docManager: IDocumentManager
): void {
  const dropdown = createAutocompleteDropdown();
  let currentEditor: any = null;
  let selectedIndex = 0;
  let suggestions: FileInfo[] = [];
  let cachedFiles: FileInfo[] = [];
  let lastCacheTime = 0;
  const CACHE_DURATION = 5000; // 5 seconds
  let isInWikilinkContext = false;
  let wikilinkStartColumn = 0; // Track where the [[ starts

  // Hide dropdown when clicking elsewhere
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target as Node)) {
      dropdown.style.display = 'none';
      isInWikilinkContext = false;
    }
  });

  // Global keydown handler for autocomplete navigation
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (dropdown.style.display === 'none' || !isInWikilinkContext || !currentEditor) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        event.stopPropagation();
        selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
        updateDropdownSelection();
        break;
      
      case 'ArrowUp':
        event.preventDefault();
        event.stopPropagation();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        updateDropdownSelection();
        break;
      
      case 'Enter':
      case 'Tab':
        if (suggestions.length > 0 && suggestions[selectedIndex]) {
          event.preventDefault();
          event.stopPropagation();
          insertSuggestion(suggestions[selectedIndex]);
        }
        break;
      
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        dropdown.style.display = 'none';
        isInWikilinkContext = false;
        break;
    }
  }, true);

  // Function to get files with caching
  async function getFilesWithCache(): Promise<FileInfo[]> {
    const now = Date.now();
    if (now - lastCacheTime > CACHE_DURATION || cachedFiles.length === 0) {
      console.log('Refreshing file cache...');
      cachedFiles = await getAllLinkableFiles(docManager);
      lastCacheTime = now;
      console.log(`Found ${cachedFiles.length} linkable files:`, 
        cachedFiles.map(f => `${f.name} (${f.type})`));
    }
    return cachedFiles;
  }

  // Monitor for new editor widgets
  editorTracker.widgetAdded.connect(async (sender, widget) => {
    if (!widget.context.path.endsWith('.md')) {
      return;
    }

    const editor = widget.content.editor;
    const model = editor.model;

    // Cleanup function for when widget is disposed
    const cleanup = () => {
      if (currentEditor === editor) {
        dropdown.style.display = 'none';
        currentEditor = null;
        isInWikilinkContext = false;
      }
    };

    // Connect cleanup to widget disposal
    widget.disposed.connect(cleanup);

    // Monitor model changes for autocomplete trigger
    model.sharedModel.changed.connect(async () => {
      // Only process if this editor is currently active
      const activeWidget = editorTracker.currentWidget;
      if (!activeWidget || activeWidget !== widget) {
        return;
      }

      currentEditor = editor;
      const position = editor.getCursorPosition();
      const line = position.line;
      const column = position.column;
      
      // Get only the current line text up to cursor position
      const text = model.sharedModel.getSource();
      const lines = text.split('\n');
      const currentLine = lines[line] || '';
      const beforeCursorOnLine = currentLine.substring(0, column);
      
      // Check if we're in an INCOMPLETE wikilink context
      // Must have [[ before cursor, but NO ]] after the last [[
      const lastOpenBracket = beforeCursorOnLine.lastIndexOf('[[');
      if (lastOpenBracket === -1) {
        dropdown.style.display = 'none';
        isInWikilinkContext = false;
        return;
      }
      
      // Check if there's a ]] after the last [[ but before cursor
      const textAfterLastOpen = beforeCursorOnLine.substring(lastOpenBracket);
      if (textAfterLastOpen.includes(']]')) {
        dropdown.style.display = 'none';
        isInWikilinkContext = false;
        return;
      }
      
      // Extract the prefix after the last [[
      const prefix = textAfterLastOpen.substring(2); // Remove the [[
      
      // Also check that there's no | character (for link aliases)
      if (prefix.includes('|')) {
        dropdown.style.display = 'none';
        isInWikilinkContext = false;
        return;
      }

      isInWikilinkContext = true;
      wikilinkStartColumn = lastOpenBracket; // Store position of [[ for dropdown positioning
      
      console.log('Wikilink context detected:', {
        prefix,
        beforeCursorOnLine,
        lastOpenBracket,
        wikilinkStartColumn,
        textAfterLastOpen,
        line: line,
        column: column
      });
      
      // Get all linkable files (with caching)
      const files = await getFilesWithCache();
      
      // Filter files by prefix
      suggestions = files
        .filter(file => file.name.toLowerCase().includes(prefix.toLowerCase()))
        .sort((a, b) => {
          const aStarts = a.name.toLowerCase().startsWith(prefix.toLowerCase());
          const bStarts = b.name.toLowerCase().startsWith(prefix.toLowerCase());
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return a.name.localeCompare(b.name);
        })
        .slice(0, 10);

      console.log(`Found ${suggestions.length} suggestions for prefix "${prefix}"`);

      if (suggestions.length > 0) {
        selectedIndex = 0;
        showDropdown();
      } else {
        dropdown.style.display = 'none';
        isInWikilinkContext = false;
      }
    });
  });

  function showDropdown(): void {
    dropdown.innerHTML = '';
    
    suggestions.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'pkm-autocomplete-item';
      item.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid var(--jp-border-color2);
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;
      
      const nameSpan = document.createElement('span');
      nameSpan.textContent = file.name;
      nameSpan.style.fontWeight = index === selectedIndex ? 'bold' : 'normal';
      
      const typeSpan = document.createElement('span');
      typeSpan.textContent = file.type === 'ipynb' ? '📓' : '📝';
      typeSpan.style.cssText = `
        font-size: 12px;
        opacity: 0.7;
        margin-left: 8px;
      `;
      
      item.appendChild(nameSpan);
      item.appendChild(typeSpan);
      
      if (index === selectedIndex) {
        item.style.backgroundColor = 'var(--jp-brand-color3)';
      }
      
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Clicked on suggestion:', file.name);
        insertSuggestion(file);
      });
      dropdown.appendChild(item);
    });
    
    dropdown.style.display = 'block';
    if (currentEditor) {
      positionDropdown(dropdown, currentEditor, wikilinkStartColumn);
    }
  }

  function updateDropdownSelection(): void {
    const items = dropdown.querySelectorAll('.pkm-autocomplete-item');
    items.forEach((item, index) => {
      const nameSpan = item.querySelector('span');
      if (nameSpan) {
        nameSpan.style.fontWeight = index === selectedIndex ? 'bold' : 'normal';
      }
      (item as HTMLElement).style.backgroundColor = 
        index === selectedIndex ? 'var(--jp-brand-color3)' : 'transparent';
      
      // Scroll selected item into view
      if (index === selectedIndex) {
        (item as HTMLElement).scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }
    });
  }

  function insertSuggestion(file: FileInfo): void {
    if (!currentEditor) {
      console.warn('No current editor for insertion');
      return;
    }
    
    try {
      const position = currentEditor.getCursorPosition();
      const model = currentEditor.model;
      const text = model.sharedModel.getSource();
      const lines = text.split('\n');
      const currentLine = lines[position.line] || '';
      const beforeCursorOnLine = currentLine.substring(0, position.column);
      
      // Find the last [[ before cursor on current line
      const lastOpenBracket = beforeCursorOnLine.lastIndexOf('[[');
      
      if (lastOpenBracket !== -1) {
        const matchStartOnLine = lastOpenBracket + 2; // +2 to skip the [[
        const replacement = file.name + ']]';
        
        // Calculate the absolute position in the document
        let absoluteOffset = 0;
        for (let i = 0; i < position.line; i++) {
          absoluteOffset += lines[i].length + 1; // +1 for newline
        }
        const absoluteMatchStart = absoluteOffset + matchStartOnLine;
        const absoluteCursorPos = absoluteOffset + position.column;
        
        console.log('Inserting suggestion:', {
          file: file.name,
          line: position.line,
          column: position.column,
          matchStartOnLine,
          absoluteMatchStart,
          absoluteCursorPos,
          replacement,
          lastOpenBracket,
          beforeCursorOnLine
        });
        
        // Simple direct text replacement
        const beforeMatch = text.substring(0, absoluteMatchStart);
        const afterCursor = text.substring(absoluteCursorPos);
        const newText = beforeMatch + replacement + afterCursor;
        
        // Replace entire text content
        model.sharedModel.setSource(newText);
        
        // Position cursor after the inserted text
        const prefixLength = position.column - matchStartOnLine;
        const newColumn = position.column + replacement.length - prefixLength;
        const newPosition = {
          line: position.line,
          column: newColumn
        };
        
        // Set cursor position immediately
        currentEditor.setCursorPosition(newPosition);
        
        console.log('Insertion completed');
      } else {
        console.warn('No wikilink [[ found for insertion');
      }
    } catch (error) {
      console.error('Error inserting suggestion:', error);
    }
    
    dropdown.style.display = 'none';
    isInWikilinkContext = false;
  }
}