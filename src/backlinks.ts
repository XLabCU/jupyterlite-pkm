import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette, MainAreaWidget } from '@jupyterlab/apputils';
import { IEditorTracker } from '@jupyterlab/fileeditor';
import { IMarkdownViewerTracker } from '@jupyterlab/markdownviewer';
import { INotebookTracker } from '@jupyterlab/notebook';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { Widget } from '@lumino/widgets';

const COMMAND_TOGGLE_BACKLINKS = 'pkm:toggle-backlinks-panel';
const WIKILINK_INDEX_FILE = 'wikilink-index.json';

/**
 * Interface for backlink information
 */
interface Backlink {
  sourceFile: string;
  targetFile: string;
  context: string;
  lineNumber: number;
}

/**
 * Interface for the wikilink index structure
 */
interface WikilinkIndex {
  links: { [sourceFile: string]: string[] };
  backlinks: { [targetFile: string]: string[] };
  contexts: { [key: string]: { context: string; lineNumber: number } }; // key: "sourceFile->targetFile"
  lastUpdated: string;
}

/**
 * Widget to display backlinks in a side panel
 */
class BacklinksPanelWidget extends Widget {
  private _backlinks: Backlink[] = [];
  private _currentPath: string = '';
  private _container!: HTMLDivElement;
  private _wikilinkIndex: WikilinkIndex | null = null;

  constructor(
    private docManager: IDocumentManager,
    private editorTracker: IEditorTracker,
    private markdownTracker: IMarkdownViewerTracker,
    private notebookTracker: INotebookTracker
  ) {
    super();
    this.addClass('jp-pkm-backlinks-panel');
    this.title.label = 'Backlinks';
    this.title.closable = true;
    this.title.iconClass = 'jp-MaterialIcon jp-LinkIcon';
    
    this.createUI();
    this.loadWikilinkIndex();
    this.setupTracking();
    this.setupFileWatching();
    
    // Trigger initial update
    setTimeout(() => {
      this.handleCurrentChanged();
    }, 100);
  }

  private createUI(): void {
    this._container = document.createElement('div');
    this._container.className = 'jp-pkm-backlinks-content';
    this._container.style.cssText = `
      padding: 16px;
      height: 100%;
      overflow-y: auto;
      font-family: var(--jp-ui-font-family);
    `;
    this.node.appendChild(this._container);
    
    this.showEmptyState();
  }

  private async loadWikilinkIndex(): Promise<void> {
    try {
      console.log('Backlinks: Loading wikilink index...');
      const indexContent = await this.docManager.services.contents.get(WIKILINK_INDEX_FILE, { content: true });
      if (typeof indexContent.content === 'string') {
        this._wikilinkIndex = JSON.parse(indexContent.content);
        console.log('Backlinks: Wikilink index loaded successfully');
      }
    } catch (error) {
      console.warn('Backlinks: Could not load wikilink index, building new one...', error);
      await this.buildWikilinkIndex();
    }
  }

  private async buildWikilinkIndex(): Promise<void> {
    console.log('Backlinks: Building wikilink index...');
    
    const index: WikilinkIndex = {
      links: {},
      backlinks: {},
      contexts: {},
      lastUpdated: new Date().toISOString()
    };

    try {
      // Get all markdown and notebook files recursively
      const allFiles = await this.getAllMarkdownAndNotebookFiles('');
      console.log(`Backlinks: Found ${allFiles.length} files to index`);

      for (const filePath of allFiles) {
        try {
          const fileName = filePath.split('/').pop() || '';
          console.log(`Backlinks: Indexing ${filePath}`);
          
          const content = await this.docManager.services.contents.get(filePath, { content: true });
          let textContent = '';
          
          if (fileName.endsWith('.md')) {
            textContent = typeof content.content === 'string' ? content.content : '';
          } else if (fileName.endsWith('.ipynb')) {
            textContent = this.extractNotebookText(content.content);
          }

          // Extract wikilinks from this file
          const wikilinks = this.extractWikilinks(textContent);
          
          if (wikilinks.length > 0) {
            index.links[filePath] = wikilinks.map(link => link.target);
            
            // Build backlinks and contexts
            for (const wikilink of wikilinks) {
              if (!index.backlinks[wikilink.target]) {
                index.backlinks[wikilink.target] = [];
              }
              index.backlinks[wikilink.target].push(filePath);
              
              const contextKey = `${filePath}->${wikilink.target}`;
              index.contexts[contextKey] = {
                context: wikilink.context,
                lineNumber: wikilink.lineNumber
              };
            }
          }
        } catch (error) {
          console.warn(`Backlinks: Error indexing ${filePath}:`, error);
        }
      }

      this._wikilinkIndex = index;
      await this.saveWikilinkIndex();
      console.log('Backlinks: Index built and saved successfully');
      
    } catch (error) {
      console.error('Backlinks: Error building wikilink index:', error);
    }
  }

