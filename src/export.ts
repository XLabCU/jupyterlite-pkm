import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette } from '@jupyterlab/apputils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { Contents } from '@jupyterlab/services';

const COMMAND_EXPORT_NOTES = 'pkm:export-notes';

/**
 * Collect all user files recursively from the contents API
 */
async function collectFiles(
  contents: Contents.IManager,
  path: string
): Promise<Array<{ path: string; content: string; type: string }>> {
  const files: Array<{ path: string; content: string; type: string }> = [];

  try {
    const listing = await contents.get(path, { content: true });

    if (listing.type !== 'directory' || !listing.content) {
      return files;
    }

    for (const item of listing.content as Contents.IModel[]) {
      // Skip the wikilink index file
      if (item.name === 'wikilink-index.json') {
        continue;
      }

      if (item.type === 'directory') {
        const subFiles = await collectFiles(contents, item.path);
        files.push(...subFiles);
      } else if (
        item.type === 'file' || item.type === 'notebook'
      ) {
        try {
          const file = await contents.get(item.path, { content: true });
          let content: string;

          if (typeof file.content === 'string') {
            content = file.content;
          } else if (file.content && typeof file.content === 'object') {
            content = JSON.stringify(file.content, null, 2);
          } else {
            continue;
          }

          files.push({
            path: item.path,
            content,
            type: item.type
          });
        } catch (error) {
          console.warn(`Export: Could not read file ${item.path}:`, error);
        }
      }
    }
  } catch (error) {
    console.error(`Export: Error reading directory ${path}:`, error);
  }

  return files;
}

/**
 * Create a simple text-based archive of all notes.
 * Uses a delimiter-based format since we can't rely on JSZip
 * being available in the browser.
 */
function createArchive(
  files: Array<{ path: string; content: string; type: string }>
): string {
  const lines: string[] = [];
  const separator = '=' .repeat(72);

  lines.push(`PKM Notes Export`);
  lines.push(`Exported: ${new Date().toISOString()}`);
  lines.push(`Files: ${files.length}`);
  lines.push(separator);
  lines.push('');

  for (const file of files) {
    lines.push(`FILE: ${file.path}`);
    lines.push(`TYPE: ${file.type}`);
    lines.push('-'.repeat(72));
    lines.push(file.content);
    lines.push('');
    lines.push(separator);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Trigger a browser download of the given content
 */
function downloadContent(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Plugin to export all notes as a downloadable file
 */
export const exportPlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlite/pkm-extension:export',
  description: 'Export all PKM notes as a downloadable archive',
  autoStart: true,
  requires: [IDocumentManager],
  optional: [ICommandPalette],
  activate: (
    app: JupyterFrontEnd,
    docManager: IDocumentManager,
    palette: ICommandPalette | null
  ) => {
    console.log('Export plugin activated');

    app.commands.addCommand(COMMAND_EXPORT_NOTES, {
      label: 'PKM: Export All Notes',
      caption: 'Download all notes and notebooks as a text archive',
      execute: async () => {
        console.log('Export: Starting export...');

        try {
          const files = await collectFiles(docManager.services.contents, '');

          if (files.length === 0) {
            alert('No files found to export.');
            return;
          }

          // Separate markdown and notebook files for individual JSON export
          const markdownFiles = files.filter(f => f.path.endsWith('.md'));
          const notebookFiles = files.filter(f => f.path.endsWith('.ipynb'));
          const otherFiles = files.filter(
            f => !f.path.endsWith('.md') && !f.path.endsWith('.ipynb')
          );

          // Build a structured JSON export
          const exportData = {
            exportedAt: new Date().toISOString(),
            summary: {
              totalFiles: files.length,
              markdownFiles: markdownFiles.length,
              notebookFiles: notebookFiles.length,
              otherFiles: otherFiles.length
            },
            files: files.map(f => ({
              path: f.path,
              type: f.type,
              content: f.content
            }))
          };

          const jsonContent = JSON.stringify(exportData, null, 2);
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          downloadContent(jsonContent, `pkm-export-${timestamp}.json`, 'application/json');

          console.log(`Export: Downloaded ${files.length} files`);
        } catch (error) {
          console.error('Export: Failed to export notes:', error);
          alert('Failed to export notes. See browser console for details.');
        }
      }
    });

    if (palette) {
      palette.addItem({
        command: COMMAND_EXPORT_NOTES,
        category: 'PKM'
      });
    }

    // Keyboard shortcut
    app.commands.addKeyBinding({
      command: COMMAND_EXPORT_NOTES,
      keys: ['Alt E'],
      selector: 'body'
    });
  }
};
