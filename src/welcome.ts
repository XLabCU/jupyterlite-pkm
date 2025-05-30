import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { Dialog, showDialog } from '@jupyterlab/apputils';
import { IStateDB } from '@jupyterlab/statedb';
import { Widget } from '@lumino/widgets';

/**
 * The command IDs used by the welcome plugin
 */
namespace CommandIDs {
  export const showWelcome = 'pkm:show-welcome';
}

/**
 * The welcome dialog plugin
 */
export const welcomePlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlite/pkm-extension:welcome',
  description: 'Shows a welcome dialog for the PKM extension',
  autoStart: true,
  requires: [IStateDB],
  activate: async (app: JupyterFrontEnd, state: IStateDB) => {
    const WELCOME_DIALOG_KEY = 'pkm-extension:welcome-shown';
    
    // Check if we should show the welcome dialog
    const shouldShow = await state.fetch(WELCOME_DIALOG_KEY);
    
    // Function to show the welcome dialog
    const showWelcomeDialog = async () => {
      const result = await showDialog({
        title: 'Welcome to JupyterLite PKM Extension',
        body: createWelcomeContent(),
        buttons: [
          Dialog.okButton({ label: 'Got it!' }),
          Dialog.createButton({
            label: "Don't show again",
            displayType: 'warn'
          })
        ],
        hasClose: true
      });
      
      // If user clicked "Don't show again", save that preference
      if (result.button.label === "Don't show again") {
        await state.save(WELCOME_DIALOG_KEY, true);
      }
    };
    
    // Add command to manually show welcome dialog
    app.commands.addCommand(CommandIDs.showWelcome, {
      label: 'Show PKM Welcome',
      execute: showWelcomeDialog
    });
    
    // Show on first load if not previously dismissed
    if (!shouldShow) {
      // Wait a bit for the app to fully load
      setTimeout(showWelcomeDialog, 1000);
    }
  }
};

/**
 * Create the welcome dialog content
 */
function createWelcomeContent(): Widget {
  const widget = new Widget();
  const container = document.createElement('div');
  container.style.padding = '10px';
  container.style.maxWidth = '500px';
  container.style.minHeight = '600px';
  
  container.innerHTML = `
    <p style="margin-bottom: 15px;">
      The <strong>Personal Knowledge Management (PKM) extension</strong> is now active! 
      This extension transforms JupyterLite into a powerful note-taking and knowledge management system.</p>
      <p>This approach gives you computational reproducibility (notebooks) + narrative synthesis (markdown) + knowledge linking (PKM features).
  It's like having Jupyter notebooks as your "lab bench" and markdown notes as your "research papers" that can dynamically reference your
  work!
    </p>


    
    <h3 style="margin-top: 20px; margin-bottom: 10px;">✨ Key Features</h3>
    
    <h4 style="margin-top: 15px; margin-bottom: 5px;">📝 Wikilinks</h4>
    <ul style="margin-left: 20px; margin-bottom: 10px;">
      <li><code>[[Note Name]]</code> - Create links between notes</li>
      <li><code>[[note|display text]]</code> - Link with custom display text</li>
      <li>Ctrl/Cmd + Click to follow links</li>
      <li>Auto-completion for existing notes</li>
      <li>You can wikilink your markdown notes to your python .ipynb files.</li>
    </ul>
    
    <h4 style="margin-top: 15px; margin-bottom: 5px;">📊 Notebook Embedding</h4>
    <ul style="margin-left: 20px; margin-bottom: 10px;">
      <li><code>![[notebook.ipynb]]</code> - Embed entire notebooks</li>
      <li><code>![[notebook.ipynb#cell-id]]</code> - Embed specific cells</li>
      <li>Live preview of embedded content</li>
    </ul>
    
    <h4 style="margin-top: 15px; margin-bottom: 5px;">⌨️ Keyboard Shortcuts</h4>
    <ul style="margin-left: 20px; margin-bottom: 10px;">
      <li><kbd>Alt</kbd> + <kbd>m</kbd> - Toggle markdown preview</li>
      <li><kbd>Alt</kbd> + <kbd>f</kbd> - Global search</li>
      <li><kbd>Alt</kbd> + <kbd>b</kbd> - See what links to a note</li>
    </ul>
    
    <h4 style="margin-top: 15px; margin-bottom: 5px;">💾 Auto-Save</h4>
    <p style="margin-left: 20px; margin-bottom: 10px;">
      Your notes are automatically saved every 30 seconds while editing.
    </p>
    
    <h4 style="margin-top: 15px; margin-bottom: 5px;">🔍 Search & Navigation</h4>
    <ul style="margin-left: 20px; margin-bottom: 10px;">
      <li>Full-text search across all notes and notebooks</li>
      <li>Backlinks panel shows all notes linking to current note</li>
      <li>Quick navigation between connected notes</li>
    </ul>
    
    <p style="margin-top: 20px; font-style: italic; color: #666;">
      💡 Tip: You can access this welcome message anytime from the Command Palette 
      (search for "Show PKM Welcome").
      💡 Tip: The plugin looks for <pre>start.md</pre> to open at startup. 
    </p>
  `;
  
  widget.node.appendChild(container);
  return widget;
}