import { IEditorTracker } from '@jupyterlab/fileeditor';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { Contents } from '@jupyterlab/services';

/**
 * Collect all markdown files in the workspace
 */
async function getAllMarkdownFiles(
  docManager: IDocumentManager
): Promise<string[]> {
  const contents = docManager.services.contents;
  const files: string[] = [];

  async function collectFiles(path: string) {
    try {
      const listing = await contents.get(path, { content: true });
      
      if (listing.type !== 'directory' || !listing.content) {
        return;
      }

      for (const item of listing.content as Contents.IModel[]) {
        if (item.type === 'file' && item.name.endsWith('.md')) {
          // Store filename without extension for wikilink
          const nameWithoutExt = item.name.slice(0, -3);
          files.push(nameWithoutExt);
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
 * Setup wikilink auto-completion for markdown editors
 */
export function setupWikilinkCompletion(
  editorTracker: IEditorTracker,
  docManager: IDocumentManager
): void {
  // Monitor for new editor widgets
  editorTracker.widgetAdded.connect(async (sender, widget) => {
    if (!widget.context.path.endsWith('.md')) {
      return;
    }

    const editor = widget.content.editor;
    const model = editor.model;

    // Monitor model changes
    model.sharedModel.changed.connect(async () => {
      const position = editor.getCursorPosition();
      const line = position.line;
      const column = position.column;
      
      // Get text before cursor
      const text = model.sharedModel.getSource();
      const lines = text.split('\n');
      let offset = 0;
      for (let i = 0; i < line; i++) {
        offset += lines[i].length + 1; // +1 for newline
      }
      offset += column;
      const beforeCursor = text.substring(0, offset);
      
      // Check if we're in a wikilink context
      const match = beforeCursor.match(/\[\[([^\]|]*)$/);
      if (!match) {
        return;
      }

      const prefix = match[1].toLowerCase();
      
      // Get all markdown files
      const files = await getAllMarkdownFiles(docManager);
      
      // Filter files by prefix
      const suggestions = files
        .filter(file => file.toLowerCase().includes(prefix))
        .sort((a, b) => {
          const aStarts = a.toLowerCase().startsWith(prefix);
          const bStarts = b.toLowerCase().startsWith(prefix);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return a.localeCompare(b);
        })
        .slice(0, 10);

      // For now, we'll just log suggestions
      // In a full implementation, you'd show a dropdown UI
      if (suggestions.length > 0) {
        console.log('Wikilink suggestions:', suggestions);
      }
    });
  });
}