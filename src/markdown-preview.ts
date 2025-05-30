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
      
      const updateButton = () => {
        if (pkmState.markdownMode === 'edit') {
          button.innerHTML = '📝 Edit Mode';
          button.style.background = 'var(--jp-brand-color1, #1976d2)';
          button.style.borderColor = 'var(--jp-brand-color1, #1976d2)';
          statusSpan.textContent = 'Markdown files will open in edit mode';
        } else {
          button.innerHTML = '👁 Preview Mode';
          button.style.background = 'var(--jp-warn-color1, #ff9800)';
          button.style.borderColor = 'var(--jp-warn-color1, #ff9800)';
          statusSpan.textContent = 'Markdown files will open in preview mode';
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
        const oldMode = pkmState.markdownMode;
        const newMode = pkmState.markdownMode === 'edit' ? 'preview' : 'edit';
        pkmState.setMarkdownMode(newMode);
        stateDB.save(STATE_KEY, newMode);
        updateButton();
        
        // Show brief confirmation
        const originalText = statusSpan.textContent;
        statusSpan.textContent = 'Mode changed!';
        statusSpan.style.color = 'var(--jp-success-color1, #4caf50)';
        setTimeout(() => {
          statusSpan.textContent = originalText;
          statusSpan.style.color = 'var(--jp-ui-font-color1)';
        }, 1000);

        // Switch the current file to the new mode if it's a markdown file
        // Find the currently active markdown file
        let currentWidget = null;
        let currentPath = '';
        
        if (oldMode === 'edit') {
          // We were in edit mode, check editor tracker
          currentWidget = editorTracker.currentWidget;
          if (currentWidget && currentWidget.context.path.endsWith('.md')) {
            currentPath = currentWidget.context.path;
          }
        } else {
          // We were in preview mode, check viewer tracker
          currentWidget = markdownTracker.currentWidget;
          if (currentWidget && currentWidget.context.path.endsWith('.md')) {
            currentPath = currentWidget.context.path;
          }
        }
        
        if (currentWidget && currentPath) {
          // Instead of closing the widget, just open in the new mode
          // JupyterLab will handle switching between views
          try {
            const factory = pkmState.markdownMode === 'edit' ? 'Editor' : 'Markdown Preview';
            await docManager.openOrReveal(currentPath, factory);
            
            console.log(`Switched ${currentPath} from ${oldMode} to ${pkmState.markdownMode} mode`);
          } catch (error) {
            console.error('Failed to switch file mode:', error);
          }
        }
      });
      
      // Listen for mode changes from other sources
      pkmState.markdownModeChanged.connect(updateButton);
      
      updateButton();
      return widget;
    };

    // Add toggle command
    app.commands.addCommand(COMMAND_TOGGLE_MODE, {
      label: 'Toggle Markdown Mode (Edit/Preview)',
      execute: async () => {
        const oldMode = pkmState.markdownMode;
        const newMode = pkmState.markdownMode === 'edit' ? 'preview' : 'edit';
        pkmState.setMarkdownMode(newMode);
        stateDB.save(STATE_KEY, newMode);
        
        // Switch the current file to the new mode if it's a markdown file
        // Find the currently active markdown file
        let currentWidget = null;
        let currentPath = '';
        
        if (oldMode === 'edit') {
          // We were in edit mode, check editor tracker
          currentWidget = editorTracker.currentWidget;
          if (currentWidget && currentWidget.context.path.endsWith('.md')) {
            currentPath = currentWidget.context.path;
          }
        } else {
          // We were in preview mode, check viewer tracker
          currentWidget = markdownTracker.currentWidget;
          if (currentWidget && currentWidget.context.path.endsWith('.md')) {
            currentPath = currentWidget.context.path;
          }
        }
        
        if (currentWidget && currentPath) {
          // Instead of closing the widget, just open in the new mode
          // JupyterLab will handle switching between views
          try {
            const factory = pkmState.markdownMode === 'edit' ? 'Editor' : 'Markdown Preview';
            await docManager.openOrReveal(currentPath, factory);
            
            console.log(`Switched ${currentPath} from ${oldMode} to ${pkmState.markdownMode} mode via keyboard`);
          } catch (error) {
            console.error('Failed to switch file mode:', error);
          }
        }
        
        // Show current mode
        showDialog({
          title: 'Markdown Mode Changed',
          body: `Markdown files will now open in ${pkmState.markdownMode} mode`,
          buttons: [Dialog.okButton()]
        });
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