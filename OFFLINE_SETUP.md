# Offline Setup Guide

This app works 100% offline with no internet connection required.

## Quick Start

All dependencies are included in the repository:

1. Clone/download the repository
2. Double-click `index.html`
3. The app loads and runs completely offline

No additional setup needed! The `libs/` and `fonts/` directories are included with all necessary files.

## Manual Setup (If Dependencies Are Missing)

If for some reason the `libs/` and `fonts/` directories are empty or missing, download the dependencies:

### Download JavaScript Libraries

Create the `libs/` directory and download:

```bash
mkdir -p libs
cd libs

# Download libraries
curl -o fabric.min.js https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js
curl -o dexie.js https://unpkg.com/dexie@3.2.4/dist/dexie.js
curl -o jspdf.umd.min.js https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
curl -o jszip.min.js https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js

cd ..
```

### Download Fonts

Create the `fonts/` directory and download:

```bash
mkdir -p fonts
cd fonts

# JetBrains Mono
curl -o jetbrains-mono-400.woff2 "https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxTOlOVkQ.woff2"
curl -o jetbrains-mono-500.woff2 "https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjOlOVkQ.woff2"
curl -o jetbrains-mono-600.woff2 "https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKw5PVOVkQ.woff2"

# Outfit
curl -o outfit-300.woff2 "https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4TC1C4G-EiAou6Y.woff2"
curl -o outfit-400.woff2 "https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4W61C4G-EiAou6Y.woff2"
curl -o outfit-500.woff2 "https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4QK1C4G-EiAou6Y.woff2"
curl -o outfit-600.woff2 "https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4e6yC4G-EiAou6Y.woff2"
curl -o outfit-700.woff2 "https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4deyC4G-EiAou6Y.woff2"

cd ..
```

## File Structure

After setup, your directory should look like:

```
VideoMarkup/
├── libs/                 (~1.5MB)
│   ├── fabric.min.js
│   ├── dexie.js
│   ├── jspdf.umd.min.js
│   └── jszip.min.js
├── fonts/                (~13KB)
│   ├── jetbrains-mono-400.woff2
│   ├── jetbrains-mono-500.woff2
│   ├── jetbrains-mono-600.woff2
│   ├── outfit-300.woff2
│   ├── outfit-400.woff2
│   ├── outfit-500.woff2
│   ├── outfit-600.woff2
│   └── outfit-700.woff2
├── css/
│   ├── fonts.css         (references local fonts)
│   └── ...
├── js/
│   └── ...
├── index.html
└── HogarthIsologo.png
```

## Usage

Once set up, the app works completely offline:

- **No internet needed** - All resources are local
- **Double-click to run** - Just open `index.html` in your browser
- **Fully portable** - Copy the entire folder anywhere
- **Privacy-first** - No external requests, all data stays local
- **Air-gapped compatible** - Works in secure environments

## Notes

- The `libs/` and `fonts/` folders are included in the repository (~1.5MB total)
- Works both online (Vercel) and offline (double-click HTML)
- All app data is stored in browser IndexedDB (persists between sessions)
- Works best in modern browsers (Chrome, Firefox, Safari, Edge)
- No external CDN dependencies - fully self-contained

---

**Made by Production Team - Hogarth Argentina**
