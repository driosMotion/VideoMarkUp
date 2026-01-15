#!/bin/bash
# Build script to create a standalone HTML file
# All CSS, JS, fonts, and images will be inlined

OUTPUT="VideoMarkupStandalone.html"
echo "Building standalone HTML file..."

# Start HTML
cat > "$OUTPUT" << 'HTML_START'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Video Markup - Post-Production Helper Tool</title>
    
    <style>
HTML_START

# Inline all CSS files
echo "/* ========== FONTS ========== */" >> "$OUTPUT"
cat css/fonts.css | sed 's|url('\''\.\.\/fonts\/|url('\''data:font/woff2;base64,|g' >> "$OUTPUT"

echo "" >> "$OUTPUT"
echo "/* ========== MAIN CSS ========== */" >> "$OUTPUT"
cat css/main.css >> "$OUTPUT"

echo "" >> "$OUTPUT"
echo "/* ========== VIDEO PLAYER CSS ========== */" >> "$OUTPUT"
cat css/video-player.css >> "$OUTPUT"

echo "" >> "$OUTPUT"
echo "/* ========== SNAPSHOT CARDS CSS ========== */" >> "$OUTPUT"
cat css/snapshot-cards.css >> "$OUTPUT"

echo "" >> "$OUTPUT"
echo "/* ========== DRAWING TOOLS CSS ========== */" >> "$OUTPUT"
cat css/drawing-tools.css >> "$OUTPUT"

# Close style tag and continue HTML
cat >> "$OUTPUT" << 'HTML_AFTER_CSS'
    </style>
</head>
<body>
HTML_AFTER_CSS

# Get logo as base64
LOGO_B64=$(base64 -i HogarthIsologo.png | tr -d '\n')

# Insert HTML body with data: URLs for images
sed "s|src=\"HogarthIsologo.png\"|src=\"data:image/png;base64,$LOGO_B64\"|g" index.html | \
sed -n '/<body>/,/<\/body>/p' | \
sed '1d;$d' >> "$OUTPUT"

# Start script section
cat >> "$OUTPUT" << 'SCRIPT_START'

    <!-- Inline Scripts -->
    <script>
SCRIPT_START

# Inline library files
echo "/* ========== FABRIC.JS ========== */" >> "$OUTPUT"
cat libs/fabric.min.js >> "$OUTPUT"

echo "" >> "$OUTPUT"
echo "/* ========== DEXIE.JS ========== */" >> "$OUTPUT"
cat libs/dexie.js >> "$OUTPUT"

echo "" >> "$OUTPUT"
echo "/* ========== JSPDF ========== */" >> "$OUTPUT"
cat libs/jspdf.umd.min.js >> "$OUTPUT"

echo "" >> "$OUTPUT"
echo "/* ========== JSZIP ========== */" >> "$OUTPUT"
cat libs/jszip.min.js >> "$OUTPUT"

cat >> "$OUTPUT" << 'SCRIPT_SEPARATOR'
    </script>
    <script>
SCRIPT_SEPARATOR

# Inline auth script
echo "/* ========== AUTH.JS ========== */" >> "$OUTPUT"
cat js/auth.js >> "$OUTPUT"

cat >> "$OUTPUT" << 'SCRIPT_SEPARATOR'
    </script>
    <script>
SCRIPT_SEPARATOR

# Inline core modules
echo "/* ========== CORE MODULES ========== */" >> "$OUTPUT"
cat js/error-handler.js >> "$OUTPUT"
echo "" >> "$OUTPUT"
cat js/app-state.js >> "$OUTPUT"
echo "" >> "$OUTPUT"
cat js/canvas-manager.js >> "$OUTPUT"
echo "" >> "$OUTPUT"
cat js/shape-drawing.js >> "$OUTPUT"
echo "" >> "$OUTPUT"
cat js/brush-manager.js >> "$OUTPUT"

cat >> "$OUTPUT" << 'SCRIPT_SEPARATOR'
    </script>
    <script>
SCRIPT_SEPARATOR

# Inline feature modules
echo "/* ========== FEATURE MODULES ========== */" >> "$OUTPUT"
cat js/storage.js >> "$OUTPUT"
echo "" >> "$OUTPUT"
cat js/video-handler.js >> "$OUTPUT"
echo "" >> "$OUTPUT"
cat js/snapshot-manager.js >> "$OUTPUT"
echo "" >> "$OUTPUT"
cat js/drawing-tool.js >> "$OUTPUT"
echo "" >> "$OUTPUT"
cat js/tag-manager.js >> "$OUTPUT"
echo "" >> "$OUTPUT"
cat js/tag-editor.js >> "$OUTPUT"
echo "" >> "$OUTPUT"
cat js/pdf-exporter.js >> "$OUTPUT"
echo "" >> "$OUTPUT"
cat js/project-sharing.js >> "$OUTPUT"
echo "" >> "$OUTPUT"
cat js/project-manager.js >> "$OUTPUT"
echo "" >> "$OUTPUT"
cat js/faq.js >> "$OUTPUT"
echo "" >> "$OUTPUT"
cat js/app.js >> "$OUTPUT"

# Close script and HTML
cat >> "$OUTPUT" << 'HTML_END'
    </script>
</body>
</html>
HTML_END

# Now handle fonts - convert to base64 and replace in output
echo "Converting fonts to base64..."
for font in fonts/*.woff2; do
    basename=$(basename "$font")
    echo "  Processing $basename..."
    base64_font=$(base64 -i "$font" | tr -d '\n')
    # This placeholder will be replaced
    sed -i '' "s|url('data:font/woff2;base64,|url('data:font/woff2;base64,$base64_font') format('woff2'); /* $basename */ } @font-face { font-family: 'PLACEHOLDER'; src: url('data:font/woff2;base64,|g" "$OUTPUT" 2>/dev/null || true
done

# Final cleanup of font declarations
# This is a bit hacky but works for the font file structure
perl -i -pe 's/url\('"'"'data:font\/woff2;base64,/url('"'"'data:font\/woff2;base64,/g' "$OUTPUT"

echo ""
echo "✅ Standalone HTML file created: $OUTPUT"
echo "📊 File size: $(du -h "$OUTPUT" | cut -f1)"
echo ""
echo "🚀 You can now:"
echo "   1. Double-click $OUTPUT to open in browser"
echo "   2. Share it as a single file"
echo "   3. All features work offline!"
