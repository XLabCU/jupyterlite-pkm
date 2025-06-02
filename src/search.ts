import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette, MainAreaWidget } from '@jupyterlab/apputils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { Contents } from '@jupyterlab/services';
import { Panel } from '@lumino/widgets';

const COMMAND_SEARCH = 'pkm:search-notes';

/**
 * Search result interface
 */
interface SearchResult {
  path: string;
  title: string;
  matches: Array<{
    line: number;
    text: string;
    matchStart: number;
    matchEnd: number;
  }>;
}

/**
 * Search widget for PKM
 */
class SearchWidget extends Panel {
  private searchInput!: HTMLInputElement;
  private resultsContainer!: HTMLDivElement;

  constructor(private docManager: IDocumentManager) {
    super();
    this.addClass('pkm-search-widget');
    this.title.label = 'Search Notes';
    this.title.closable = true;

    this.createUI();
  }

  private createUI(): void {
    // Search input
    const searchContainer = document.createElement('div');
    searchContainer.className = 'pkm-search-container';

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.placeholder = 'Search in all notes...';
    this.searchInput.className = 'pkm-search-input';
    
    const searchButton = document.createElement('button');
    searchButton.textContent = 'Search';
    searchButton.className = 'pkm-search-button';

    searchContainer.appendChild(this.searchInput);
    searchContainer.appendChild(searchButton);

    // Results container
    this.resultsContainer = document.createElement('div');
    this.resultsContainer.className = 'pkm-search-results';

    // Add to widget
    this.node.appendChild(searchContainer);
    this.node.appendChild(this.resultsContainer);

    // Event handlers
    const performSearch = () => {
      const query = this.searchInput.value.trim();
      if (query) {
        this.search(query);
      }
    };

    searchButton.addEventListener('click', performSearch);
    this.searchInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        performSearch();
      }
    });
  }

  private async search(query: string): Promise<void> {
    this.resultsContainer.innerHTML = '<div class="pkm-search-loading">Searching...</div>';
    
    try {
      const results = await this.searchInFiles(query);
      this.displayResults(results);
    } catch (error) {
      console.error('Search error:', error);
      this.resultsContainer.innerHTML = '<div class="pkm-search-error">Search failed</div>';
    }
  }

  private async searchInFiles(query: string): Promise<SearchResult[]> {
    const contents = this.docManager.services.contents;
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();

    async function searchInFile(path: string): Promise<void> {
      const fileName = path.split('/').pop()!;
      const fileNameLower = fileName.toLowerCase();
      const matches: SearchResult['matches'] = [];
      
      // Check if filename contains the query
      if (fileNameLower.includes(queryLower)) {
        matches.push({
          line: 0,
          text: `[Filename match: ${fileName}]`,
          matchStart: fileNameLower.indexOf(queryLower),
          matchEnd: fileNameLower.indexOf(queryLower) + query.length
        });
      }

      try {
        const file = await contents.get(path, { content: true });
        if (file.type === 'file' && file.content) {
          
          // Handle markdown files
          if (path.endsWith('.md')) {
            const content = file.content as string;
            const lines = content.split('\n');

            lines.forEach((line, index) => {
              const lineLower = line.toLowerCase();
              let matchIndex = lineLower.indexOf(queryLower);
              
              while (matchIndex !== -1) {
                matches.push({
                  line: index + 1,
                  text: line,
                  matchStart: matchIndex,
                  matchEnd: matchIndex + query.length
                });
                
                matchIndex = lineLower.indexOf(queryLower, matchIndex + 1);
              }
            });
          }
          
          // Handle notebook files
          else if (path.endsWith('.ipynb')) {
            const notebook = file.content as any;
            if (notebook.cells && Array.isArray(notebook.cells)) {
              notebook.cells.forEach((cell: any, cellIndex: number) => {
                if (cell.source) {
                  const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
                  const lines = source.split('\n');
                  
                  lines.forEach((line: string, lineIndex: number) => {
                    const lineLower = line.toLowerCase();
                    let matchIndex = lineLower.indexOf(queryLower);
                    
                    while (matchIndex !== -1) {
                      matches.push({
                        line: cellIndex + 1, // Using cell index as "line" for notebooks
                        text: `[Cell ${cellIndex + 1}] ${line}`,
                        matchStart: matchIndex + 9 + cellIndex.toString().length, // Account for [Cell X] prefix
                        matchEnd: matchIndex + 9 + cellIndex.toString().length + query.length
                      });
                      
                      matchIndex = lineLower.indexOf(queryLower, matchIndex + 1);
                    }
                  });
                }
              });
            }
          }

          if (matches.length > 0) {
            const title = fileName.endsWith('.md') ? fileName.slice(0, -3) : 
                         fileName.endsWith('.ipynb') ? fileName.slice(0, -6) : fileName;
            results.push({
              path,
              title,
              matches
            });
          }
        }
      } catch (error) {
        console.error(`Error searching file ${path}:`, error);
      }
    }

    async function searchDirectory(path: string): Promise<void> {
      try {
        const listing = await contents.get(path, { content: true });
        
        if (listing.type !== 'directory' || !listing.content) {
          return;
        }

        const promises: Promise<void>[] = [];
        
        for (const item of listing.content as Contents.IModel[]) {
          if (item.type === 'file' && (item.name.endsWith('.md') || item.name.endsWith('.ipynb'))) {
            promises.push(searchInFile(item.path));
          } else if (item.type === 'directory') {
            promises.push(searchDirectory(item.path));
          }
        }
        
        await Promise.all(promises);
      } catch (error) {
        console.error(`Error searching directory ${path}:`, error);
      }
    }

    await searchDirectory('');
    return results;
  }

  private displayResults(results: SearchResult[]): void {
    if (results.length === 0) {
      this.resultsContainer.innerHTML = '<div class="pkm-search-no-results">No results found</div>';
      return;
    }

    this.resultsContainer.innerHTML = '';
    
    const summary = document.createElement('div');
    summary.className = 'pkm-search-summary';
    summary.textContent = `Found ${results.length} files with matches`;
    this.resultsContainer.appendChild(summary);

    results.forEach(result => {
      const resultItem = document.createElement('div');
      resultItem.className = 'pkm-search-result-item';

      const header = document.createElement('div');
      header.className = 'pkm-search-result-header';
      
      const title = document.createElement('a');
      title.href = '#';
      title.className = 'pkm-search-result-title';
      title.textContent = result.title;
      title.addEventListener('click', async (event) => {
        event.preventDefault();
        await this.docManager.openOrReveal(result.path);
      });
      
      header.appendChild(title);
      
      const matchCount = document.createElement('span');
      matchCount.className = 'pkm-search-match-count';
      matchCount.textContent = `(${result.matches.length} matches)`;
      header.appendChild(matchCount);

      resultItem.appendChild(header);

      // Show first few matches
      const matchList = document.createElement('ul');
      matchList.className = 'pkm-search-match-list';
      
      result.matches.slice(0, 3).forEach(match => {
        const matchItem = document.createElement('li');
        matchItem.className = 'pkm-search-match-item';
        
        // Highlight the match
        const before = match.text.substring(0, match.matchStart);
        const matched = match.text.substring(match.matchStart, match.matchEnd);
        const after = match.text.substring(match.matchEnd);
        
        matchItem.innerHTML = `
          <span class="pkm-search-line-number">Line ${match.line}:</span>
          <span class="pkm-search-match-text">
            ${this.escapeHtml(before)}<mark>${this.escapeHtml(matched)}</mark>${this.escapeHtml(after)}
          </span>
        `;
        
        matchList.appendChild(matchItem);
      });
      
      if (result.matches.length > 3) {
        const more = document.createElement('li');
        more.className = 'pkm-search-more-matches';
        more.textContent = `...and ${result.matches.length - 3} more matches`;
        matchList.appendChild(more);
      }
      
      resultItem.appendChild(matchList);
      this.resultsContainer.appendChild(resultItem);
    });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  focus(): void {
    this.searchInput.focus();
  }
}