  private async saveWikilinkIndex(): Promise<void> {
    if (!this._wikilinkIndex) return;
    
    try {
      await this.docManager.services.contents.save(WIKILINK_INDEX_FILE, {
        type: 'file',
        format: 'text',
        content: JSON.stringify(this._wikilinkIndex, null, 2)
      });
      console.log('Backlinks: Wikilink index saved successfully');
    } catch (error) {
      console.error('Backlinks: Error saving wikilink index:', error);
    }
  }

  private extractWikilinks(textContent: string): Array<{target: string, context: string, lineNumber: number}> {
    const wikilinks: Array<{target: string, context: string, lineNumber: number}> = [];
    const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
    let match;

    while ((match = wikilinkRegex.exec(textContent)) !== null) {
      const linkText = match[1];
      const [targetFile] = linkText.split('|');
      const target = targetFile.trim();
      const lineNumber = textContent.substring(0, match.index).split('\n').length;
      const context = this.extractContext(textContent, match.index);
      
      wikilinks.push({ target, context, lineNumber });
    }

    return wikilinks;
  }

  private async getAllMarkdownAndNotebookFiles(path: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const listing = await this.docManager.services.contents.get(path, { type: 'directory' });
      
      for (const item of listing.content) {
        if (item.type === 'directory') {
          // Recursively search subdirectories
          const subFiles = await this.getAllMarkdownAndNotebookFiles(item.path);
          files.push(...subFiles);
        } else if (item.type === 'file' && (item.name.endsWith('.md') || item.name.endsWith('.ipynb'))) {
          files.push(item.path);
        }
      }
    } catch (error) {
      console.warn(`Backlinks: Could not read directory ${path}:`, error);
    }
    
