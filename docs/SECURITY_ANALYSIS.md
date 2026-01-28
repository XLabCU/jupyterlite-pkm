# Security Analysis: JupyterLite PKM Extension

**Version**: 0.1.0
**Date**: January 2026
**Scope**: Full review of `@jupyterlite/pkm-extension` for teaching deployment

---

## 1. Executive Summary

This extension is **safe for teaching deployment**. It runs entirely in the browser sandbox, introduces no new attack vectors beyond JupyterLite's baseline, and properly delegates HTML sanitization to JupyterLab's built-in pipeline.

**Risk Level**: Low

---

## 2. Architecture Security Model

### 2.1 Execution Environment

All code runs in the browser's JavaScript engine. There is no server-side component.

| Component | Boundary |
|-----------|----------|
| Extension code | Browser JS sandbox |
| File storage | IndexedDB via JupyterLab Contents API |
| Notebook execution | Pyodide (Python) / WebR (R) WebAssembly sandboxes |
| Network access | Standard browser same-origin policy |

### 2.2 Data Flow

```
User Input (markdown text)
    |
    v
Wikilink Parser (regex-based, src/wikilinks.ts:68-96)
    |
    v
HTML Generation (links only, no script injection)
    |
    v
JupyterLab Markdown Sanitizer (strips unsafe attributes)
    |
    v
Post-render DOM manipulation (click handlers via addEventListener)
    |
    v
Rendered output (safe)
```

---

## 3. Detailed Findings

### 3.1 HTML Sanitization: SAFE

**Location**: `src/wikilinks.ts:403-410`, `src/block-embedding.ts:797-871`

The extension replaces JupyterLab's default markdown renderer but **delegates all rendering to the original renderer** after processing wikilink syntax. This means JupyterLab's HTML sanitizer remains in the pipeline.

The `wikilinkDisplayToTarget` Map (`src/wikilinks.ts:36`) exists specifically because sanitization strips custom `data-*` attributes. This is a correct workaround that preserves the security boundary.

**Assessment**: No sanitization bypass.

### 3.2 External Links: SAFE

**Location**: `src/wikilinks.ts:464-466`

External links include `rel="noopener noreferrer"` and `target="_blank"`:
```html
<a href="..." target="_blank" rel="noopener noreferrer">...</a>
```

**Assessment**: Prevents tab-nabbing and referrer leakage.

### 3.3 File Creation: SAFE

**Location**: `src/wikilinks.ts:291-372`

New files created via broken wikilinks use template content:
- Markdown: `# ${baseName}\n\n`
- Notebooks: Empty cell structure with standard metadata
- JSON/GeoJSON/CSV: Safe template structures

User-controlled input (`baseName`) is used only as a heading in markdown, not as executable content.

**Assessment**: No injection vector.

### 3.4 Search Results Display: SAFE

**Location**: `src/search.ts:265-269`

Search results use `escapeHtml()` before inserting into the DOM:
```typescript
${this.escapeHtml(before)}<mark>${this.escapeHtml(matched)}</mark>
```

The `escapeHtml` implementation creates a text node and reads its innerHTML, which is a standard safe pattern.

**Assessment**: No XSS vector.

### 3.5 DOM Manipulation: LOW RISK

**Location**: `src/wikilinks.ts:503-744`

Click handlers are attached post-render via `setTimeout(..., 100)`. This timing-based approach is a code smell but not a security vulnerability:
- Handlers use `preventDefault()` and `stopPropagation()`
- No user content is evaluated as code
- Handlers only navigate to files or show dialogs

**Assessment**: No vulnerability, but fragile implementation.

### 3.6 Console Logging: INFORMATIONAL

Multiple files contain extensive `console.log()` calls that output file paths and content previews. In shared environments, this could expose content to anyone with developer tools access. This is an informational finding, not a vulnerability.

**Recommendation**: Reduce debug logging for production builds.

---

## 4. Memory Safety

### 4.1 Bounded Structures (Mitigated)

