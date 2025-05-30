import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette, showDialog, Dialog } from '@jupyterlab/apputils';
import { IStateDB } from '@jupyterlab/statedb';
import { IEditorTracker } from '@jupyterlab/fileeditor';
import { IMarkdownViewerTracker } from '@jupyterlab/markdownviewer';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { Widget } from '@lumino/widgets';
import { pkmState } from './state';

const COMMAND_TOGGLE_MODE = 'pkm:toggle-markdown-mode';
const COMMAND_OPEN_START = 'pkm:open-start-file';
const STATE_KEY = 'pkm:markdown-mode';

/**
 * Plugin for global markdown mode toggle and startup behavior
 */
export const markdownPreviewPlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlite/pkm-extension:markdown-mode',
  description: 'Global markdown mode toggle and startup file',
  autoStart: true,
  requires: [IEditorTracker, IMarkdownViewerTracker, IDocumentManager, IStateDB],
  optional: [ICommandPalette],
  activate: (
    app: JupyterFrontEnd,
    editorTracker: IEditorTracker,
    markdownTracker: IMarkdownViewerTracker,
    docManager: IDocumentManager,
    stateDB: IStateDB,
    palette: ICommandPalette | null
  ) => {
    console.log('PKM Markdown mode plugin activated');
    
    // Load saved mode from state
    stateDB.fetch(STATE_KEY).then((value: any) => {
      if (value === 'preview' || value === 'edit') {
        pkmState.setMarkdownMode(value as 'edit' | 'preview');
      }
    });

    // Create mode toggle button widget
    const createModeToggleWidget = (): Widget => {
      const widget = new Widget();
      widget.addClass('pkm-mode-toggle');
      widget.node.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        width: calc(var(--jp-sidebar-min-width, 240px) - 40px);
        max-width: 280px;
        z-index: 1000;
        background: var(--jp-layout-color0, #ffffff);
        border: 2px solid var(--jp-brand-color1, #1976d2);
        border-radius: 8px;
        padding: 12px;
        margin: 0;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      
      widget.node.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button id="pkm-mode-btn" style="
            padding: 10px 12px; 
            border: 2px solid var(--jp-brand-color1, #1976d2); 
            background: var(--jp-brand-color1, #1976d2);
            color: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            transition: all 0.2s ease;
            width: 100%;
            text-align: center;
          ">
            📝 Edit Mode
          </button>
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <span style="color: var(--jp-ui-font-color1); font-size: 12px; font-weight: 500; text-align: center;">
              Markdown files will open in edit mode
            </span>
            <span style="color: var(--jp-ui-font-color2); font-size: 11px; text-align: center;">
              Press Alt+M to toggle
            </span>
          </div>
        </div>
      `;
      
      const button = widget.node.querySelector('#pkm-mode-btn') as HTMLButtonElement;
      const statusSpan = widget.node.querySelector('span') as HTMLSpanElement;
      
      const getCurrentFileMode = (): 'edit' | 'preview' | 'none' => {
        // Check if current focused widget is a markdown file
        const editorWidget = editorTracker.currentWidget;
        const previewWidget = markdownTracker.currentWidget;
        
        if (editorWidget && editorWidget.context.path.endsWith('.md')) {
          return 'edit';
        } else if (previewWidget && previewWidget.context.path.endsWith('.md')) {
          return 'preview';
        }
        return 'none';
      };

      const updateButton = () => {
        const currentMode = getCurrentFileMode();
        
        if (currentMode === 'edit') {
          button.innerHTML = '👁 Switch to Preview';
          button.style.background = 'var(--jp-brand-color1, #1976d2)';
          button.style.borderColor = 'var(--jp-brand-color1, #1976d2)';
          statusSpan.textContent = 'Currently viewing in edit mode';
          button.disabled = false;
        } else if (currentMode === 'preview') {
          button.innerHTML = '📝 Switch to Edit';
          button.style.background = 'var(--jp-warn-color1, #ff9800)';
          button.style.borderColor = 'var(--jp-warn-color1, #ff9800)';
          statusSpan.textContent = 'Currently viewing in preview mode';
          button.disabled = false;
        } else {
          button.innerHTML = '📄 No Markdown File';
          button.style.background = 'var(--jp-layout-color3, #ccc)';
          button.style.borderColor = 'var(--jp-layout-color3, #ccc)';
          statusSpan.textContent = 'Focus a markdown file to toggle view';
          button.disabled = true;
        }
      };
      
      // Add hover effect
      button.addEventListener('mouseenter', () => {
        button.style.opacity = '0.8';
      });
      
      button.addEventListener('mouseleave', () => {
        button.style.opacity = '1';
      });
      
      button.addEventListener('click', async () => {
        const currentMode = getCurrentFileMode();
        
        if (currentMode === 'none') {
          // No markdown file is focused, do nothing
          return;
        }
        
        // Determine which widget and path to work with
        let currentWidget = null;
        let currentPath = '';
        
        if (currentMode === 'edit') {
          currentWidget = editorTracker.currentWidget;
          if (currentWidget && currentWidget.context.path.endsWith('.md')) {
            currentPath = currentWidget.context.path;
          }
        } else if (currentMode === 'preview') {
          currentWidget = markdownTracker.currentWidget;
          if (currentWidget && currentWidget.context.path.endsWith('.md')) {
            currentPath = currentWidget.context.path;
          }
        }
        
        if (!currentWidget || !currentPath) {
          console.warn('No valid markdown file found to toggle');
          return;
        }
        
        // Determine target mode
        const targetMode = currentMode === 'edit' ? 'preview' : 'edit';
        const targetFactory = targetMode === 'edit' ? 'Editor' : 'Markdown Preview';
        
        try {
          // Show loading state
          statusSpan.textContent = `Switching to ${targetMode}...`;
          statusSpan.style.color = 'var(--jp-brand-color1, #1976d2)';
          
          // Close the current widget first
          if (currentWidget && !currentWidget.isDisposed) {
            currentWidget.close();
          }
          
          // Small delay to ensure cleanup
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Open the file in the new mode
          await docManager.openOrReveal(currentPath, targetFactory);
          
          // Show success confirmation
          statusSpan.textContent = `Switched to ${targetMode} mode!`;
          statusSpan.style.color = 'var(--jp-success-color1, #4caf50)';
          
          setTimeout(() => {
            updateButton(); // This will reset the text and color
          }, 1500);
          
          console.log(`Toggled ${currentPath} from ${currentMode} to ${targetMode} mode`);
          
        } catch (error) {
          console.error('Failed to toggle file mode:', error);
          statusSpan.textContent = 'Failed to switch mode';
          statusSpan.style.color = 'var(--jp-error-color1, #f44336)';
          
          setTimeout(() => {
            updateButton();
          }, 2000);
        }
      });
      
      // Listen for focus changes to update button state
      editorTracker.currentChanged.connect(updateButton);
      markdownTracker.currentChanged.connect(updateButton);
      
      // Initial button update
      updateButton();
      return widget;
    };

    // Add toggle command
    app.commands.addCommand(COMMAND_TOGGLE_MODE, {
      label: 'Toggle Current Markdown File View',
      execute: async () => {
        // Use the same logic as the button click
        const getCurrentFileMode = (): 'edit' | 'preview' | 'none' => {
          const editorWidget = editorTracker.currentWidget;
          const previewWidget = markdownTracker.currentWidget;
          
          if (editorWidget && editorWidget.context.path.endsWith('.md')) {
            return 'edit';
          } else if (previewWidget && previewWidget.context.path.endsWith('.md')) {
            return 'preview';
          }
          return 'none';
        };
        
        const currentMode = getCurrentFileMode();
        
        if (currentMode === 'none') {
          showDialog({
            title: 'No Markdown File',
            body: 'Please focus a markdown file to toggle its view mode.',
            buttons: [Dialog.okButton()]
          });
          return;
        }
        
        // Determine which widget and path to work with
        let currentWidget = null;
        let currentPath = '';
        
        if (currentMode === 'edit') {
          currentWidget = editorTracker.currentWidget;
          if (currentWidget && currentWidget.context.path.endsWith('.md')) {
            currentPath = currentWidget.context.path;
          }
        } else if (currentMode === 'preview') {
          currentWidget = markdownTracker.currentWidget;
          if (currentWidget && currentWidget.context.path.endsWith('.md')) {
            currentPath = currentWidget.context.path;
          }
        }
        
        if (!currentWidget || !currentPath) {
          console.warn('No valid markdown file found to toggle');
          return;
        }
        
        // Determine target mode
        const targetMode = currentMode === 'edit' ? 'preview' : 'edit';
        const targetFactory = targetMode === 'edit' ? 'Editor' : 'Markdown Preview';
        
        try {
          // Close the current widget first
          if (currentWidget && !currentWidget.isDisposed) {
            currentWidget.close();
          }
          
          // Small delay to ensure cleanup
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Open the file in the new mode
          await docManager.openOrReveal(currentPath, targetFactory);
          
          console.log(`Toggled ${currentPath} from ${currentMode} to ${targetMode} mode via keyboard`);
          
          // Show brief confirmation
          showDialog({
            title: 'View Mode Changed',
            body: `Switched to ${targetMode} mode for ${currentPath.split('/').pop()}`,
            buttons: [Dialog.okButton()]
          });
          
        } catch (error) {
          console.error('Failed to toggle file mode:', error);
          showDialog({
            title: 'Error',
            body: 'Failed to switch view mode. Please try again.',
            buttons: [Dialog.okButton()]
          });
        }
      }
    });

    // Add command to open start.md
    app.commands.addCommand(COMMAND_OPEN_START, {
      label: 'Open Start File',
      execute: async () => {
        try {
          const factory = pkmState.markdownMode === 'edit' ? 'Editor' : 'Markdown Preview';
          await docManager.openOrReveal('start.md', factory);
        } catch (error) {
          console.log('start.md not found, creating it...');
          // Create start.md if it doesn't exist
          try {
            await docManager.services.contents.save('start.md', {
              type: 'file',
              format: 'text',
              content: `# Welcome to Your PKM System

This is your starting note. Try creating wikilinks:

- [[My First Note]] - Creates a new note
- [[https://example.com|External Link]] - Links to external sites

## Features:
- **Wikilinks**: Use [[Note Name]] syntax
- **Search**: Alt+F to search all notes  
- **Auto-save**: Your changes are saved automatically
- **Mode Toggle**: Use the button above or Alt+M to switch between edit and preview modes

Start building your knowledge graph!
`
            });
            
            const factory = pkmState.markdownMode === 'edit' ? 'Editor' : 'Markdown Preview';
            await docManager.openOrReveal('start.md', factory);
          } catch (createError) {
            console.error('Failed to create start.md:', createError);
          }
        }
      }
    });

    // Add commands to palette
    if (palette) {
      palette.addItem({
        command: COMMAND_TOGGLE_MODE,
        category: 'PKM'
      });
      palette.addItem({
        command: COMMAND_OPEN_START,
        category: 'PKM'
      });
    }

    // Add keyboard shortcut for mode toggle
    app.commands.addKeyBinding({
      command: COMMAND_TOGGLE_MODE,
      keys: ['Alt M'],
      selector: 'body'
    });

    // Create a single global toggle widget
    let globalToggleWidget: Widget | null = null;
    
    const showToggleWidget = () => {
      if (!globalToggleWidget) {
        globalToggleWidget = createModeToggleWidget();
        document.body.appendChild(globalToggleWidget.node);
        console.log('Created global toggle widget');
      }
      globalToggleWidget.node.style.display = 'block';
    };
    
    const hideToggleWidget = () => {
      if (globalToggleWidget) {
        globalToggleWidget.node.style.display = 'none';
      }
    };

    // Show/hide toggle widget based on current file
    const updateToggleVisibility = () => {
      const currentEditorWidget = editorTracker.currentWidget;
      const currentViewerWidget = markdownTracker.currentWidget;
      
      // Show if we have a markdown file open (either editor or viewer)
      const hasMarkdownFile = (currentEditorWidget && currentEditorWidget.context.path.endsWith('.md')) ||
                             (currentViewerWidget && currentViewerWidget.context.path.endsWith('.md'));
      
      if (hasMarkdownFile) {
        showToggleWidget();
      } else {
        hideToggleWidget();
      }
    };

    // Track current widget changes
    editorTracker.currentChanged.connect(updateToggleVisibility);
    markdownTracker.currentChanged.connect(updateToggleVisibility);
    
    // Track when widgets are added/removed
    editorTracker.widgetAdded.connect(updateToggleVisibility);
    markdownTracker.widgetAdded.connect(updateToggleVisibility);

    // Auto-open start.md on startup (with delay to ensure UI is ready)
    setTimeout(() => {
      app.commands.execute(COMMAND_OPEN_START);
    }, 1000);
  }
};