    return files;
  }

  private setupTracking(): void {
    // Track when user switches between files
    this.editorTracker.currentChanged.connect(this.handleCurrentChanged, this);
    this.markdownTracker.currentChanged.connect(this.handleCurrentChanged, this);
    this.notebookTracker.currentChanged.connect(this.handleCurrentChanged, this);
  }

  private setupFileWatching(): void {
    // Listen for file saves to update the index
    this.docManager.services.contents.fileChanged.connect(this.handleFileChanged, this);
  }

  private async handleFileChanged(sender: any, change: any): Promise<void> {
    if (!change || !change.newValue || !change.newValue.path) return;
    
    const filePath = change.newValue.path;
    const fileName = filePath.split('/').pop() || '';
    
    // Only process markdown and notebook files
    if (!fileName.endsWith('.md') && !fileName.endsWith('.ipynb')) return;
    
    console.log(`Backlinks: File changed: ${filePath}, updating index...`);
    await this.updateFileInIndex(filePath);
  }

  private async updateFileInIndex(filePath: string): Promise<void> {
    if (!this._wikilinkIndex) {
      await this.buildWikilinkIndex();
      return;
    }

    try {
      // Remove old entries for this file
      delete this._wikilinkIndex.links[filePath];
      
      // Remove old backlinks pointing to this file
      for (const [target, sources] of Object.entries(this._wikilinkIndex.backlinks)) {
        this._wikilinkIndex.backlinks[target] = sources.filter(source => source !== filePath);
        if (this._wikilinkIndex.backlinks[target].length === 0) {
          delete this._wikilinkIndex.backlinks[target];
        }
      }
      
      // Remove old contexts for this file
      for (const contextKey of Object.keys(this._wikilinkIndex.contexts)) {
        if (contextKey.startsWith(`${filePath}->`)) {
          delete this._wikilinkIndex.contexts[contextKey];
        }
      }

      // Re-index this file
      const content = await this.docManager.services.contents.get(filePath, { content: true });
      const fileName = filePath.split('/').pop() || '';
      let textContent = '';
      
      if (fileName.endsWith('.md')) {
        textContent = typeof content.content === 'string' ? content.content : '';
      } else if (fileName.endsWith('.ipynb')) {
        textContent = this.extractNotebookText(content.content);
      }

      const wikilinks = this.extractWikilinks(textContent);
      
      if (wikilinks.length > 0) {
        this._wikilinkIndex.links[filePath] = wikilinks.map(link => link.target);
        
        for (const wikilink of wikilinks) {
          if (!this._wikilinkIndex.backlinks[wikilink.target]) {
            this._wikilinkIndex.backlinks[wikilink.target] = [];
          }
          this._wikilinkIndex.backlinks[wikilink.target].push(filePath);
          
          const contextKey = `${filePath}->${wikilink.target}`;
          this._wikilinkIndex.contexts[contextKey] = {
            context: wikilink.context,
            lineNumber: wikilink.lineNumber
          };
        }
      }

      this._wikilinkIndex.lastUpdated = new Date().toISOString();
      await this.saveWikilinkIndex();
      
      // Refresh backlinks if this affects the current file
      if (this._currentPath) {
        this.updateBacklinks();
      }
      
    } catch (error) {
      console.error(`Backlinks: Error updating index for ${filePath}:`, error);
    }
  }

  private handleCurrentChanged(): void {
    const editorWidget = this.editorTracker.currentWidget;
    const markdownWidget = this.markdownTracker.currentWidget;
    const notebookWidget = this.notebookTracker.currentWidget;
    
    console.log('Backlinks: handleCurrentChanged called');
    console.log('Backlinks: editorWidget:', editorWidget?.context?.path);
    console.log('Backlinks: markdownWidget:', markdownWidget?.context?.path);
    console.log('Backlinks: notebookWidget:', notebookWidget?.context?.path);
    
    const isTargetFile = (path: string): boolean => {
      return path.endsWith('.md') || path.endsWith('.ipynb');
    };

    let currentPath = '';
    let widgetType = '';
    
    // Check which widget represents the currently focused/active document
    // Priority: notebook (if active) > editor (if active) > markdown (if active)
    if (notebookWidget && notebookWidget.context?.path?.endsWith('.ipynb')) {
      currentPath = notebookWidget.context.path;
      widgetType = 'notebook';
    } else if (editorWidget && isTargetFile(editorWidget.context.path)) {
      currentPath = editorWidget.context.path;
      widgetType = 'editor';
    } else if (markdownWidget && markdownWidget.context?.path?.endsWith('.md')) {
      currentPath = markdownWidget.context.path;
      widgetType = 'markdown';
    }

    console.log(`Backlinks: Selected path: "${currentPath}" from ${widgetType} widget`);
    console.log('Backlinks: Previous path:', this._currentPath);
    
    if (currentPath !== this._currentPath) {
      this._currentPath = currentPath;
      console.log('Backlinks: Path changed, updating backlinks for:', currentPath);
      this.updateBacklinks();
    } else {
      console.log('Backlinks: Path unchanged, no update needed');
    }
  }

  private showEmptyState(): void {
    this._container.innerHTML = `
      <div class="jp-pkm-backlinks-empty" style="text-align: center; color: var(--jp-ui-font-color2); margin-top: 40px;">
        <div style="font-size: 24px; margin-bottom: 16px;">🔗</div>
        <div style="margin-bottom: 8px;">No backlinks found</div>
        <div style="font-size: 12px;">Open a markdown or notebook file to see its backlinks</div>
      </div>
    `;
  }

  private updateBacklinks(): void {
    console.log('Backlinks: updateBacklinks called for path:', this._currentPath);
    this._backlinks = [];

    if (!this._currentPath) {
      this.showEmptyState();
      return;
    }

    if (!this._wikilinkIndex) {
      this._container.innerHTML = '<div class="jp-pkm-backlinks-empty">Wikilink index not loaded</div>';
      return;
    }

    // Get the target filename for lookup
    const currentFileName = (() => {
      const fullName = this._currentPath.split('/').pop() || '';
      if (fullName.endsWith('.ipynb')) {
        return fullName; // Keep full name for notebooks
      }
      return fullName.replace(/\.[^/.]+$/, ''); // Strip extension for markdown
    })();

    console.log('Backlinks: Looking for backlinks to file:', currentFileName);

    // Look up backlinks from the index
    const sourceFiles = this._wikilinkIndex.backlinks[currentFileName] || [];
    console.log('Backlinks: Found source files:', sourceFiles);

    this._backlinks = sourceFiles.map(sourceFile => {
      const contextKey = `${sourceFile}->${currentFileName}`;
      const contextData = this._wikilinkIndex!.contexts[contextKey];
      
      return {
        sourceFile,
        targetFile: this._currentPath,
        context: contextData?.context || '',
        lineNumber: contextData?.lineNumber || 1
      };
    });

    console.log('Backlinks: Found', this._backlinks.length, 'backlinks:', this._backlinks);
    this.renderBacklinks();
  }

  private extractNotebookText(notebookContent: any): string {
    if (!notebookContent || !notebookContent.cells || !Array.isArray(notebookContent.cells)) {
      console.log('Backlinks: Invalid notebook content structure');
      return '';
    }

    const markdownCells = notebookContent.cells.filter((cell: any) => cell.cell_type === 'markdown');
    console.log(`Backlinks: Found ${markdownCells.length} markdown cells in notebook`);

    const textParts: string[] = [];
    
    for (const cell of markdownCells) {
      let cellText = '';
      
      if (typeof cell.source === 'string') {
        cellText = cell.source;
      } else if (Array.isArray(cell.source)) {
        cellText = cell.source.join('');
      } else if (cell.source) {
        // Handle any other source format
        cellText = String(cell.source);
      }
      
      if (cellText.trim()) {
        textParts.push(cellText);
      }
    }
    
    const result = textParts.join('\n');
    console.log(`Backlinks: Extracted ${result.length} characters from notebook markdown cells`);
    return result;
  }

  private extractContext(content: string, matchIndex: number): string {
    const lines = content.split('\n');
    const position = content.substring(0, matchIndex).split('\n').length - 1;
    const contextRadius = 1;
    
    const startLine = Math.max(0, position - contextRadius);
    const endLine = Math.min(lines.length - 1, position + contextRadius);
    
    return lines.slice(startLine, endLine + 1).join('\n').trim();
  }

  private renderBacklinks(): void {
    this._container.innerHTML = '';
    
    if (this._backlinks.length === 0) {
      this.showEmptyState();
      return;
    }
    
    const header = document.createElement('div');
    header.className = 'jp-pkm-backlinks-header';
    header.textContent = `Backlinks (${this._backlinks.length})`;
    header.style.cssText = `
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: var(--jp-ui-font-color0);
      border-bottom: 1px solid var(--jp-border-color1);
      padding-bottom: 0.5rem;
    `;
    this._container.appendChild(header);
    
    this._backlinks.forEach(backlink => {
      const item = document.createElement('div');
      item.className = 'jp-pkm-backlinks-item';
      item.style.cssText = `
        margin-bottom: 1rem;
        padding: 0.75rem;
        border: 1px solid var(--jp-border-color1);
        border-radius: 4px;
        background: var(--jp-layout-color1);
        cursor: pointer;
        transition: background-color 0.2s;
      `;
      
      const fileName = document.createElement('div');
      fileName.className = 'jp-pkm-backlinks-filename';
      fileName.textContent = backlink.sourceFile;
      fileName.style.cssText = `
        font-weight: 600;
        color: var(--jp-content-link-color);
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
      `;
      
      const context = document.createElement('div');
      context.className = 'jp-pkm-backlinks-context';
      context.textContent = backlink.context;
      context.style.cssText = `
        color: var(--jp-ui-font-color1);
        font-size: 0.85rem;
        line-height: 1.4;
        white-space: pre-wrap;
      `;
      
      item.addEventListener('click', () => {
        this.docManager.openOrReveal(backlink.sourceFile);
      });
      
      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = 'var(--jp-layout-color2)';
      });
      
      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = 'var(--jp-layout-color1)';
      });
      
      item.appendChild(fileName);
      item.appendChild(context);
      this._container.appendChild(item);
    });
  }

  public refresh(): void {
    console.log('Backlinks: Manual refresh called');
    this.handleCurrentChanged();
  }

  public async rebuildIndex(): Promise<void> {
    console.log('Backlinks: Rebuilding index...');
    await this.buildWikilinkIndex();
    this.updateBacklinks();
  }
}

