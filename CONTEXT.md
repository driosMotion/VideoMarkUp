# Video Markup - Project Context

## Overview
A client-side web application for video post-production coordination. Upload videos, capture frame snapshots, annotate them with drawings and tags, add comments, and export PDF reports.

## Tech Stack
- **Frontend**: Vanilla HTML/CSS/JavaScript (no build step)
- **Drawing**: Fabric.js 5.3.1 (canvas manipulation)
- **Storage**: Dexie.js (IndexedDB wrapper)
- **PDF Export**: jsPDF 2.5.1
- **Fonts**: Outfit (UI), JetBrains Mono (timecodes)

## Project Structure
```
VideoMarkup/
├── index.html              # Main entry point
├── css/
│   ├── main.css            # Global styles, layout, variables
│   ├── video-player.css    # Video upload & player styles
│   ├── snapshot-cards.css  # Snapshot cards & modal styles
│   └── drawing-tools.css   # Drawing toolbar styles
├── js/
│   ├── app.js              # Main app initialization, keyboard shortcuts
│   ├── video-handler.js    # Video upload, playback, frame navigation
│   ├── snapshot-manager.js # Capture, store, display snapshots
│   ├── drawing-tool.js     # Fabric.js canvas setup & tools
│   ├── tag-manager.js      # Tag selection & state
│   ├── storage.js          # IndexedDB operations (Dexie)
│   └── pdf-exporter.js     # PDF report generation
├── assets/                 # Static assets (icons if needed)
└── CONTEXT.md              # This file
```

## Data Model (IndexedDB)

### Projects Table
| Field | Type | Description |
|-------|------|-------------|
| id | number (auto) | Primary key |
| name | string | Project name (from filename) |
| videoFileName | string | Original video filename |
| videoData | Blob | Video file data |
| createdAt | Date | Creation timestamp |

### Snapshots Table
| Field | Type | Description |
|-------|------|-------------|
| id | number (auto) | Primary key |
| projectId | number | Foreign key to project |
| timestamp | number | Video time in seconds |
| originalImage | string | Base64 PNG of frame |
| markedUpImage | string | Base64 PNG with drawings |
| fabricData | object | Fabric.js JSON for editing |
| comment | string | User comment |
| tags | array | Array of tag IDs |
| tagHours | object | Hours per tag { "vfx": 2, "3d": 4 } |
| createdAt | Date | Creation timestamp |

## Key Features

### Project Manager
- Dropdown menu in header to manage projects
- Switch between saved projects
- Delete projects
- Create new project (reset to upload state)
- Shows project date and active indicator

### Video Player
- Drag & drop or click to upload video (MP4, WebM, MOV)
- Supports all aspect ratios (horizontal, vertical, square)
- Custom controls: play/pause, frame step (←/→), seek bar
- Timecode display (HH:MM:SS:FF format, 24fps default)
- Volume control with mute toggle
- Snapshot markers on timeline
- Keyboard shortcuts displayed below timeline

### Snapshot Capture
- Click "Capture Snapshot" or press `S` key
- Flash animation feedback
- Auto-saves to IndexedDB
- Appears in sidebar list with thumbnail
- Click to seek video to that frame
- Click to open in edit modal

### Snapshot Editor (Modal)
- Full-size preview with Fabric.js overlay
- Drawing tools:
  - Select (V) - Move/resize objects
  - Draw (B) - Freehand brush
  - Rectangle (R) - Draw rectangles
  - Circle (C) - Draw ellipses
  - Arrow (A) - Draw arrows with heads
  - Text (T) - Add text annotations
  - Eraser (E) - Delete objects
- Color palette (6 colors)
- Brush size slider (1-20px)
- Undo & Clear buttons
- Tag buttons with visual states
- Comment textarea (auto-save on close)

### Tags & Staffing
Available tags with color coding and hour estimates:
- VFX (red)
- Rotoscopy (teal)
- 3D (purple)
- Color (yellow)
- Composite (cyan)
- Cleanup (green)
- Audio (pink)
- Review (orange)

Each tag can have an hour estimate for staffing/resource planning. When you select a tag, enter the estimated hours needed for that department. The hours are displayed on snapshot cards and in the PDF report.

### Delete Snapshots
- Hover over a snapshot card to reveal the delete button (trash icon)
- Click to delete the snapshot directly from the sidebar

### PDF Export
- Cover page with project name (auto-sized for long names), date, snapshot count
- **Staffing Summary page** with:
  - Table showing shots and hours per department
  - Total hours and estimated work days (8h/day)
  - Project summary box
- One page per snapshot with:
  - Marked-up image (centered)
  - Timecode
  - Tags with hours (color-coded)
  - Comment text
- Dark theme styling
- Auto-generated filename with date

### Project Sharing (Import/Export)
- **Share button**: Export current project as a `.zip` file
  - Includes video file, all snapshots, drawings, comments, tags, hours
  - Can be sent to another user
- **Import button**: Load a shared `.zip` project file
  - Restores the full project with all data
  - Video, snapshots, markups, and metadata preserved
- Uses JSZip library for compression

## Keyboard Shortcuts

### Global (when video loaded)
| Key | Action |
|-----|--------|
| Space | Play/Pause |
| ← | Previous frame |
| → | Next frame |
| S | Capture snapshot |
| Escape | Close modal |

### In Editor Modal
| Key | Action |
|-----|--------|
| V | Select tool |
| B | Brush/Draw tool |
| R | Rectangle tool |
| C | Circle tool |
| A | Arrow tool |
| T | Text tool |
| E | Eraser tool |
| Ctrl/Cmd+Z | Undo |

## CSS Variables (Theming)
Main colors defined in `css/main.css`:
```css
--bg-primary: #0d0d0f;      /* Main background */
--bg-secondary: #141416;     /* Cards, sidebar */
--accent-primary: #6366f1;   /* Primary purple */
--text-primary: #f0f0f2;     /* Main text */
--text-secondary: #a0a0a8;   /* Muted text */
```

## Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires: ES6+, IndexedDB, Canvas API, Blob API
- Not tested in IE11

## Known Limitations
1. Large videos may be slow to store (stored as blobs in IndexedDB)
2. No cloud sync (fully client-side)
3. Frame rate assumed 24fps (not detected from video)
4. Single project at a time in editor

## Future Enhancements (Not Implemented)
- [ ] Frame rate detection from video metadata
- [ ] Multiple brush types (spray, highlighter)
- [ ] Snapshot reordering (drag to sort)
- [ ] Filter snapshots by tag
- [ ] Export to other formats (CSV, JSON)
- [ ] Project import/export
- [ ] Collaborative features (WebSocket)
- [ ] Timeline thumbnail scrubbing

## Development Notes
- All modules are global (`window.ModuleName`)
- No build step required - just serve files
- CDN dependencies loaded in `index.html`
- Console logging available via `Storage`, `VideoHandler`, etc.

## Running Locally
Simply open `index.html` in a browser, or serve with any static file server:
```bash
# Python
python -m http.server 8000

# Node.js (npx)
npx serve .

# PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

