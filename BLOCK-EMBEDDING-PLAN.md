# Block Embedding Implementation Plan

## 🎯 Overview
Implement block embedding functionality that allows embedding content from other files into markdown notes, with special support for Jupyter notebook cells.

## 📋 Features to Implement

### 1. **Markdown Block Embedding**
- Embed specific paragraphs, headings, or sections from other .md files
- Reference by line numbers, heading names, or block IDs

### 2. **Jupyter Notebook Cell Embedding** 
- Embed individual code cells from .ipynb files
- Embed cell outputs (text, images, tables)
- Support for both code and markdown cells

### 3. **Static Snapshots with Timestamps**
- Embedded content is static (not live-updating)
- Include timestamp when embed was created
- Optional refresh functionality to update content

## 🔧 Syntax Design

### Basic Markdown Embedding
```markdown
![[filename.md#heading]]           # Embed content under heading
![[filename.md#L10-20]]            # Embed lines 10-20
![[filename.md#block-id]]          # Embed by block ID
```

### Jupyter Notebook Embedding
```markdown
![[notebook.ipynb#cell-1]]         # Embed entire cell (code + output)
![[notebook.ipynb#cell-1-code]]    # Embed only the code
![[notebook.ipynb#cell-1-output]]  # Embed only the output
![[notebook.ipynb#cell-range-1-3]] # Embed cells 1-3
```

### Advanced Options
```markdown
![[file.md#heading|Custom Title]]  # Custom display title
![[file.md#heading|refresh]]       # Show refresh button
![[file.md#heading|timestamp]]     # Show when embedded
```

## 🏗️ Technical Architecture

### 1. **Parser Enhancement**
- Extend existing wikilink parser to handle `![[` syntax
- Parse embedding targets and options
- Support for different reference types (heading, line, cell)

### 2. **Content Extraction Engine**
```typescript
interface EmbedTarget {
  file: string;
  type: 'markdown' | 'notebook';
  reference: string;          // heading, line range, cell ID
  options: EmbedOptions;
}

interface EmbedOptions {
  title?: string;
  showRefresh?: boolean;
  showTimestamp?: boolean;
  embedType?: 'full' | 'code' | 'output';
}
```

### 3. **Markdown Content Extraction**
- **By heading**: Extract content from heading to next heading
- **By line range**: Extract specific line numbers
- **By block ID**: Support for custom block identifiers

### 4. **Notebook Content Extraction**
- Parse .ipynb JSON structure
- Extract cell content by index or ID
- Handle different cell types (code, markdown, raw)
- Extract outputs (text, HTML, images)

### 5. **Rendering Engine**
```typescript
interface EmbedBlock {
  id: string;
  source: EmbedTarget;
  content: string;
  timestamp: Date;
  contentType: 'markdown' | 'code' | 'output' | 'html';
}
```

## 🎨 UI/UX Design

### 1. **Embed Block Appearance**
```
┌─────────────────────────────────────────────┐
│ 📄 filename.md#heading                      │
│ 🕒 Embedded on 2024-01-15 10:30 AM    [↻]  │
├─────────────────────────────────────────────┤
│                                             │
│ [Embedded content appears here]             │
│                                             │
└─────────────────────────────────────────────┘
```

### 2. **Notebook Cell Embed Appearance**
```
┌─────────────────────────────────────────────┐
│ 📓 analysis.ipynb#cell-3 (code + output)    │
│ 🕒 Embedded on 2024-01-15 10:30 AM    [↻]  │
├─────────────────────────────────────────────┤
│ [In]: import pandas as pd                   │
│       df = pd.read_csv('data.csv')          │
│       df.head()                             │
├─────────────────────────────────────────────┤
│ [Out]:                                      │
│   name    value                             │
│ 0 Alice   100                               │
│ 1 Bob     200                               │
└─────────────────────────────────────────────┘
```

### 3. **Visual Indicators**
- **Border styling** to distinguish embedded content
- **Source file icon** (📄 for .md, 📓 for .ipynb)
- **Timestamp display** with clock icon 🕒
- **Refresh button** [↻] when enabled
- **Content type badges** (code, output, full)

## 🔍 Autocomplete Enhancement

### Enhanced Wikilink Autocomplete
When typing `![[filename.ipynb#`, show:
- Available cell indices
- Cell types (code, markdown)
- Brief cell previews

Example dropdown:
```
📓 analysis.ipynb
├─ cell-1 (markdown) "# Data Analysis"
├─ cell-2 (code) "import pandas as pd"
├─ cell-3 (code) "df = pd.read_csv..."
└─ cell-4 (code) "plt.figure(figsize..."
```

## 📁 File Structure

### New Files to Create
```
src/
├─ block-embedding.ts          # Main embedding logic
├─ content-extractors/
│  ├─ markdown-extractor.ts    # Extract from .md files
│  ├─ notebook-extractor.ts    # Extract from .ipynb files
│  └─ extractor-utils.ts       # Common utilities
├─ embed-renderer.ts           # Render embedded blocks
└─ embed-autocomplete.ts       # Enhanced autocomplete
```

## 🔄 Implementation Phases

