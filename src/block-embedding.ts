import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { IEditorTracker } from '@jupyterlab/fileeditor';
import { IMarkdownViewerTracker } from '@jupyterlab/markdownviewer';
import { IRenderMimeRegistry, IRenderMime } from '@jupyterlab/rendermime';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { Contents } from '@jupyterlab/services';

/**
 * Regular expression for block embedding syntax
 */
const BLOCK_EMBED_REGEX = /!\[\[([^#\]]+)#([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Interface for parsed block embed
 */
interface BlockEmbed {
  fullMatch: string;
  sourceFile: string;
  blockRef: string;
  displayTitle?: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Interface for extracted block content
 */
interface ExtractedBlock {
  content: string;
  title: string;
  sourceFile: string;
  blockRef: string;
  extractedAt: Date;
  found: boolean;
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
  console.log('Block embedding - searching for file:', filename, '-> target:', targetName);

  async function searchDirectory(path: string): Promise<string | null> {
    try {
      const listing = await contents.get(path, { content: true });
      
      if (listing.type !== 'directory' || !listing.content) {
        return null;
      }

      console.log(`Block embedding - searching in directory: ${path || 'root'}, found ${listing.content.length} items`);
      
      for (const item of listing.content as Contents.IModel[]) {
        console.log(`  - ${item.name} (${item.type})`);
        if ((item.type === 'file' || item.type === 'notebook') && item.name === targetName) {
          console.log(`Block embedding - found match: ${item.path}`);
          return item.path;
        } else if (item.type === 'directory') {
          const found = await searchDirectory(item.path);
          if (found) {
            return found;
          }
        }
      }
    } catch (error) {
      console.error(`Block embedding - error searching directory ${path}:`, error);
    }
    
    return null;
  }

  return searchDirectory('');
}

/**
 * Extract content from markdown file by heading
 */
async function extractByHeading(
  docManager: IDocumentManager,
  filePath: string,
  heading: string
): Promise<string | null> {
  try {
    console.log(`Attempting to extract heading "${heading}" from file: ${filePath}`);
    
    const fileModel = await docManager.services.contents.get(filePath, { content: true });
    if (fileModel.type !== 'file') {
      console.warn(`File ${filePath} is not a file type, got: ${fileModel.type}`);
      return null;
    }

    // Handle different content formats
    let content: string;
    if (typeof fileModel.content === 'string') {
      content = fileModel.content;
    } else if (fileModel.content && typeof fileModel.content === 'object') {
      // If content is an object, it might be the parsed JSON - we need the raw content
      console.warn(`File ${filePath} content is not a string:`, typeof fileModel.content);
      return null;
    } else {
      console.warn(`File ${filePath} has no content`);
      return null;
    }

    const lines = content.split('\n');
    
    console.log(`File has ${lines.length} lines`);
    console.log('Looking for headings in file:', lines.slice(0, 10).map((line, i) => `${i}: ${line}`));
    
    // Find the heading line - be more flexible with whitespace and matching
    const normalizedHeading = heading.trim().toLowerCase();
    let startIndex = -1;
    let headingLevel = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (match) {
        const lineHeading = match[2].trim().toLowerCase();
        console.log(`Found heading at line ${i}: "${match[2]}" (level ${match[1].length})`);
        
        if (lineHeading === normalizedHeading) {
          startIndex = i;
          headingLevel = match[1].length;
          console.log(`Matched heading "${heading}" at line ${i}`);
          break;
        }
      }
    }
    
    if (startIndex === -1) {
      console.warn(`Heading "${heading}" not found in ${filePath}`);
      console.log('Available headings:');
      lines.forEach((line, i) => {
        const match = line.match(/^(#{1,6})\s+(.+)$/);
        if (match) {
          console.log(`  Line ${i}: ${match[1]} ${match[2]}`);
        }
      });
      return null;
    }
    
    // Find the end of this section (next heading of same or higher level)
    let endIndex = lines.length;
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      const match = line.match(/^(#{1,6})\s/);
      
      if (match && match[1].length <= headingLevel) {
        endIndex = i;
        break;
      }
    }
    
    // Extract the content (excluding the heading itself)
    const sectionLines = lines.slice(startIndex + 1, endIndex);
    const extractedContent = sectionLines.join('\n').trim();
    
    console.log(`Extracted ${sectionLines.length} lines of content`);
    console.log('First 200 chars:', extractedContent.substring(0, 200));
    
    return extractedContent;
    
  } catch (error) {
    console.error(`Error extracting heading "${heading}" from ${filePath}:`, error);
    if (error instanceof SyntaxError && error.message.includes('JSON.parse')) {
      console.warn(`File ${filePath} may not exist or be accessible`);
    }
    return null;
  }
}

/**
 * Extract content from markdown file by block ID
 */
async function extractByBlockId(
  docManager: IDocumentManager,
  filePath: string,
  blockId: string
): Promise<string | null> {
  try {
    console.log(`Attempting to extract block ID "${blockId}" from file: ${filePath}`);
    
    const fileModel = await docManager.services.contents.get(filePath, { content: true });
    if (fileModel.type !== 'file') {
      console.warn(`File ${filePath} is not a file type, got: ${fileModel.type}`);
      return null;
    }

    // Handle different content formats
    let content: string;
    if (typeof fileModel.content === 'string') {
      content = fileModel.content;
    } else if (fileModel.content && typeof fileModel.content === 'object') {
      console.warn(`File ${filePath} content is not a string:`, typeof fileModel.content);
      return null;
    } else {
      console.warn(`File ${filePath} has no content`);
      return null;
    }

    const lines = content.split('\n');
    
    // Look for block ID marker: ^block-id at end of line or paragraph
    const blockIdPattern = new RegExp(`\\^${blockId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
    let blockLineIndex = -1;
    
    console.log(`Looking for block ID pattern: ${blockIdPattern}`);
    
    for (let i = 0; i < lines.length; i++) {
      if (blockIdPattern.test(lines[i])) {
        blockLineIndex = i;
        console.log(`Found block ID "${blockId}" at line ${i}: "${lines[i]}"`);
        break;
      }
    }
    
    if (blockLineIndex === -1) {
      console.warn(`Block ID "${blockId}" not found in ${filePath}`);
      console.log('Available block IDs:');
      lines.forEach((line, i) => {
        const blockMatch = line.match(/\^([a-zA-Z0-9-_]+)\s*$/);
        if (blockMatch) {
          console.log(`  Line ${i}: ^${blockMatch[1]}`);
        }
      });
      return null;
    }
    
    // Extract the paragraph containing the block ID
    // Go backwards to find the start of the paragraph
    let startIndex = blockLineIndex;
    for (let i = blockLineIndex - 1; i >= 0; i--) {
      if (lines[i].trim() === '') {
        startIndex = i + 1;
        break;
      }
      if (i === 0) {
        startIndex = 0;
      }
    }
    
    // Go forwards to find the end of the paragraph
    let endIndex = blockLineIndex;
    for (let i = blockLineIndex + 1; i < lines.length; i++) {
      if (lines[i].trim() === '') {
        endIndex = i - 1;
        break;
      }
      if (i === lines.length - 1) {
        endIndex = i;
      }
    }
    
    // Extract the block content and remove the block ID marker
    const blockLines = lines.slice(startIndex, endIndex + 1);
    const blockContent = blockLines
      .map(line => line.replace(blockIdPattern, '').trimEnd())
      .join('\n')
      .trim();
    
    console.log(`Extracted block content (${blockLines.length} lines):`, blockContent.substring(0, 200));
    
    return blockContent;
    
  } catch (error) {
    console.error(`Error extracting block ID "${blockId}" from ${filePath}:`, error);
    if (error instanceof SyntaxError && error.message.includes('JSON.parse')) {
      console.warn(`File ${filePath} may not exist or be accessible`);
    }
    return null;
  }
}

/**
 * Extract block content based on reference type
 */
async function extractBlockContent(
  docManager: IDocumentManager,
  sourceFile: string,
  blockRef: string
): Promise<ExtractedBlock> {
  const extractedAt = new Date();
  
  console.log(`Block embedding - extracting from "${sourceFile}" block/heading "${blockRef}"`);
  
  // First, resolve the file path
  const resolvedPath = await findFile(docManager, sourceFile);
  if (!resolvedPath) {
    console.warn(`Block embedding - could not find file: ${sourceFile}`);
    return {
      content: '',
      title: blockRef,
      sourceFile,
      blockRef,
      extractedAt,
      found: false
    };
  }
  
  console.log(`Block embedding - resolved "${sourceFile}" to "${resolvedPath}"`);
  
  // Determine if it's likely a block ID based on naming patterns
  // Block IDs typically use kebab-case, headings use normal text
  const isLikelyBlockId = /^[a-z0-9-_]+$/.test(blockRef) && blockRef.includes('-');
  
  let content: string | null = null;
  let title = blockRef;
  
  if (isLikelyBlockId) {
    // Try as block ID first
    console.log(`"${blockRef}" looks like a block ID, trying block extraction first`);
    content = await extractByBlockId(docManager, resolvedPath, blockRef);
    if (content === null) {
      console.log(`Block ID extraction failed, trying as heading`);
      content = await extractByHeading(docManager, resolvedPath, blockRef);
    }
    title = content !== null ? `Block: ${blockRef}` : blockRef;
  } else {
    // Try as heading first
    console.log(`"${blockRef}" looks like a heading, trying heading extraction first`);
    content = await extractByHeading(docManager, resolvedPath, blockRef);
    if (content === null) {
      console.log(`Heading extraction failed, trying as block ID`);
      content = await extractByBlockId(docManager, resolvedPath, blockRef);
      title = content !== null ? `Block: ${blockRef}` : blockRef;
    }
  }
  
  return {
    content: content || '',
    title,
    sourceFile,
    blockRef,
    extractedAt,
    found: content !== null
  };
}

/**
 * Parse block embeds from text
 */
function parseBlockEmbeds(text: string): BlockEmbed[] {
  const embeds: BlockEmbed[] = [];
  let match;

  BLOCK_EMBED_REGEX.lastIndex = 0;
  while ((match = BLOCK_EMBED_REGEX.exec(text)) !== null) {
    embeds.push({
      fullMatch: match[0],
      sourceFile: match[1].trim(),
      blockRef: match[2].trim(),
      displayTitle: match[3]?.trim(),
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }

  return embeds;
}

/**
 * Render an embedded block as markdown with a visual container
 */
function renderEmbedBlock(extractedBlock: ExtractedBlock, displayTitle?: string): string {
  const timestamp = extractedBlock.extractedAt.toLocaleString();
  const title = displayTitle || extractedBlock.title;
  const statusIcon = extractedBlock.found ? '📄' : '❌';
  
  if (!extractedBlock.found) {
    return `
> **${statusIcon} ${extractedBlock.sourceFile}#${extractedBlock.blockRef}**
> 
> *Block not found*
`;
  }
  
  // Format the embedded content with clear visual boundaries
  const headerLine = `**${statusIcon} ${extractedBlock.sourceFile}#${title}** *(🕒 ${timestamp})*`;
  const contentLines = extractedBlock.content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  return `
---

${headerLine}

${contentLines.join('\n\n')}

---
`;
}

/**
 * Plugin to handle block embedding in markdown files
 */
export const blockEmbeddingPlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlite/pkm-extension:block-embedding',
  description: 'Handle block embedding in markdown files',
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
    console.log('Block embedding plugin activated');

    // Override the default markdown renderer to process block embeds
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
            // Get the markdown source
            let source: string;
            if (typeof model.data === 'string') {
              source = model.data;
            } else if (model.data['text/markdown']) {
              source = model.data['text/markdown'] as string;
            } else if (model.data['text/plain']) {
              source = model.data['text/plain'] as string;
            } else {
              return originalRenderModel(model);
            }
            
            // Parse block embeds
            const embeds = parseBlockEmbeds(source);
            
            if (embeds.length === 0) {
              return originalRenderModel(model);
            }
            
            console.log(`Found ${embeds.length} block embeds`);
            
            // Process embeds
            let processedSource = source;
            let offset = 0;
            
            for (const embed of embeds) {
              console.log('Processing embed:', embed.sourceFile, '#', embed.blockRef);
              
              const extractedBlock = await extractBlockContent(
                docManager,
                embed.sourceFile,
                embed.blockRef
              );
              
              const embedHtml = renderEmbedBlock(extractedBlock, embed.displayTitle);
              
              const adjustedStart = embed.startIndex + offset;
              const adjustedEnd = embed.endIndex + offset;
              
              processedSource = 
                processedSource.slice(0, adjustedStart) +
                embedHtml +
                processedSource.slice(adjustedEnd);
              
              offset += embedHtml.length - embed.fullMatch.length;
            }
            
            // Update the model with processed source
            const processedModel = {
              ...model,
              data: typeof model.data === 'string' ? { 'text/markdown': processedSource } : {
                ...model.data,
                'text/markdown': processedSource
              },
              metadata: model.metadata || {},
              trusted: model.trusted !== undefined ? model.trusted : true
            };
            
            return originalRenderModel(processedModel);
          };
          
          return renderer;
        }
      }, 0);
    }

    // No custom CSS needed - using markdown formatting instead
  }
};