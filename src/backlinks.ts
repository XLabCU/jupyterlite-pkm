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
 * Widget to display backlinks in a side panel
 */
class BacklinksPanelWidget extends Widget {
  private _backlinks: Backlink[] = [];
  private _currentPath: string = '';
  private _container!: HTMLDivElement;

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
    this.setupTracking();
    
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

  private setupTracking(): void {
    // Track when user switches between files
    this.editorTracker.currentChanged.connect(this.handleCurrentChanged, this);
    this.markdownTracker.currentChanged.connect(this.handleCurrentChanged, this);
    this.notebookTracker.currentChanged.connect(this.handleCurrentChanged, this);
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
    this._container.innerHTML = '';

    if (!this._currentPath) {
      this._container.innerHTML = '<div class="jp-pkm-backlinks-empty">No file selected</div>';
      console.log('Backlinks: No current path, showing empty state');
      return;
    }

    const currentFileName = (() => {
      const fullName = this._currentPath.split('/').pop() || '';
      if (fullName.endsWith('.ipynb')) {
        return fullName; // Keep full name for notebooks
      }
      return fullName.replace(/\.[^/.]+$/, ''); // Strip extension for markdown
    })();
    console.log('Backlinks: Looking for backlinks to file:', currentFileName);
    
    this.searchForBacklinks(currentFileName);
  }

  private async searchForBacklinks(currentFileName: string): Promise<void> {
    const backlinks: Backlink[] = [];
    
    try {
      // Get all markdown and notebook files recursively
      const allFiles = await this.getAllMarkdownAndNotebookFiles('');
      console.log(`Backlinks: Found ${allFiles.length} total files to search`);
      
      const promises = allFiles.map(async (filePath: string) => {
        try {
          const fileName = filePath.split('/').pop() || '';
          console.log(`Backlinks: Processing file ${fileName} for links to ${currentFileName}`);
          const content = await this.docManager.services.contents.get(filePath, { content: true });
          console.log(`Backlinks: Successfully got content for ${fileName}`, typeof content.content);
          
          let textContent = '';
          if (fileName.endsWith('.md')) {
            // Handle different content formats that JupyterLab might return
            if (typeof content.content === 'string') {
              textContent = content.content;
            } else if (content.content && typeof content.content === 'object') {
              // If content is an object, try to extract text
              textContent = JSON.stringify(content.content);
              console.log(`Backlinks: ${fileName} content is object:`, content.content);
            } else {
              console.log(`Backlinks: ${fileName} unexpected content format:`, content);
              textContent = '';
            }
            console.log(`Backlinks: ${fileName} is markdown, content type:`, typeof textContent, 'length:', textContent ? textContent.length : 'null');
          } else if (fileName.endsWith('.ipynb')) {
            textContent = this.extractNotebookText(content.content);
          }
          
          console.log(`Backlinks: File ${fileName} content length: ${textContent.length}`);
          console.log(`Backlinks: File ${fileName} contains '[[start]]':`, textContent.includes('[[start]]'));
          console.log(`Backlinks: File ${fileName} contains '[[${currentFileName}]]':`, textContent.includes(`[[${currentFileName}]]`));
          
          // Simple test - log first 200 characters to see if content is real
          console.log(`Backlinks: First 200 chars of ${fileName}:`, textContent.substring(0, 200));
          
          const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
          let match;
          let matchCount = 0;
          const fileBacklinks: Backlink[] = [];
          
          while ((match = wikilinkRegex.exec(textContent)) !== null) {
            matchCount++;
            const linkText = match[1];
            const [targetFile] = linkText.split('|');
            const targetFileName = targetFile.trim();
            
            console.log(`Backlinks: Found wikilink in ${fileName}: [[${linkText}]] -> target: "${targetFileName}" (looking for: "${currentFileName}")`);
            
            if (targetFileName === currentFileName) {
              const lineNumber = textContent.substring(0, match.index).split('\n').length;
              const newBacklink = {
                sourceFile: filePath,
                targetFile: this._currentPath,
                context: this.extractContext(textContent, match.index),
                lineNumber
              };
              console.log(`Backlinks: FOUND MATCH! Adding backlink:`, newBacklink);
              fileBacklinks.push(newBacklink);
            }
          }
          
          console.log(`Backlinks: File ${fileName} processed. Found ${matchCount} total wikilinks, ${fileBacklinks.length} backlinks.`);
          return fileBacklinks;
        } catch (error) {
          console.warn(`Could not read file ${filePath}:`, error);
          return [];
        }
      });
      
      console.log('Backlinks: Waiting for all file processing to complete...');
      const allFileBacklinks = await Promise.all(promises);
      console.log('Backlinks: All promises resolved, processing results...');
      
      // Flatten the array of arrays
      for (const fileBacklinks of allFileBacklinks) {
        if (fileBacklinks && fileBacklinks.length > 0) {
          console.log('Backlinks: Adding', fileBacklinks.length, 'backlinks from a file');
          backlinks.push(...fileBacklinks);
        }
      }
      
      console.log('Backlinks: Found', backlinks.length, 'backlinks:', backlinks);
      this._backlinks = backlinks;
      this.renderBacklinks();
      
    } catch (error) {
      console.error('Error getting file listing:', error);
      this._container.innerHTML = '<div class="jp-pkm-backlinks-empty">Error loading backlinks</div>';
    }
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
      console.warn(`Could not read directory ${path}:`, error);
    }
    
    return files;
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

    // Add to command palette
    if (palette) {
      palette.addItem({
        command: COMMAND_TOGGLE_BACKLINKS,
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