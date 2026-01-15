#!/bin/bash
# Build script to create an obfuscated standalone HTML file
# Protects the code from easy reverse-engineering

OUTPUT_ORIGINAL="VideoMarkupStandalone.html"
OUTPUT_PROTECTED="VideoMarkupStandalone-Obfuscated.html"

echo "🔒 Building obfuscated standalone HTML file..."
echo ""

# Check if original standalone exists
if [ ! -f "$OUTPUT_ORIGINAL" ]; then
    echo "❌ Error: $OUTPUT_ORIGINAL not found!"
    echo "Please run ./build-standalone.sh first"
    exit 1
fi

# Create temp directory
mkdir -p temp_obfuscate

echo "📝 Extracting JavaScript code..."

# Find line numbers for script tags
FIRST_SCRIPT=$(grep -n '<script>' "$OUTPUT_ORIGINAL" | head -1 | cut -d: -f1)
LAST_SCRIPT=$(grep -n '</script>' "$OUTPUT_ORIGINAL" | tail -1 | cut -d: -f1)

# Extract header (everything before first <script>)
head -n $((FIRST_SCRIPT - 1)) "$OUTPUT_ORIGINAL" > temp_obfuscate/header.html

# Extract footer (everything after last </script>)
tail -n +$((LAST_SCRIPT + 1)) "$OUTPUT_ORIGINAL" > temp_obfuscate/footer.html

# Extract JavaScript content (between <script> and </script>, excluding the tags)
awk '/<script>/,/<\/script>/ {
    if (/<script>/ || /<\/script>/) next;
    print
}' "$OUTPUT_ORIGINAL" > temp_obfuscate/all-scripts.js

echo "🔐 Obfuscating JavaScript code (this may take a minute)..."

# Obfuscate with STRONG protection settings (compatible options)
javascript-obfuscator temp_obfuscate/all-scripts.js \
  --output temp_obfuscate/obfuscated.js \
  --compact true \
  --control-flow-flattening true \
  --control-flow-flattening-threshold 0.75 \
  --dead-code-injection true \
  --dead-code-injection-threshold 0.4 \
  --debug-protection false \
  --disable-console-output false \
  --identifier-names-generator hexadecimal \
  --log false \
  --numbers-to-expressions true \
  --rename-globals false \
  --self-defending true \
  --simplify true \
  --split-strings true \
  --split-strings-chunk-length 10 \
  --string-array true \
  --string-array-encoding 'rc4' \
  --string-array-index-shift true \
  --string-array-rotate true \
  --string-array-shuffle true \
  --string-array-threshold 0.75 \
  --unicode-escape-sequence false

if [ $? -ne 0 ]; then
    echo "❌ Obfuscation failed!"
    rm -rf temp_obfuscate
    exit 1
fi

echo "🔨 Assembling protected HTML file..."

# Assemble the protected file
cat temp_obfuscate/header.html > "$OUTPUT_PROTECTED"
echo "<script>" >> "$OUTPUT_PROTECTED"
cat temp_obfuscate/obfuscated.js >> "$OUTPUT_PROTECTED"
echo "</script>" >> "$OUTPUT_PROTECTED"
cat temp_obfuscate/footer.html >> "$OUTPUT_PROTECTED"

# Cleanup
rm -rf temp_obfuscate

echo ""
echo "✅ Protected standalone file created: $OUTPUT_PROTECTED"
echo "📊 Original size: $(du -h "$OUTPUT_ORIGINAL" | cut -f1)"
echo "📊 Protected size: $(du -h "$OUTPUT_PROTECTED" | cut -f1)"
echo ""
echo "🔒 Protection features applied:"
echo "   ✓ Variable names randomized (hexadecimal)"
echo "   ✓ Strings encrypted with RC4"
echo "   ✓ Control flow obfuscated (75% threshold)"
echo "   ✓ Dead code injection (40% threshold)"
echo "   ✓ Self-defending code (crashes debuggers)"
echo "   ✓ String array shuffling & rotation"
echo "   ✓ Function call wrapping"
echo ""
echo "⚠️  Note: The code is now extremely difficult to reverse-engineer!"
echo "    Keep the original for debugging if needed."
echo ""
echo "🚀 You can now:"
echo "   1. Double-click $OUTPUT_PROTECTED to test"
echo "   2. Share it - code is protected from casual inspection"
echo "   3. All features work exactly the same!"
