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
              
              // Escape any quotes in the attributes to prevent HTML injection
              const escapedPath = linkPath ? linkPath.replace(/"/g, '&quot;') : '';
              const escapedTarget = link.target.replace(/"/g, '&quot;');
              const escapedDisplay = displayText.replace(/"/g, '&quot;');
              
              let replacement: string;
              if (linkPath) {
                // File exists - create a clickable link
                // Use a format that JupyterLab's commandlinker won't interfere with
                // We'll encode our data in the href as a special protocol
                const encodedData = encodeURIComponent(JSON.stringify({ path: linkPath, target: link.target }));
                replacement = `<a href="pkm-wikilink:${encodedData}" class="pkm-wikilink" data-path="${escapedPath}" data-target="${escapedTarget}" data-wikilink="true">${escapedDisplay}</a>`;
              } else {
                // File doesn't exist - create a broken link
                const encodedData = encodeURIComponent(JSON.stringify({ path: '', target: link.target }));
                replacement = `<a href="pkm-wikilink:${encodedData}" class="pkm-wikilink pkm-wikilink-broken" data-target="${escapedTarget}" data-path="" data-wikilink="true">${escapedDisplay}</a>`;
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
              // JupyterLab transforms our links, so we need to find them by class or by checking commandlinker-args
              const allLinks = node.querySelectorAll('a');
              const wikilinks: Element[] = [];
              
              allLinks.forEach((link: Element) => {
                // Check if it's our wikilink by class, attributes, or custom protocol
                const href = link.getAttribute('href');
                const commandlinkerArgs = link.getAttribute('commandlinker-args');
                const isWikilink = link.classList.contains('pkm-wikilink') || 
                                  link.hasAttribute('data-wikilink') ||
                                  link.hasAttribute('data-target') ||
                                  link.hasAttribute('data-path') ||
                                  (href && href.startsWith('pkm-wikilink:'));
                
                // Also check if commandlinker-args contains our wikilink data
                if (isWikilink || (commandlinkerArgs && commandlinkerArgs.includes('"path"'))) {
                  wikilinks.push(link);
                }
              });
              
              console.log(`Found ${wikilinks.length} wikilinks in rendered content`);
              
              wikilinks.forEach((link: Element) => {
                // Remove any existing click handlers to prevent duplicates
                const newLink = link.cloneNode(true) as HTMLAnchorElement;
                link.parentNode?.replaceChild(newLink, link);
                
                newLink.addEventListener('click', async (event: Event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  
                  try {
                    // First try to get data from our custom attributes
                    let path = newLink.dataset?.path || newLink.getAttribute('data-path');
                    let targetName = newLink.dataset?.target || newLink.getAttribute('data-target');
                    const isBrokenClass = newLink.classList.contains('pkm-wikilink-broken');
                    
                    // Try to extract from our custom protocol in href
                    const href = newLink.getAttribute('href');
                    if (href && href.startsWith('pkm-wikilink:')) {
                      try {
                        const encodedData = href.substring('pkm-wikilink:'.length);
                        const data = JSON.parse(decodeURIComponent(encodedData));
                        path = data.path || path;
                        targetName = data.target || targetName;
                      } catch (e) {
                        console.error('Failed to parse pkm-wikilink data:', e);
                      }
                    }
                    
                    // If JupyterLab has transformed our link, extract data from commandlinker-args
                    const commandlinkerArgs = newLink.getAttribute('commandlinker-args');
                    if (commandlinkerArgs && !path && !targetName) {
                      try {
                        const args = JSON.parse(commandlinkerArgs);
                        if (args.path !== undefined) {
                          path = args.path;
                        }
                        // Extract target from the link text or href
                        targetName = newLink.textContent || '';
                        // If the link has been transformed to have an href, extract from there
                        if (href && href !== '#' && !href.startsWith('pkm-wikilink:')) {
                          // Extract filename from href
                          const match = href.match(/([^/]+)(?:\.md)?$/);
                          if (match) {
                            targetName = match[1];
                          }
                        }
                      } catch (e) {
                        console.error('Failed to parse commandlinker-args:', e);
                      }
                    }
                    
                    // Log for debugging
                    console.log('Wikilink clicked:', {
                      path,
                      targetName,
                      classList: newLink.classList.toString(),
                      commandlinkerArgs,
                      href: newLink.getAttribute('href'),
                      text: newLink.textContent
                    });
                    
                    const isBroken = isBrokenClass || !path || path === '';
                    
                    if (isBroken) {
                      // Handle broken link - prompt to create file
                      if (!targetName) {
                        console.error('Target name is undefined for broken wikilink');
                        return;
                      }
                      
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
                        const currentDir = currentPath ? currentPath.substring(0, currentPath.lastIndexOf('/')) : '';
                        
                        // Ensure targetName has .md extension
                        const fileName = targetName.endsWith('.md') ? targetName : `${targetName}.md`;
                        
                        // Create new file path
                        const newPath = currentDir ? `${currentDir}/${fileName}` : fileName;
                        
                        console.log('Creating new file at:', newPath);
                        
                        await docManager.services.contents.save(newPath, {
                          type: 'file',
                          format: 'text',
                          content: `# ${targetName}\n\n`
                        });
                        
                        // Open the new file in the main area (left panel)
                        const widget = await docManager.openOrReveal(newPath, undefined, undefined, {
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
                      console.log('Opening file at:', path);
                      
                      if (path) {
                        await docManager.openOrReveal(path, undefined, undefined, {
                          mode: 'split-left',
                          ref: '_noref'
                        });
                      } else {
                        console.error('Path is null or undefined for wikilink');
                      }
                    }
                  } catch (error) {
                    console.error('Error handling wikilink click:', error);
                    console.error('Target element:', newLink);
                    console.error('All attributes:', Array.from(newLink.attributes).map(attr => ({ name: attr.name, value: attr.value })));
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
    
    // Set up auto-save for all markdown files
    editorTracker.widgetAdded.connect((sender, widget) => {
      if (widget.context.path.endsWith('.md')) {
        // Enable auto-save with a 2-second delay
        let saveTimeout: NodeJS.Timeout | null = null;
        
        widget.context.model.contentChanged.connect(() => {
          if (saveTimeout) {
            clearTimeout(saveTimeout);
          }
          
          saveTimeout = setTimeout(() => {
            if (widget.context.model.dirty) {
              widget.context.save().catch(error => {
                console.error('Auto-save failed:', error);
              });
            }
          }, 2000);
        });
      }
    });
  }
};