import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { IEditorTracker } from '@jupyterlab/fileeditor';
import { IMarkdownViewerTracker } from '@jupyterlab/markdownviewer';
import { IRenderMimeRegistry, IRenderMime } from '@jupyterlab/rendermime';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { Dialog, showDialog } from '@jupyterlab/apputils';
import { Contents } from '@jupyterlab/services';
import { setupWikilinkCompletion } from './wikilink-completer';

/**
 * Regular expressions for wikilink parsing
 */
const WIKILINK_REGEX = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
// const NOTEBOOK_EMBED_REGEX = /!\[\[([^#\]]+\.ipynb)#([^\]]+)\]\]/g;

/**
 * Interface for parsed wikilink
 */
interface WikiLink {
  fullMatch: string;
  target: string;
  display?: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Parse wikilinks from text
 */
function parseWikilinks(text: string): WikiLink[] {
  const links: WikiLink[] = [];
  let match;

  WIKILINK_REGEX.lastIndex = 0; // Reset regex state
  while ((match = WIKILINK_REGEX.exec(text)) !== null) {
    links.push({
      fullMatch: match[0],
      target: match[1].trim(),
      display: match[2]?.trim(),
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }

  return links;
}

/**
 * Find markdown file by name across all directories
 */
async function findMarkdownFile(
  docManager: IDocumentManager,
  filename: string
): Promise<string | null> {
  const contents = docManager.services.contents;
  
  // Add .md extension if not present
  const targetName = filename.endsWith('.md') ? filename : `${filename}.md`;

  async function searchDirectory(path: string): Promise<string | null> {
    try {
      const listing = await contents.get(path, { content: true });
      
      if (listing.type !== 'directory' || !listing.content) {
        return null;
      }

      for (const item of listing.content as Contents.IModel[]) {
        if (item.type === 'file' && item.name === targetName) {
          return item.path;
        } else if (item.type === 'directory') {
          const found = await searchDirectory(item.path);
          if (found) {
            return found;
          }
        }
      }
    } catch (error) {
      console.error(`Error searching directory ${path}:`, error);
    }
    
    return null;
  }

  return searchDirectory('');
}

/**
 * Plugin to handle wikilinks in markdown files
 */
export const wikilinkPlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlite/pkm-extension:wikilinks',
  description: 'Handle wikilinks in markdown files',
  autoStart: true,
  requires: [
    IEditorTracker,
    IMarkdownViewerTracker,
    IDocumentManager,
    IRenderMimeRegistry
  ],
  activate: (
    app: JupyterFrontEnd,
    editorTracker: IEditorTracker,
    markdownTracker: IMarkdownViewerTracker,
    docManager: IDocumentManager,
    rendermime: IRenderMimeRegistry
  ) => {
    console.log('Wikilinks plugin activated');

    // Set up wikilink auto-completion
    setupWikilinkCompletion(editorTracker, docManager);

    // Override the default markdown renderer
    const defaultFactory = rendermime.getFactory('text/markdown');
    if (defaultFactory) {
      rendermime.removeMimeType('text/markdown');
      rendermime.addFactory({
        safe: true,
        mimeTypes: ['text/markdown'],
        createRenderer: (options: IRenderMime.IRendererOptions) => {
          const renderer = defaultFactory.createRenderer(options);
          const originalRenderModel = renderer.renderModel.bind(renderer);
          
          renderer.renderModel = async (model: IRenderMime.IMimeModel) => {
            // Ensure model has proper structure
            if (!model || !model.data) {
              console.warn('Invalid model structure:', model);
              return originalRenderModel(model);
            }
            
            // Get the markdown source - handle different data structures
            let source: string;
            if (typeof model.data === 'string') {
              source = model.data;
            } else if (model.data['text/markdown']) {
              source = model.data['text/markdown'] as string;
            } else if (model.data['text/plain']) {
              source = model.data['text/plain'] as string;
            } else {
              console.warn('No markdown content found in model:', model);
              return originalRenderModel(model);
            }
            
            // Parse wikilinks
            const links = parseWikilinks(source);
            
            // Process the markdown to convert wikilinks to standard links
            let processedSource = source;
            let offset = 0;
            
            for (const link of links) {
              const linkPath = await findMarkdownFile(docManager, link.target);
              const displayText = link.display || link.target;
              
              let replacement: string;
              if (linkPath) {
                // File exists - create a clickable link
                replacement = `<a href="#" class="pkm-wikilink" data-path="${linkPath}">${displayText}</a>`;
              } else {
                // File doesn't exist - create a broken link
                replacement = `<a href="#" class="pkm-wikilink pkm-wikilink-broken" data-target="${link.target}">${displayText}</a>`;
              }
              
              const adjustedStart = link.startIndex + offset;
              const adjustedEnd = link.endIndex + offset;
              
              processedSource = 
                processedSource.slice(0, adjustedStart) +
                replacement +
                processedSource.slice(adjustedEnd);
              
              offset += replacement.length - link.fullMatch.length;
            }
            
            // Update the model with processed source - handle metadata
            const processedModel = {
              ...model,
              data: typeof model.data === 'string' ? { 'text/markdown': processedSource } : {
                ...model.data,
                'text/markdown': processedSource
              },
              metadata: model.metadata || {},
              trusted: model.trusted !== undefined ? model.trusted : true
            };
            
            // Render with the original method
            await originalRenderModel(processedModel);
            
            // Add click handlers to wikilinks after rendering
            setTimeout(() => {
              // Check if renderer is still valid and attached
              if (!renderer.node || !renderer.node.isConnected) {
                console.warn('Renderer node is not connected to DOM');
                return;
              }
              
              const node = renderer.node;
              const wikilinks = node.querySelectorAll('.pkm-wikilink');
              
              wikilinks.forEach((link: Element) => {
                // Remove any existing click handlers to prevent duplicates
                const newLink = link.cloneNode(true) as Element;
                link.parentNode?.replaceChild(newLink, link);
                
                newLink.addEventListener('click', async (event: Event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const target = newLink as HTMLAnchorElement;
                  
                  try {
                    if (target.classList.contains('pkm-wikilink-broken')) {
                      // Handle broken link - prompt to create file
                      const targetName = target.dataset.target!;
                      const result = await showDialog({
                        title: 'Create New Note',
                        body: `Create new note "${targetName}"?`,
                        buttons: [
                          Dialog.cancelButton(),
                          Dialog.okButton({ label: 'Create' })
                        ]
                      });
                      
                      if (result.button.accept) {
                        // Get current directory from the current file
                        const currentWidget = markdownTracker.currentWidget || editorTracker.currentWidget;
                        const currentPath = currentWidget?.context.path || '';
                        const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/'));
                        
                        // Create new file
                        const newPath = currentDir ? `${currentDir}/${targetName}.md` : `${targetName}.md`;
                        await docManager.services.contents.save(newPath, {
                          type: 'file',
                          format: 'text',
                          content: `# ${targetName}\n\n`
                        });
                        
                        // Open the new file in the main area (left panel)
                        const widget = await docManager.openOrReveal(newPath, {
                          mode: 'split-left',
                          ref: '_noref'
                        });
                        
                        // Enable auto-save for the new document
                        if (widget && widget.context) {
                          widget.context.model.sharedModel.changed.connect(() => {
                            if (widget.context.model.dirty) {
                              widget.context.save();
                            }
                          });
                        }
                      }
                    } else {
                      // Handle existing link - open the file in the main area (left panel)
                      const path = target.dataset.path!;
                      await docManager.openOrReveal(path, {
                        mode: 'split-left',
                        ref: '_noref'
                      });
                    }
                  } catch (error) {
                    console.error('Error handling wikilink click:', error);
                  }
                });
              });
            }, 100);
          };
          
          return renderer;
        }
      }, 0);
    }

    // Add CSS for wikilinks
    const style = document.createElement('style');
    style.textContent = `
      .pkm-wikilink {
        color: #0969da;
        text-decoration: none;
        cursor: pointer;
      }
      
      .pkm-wikilink:hover {
        text-decoration: underline;
      }
      
      .pkm-wikilink-broken {
        color: #cf222e;
        text-decoration: none;
        cursor: pointer;
      }
      
      .pkm-wikilink-broken:hover {
        text-decoration: underline;
      }
    `;
    document.head.appendChild(style);
  }
};