/**
 * Plugin for full-text search
 */
export const searchPlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlite/pkm-extension:search',
  description: 'Full-text search for markdown and notebook files',
  autoStart: true,
  requires: [IDocumentManager],
  optional: [ICommandPalette],
  activate: (
    app: JupyterFrontEnd,
    docManager: IDocumentManager,
    palette: ICommandPalette | null
  ) => {
    console.log('Search plugin activated');

    // Add search command
    app.commands.addCommand(COMMAND_SEARCH, {
      label: 'PKM: Search Notes',
      execute: () => {
        const widget = new SearchWidget(docManager);
        const main = new MainAreaWidget({ content: widget });
        main.title.label = 'Search Notes';
        main.title.closable = true;
        
        app.shell.add(main, 'main');
        app.shell.activateById(main.id);
        widget.focus();
      }
    });

    // Add to command palette
    if (palette) {
      palette.addItem({
        command: COMMAND_SEARCH,
        category: 'PKM'
      });
    }

    // Add keyboard shortcut
    app.commands.addKeyBinding({
      command: COMMAND_SEARCH,
      keys: ['Alt F'],
      selector: 'body'
    });

    // Add CSS for search
    const style = document.createElement('style');
    style.textContent = `
      .pkm-search-widget {
        padding: 1rem;
        height: 100%;
        overflow-y: auto;
      }
      
      .pkm-search-container {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1rem;
      }
      
      .pkm-search-input {
        flex: 1;
        padding: 0.5rem;
        border: 1px solid var(--jp-border-color1);
        border-radius: 4px;
        font-size: 14px;
      }
      
      .pkm-search-button {
        padding: 0.5rem 1rem;
        background-color: var(--jp-brand-color1);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      
      .pkm-search-button:hover {
        background-color: var(--jp-brand-color2);
      }
      
      .pkm-search-loading,
      .pkm-search-error,
      .pkm-search-no-results {
        text-align: center;
        padding: 2rem;
        color: var(--jp-ui-font-color2);
      }
      
      .pkm-search-summary {
        margin-bottom: 1rem;
        color: var(--jp-ui-font-color2);
        font-size: 0.875rem;
      }
      
      .pkm-search-result-item {
        margin-bottom: 1.5rem;
        padding: 1rem;
        background-color: var(--jp-layout-color1);
        border-radius: 4px;
      }
      
      .pkm-search-result-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
      }
      
      .pkm-search-result-title {
        font-weight: bold;
        color: var(--jp-content-link-color);
        text-decoration: none;
      }
      
      .pkm-search-result-title:hover {
        text-decoration: underline;
      }
      
      .pkm-search-match-count {
        font-size: 0.875rem;
        color: var(--jp-ui-font-color2);
      }
      
      .pkm-search-match-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      
      .pkm-search-match-item {
        margin-bottom: 0.25rem;
        font-size: 0.875rem;
        color: var(--jp-ui-font-color1);
      }
      
      .pkm-search-line-number {
        color: var(--jp-ui-font-color2);
        margin-right: 0.5rem;
      }
      
      .pkm-search-match-text {
        font-family: var(--jp-code-font-family);
      }
      
      .pkm-search-match-text mark {
        background-color: var(--jp-warn-color2);
        padding: 0 2px;
      }
      
      .pkm-search-more-matches {
        color: var(--jp-ui-font-color2);
        font-style: italic;
      }
    `;
    document.head.appendChild(style);
  }
};