### Phase 1: Basic Markdown Embedding
1. Extend wikilink parser for `![[` syntax
2. Implement markdown content extraction
3. Basic rendering with timestamps
4. Simple heading-based references

### Phase 2: Notebook Embedding
1. Implement .ipynb JSON parsing
2. Cell content extraction
3. Code and output rendering
4. Cell indexing and references

### Phase 3: Enhanced Features
1. Line range references
2. Custom block IDs
3. Refresh functionality
4. Enhanced autocomplete

### Phase 4: Advanced Options
1. Custom titles and styling
2. Embedding options (code-only, output-only)
3. Cell range embedding
4. Performance optimizations

## 🧪 Testing Strategy

### Test Cases
1. **Markdown embedding**: Headings, line ranges, missing content
2. **Notebook embedding**: Different cell types, outputs, malformed JSON
3. **Edge cases**: Non-existent files, circular references, large content
4. **UI/UX**: Refresh functionality, autocomplete, visual styling

### Test Files to Create
- `embedding-test.md` - Test various embedding syntaxes
- `sample-notebook.ipynb` - Test notebook for embedding
- `source-content.md` - Source content for testing

## 🎛️ Configuration Options

### Extension Settings
```typescript
interface EmbedSettings {
  maxEmbedSize: number;           // Max characters per embed
  showTimestamps: boolean;        // Default timestamp visibility
  enableRefresh: boolean;         // Default refresh button
  cacheEmbeds: boolean;          // Cache embedded content
  refreshShortcut: string;        // Keyboard shortcut for refresh
}
```

## 🚀 Future Enhancements

### Potential Advanced Features
1. **Live embedding** (auto-refresh when source changes)
2. **Transclusion editing** (edit embedded content in place)
3. **Embed analytics** (track which content is embedded where)
4. **Export handling** (how embeds appear in exported documents)
5. **Collaborative features** (shared embed libraries)

## 📊 Success Metrics

### Functionality Goals
- ✅ Embed markdown sections by heading
- ✅ Embed notebook cells with code and output
- ✅ Timestamps and refresh functionality
- ✅ Enhanced autocomplete for embedding
- ✅ Clean, distinguishable visual presentation

### Performance Goals
- Parse and render embeds in <200ms
- Support files up to 10MB
- Smooth autocomplete with <100ms response
- Minimal impact on existing functionality

---

## 📊 Current Implementation Status

### ✅ **Phase 1 - Completed Components:**

1. **Parser Implementation** - `src/block-embedding.ts:13`
   - `BLOCK_EMBED_REGEX` matches `![[file.md#ref|title]]` syntax
   - Supports heading references, block IDs, and custom titles

2. **Content Extractors** - `src/block-embedding.ts:43-210`
   - `extractByHeading()` - Extracts content from heading to next same-level heading
   - `extractByBlockId()` - Extracts paragraphs containing `^block-id` markers
   - Enhanced debugging with detailed console logging

3. **Visual Renderer** - `src/block-embedding.ts:233-253`
   - Obsidian-style bordered blocks with headers
   - Timestamps and source file information
   - Error states for missing content/files

4. **CSS Styling** - `src/block-embedding.ts:371-430`
   - Professional block styling with borders and shadows
   - Distinct error state styling
   - Responsive design with proper spacing

5. **Integration** - `src/index.ts:44`
   - Registered as `blockEmbeddingPlugin` in main extension
   - Hooks into existing markdown renderer pipeline

### 🧪 **Test Files Created:**
- **`embedding-source.md`** - Source content with headings and `^block-id` markers
- **`embedding-test.md`** - Comprehensive test cases for all syntax types
- **`block-embedding-guide.md`** - User documentation and usage examples

### 🐛 **Current Status: Debugging Phase**

**Issue Identified:** Block embeds are parsed correctly but content extraction is failing.
- Console shows: "Found 9 block embeds"
- Console shows: "Processing embed: embedding-source.md # Introduction"
- Result: All embeds show "❌ Block not found" error

**Enhanced Debugging Added:**
- Detailed file access logging
- Heading discovery and matching traces
- Block ID pattern matching verification
- Available content listing when extraction fails

**Next Steps:**
1. **Test with enhanced debugging** to identify root cause
2. **Fix identified issues** (likely file path resolution or content matching)
3. **Verify functionality** with test files
4. **Proceed to Phase 2** (Jupyter notebook embedding)

### 🔍 **Debug Console Output Expected:**
```
Attempting to extract heading "Introduction" from file: embedding-source.md
File has X lines
Looking for headings in file: [first 10 lines...]
Found heading at line Y: "Introduction" (level 1)
Matched heading "Introduction" at line Y
Extracted Z lines of content
```

**OR (if failing):**
```
Heading "Introduction" not found in embedding-source.md
Available headings:
  Line 0: # Source Document for Embedding Tests
  Line 4: ## Introduction
  ...
```

This will reveal whether the issue is file path resolution, heading text matching, or content parsing.

---

This plan provides a comprehensive roadmap for implementing block embedding with special Jupyter notebook support. **Phase 1 implementation is complete** and ready for debugging and testing.