/**
 * Plugin to display backlinks in a side panel
 */
export const backlinksPlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlite/pkm-extension:backlinks',
  description: 'Display backlinks for markdown and notebook files in a side panel',
  autoStart: true,
  requires: [IEditorTracker, IMarkdownViewerTracker, INotebookTracker, IDocumentManager],
  optional: [ICommandPalette],
  activate: (
    app: JupyterFrontEnd,
    editorTracker: IEditorTracker,
    markdownTracker: IMarkdownViewerTracker,
    notebookTracker: INotebookTracker,
    docManager: IDocumentManager,
    palette: ICommandPalette | null
  ) => {
    console.log('Backlinks plugin activated');

    let backlinksPanel: MainAreaWidget<BacklinksPanelWidget> | null = null;

    // Command to toggle backlinks panel
    app.commands.addCommand(COMMAND_TOGGLE_BACKLINKS, {
      label: 'Toggle Backlinks Panel',
      caption: 'Show or hide the backlinks panel',
      execute: () => {
        if (backlinksPanel && !backlinksPanel.isDisposed) {
          if (backlinksPanel.isVisible) {
            backlinksPanel.close();
          } else {
            app.shell.add(backlinksPanel, 'right');
            app.shell.activateById(backlinksPanel.id);
          }
        } else {
          // Create new backlinks panel
          const widget = new BacklinksPanelWidget(docManager, editorTracker, markdownTracker, notebookTracker);
          backlinksPanel = new MainAreaWidget({ content: widget });
          backlinksPanel.id = 'pkm-backlinks-panel';
          backlinksPanel.title.label = 'Backlinks';
          backlinksPanel.title.closable = true;
          backlinksPanel.title.iconClass = 'jp-MaterialIcon jp-LinkIcon';
          
          app.shell.add(backlinksPanel, 'right');
          app.shell.activateById(backlinksPanel.id);
        }
      }
    });

    // Command to rebuild wikilink index
    app.commands.addCommand('pkm:rebuild-wikilink-index', {
      label: 'Rebuild Wikilink Index',
      caption: 'Rebuild the wikilink index from all files',
      execute: async () => {
        if (backlinksPanel && !backlinksPanel.isDisposed) {
          const widget = backlinksPanel.content as BacklinksPanelWidget;
          await widget.rebuildIndex();
        }
      }
    });

    // Add to command palette
    if (palette) {
      palette.addItem({
        command: COMMAND_TOGGLE_BACKLINKS,
        category: 'PKM'
      });
      
      palette.addItem({
        command: 'pkm:rebuild-wikilink-index',
        category: 'PKM'
      });
    }

    // Add keyboard shortcut
    app.commands.addKeyBinding({
      command: COMMAND_TOGGLE_BACKLINKS,
      keys: ['Alt B'],
      selector: 'body'
    });

    // Add CSS for backlinks panel
    const style = document.createElement('style');
    style.textContent = `
      .jp-pkm-backlinks-panel {
        min-width: 250px;
      }
      
      .jp-pkm-backlinks-content {
        font-family: var(--jp-ui-font-family);
      }
      
      .jp-pkm-backlinks-header {
        font-size: 1.1rem;
        font-weight: 600;
        margin-bottom: 1rem;
        color: var(--jp-ui-font-color0);
        border-bottom: 1px solid var(--jp-border-color1);
        padding-bottom: 0.5rem;
      }
      
      .jp-pkm-backlinks-empty {
        color: var(--jp-ui-font-color2);
        font-style: italic;
        text-align: center;
        padding: 2rem 1rem;
      }
      
      .jp-pkm-backlinks-item {
        margin-bottom: 1rem;
        padding: 0.75rem;
        border: 1px solid var(--jp-border-color1);
        border-radius: 4px;
        background: var(--jp-layout-color1);
        cursor: pointer;
        transition: background-color 0.2s;
      }
      
      .jp-pkm-backlinks-item:hover {
        background: var(--jp-layout-color2);
      }
      
      .jp-pkm-backlinks-filename {
        font-weight: 600;
        color: var(--jp-content-link-color);
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
      }
      
      .jp-pkm-backlinks-context {
        color: var(--jp-ui-font-color1);
        font-size: 0.85rem;
        line-height: 1.4;
        white-space: pre-wrap;
      }
    `;
    document.head.appendChild(style);
  }
};