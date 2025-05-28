import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { IEditorTracker } from '@jupyterlab/fileeditor';
import { IMarkdownViewerTracker } from '@jupyterlab/markdownviewer';
import { INotebookTracker } from '@jupyterlab/notebook';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';

/**
 * Regular expression for notebook embed syntax
 */
const NOTEBOOK_EMBED_REGEX = /!\[\[([^#\]]+\.ipynb)#([^\]]+)\]\]/g;

/**
 * Plugin to handle notebook block embedding
 */
export const notebookEmbedPlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlite/pkm-extension:notebook-embed',
  description: 'Embed notebook cells in markdown files',
  autoStart: true,
  requires: [
    IEditorTracker,
    IMarkdownViewerTracker,
    INotebookTracker,
    IDocumentManager,
    IRenderMimeRegistry
  ],
  activate: (
    app: JupyterFrontEnd,
    editorTracker: IEditorTracker,
    markdownTracker: IMarkdownViewerTracker,
    notebookTracker: INotebookTracker,
    docManager: IDocumentManager,
    rendermime: IRenderMimeRegistry
  ) => {
    console.log('Notebook embed plugin activated');

    // For now, we'll just add the CSS and leave the embedding functionality
    // as a placeholder since it requires more complex integration
    
    // Add CSS for embedded cells
    const style = document.createElement('style');
    style.textContent = `
      .pkm-embedded-cell {
        margin: 1rem 0;
        border: 1px solid var(--jp-border-color2);
        border-radius: 4px;
        overflow: hidden;
      }
      
      .pkm-embedded-cell-header {
        background-color: var(--jp-layout-color2);
        padding: 0.5rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.875rem;
      }
      
      .pkm-embedded-cell-source {
        color: var(--jp-ui-font-color2);
      }
      
      .pkm-embedded-cell-status {
        color: var(--jp-ui-font-color3);
        font-style: italic;
      }
      
      .pkm-embedded-cell-status.modified {
        color: var(--jp-warn-color1);
      }
      
      .pkm-embedded-cell-content {
        border: none !important;
      }
      
      .pkm-notebook-embed-placeholder {
        margin: 1rem 0;
      }
      
      .pkm-embed-loading {
        padding: 1rem;
        background-color: var(--jp-layout-color1);
        border: 1px dashed var(--jp-border-color2);
        border-radius: 4px;
        color: var(--jp-ui-font-color2);
        text-align: center;
      }
    `;
    document.head.appendChild(style);

    // Log when notebook embeds are found in markdown
    markdownTracker.widgetAdded.connect((sender, widget) => {
      widget.context.ready.then(() => {
        widget.content.ready.then(() => {
          const content = widget.content.node.textContent || '';
          const matches = content.match(NOTEBOOK_EMBED_REGEX);
          if (matches) {
            console.log('Found notebook embeds:', matches);
          }
        });
      });
    });
  }
};