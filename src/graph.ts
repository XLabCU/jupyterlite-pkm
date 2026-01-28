import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette } from '@jupyterlab/apputils';
import { IDocumentManager } from '@jupyterlab/docmanager';

const COMMAND_SHOW_GRAPH = 'pkm:show-knowledge-graph';
const GRAPH_NOTEBOOK_PATH = '_pkm_knowledge_graph.ipynb';

/**
 * Python source for the knowledge graph cell.
 * Reads wikilink-index.json from the JupyterLite filesystem,
 * builds a networkx DiGraph, and renders it with matplotlib.
 */
const GRAPH_CODE = `import json
import os
import networkx as nx
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

# --- Load the wikilink index ---
index_path = "wikilink-index.json"

if not os.path.exists(index_path):
    print("wikilink-index.json not found.")
    print("Open the Backlinks panel (Alt+B) first to generate it,")
    print("or run the 'PKM: Rebuild Wikilink Index' command.")
else:
    with open(index_path) as f:
        index = json.load(f)

    # --- Build graph ---
    G = nx.DiGraph()

    for source, targets in index.get("links", {}).items():
        # Clean up paths to short display names
        source_name = source.rsplit("/", 1)[-1].replace(".md", "").replace(".ipynb", "")
        G.add_node(source_name, file=source)

        for target in targets:
            target_name = target.rsplit("/", 1)[-1].replace(".md", "").replace(".ipynb", "")
            G.add_node(target_name, file=target)
            G.add_edge(source_name, target_name)

    if len(G.nodes) == 0:
        print("No wikilinks found in the index. Add [[links]] between your notes!")
    else:
        # --- Compute layout and styling ---
        # Use spring layout for organic clustering
        pos = nx.spring_layout(G, k=1.5, iterations=50, seed=42)

        # Node sizes proportional to in-degree (how many things link to it)
        in_deg = dict(G.in_degree())
        node_sizes = [300 + 200 * in_deg.get(n, 0) for n in G.nodes]

        # Color by type: check if original file was .ipynb
        node_colors = []
        for n in G.nodes:
            f = G.nodes[n].get("file", "")
            if f.endswith(".ipynb"):
                node_colors.append("#f97316")  # orange for notebooks
            else:
                node_colors.append("#3b82f6")  # blue for markdown

        # --- Draw ---
        fig, ax = plt.subplots(figsize=(12, 8))
        fig.patch.set_facecolor("#1e1e2e")
        ax.set_facecolor("#1e1e2e")

        nx.draw_networkx_edges(
            G, pos, ax=ax,
            edge_color="#555555",
            arrows=True,
            arrowsize=12,
            alpha=0.6,
            width=1.2,
            connectionstyle="arc3,rad=0.1",
        )

        nx.draw_networkx_nodes(
            G, pos, ax=ax,
            node_size=node_sizes,
            node_color=node_colors,
            edgecolors="#ffffff",
            linewidths=0.8,
            alpha=0.9,
        )

        nx.draw_networkx_labels(
            G, pos, ax=ax,
            font_size=8,
            font_color="#e0e0e0",
            font_weight="bold",
        )

        # Legend
        legend_handles = [
            mpatches.Patch(color="#3b82f6", label=f"Markdown ({sum(1 for c in node_colors if c == '#3b82f6')})"),
            mpatches.Patch(color="#f97316", label=f"Notebook ({sum(1 for c in node_colors if c == '#f97316')})"),
        ]
        ax.legend(handles=legend_handles, loc="upper left",
                  facecolor="#2e2e3e", edgecolor="#555555",
                  labelcolor="#e0e0e0", fontsize=9)

        ax.set_title(
            f"Knowledge Graph  \\u2014  {len(G.nodes)} notes, {len(G.edges)} links",
            color="#e0e0e0", fontsize=14, pad=15
        )
        ax.axis("off")
        plt.tight_layout()
        plt.show()

        # --- Print stats ---
        print(f"\\nGraph Statistics:")
        print(f"  Nodes: {len(G.nodes)}")
        print(f"  Edges: {len(G.edges)}")

        if len(G.nodes) > 1:
            # Most connected notes (by incoming links)
            top = sorted(in_deg.items(), key=lambda x: x[1], reverse=True)[:5]
            print(f"\\nMost linked-to notes:")
            for name, deg in top:
                if deg > 0:
                    print(f"  {name}: {deg} incoming links")

            # Orphan notes (no incoming or outgoing links)
            isolates = list(nx.isolates(G))
            if isolates:
                print(f"\\nOrphan notes (no links): {', '.join(isolates)}")
`;

/**
 * Build a minimal notebook JSON structure with the graph code cell.
 */
function makeGraphNotebook(): string {
  return JSON.stringify({
    cells: [
      {
        cell_type: 'markdown',
        metadata: {},
        source: [
          '# Knowledge Graph\n',
          '\n',
          'This notebook visualizes the wikilink connections between your notes.\n',
          'Run the cell below to generate the graph.\n',
          '\n',
          '> **Tip:** Re-run after adding new `[[links]]` to see updates.\n',
          '> Make sure the Backlinks panel has been opened at least once (Alt+B) so the index exists.'
        ]
      },
      {
        cell_type: 'code',
        execution_count: null,
        metadata: { tags: ['graph'] },
        outputs: [],
        source: GRAPH_CODE.split('\n').map((line, i, arr) =>
          i < arr.length - 1 ? line + '\n' : line
        )
      }
    ],
    metadata: {
      kernelspec: {
        display_name: 'Python (Pyodide)',
        language: 'python',
        name: 'python'
      },
      language_info: {
        name: 'python',
        version: '3.11'
      }
    },
    nbformat: 4,
    nbformat_minor: 5
  }, null, 2);
}

/**
 * Plugin to visualize the knowledge graph via a Python/networkx notebook
 */
export const graphPlugin: JupyterFrontEndPlugin<void> = {
  id: '@jupyterlite/pkm-extension:graph',
  description: 'Visualize the PKM knowledge graph using networkx and matplotlib',
  autoStart: true,
  requires: [IDocumentManager],
  optional: [ICommandPalette],
  activate: (
    app: JupyterFrontEnd,
    docManager: IDocumentManager,
    palette: ICommandPalette | null
  ) => {
    console.log('Graph plugin activated');

    app.commands.addCommand(COMMAND_SHOW_GRAPH, {
      label: 'PKM: Show Knowledge Graph',
      caption: 'Open a notebook that visualizes note connections using networkx',
      execute: async () => {
        try {
          // Check if the notebook already exists
          let exists = false;
          try {
            await docManager.services.contents.get(GRAPH_NOTEBOOK_PATH);
            exists = true;
          } catch {
            // File doesn't exist, we'll create it
          }

          if (!exists) {
            // Create the notebook
            await docManager.services.contents.save(GRAPH_NOTEBOOK_PATH, {
              type: 'notebook',
              format: 'json',
              content: JSON.parse(makeGraphNotebook())
            });
          }

          // Open the notebook
          await docManager.openOrReveal(GRAPH_NOTEBOOK_PATH);
        } catch (error) {
          console.error('Failed to open knowledge graph notebook:', error);
        }
      }
    });

    if (palette) {
      palette.addItem({
        command: COMMAND_SHOW_GRAPH,
        category: 'PKM'
      });
    }

    app.commands.addKeyBinding({
      command: COMMAND_SHOW_GRAPH,
      keys: ['Alt G'],
      selector: 'body'
    });
  }
};
