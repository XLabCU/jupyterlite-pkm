import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { IMarkdownViewerTracker } from '@jupyterlab/markdownviewer';
import { IRenderMimeRegistry, IRenderMime } from '@jupyterlab/rendermime';

/**
 * SVG icon for copy button
 */
const COPY_ICON_SVG = `
<svg class="pkm-copy-icon" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
  <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
</svg>
`;

/**
 * SVG icon for success state
 */
const CHECK_ICON_SVG = `
<svg class="pkm-copy-icon" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
  <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
</svg>
`;

/**
 * Language mapping for common aliases
 */
const LANGUAGE_ALIASES: Record<string, string> = {
  'py': 'python',
  'js': 'javascript',
  'ts': 'typescript',
  'sh': 'bash',
  'yml': 'yaml',
  'md': 'markdown',
  'htm': 'html'
};

/**
 * Create copy button element
 */
function createCopyButton(codeText: string, language?: string): HTMLElement {
  const button = document.createElement('button');
  button.className = 'pkm-code-copy-btn';
  button.title = 'Copy code to clipboard';
  button.innerHTML = `${COPY_ICON_SVG}<span>Copy</span>`;
  
  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    
    try {
      await navigator.clipboard.writeText(codeText);
      
      // Update button to show success state
      button.innerHTML = `${CHECK_ICON_SVG}<span>Copied!</span>`;
      button.classList.add('copied');
      
      // Reset button after 2 seconds
      setTimeout(() => {
        button.innerHTML = `${COPY_ICON_SVG}<span>Copy</span>`;
        button.classList.remove('copied');
      }, 2000);
      
    } catch (error) {
      console.error('Failed to copy code:', error);
      
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = codeText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        button.innerHTML = `${CHECK_ICON_SVG}<span>Copied!</span>`;
        button.classList.add('copied');
        
        setTimeout(() => {
          button.innerHTML = `${COPY_ICON_SVG}<span>Copy</span>`;
          button.classList.remove('copied');
        }, 2000);
        
      } catch (fallbackError) {
        console.error('Fallback copy failed:', fallbackError);
        button.innerHTML = `${COPY_ICON_SVG}<span>Failed</span>`;
        
        setTimeout(() => {
          button.innerHTML = `${COPY_ICON_SVG}<span>Copy</span>`;
        }, 2000);
      }
    }
  });
  
  return button;
}

/**
 * Create language label element
 */
function createLanguageLabel(language: string): HTMLElement {
  const label = document.createElement('div');
  const normalizedLang = LANGUAGE_ALIASES[language.toLowerCase()] || language.toLowerCase();
  label.className = `pkm-code-language ${normalizedLang}`;
  label.textContent = normalizedLang;
  return label;
}

/**
 * Extract language from code block class names
 */
function extractLanguage(codeElement: HTMLElement): string | undefined {
  const classes = codeElement.className.split(' ');
  for (const className of classes) {
    if (className.startsWith('language-')) {
      return className.replace('language-', '');
    }
    if (className.startsWith('hljs-')) {
      continue; // Skip highlight.js classes
    }
    // Check if it's a direct language class
    if (['python', 'javascript', 'typescript', 'bash', 'shell', 'r', 'sql', 'json', 'css', 'html', 'markdown', 'yaml'].includes(className.toLowerCase())) {
      return className.toLowerCase();
    }
  }
  return undefined;
}

/**
 * Extract language from fence notation (```python)
 */
function extractLanguageFromContent(preElement: HTMLElement): string | undefined {
  // Look for the code element inside the pre
  const codeElement = preElement.querySelector('code');
  if (codeElement) {
    return extractLanguage(codeElement);
  }
  return undefined;
}

/**
 * Process code blocks to add copy buttons and language labels
 */
function processCodeBlocks(container: HTMLElement): void {
  const codeBlocks = container.querySelectorAll('pre');
  
  codeBlocks.forEach((preElement: HTMLElement) => {
    // Skip if already processed
    if (preElement.querySelector('.pkm-code-copy-btn')) {
      return;
    }
    
    const codeElement = preElement.querySelector('code');
    if (!codeElement) {
      return;
    }
    
    // Extract code text
    const codeText = codeElement.textContent || '';
    if (!codeText.trim()) {
      return;
    }
    
    // Extract language
    const language = extractLanguageFromContent(preElement);
    
    // Add language label if language is detected
    if (language) {
      const languageLabel = createLanguageLabel(language);
      preElement.appendChild(languageLabel);
    }
    
    // Add copy button
    const copyButton = createCopyButton(codeText, language);
    preElement.appendChild(copyButton);
    
    // Ensure pre element has relative positioning
    if (getComputedStyle(preElement).position === 'static') {
      preElement.style.position = 'relative';
    }
  });
}

/**
 * Plugin to add copy functionality to code blocks
 */
export const codeCopyPlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlite/pkm-extension:code-copy',
  description: 'Add copy functionality to code blocks in markdown',
  autoStart: true,
  requires: [
    IMarkdownViewerTracker,
    IRenderMimeRegistry
  ],
  activate: (
    app: JupyterFrontEnd,
    markdownTracker: IMarkdownViewerTracker,
    rendermime: IRenderMimeRegistry
  ) => {
    console.log('Code copy plugin activated');

    // Override the markdown renderer to add copy buttons
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
            // Call the original render method first
            const result = await originalRenderModel(model);
            
            // Process code blocks after rendering
            if (renderer.node) {
              // Use a slight delay to ensure DOM is fully ready
              setTimeout(() => {
                processCodeBlocks(renderer.node as HTMLElement);
              }, 100);
            }
            
            return result;
          };
          
          return renderer;
        }
      }, 1); // Higher priority than the block embedding plugin
    }

    // Also process existing markdown viewers
    markdownTracker.widgetAdded.connect((tracker, widget) => {
      // Wait for the widget to be fully rendered
      setTimeout(() => {
        if (widget.content.node) {
          processCodeBlocks(widget.content.node);
        }
      }, 200);
    });

    // Process code blocks when content changes
    markdownTracker.currentChanged.connect((tracker, widget) => {
      if (widget && widget.content.node) {
        setTimeout(() => {
          processCodeBlocks(widget.content.node);
        }, 100);
      }
    });

    console.log('Code copy functionality ready');
  }
};