| Structure | Location | Status |
|-----------|----------|--------|
| `wikilinkDisplayToTarget` Map | `src/wikilinks.ts:36` | **Mitigated** - Entries cleared on document close |
| `filePathCache` Map | `src/wikilinks.ts:43` | **Mitigated** - TTL-based expiration (10s) |
| File autocomplete cache | `src/wikilink-completer.ts:128` | **Mitigated** - TTL-based expiration (5s) |

### 4.2 Index Persistence

The backlinks index (`wikilink-index.json`) is persisted to IndexedDB. It grows proportionally with the number of files and wikilinks. For teaching deployments with hundreds of notes, this remains manageable.

### 4.3 Search Memory

Full-text search loads entire file contents into memory for scanning. This is bounded by the number and size of files in the workspace. For typical teaching deployments (< 1000 files), this is not a concern.

---

## 5. Threat Model for Teaching Deployment

### 5.1 Threats Considered

| Threat | Likelihood | Impact | Mitigated |
|--------|-----------|--------|-----------|
| XSS via markdown content | Low | Medium | Yes - JupyterLab sanitizer |
| File system escape | None | High | Yes - browser sandbox |
| Code injection via wikilinks | None | High | Yes - no eval/innerHTML of user input |
| Data exfiltration | None | Low | Yes - no network calls |
| Content tampering by students | Medium | Low | Partial - no read-only mode yet |
| Session data loss | Medium | Low | Partial - IndexedDB persistence |

### 5.2 Trust Boundaries

```
+-----------------------------------------------+
| Browser Sandbox                                 |
|  +-------------------------------------------+ |
|  | JupyterLite (Service Worker)              | |
|  |  +---------------------------------------+| |
|  |  | JupyterLab Application                || |
|  |  |  +-----------------------------------+|| |
|  |  |  | PKM Extension                     ||| |
|  |  |  | - Wikilinks (UI only)             ||| |
|  |  |  | - Backlinks (index only)          ||| |
|  |  |  | - Search (read only)              ||| |
|  |  |  | - Block embedding (read only)     ||| |
|  |  |  | - Export (download only)          ||| |
|  |  |  +-----------------------------------+|| |
|  |  +---------------------------------------+| |
|  +-------------------------------------------+ |
+-----------------------------------------------+
```

The PKM extension operates entirely within JupyterLab's application layer. It has no elevated privileges beyond the standard JupyterLab Contents API.

---

## 6. Recommendations

### For Current Deployment

1. **Safe to deploy as-is** for teaching environments
2. Advise students to refresh the browser periodically for long sessions
3. Student data persists in the browser only - clearing browser data deletes work

### For Future Hardening

1. **Add read-only mode** for preloaded teaching content
2. **Reduce console logging** in production builds
3. **Add content integrity checks** for preloaded notes (optional)
4. **Add periodic browser storage warnings** to alert students about data persistence limitations

---

## 7. Dependencies

All dependencies are standard JupyterLab packages maintained by the Jupyter project:

| Package | Purpose | Maintained By |
|---------|---------|---------------|
| `@jupyterlab/application` | App framework | Project Jupyter |
| `@jupyterlab/apputils` | UI utilities | Project Jupyter |
| `@jupyterlab/docmanager` | File management | Project Jupyter |
| `@jupyterlab/rendermime` | Rendering pipeline | Project Jupyter |
| `@jupyterlab/services` | Contents API | Project Jupyter |
| `@lumino/widgets` | Widget framework | Project Jupyter |
| `@lumino/signaling` | Event system | Project Jupyter |

No third-party dependencies outside the Jupyter ecosystem.

---

## 8. Conclusion

The JupyterLite PKM extension is a well-scoped UI extension that adds knowledge management features without introducing security vulnerabilities. It correctly delegates security-critical operations (HTML sanitization, code execution sandboxing) to the underlying JupyterLab and browser platforms.

**Verdict**: Approved for teaching deployment.
