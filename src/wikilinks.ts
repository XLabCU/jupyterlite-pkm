import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { pkmState } from './state';

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
 * Find all code spans in the text (inline code with backticks)
 */
function findCodeSpans(text: string): Array<{start: number, end: number}> {
  const codeSpans: Array<{start: number, end: number}> = [];
  
  // Match both single and multiple backticks
  const codeRegex = /(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g;
  let match;
  
  while ((match = codeRegex.exec(text)) !== null) {
    codeSpans.push({
      start: match.index,
      end: match.index + match[0].length
    });
  }
  
  return codeSpans;
}

/**
 * Check if a position is inside any code span
 */
function isInsideCodeSpan(position: number, codeSpans: Array<{start: number, end: number}>): boolean {
  return codeSpans.some(span => position >= span.start && position < span.end);
}

/**
 * Parse wikilinks from text, excluding those inside code spans
 */
function parseWikilinks(text: string): WikiLink[] {
  const links: WikiLink[] = [];
  const codeSpans = findCodeSpans(text);
  let match;

  WIKILINK_REGEX.lastIndex = 0; // Reset regex state
  while ((match = WIKILINK_REGEX.exec(text)) !== null) {
    // Skip wikilinks that are inside code spans
    if (!isInsideCodeSpan(match.index, codeSpans)) {
      links.push({
        fullMatch: match[0],
        target: match[1].trim(),
        display: match[2]?.trim(),
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }
  }

  return links;
}

/**
 * Supported file extensions for wikilinks
 */
const SUPPORTED_EXTENSIONS = ['.md', '.ipynb', '.csv', '.json', '.geojson'];

/**
 * Get the appropriate file extension based on the filename
 */
function getFileExtension(filename: string): string {
  // If filename already has a supported extension, use it
  for (const ext of SUPPORTED_EXTENSIONS) {
    if (filename.endsWith(ext)) {
      return ext;
    }
  }
  
  // Default to .md for files without extension
  return '.md';
}

/**
 * Get the base name without extension
 */
function getBaseName(filename: string): string {
  for (const ext of SUPPORTED_EXTENSIONS) {
    if (filename.endsWith(ext)) {
      return filename.slice(0, -ext.length);
    }
  }
  return filename;
}

/**
 * Find file by name across all directories, supporting multiple extensions
 */
async function findFile(
  docManager: IDocumentManager,
  filename: string
): Promise<string | null> {
  const contents = docManager.services.contents;
  
  // Determine target filename with proper extension
  const targetName = filename.includes('.') ? filename : `${filename}.md`;
  console.log('Searching for file:', filename, '-> target:', targetName);

  async function searchDirectory(path: string): Promise<string | null> {
    try {
      const listing = await contents.get(path, { content: true });
      
      if (listing.type !== 'directory' || !listing.content) {
        return null;
      }

      console.log(`Searching in directory: ${path || 'root'}, found ${listing.content.length} items`);
      
      for (const item of listing.content as Contents.IModel[]) {
        console.log(`  - ${item.name} (${item.type})`);
        if ((item.type === 'file' || item.type === 'notebook') && item.name === targetName) {
          console.log(`Found match: ${item.path}`);
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
              console.log('Processing wikilink:', link.target);
              const linkPath = await findFile(docManager, link.target);
              console.log('Found path for', link.target, ':', linkPath);
              const displayText = link.display || link.target;
              
              // Escape any quotes in the attributes to prevent HTML injection
              const escapedPath = linkPath ? linkPath.replace(/"/g, '&quot;') : '';
              const escapedTarget = link.target.replace(/"/g, '&quot;');
              const escapedDisplay = displayText.replace(/"/g, '&quot;');
              
              let replacement: string;
              
              // Check if this is an external link (starts with http:// or https://)
              const isExternalLink = link.target.startsWith('http://') || link.target.startsWith('https://');
              
              if (isExternalLink) {
                // External link - create a regular link with external icon
                replacement = `<a href="${link.target}" class="pkm-external-link" target="_blank" rel="noopener noreferrer">${escapedDisplay}</a>`;
              } else if (linkPath) {
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
                    
                    // If still no targetName, try to extract from link text as fallback
                    if (!targetName) {
                      targetName = newLink.textContent?.trim() || '';
                    }
                    
                    // If JupyterLab has transformed our link, try extracting from commandlinker-args
                    const commandlinkerArgs = newLink.getAttribute('commandlinker-args');
                    if (commandlinkerArgs) {
                      try {
                        const args = JSON.parse(commandlinkerArgs);
                        // Only update path if we don't have it yet
                        if (!path && args.path !== undefined) {
                          path = args.path;
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
                    
                    // A link is broken ONLY if it explicitly has the broken class
                    // Don't assume it's broken just because we can't extract the path from transformed HTML
                    const isBroken = isBrokenClass;
                    
                    if (isBroken) {
                      // Handle broken link - prompt to create file
                      if (!targetName || targetName.trim() === '') {
                        console.error('Target name is undefined for broken wikilink', {
                          element: newLink,
                          classList: newLink.classList.toString(),
                          text: newLink.textContent,
                          href: newLink.getAttribute('href'),
                          allAttributes: Array.from(newLink.attributes).map(a => `${a.name}="${a.value}"`).join(' ')
                        });
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
                        
                        // Determine the appropriate file extension and content
                        const extension = getFileExtension(targetName);
                        const baseName = getBaseName(targetName);
                        const fileName = targetName.includes('.') ? targetName : `${targetName}${extension}`;
                        
                        // Create new file path
                        const newPath = currentDir ? `${currentDir}/${fileName}` : fileName;
                        
                        console.log('Creating new file at:', newPath);
                        
                        if (extension === '.ipynb') {
                          // Use JupyterLab's built-in notebook creation
                          try {
                            // Create notebook using the notebook factory
                            const widget = await docManager.createNew(newPath, 'notebook');
                            if (widget) {
                              console.log('Created notebook successfully:', newPath);
                              return; // Exit early since we've created and opened the notebook
                            }
                          } catch (error) {
                            console.error('Failed to create notebook with factory, trying manual creation:', error);
                            // Fall back to manual creation if factory fails
                          }
                        }
                        
                        // Create appropriate content based on file type
                        let content: string;
                        let format: 'text' | 'json' = 'text';
                        
                        switch (extension) {
                          case '.ipynb':
                            // Fallback manual creation with a very basic template
                            content = JSON.stringify({
                              cells: [],
                              metadata: {
                                kernelspec: {
                                  display_name: 'Python 3',
                                  language: 'python',
                                  name: 'python3'
                                }
                              },
                              nbformat: 4,
                              nbformat_minor: 4
                            }, null, 2);
                            format = 'json';
                            break;
                          case '.json':
                            content = JSON.stringify({
                              name: baseName,
                              description: 'Description here'
                            }, null, 2);
                            format = 'json';
                            break;
                          case '.geojson':
                            content = JSON.stringify({
                              type: 'FeatureCollection',
                              features: []
                            }, null, 2);
                            format = 'json';
                            break;
                          case '.csv':
                            content = 'name,value\nexample,1\n';
                            break;
                          default: // .md
                            content = `# ${baseName}\n\n`;
                            break;
                        }
                        
                        await docManager.services.contents.save(newPath, {
                          type: 'file',
                          format: format,
                          content: content
                        });
                        
                        // Open the new file with appropriate factory
                        let factory: string | undefined = undefined;
                        if (extension === '.md') {
                          factory = pkmState.markdownMode === 'edit' ? 'Editor' : 'Markdown Preview';
                        }
                        // For other file types, let JupyterLab choose the default factory
                        
                        const widget = await docManager.openOrReveal(newPath, factory);
                        
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
                      // Handle existing link - open the file
                      console.log('Opening existing file. Path from data:', path, 'Target:', targetName);
                      
                      if (path && path !== '' && path !== '#') {
                        // We have a valid path, open it in the appropriate mode
                        let factory: string | undefined = undefined;
                        
                        // Only use markdown mode for .md files
                        if (path.endsWith('.md')) {
                          factory = pkmState.markdownMode === 'edit' ? 'Editor' : 'Markdown Preview';
                        }
                        // For other file types, let JupyterLab choose the default factory
                        
                        await docManager.openOrReveal(path, factory);
                      } else if (targetName) {
                        // No path but we have targetName - try to find the file
                        const foundPath = await findFile(docManager, targetName);
                        if (foundPath) {
                          console.log('Found file at:', foundPath);
                          
                          // Use appropriate factory based on file type
                          let factory: string | undefined = undefined;
                          
                          // Only use markdown mode for .md files
                          if (foundPath.endsWith('.md')) {
                            factory = pkmState.markdownMode === 'edit' ? 'Editor' : 'Markdown Preview';
                          }
                          // For other file types, let JupyterLab choose the default factory
                          
                          await docManager.openOrReveal(foundPath, factory);
                        } else {
                          console.error('Could not find file for target:', targetName);
                        }
                      } else {
                        console.error('No path or target name available for existing wikilink');
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