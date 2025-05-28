import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette } from '@jupyterlab/apputils';
import { IEditorTracker } from '@jupyterlab/fileeditor';
import { IMarkdownViewerTracker } from '@jupyterlab/markdownviewer';
import { IDocumentManager } from '@jupyterlab/docmanager';

const COMMAND_TOGGLE_PREVIEW = 'pkm:toggle-markdown-preview';

/**
 * Plugin to auto-open markdown preview and provide toggle functionality
 */
export const markdownPreviewPlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlite/pkm-extension:markdown-preview',
  description: 'Auto-open markdown preview for .md files',
  autoStart: true,
  requires: [IEditorTracker, IMarkdownViewerTracker, IDocumentManager],
  optional: [ICommandPalette],
  activate: (
    app: JupyterFrontEnd,
    editorTracker: IEditorTracker,
    markdownTracker: IMarkdownViewerTracker,
    docManager: IDocumentManager,
    palette: ICommandPalette | null
  ) => {
    console.log('Markdown preview plugin activated');
    
    // Log available commands for debugging
    console.log('Available markdown viewer commands:', 
      Array.from(app.commands.listCommands()).filter(cmd => cmd.includes('markdown')));

    // Track which files have their preview state toggled
    const previewStates = new Map<string, boolean>();

    // Add command to toggle preview
    app.commands.addCommand(COMMAND_TOGGLE_PREVIEW, {
      label: 'Toggle Markdown Preview',
      execute: () => {
        const widget = editorTracker.currentWidget;
        if (!widget) {
          return;
        }

        const path = widget.context.path;
        if (!path.endsWith('.md')) {
          return;
        }

        // Toggle preview state for this file
        const currentState = previewStates.get(path) ?? true;
        previewStates.set(path, !currentState);

        if (!currentState) {
          // Show preview using helper function
          openMarkdownPreview(path);
        } else {
          // Hide preview - find and close the preview widget
          markdownTracker.forEach(viewer => {
            if (viewer.context.path === path) {
              viewer.close();
            }
          });
        }
      },
      isEnabled: () => {
        const widget = editorTracker.currentWidget;
        return widget !== null && widget.context.path.endsWith('.md');
      }
    });

    // Add command to palette
    if (palette) {
      palette.addItem({
        command: COMMAND_TOGGLE_PREVIEW,
        category: 'PKM'
      });
    }

    // Add keyboard shortcut
    app.commands.addKeyBinding({
      command: COMMAND_TOGGLE_PREVIEW,
      keys: ['Shift Cmd T'],
      selector: '.jp-FileEditor'
    });

    // Helper function to open markdown preview
    const openMarkdownPreview = async (path: string) => {
      // Try different command variations
      const commands = [
        'markdownviewer:open',
        'docmanager:open',
        'filebrowser:open-preview'
      ];
      
      for (const command of commands) {
        if (app.commands.hasCommand(command)) {
          try {
            if (command === 'docmanager:open') {
              // For docmanager:open, we need to specify factory
              await app.commands.execute(command, {
                path: path,
                factory: 'Markdown Preview',
                options: {
                  mode: 'split-right'
                }
              });
              return;
            } else {
              await app.commands.execute(command, {
                path: path,
                options: {
                  mode: 'split-right'
                }
              });
              return;
            }
          } catch (error) {
            console.warn(`Failed with command ${command}:`, error);
          }
        }
      }
      
      // If no commands work, try direct approach
      console.log('Trying direct markdown preview creation...');
      if (docManager) {
        try {
          docManager.open(path, 'Markdown Preview', {}, { mode: 'split-right' });
        } catch (error: unknown) {
          console.error('Direct preview creation failed:', error);
        }
      }
    };

    // Auto-open preview when opening .md files
    editorTracker.widgetAdded.connect((sender, widget) => {
      const path = widget.context.path;
      
      if (path.endsWith('.md')) {
        // Default to showing preview unless explicitly toggled off
        if (previewStates.get(path) !== false) {
          // Wait for the widget to be ready
          widget.context.ready.then(() => {
            // Additional delay to ensure everything is loaded
            setTimeout(() => {
              openMarkdownPreview(path);
            }, 300);
          });
        }
      }
    });

    // Clean up preview state when file is closed
    editorTracker.currentChanged.connect((sender, widget) => {
      if (!widget) {
        return;
      }
      // Check if any tracked widgets have been disposed
      for (const [path] of previewStates) {
        let hasWidget = false;
        editorTracker.forEach(w => {
          if (w.context.path === path) {
            hasWidget = true;
          }
        });
        if (!hasWidget) {
          previewStates.delete(path);
        }
      }
    });
    
    // Alternative: monitor widget disposal
    editorTracker.widgetAdded.connect((sender, widget) => {
      widget.disposed.connect(() => {
        const path = widget.context.path;
        previewStates.delete(path);
      });
    });
  }
};