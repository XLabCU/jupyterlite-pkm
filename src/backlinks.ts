import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { IEditorTracker } from '@jupyterlab/fileeditor';
import { IMarkdownViewerTracker } from '@jupyterlab/markdownviewer';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { Contents } from '@jupyterlab/services';
import { Widget, Panel } from '@lumino/widgets';
import { Message } from '@lumino/messaging';

/**
 * Interface for backlink information
 */
interface Backlink {
  sourcePath: string;
  sourceTitle: string;
  linkText: string;
}

/**
 * Widget to display backlinks
 */
class BacklinksWidget extends Panel {
  private _backlinks: Backlink[] = [];
  private _currentPath: string = '';

  constructor(private docManager: IDocumentManager) {
    super();
    this.addClass('pkm-backlinks-widget');
    this.title.label = 'Backlinks';
    this.title.closable = false;
  }

  get currentPath(): string {
    return this._currentPath;
  }

  set currentPath(value: string) {
    this._currentPath = value;
    this.updateBacklinks();
  }

  private async updateBacklinks(): Promise<void> {
    if (!this._currentPath || !this._currentPath.endsWith('.md')) {
      this._backlinks = [];
      this.update();
      return;
    }

    const backlinks = await this.findBacklinks(this._currentPath);
    this._backlinks = backlinks;
    this.update();
  }

  private async findBacklinks(targetPath: string): Promise<Backlink[]> {
    const contents = this.docManager.services.contents;
    const backlinks: Backlink[] = [];
    
    // Get target filename without extension
    const targetName = targetPath.split('/').pop()!.slice(0, -3);
    
    // Regular expression to find wikilinks pointing to this file
    const linkRegex = new RegExp(`\\[\\[${targetName}(?:\\|([^\\]]+))?\\]\\]`, 'g');

    async function searchInFile(filePath: string): Promise<void> {
      if (filePath === targetPath || !filePath.endsWith('.md')) {
        return;
      }

      try {
        const file = await contents.get(filePath, { content: true });
        if (file.type === 'file' && file.content) {
          const content = file.content as string;
          let match;
          
          while ((match = linkRegex.exec(content)) !== null) {
            backlinks.push({
              sourcePath: filePath,
              sourceTitle: filePath.split('/').pop()!.slice(0, -3),
              linkText: match[1] || targetName
            });
          }
        }
      } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
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
          if (item.type === 'file' && item.name.endsWith('.md')) {
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
    return backlinks;
  }

  protected onUpdateRequest(msg: Message): void {
    // Clear existing content
    this.node.innerHTML = '';

    if (this._backlinks.length === 0) {
      const noBacklinks = document.createElement('div');
      noBacklinks.className = 'pkm-backlinks-empty';
      noBacklinks.textContent = 'No backlinks found';
      this.node.appendChild(noBacklinks);
      return;
    }

    const container = document.createElement('div');
    container.className = 'pkm-backlinks-container';

    const header = document.createElement('h3');
    header.className = 'pkm-backlinks-header';
    header.textContent = `Backlinks (${this._backlinks.length})`;
    container.appendChild(header);

    const list = document.createElement('ul');
    list.className = 'pkm-backlinks-list';

    for (const backlink of this._backlinks) {
      const item = document.createElement('li');
      item.className = 'pkm-backlinks-item';

      const link = document.createElement('a');
      link.className = 'pkm-backlinks-link';
      link.href = '#';
      link.textContent = backlink.sourceTitle;
      link.title = backlink.sourcePath;
      
      link.addEventListener('click', async (event) => {
        event.preventDefault();
        await this.docManager.openOrReveal(backlink.sourcePath);
      });

      item.appendChild(link);
      list.appendChild(item);
    }

    container.appendChild(list);
    this.node.appendChild(container);
  }
}

/**
 * Plugin to display backlinks
 */
export const backlinksPlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlite/pkm-extension:backlinks',
  description: 'Display backlinks for markdown files',
  autoStart: true,
  requires: [IEditorTracker, IMarkdownViewerTracker, IDocumentManager],
  activate: (
    app: JupyterFrontEnd,
    editorTracker: IEditorTracker,
    markdownTracker: IMarkdownViewerTracker,
    docManager: IDocumentManager
  ) => {
    console.log('Backlinks plugin activated');

    // Track backlinks widgets for each markdown viewer
    const backlinksWidgets = new Map<Widget, BacklinksWidget>();

    // Add backlinks to markdown viewers
    markdownTracker.widgetAdded.connect((sender, widget) => {
      const path = widget.context.path;
      
      if (path.endsWith('.md')) {
        // Create backlinks widget
        const backlinksWidget = new BacklinksWidget(docManager);
        backlinksWidget.currentPath = path;
        
        // Add to the bottom of the viewer
        const markdownViewer = widget.node.querySelector('.jp-RenderedMarkdown');
        if (markdownViewer) {
          const container = document.createElement('div');
          container.className = 'pkm-backlinks-section';
          markdownViewer.appendChild(container);
          
          Widget.attach(backlinksWidget, container);
          backlinksWidgets.set(widget, backlinksWidget);
        }
      }
    });

    // Clean up when viewer is closed
    markdownTracker.currentChanged.connect((sender, widget) => {
      if (!widget) {
        // Widget was closed - clean up any orphaned backlinks widgets
        for (const [viewer, backlinksWidget] of backlinksWidgets) {
          if (viewer.isDisposed) {
            backlinksWidget.dispose();
            backlinksWidgets.delete(viewer);
          }
        }
      }
    });

    // Update backlinks when files change
    docManager.services.contents.fileChanged.connect(async (sender, change) => {
      if (change.type === 'save' && change.newValue && change.newValue.path && change.newValue.path.endsWith('.md')) {
        // Update all open backlinks widgets
        for (const [, backlinksWidget] of backlinksWidgets) {
          // Access the private method through type assertion
          await (backlinksWidget as any).updateBacklinks();
        }
      }
    });

    // Add CSS for backlinks
    const style = document.createElement('style');
    style.textContent = `
      .pkm-backlinks-section {
        margin-top: 2rem;
        padding-top: 1rem;
        border-top: 1px solid var(--jp-border-color1);
      }
      
      .pkm-backlinks-widget {
        padding: 1rem;
      }
      
      .pkm-backlinks-header {
        font-size: 1.1rem;
        margin-bottom: 0.5rem;
        color: var(--jp-ui-font-color0);
      }
      
      .pkm-backlinks-empty {
        color: var(--jp-ui-font-color2);
        font-style: italic;
      }
      
      .pkm-backlinks-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      
      .pkm-backlinks-item {
        margin-bottom: 0.25rem;
      }
      
      .pkm-backlinks-link {
        color: var(--jp-content-link-color);
        text-decoration: none;
      }
      
      .pkm-backlinks-link:hover {
        text-decoration: underline;
      }
    `;
    document.head.appendChild(style);
  }
};