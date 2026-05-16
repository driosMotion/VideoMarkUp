/**
 * PDF Exporter Module
 * Generates PDF reports from snapshots
 */

const PDFExporter = {
    logoDataUrl: null, // Will store the Hogarth logo as base64
    
    /**
     * Initialize PDF exporter
     */
    init() {
        document.getElementById('exportPdfBtn').addEventListener('click', () => {
            this.exportPDF();
        });
        // Preload logo
        this.loadLogo();
    },
    
    /**
     * Load Hogarth logo as base64
     * Uses Image loading for file:// protocol compatibility
     */
    async loadLogo() {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    this.logoDataUrl = canvas.toDataURL('image/png');
                    resolve();
                } catch (error) {
                    console.error('Error converting logo to base64:', error);
                    reject(error);
                }
            };
            img.onerror = (error) => {
                console.error('Error loading logo:', error);
                reject(error);
            };
            img.src = 'HogarthIsologo.png';
        });
    },

    /**
     * Export snapshots to PDF
     */
    async exportPDF() {
        const snapshots = await SnapshotManager.getAllSnapshots();
        
        if (snapshots.length === 0) {
            App.showToast('No snapshots to export', 'warning');
            return;
        }

        App.showToast('Generating PDF...', 'info');

        try {
            const doc = await this.generatePDFDocument();
            
            // Save the PDF
            const project = await Storage.getProject(VideoHandler.currentProjectId);
            const fileName = `${project.name || 'VideoMarkup'}_Report_${this.formatDate(new Date())}.pdf`;
            doc.save(fileName);

            App.showToast('PDF exported successfully!', 'success');
        } catch (error) {
            console.error('PDF export error:', error);
            App.showToast('Error exporting PDF', 'error');
        }
    },
    
    /**
     * Generate PDF document (without saving)
     * @returns {Promise<jsPDF>} The PDF document
     */
    async generatePDFDocument() {
        const snapshots = await SnapshotManager.getAllSnapshots();
        
        if (snapshots.length === 0) {
            throw new Error('No snapshots to export');
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;

        // Cover page
        await this.addCoverPage(doc, pageWidth, pageHeight, snapshots);

        // Staffing summary page
        this.addStaffingSummaryPage(doc, snapshots, pageWidth, pageHeight, margin);

        // Snapshot pages
        for (let i = 0; i < snapshots.length; i++) {
            doc.addPage();
            await this.addSnapshotPage(doc, snapshots[i], i + 1, snapshots.length, pageWidth, pageHeight, margin);
        }

        return doc;
    },
    
    /**
     * Generate PDF as blob
     * @returns {Promise<Blob>} The PDF as a blob
     */
    async generatePDFBlob() {
        const doc = await this.generatePDFDocument();
        return doc.output('blob');
    },

    /**
     * Add cover page to PDF
     */
    async addCoverPage(doc, pageWidth, pageHeight, snapshots) {
        // Background
        doc.setFillColor(13, 13, 15);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');

        // Add first frame snapshot if video is loaded
        const videoElement = document.getElementById('videoPlayer');
        if (videoElement && videoElement.src) {
            try {
                const firstFrameData = await this.captureFirstFrame(videoElement);
                if (firstFrameData) {
                    const img = await this.loadImage(firstFrameData);
                    const maxWidth = 100;
                    const maxHeight = 56;
                    
                    let imgWidth = img.width;
                    let imgHeight = img.height;
                    const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
                    imgWidth *= scale;
                    imgHeight *= scale;
                    
                    const imgX = (pageWidth - imgWidth) / 2;
                    const imgY = 30;
                    
                    doc.addImage(firstFrameData, 'PNG', imgX, imgY, imgWidth, imgHeight);
                    doc.setDrawColor(60, 60, 70);
                    doc.setLineWidth(0.5);
                    doc.rect(imgX, imgY, imgWidth, imgHeight, 'S');
                }
            } catch (error) {
                console.error('Error adding first frame to cover:', error);
            }
        }

        // Title - handle long names
        doc.setTextColor(240, 240, 242);
        doc.setFont('helvetica', 'bold');
        
        const projectName = document.getElementById('projectName').textContent || 'Video Markup';
        const maxTitleWidth = pageWidth - 40;
        
        // Calculate font size to fit
        let fontSize = 32;
        doc.setFontSize(fontSize);
        while (doc.getTextWidth(projectName) > maxTitleWidth && fontSize > 14) {
            fontSize -= 2;
            doc.setFontSize(fontSize);
        }
        
        // If still too long, split into lines
        const titleLines = doc.splitTextToSize(projectName, maxTitleWidth);
        const titleStartY = pageHeight / 2 + 10 - ((titleLines.length - 1) * fontSize * 0.4);
        doc.text(titleLines, pageWidth / 2, titleStartY, { align: 'center' });

        // Subtitle
        const subtitleY = titleStartY + (titleLines.length * fontSize * 0.5) + 15;
        doc.setFontSize(16);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(160, 160, 168);
        doc.text('Post-Production Review', pageWidth / 2, subtitleY, { align: 'center' });

        // Date
        doc.setFontSize(12);
        doc.text(this.formatDateLong(new Date()), pageWidth / 2, subtitleY + 12, { align: 'center' });

        // Snapshot count
        const count = snapshots.length;
        doc.text(`${count} Snapshot${count !== 1 ? 's' : ''}`, pageWidth / 2, subtitleY + 24, { align: 'center' });

        // Footer
        doc.setFontSize(10);
        doc.setTextColor(96, 96, 104);
        doc.text('Generated with Video Markup', pageWidth / 2, pageHeight - 15, { align: 'center' });
        
        // Add Hogarth logo
        this.addLogoToPage(doc, pageWidth, pageHeight);
    },

    /**
     * Add a snapshot page to PDF
     */
    async addSnapshotPage(doc, snapshot, index, total, pageWidth, pageHeight, margin) {
        // Background
        doc.setFillColor(20, 20, 22);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');

        // Header bar
        doc.setFillColor(26, 26, 30);
        doc.rect(0, 0, pageWidth, 18, 'F');

        // Header text
        doc.setTextColor(160, 160, 168);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Snapshot ${index} of ${total}`, margin, 11);

        // Timecode
        doc.setTextColor(240, 240, 242);
        doc.setFont('helvetica', 'bold');
        const timecode = VideoHandler.formatTimecode(snapshot.timestamp);
        doc.text(timecode, pageWidth - margin, 11, { align: 'right' });

        // Image area
        const imageStartY = 25;
        const imageMaxWidth = pageWidth - (margin * 2);
        const imageMaxHeight = 100;

        // Use marked up image if available, otherwise original
        const imageData = snapshot.markedUpImage || snapshot.originalImage;

        if (imageData) {
            try {
                // Calculate image dimensions maintaining aspect ratio
                const img = await this.loadImage(imageData);
                let imgWidth = img.width;
                let imgHeight = img.height;
                
                const scale = Math.min(imageMaxWidth / imgWidth, imageMaxHeight / imgHeight);
                imgWidth *= scale;
                imgHeight *= scale;

                // Center the image
                const imgX = (pageWidth - imgWidth) / 2;
                
                // Add image with border
                doc.setDrawColor(42, 42, 50);
                doc.setLineWidth(0.5);
                doc.addImage(imageData, 'PNG', imgX, imageStartY, imgWidth, imgHeight);
                doc.rect(imgX, imageStartY, imgWidth, imgHeight, 'S');
            } catch (e) {
                console.error('Error adding image to PDF:', e);
            }
        }

        // Tags section
        const tagsY = 135;
        if (snapshot.tags && snapshot.tags.length > 0) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(160, 160, 168);
            doc.text('TAGS:', margin, tagsY);

            let tagX = margin + 15;
            snapshot.tags.forEach(tag => {
                const color = this.hexToRgb(TagManager.getTagColor(tag));
                const hours = snapshot.tagHours && snapshot.tagHours[tag];
                const label = TagManager.getTagLabel(tag) + (hours ? ` (${hours}h)` : '');
                const labelWidth = doc.getTextWidth(label) + 8;

                // Tag background
                doc.setFillColor(color.r, color.g, color.b);
                doc.roundedRect(tagX, tagsY - 4, labelWidth, 7, 1, 1, 'F');

                // Tag text
                doc.setTextColor(255, 255, 255);
                doc.setFont('helvetica', 'bold');
                doc.text(label, tagX + 4, tagsY + 1);

                tagX += labelWidth + 4;
            });
        }

        // Comment section with rich text support
        const commentY = 148;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(160, 160, 168);
        doc.text('COMMENT:', margin, commentY);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);

        // Parse HTML comment and render with colors
        const comment = snapshot.comment || 'No comment';
        this.renderRichTextComment(doc, comment, margin, commentY + 8, pageWidth - margin * 2, {
            pageWidth,
            pageHeight,
            margin,
            yMax: pageHeight - 22
        });

        // Footer
        doc.setFontSize(8);
        doc.setTextColor(96, 96, 104);
        doc.text(`Page ${index + 1}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
        
        // Add Hogarth logo
        this.addLogoToPage(doc, pageWidth, pageHeight);
    },

    /**
     * Load image and return its dimensions
     * @param {string} src - Image source (data URL)
     * @returns {Promise<HTMLImageElement>}
     */
    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    },

    /**
     * Convert hex or rgb color to RGB object
     * @param {string} color - Hex color code (#ff3b3b) or rgb string (rgb(255, 59, 59))
     * @returns {Object}
     */
    hexToRgb(color) {
        // Handle rgb() or rgba() format
        const rgbMatch = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
        if (rgbMatch) {
            return {
                r: parseInt(rgbMatch[1]),
                g: parseInt(rgbMatch[2]),
                b: parseInt(rgbMatch[3])
            };
        }
        
        // Handle hex format (6 or 3 hex digits, optional #)
        let hexMatch = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(
            color
        );
        if (hexMatch) {
            return {
                r: parseInt(hexMatch[1], 16),
                g: parseInt(hexMatch[2], 16),
                b: parseInt(hexMatch[3], 16)
            };
        }
        hexMatch = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(color);
        if (hexMatch) {
            return {
                r: parseInt(hexMatch[1] + hexMatch[1], 16),
                g: parseInt(hexMatch[2] + hexMatch[2], 16),
                b: parseInt(hexMatch[3] + hexMatch[3], 16)
            };
        }
        
        // Default fallback (light gray)
        return { r: 240, g: 240, b: 242 };
    },

    /**
     * Format date as YYYY-MM-DD
     * @param {Date} date
     * @returns {string}
     */
    formatDate(date) {
        return date.toISOString().split('T')[0];
    },

    /**
     * Format date as long string
     * @param {Date} date
     * @returns {string}
     */
    formatDateLong(date) {
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    /**
     * Render rich text comment with colors in PDF.
     * Normalizes &nbsp;/Unicode spaces, merges same-color runs, supports &lt;font color&gt;.
     */
    normalizeWhitespaceForPdf(text) {
        if (text == null || text === '') return '';
        let t = String(text);
        t = t.replace(/\u00a0/g, ' ');
        t = t.replace(/\u202f|\u2007|\u2009|\u200a/g, ' ');
        t = t.replace(/[\u200b-\u200d\ufeff]/g, '');
        t = t.replace(/\t/g, ' ');
        t = t.replace(/[ \u00a0]+/g, ' ');
        return t.trimEnd();
    },

    renderRichTextComment(doc, htmlContent, x, y, maxWidth, layout) {
        const safeHtml = this.sanitizeCommentHtmlForPdfImport(
            this.normalizeCommentHtmlForPdf(htmlContent)
        );
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = safeHtml;

        const textSegments = this.extractTextSegments(tempDiv);

        if (textSegments.length === 0) {
            doc.setTextColor(240, 240, 242);
            doc.text('No comment', x, y);
            return;
        }

        const pageWidth = layout && layout.pageWidth;
        const pageHeight = layout && layout.pageHeight;
        const margin = layout && layout.margin != null ? layout.margin : 15;
        const yMax =
            layout && layout.yMax != null
                ? layout.yMax
                : pageHeight != null
                  ? pageHeight - 22
                  : Infinity;

        let currentX = x;
        let currentY = y;
        const advanceSoft = 3.6;
        const advancePara = 6;

        const paginate = Number.isFinite(yMax) && pageWidth != null && pageHeight != null;

        const startNewCommentPage = () => {
            if (!paginate) return;
            doc.addPage();
            doc.setFillColor(20, 20, 22);
            doc.rect(0, 0, pageWidth, pageHeight, 'F');
            currentY = margin + 14;
            currentX = x;
        };

        const ensureVerticalSpace = (deltaY) => {
            if (!paginate) return;
            if (currentY + deltaY <= yMax) return;
            startNewCommentPage();
        };

        textSegments.forEach((segment) => {
            if (segment.type === 'break') {
                currentX = x;
                const step =
                    segment.variant === 'para' ? advancePara : advanceSoft;
                ensureVerticalSpace(step);
                currentY += step;
                return;
            }

            const color = this.hexToRgb(segment.color);
            doc.setTextColor(color.r, color.g, color.b);

            const paragraphLines = String(segment.text || '').split(
                /\r\n|\r|\n/
            );
            paragraphLines.forEach((line, lineIndex) => {
                if (lineIndex > 0) {
                    currentX = x;
                    ensureVerticalSpace(advanceSoft);
                    currentY += advanceSoft;
                }

                const lineNorm = this.normalizeWhitespaceForPdf(line);
                if (!lineNorm) return;

                const words = lineNorm.split(/\s+/).filter(Boolean);
                words.forEach((word, idx) => {
                    if (
                        idx === 0 &&
                        lineIndex === 0 &&
                        currentX > x + 0.2
                    ) {
                        const sw = doc.getTextWidth(' ');
                        if (currentX + sw > x + maxWidth) {
                            currentX = x;
                            ensureVerticalSpace(advanceSoft);
                            currentY += advanceSoft;
                        } else {
                            doc.text(' ', currentX, currentY);
                            currentX += sw;
                        }
                    }

                    const wordWithSpace =
                        idx < words.length - 1 ? word + ' ' : word;
                    const wordWidth = doc.getTextWidth(wordWithSpace);

                    if (
                        currentX + wordWidth > x + maxWidth &&
                        currentX > x
                    ) {
                        currentX = x;
                        ensureVerticalSpace(advanceSoft);
                        currentY += advanceSoft;
                    }

                    doc.text(wordWithSpace, currentX, currentY);
                    currentX += wordWidth;
                });
            });
        });
    },

    /**
     * @deprecated Do not merge text runs — same-color blocks in separate DOM
     * lines were glued into one line in the PDF. Kept empty for compat if referenced.
     */
    mergeAdjacentTextRuns(segments) {
        return segments;
    },

    /**
     * Strip attributes that break CSS parsing inside our parse container
     * @param {string} html
     * @returns {string}
     */
    sanitizeCommentHtmlForPdfImport(html) {
        if (!html) return html;
        return String(html).replace(/background-color:\s*;/gi, '');
    },

    /**
     * If comment is plain text (no tags), escape and convert newlines to <br> so the DOM parser keeps line breaks.
     * Rich HTML from the editor is left as-is (already has <br>, <div>, spans, etc.).
     * @param {string} htmlContent
     * @returns {string}
     */
    normalizeCommentHtmlForPdf(htmlContent) {
        if (
            htmlContent == null ||
            htmlContent === '' ||
            htmlContent === 'No comment'
        ) {
            return htmlContent || '';
        }
        const s = String(htmlContent);
        if (/<[a-z][\s\S]*>/i.test(s.trim())) {
            return s;
        }
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\r\n|\r|\n/g, '<br>');
    },

    /**
     * Extract text segments with their colors from HTML
     * @param {HTMLElement} element
     * @returns {Array}
     */
    extractTextSegments(element) {
        const segments = [];

        const blockEndsWithNewline = new Set([
            'DIV',
            'P',
            'LI',
            'H1',
            'H2',
            'H3',
            'H4'
        ]);

        const blockTags = blockEndsWithNewline;

        /** When inline/text is followed by a block sibling, browsers wrap; PDF must insert a paragraph break. */
        const needsParaBetweenSiblings = (prev, next) => {
            if (!next || next.nodeType !== Node.ELEMENT_NODE) return false;
            if (!blockTags.has(next.tagName)) return false;
            if (!prev) return false;
            if (prev.nodeType === Node.ELEMENT_NODE) {
                if (prev.tagName === 'BR') return false;
                if (blockTags.has(prev.tagName)) return false;
            }
            return true;
        };

        const traverse = (node, defaultColor = '#f0f0f2', isRootWrapper = false) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.replace(/\r\n/g, '\n');
                if (text.length === 0) return;
                if (text.trim() === '' && !text.includes('\n')) return;
                segments.push({ text, color: defaultColor });
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const tag = node.tagName;
                if (tag === 'BR') {
                    segments.push({
                        type: 'break',
                        variant: 'soft'
                    });
                    return;
                }

                const color = (() => {
                    if (node.style && node.style.color) {
                        return node.style.color;
                    }
                    if (tag === 'FONT') {
                        const fc = node.getAttribute('color');
                        if (fc) return fc.trim();
                    }
                    return defaultColor;
                })();

                const children = Array.from(node.childNodes);
                for (let i = 0; i < children.length; i++) {
                    traverse(children[i], color, false);
                    const next = children[i + 1];
                    if (needsParaBetweenSiblings(children[i], next)) {
                        segments.push({
                            type: 'break',
                            variant: 'para'
                        });
                    }
                }

                if (blockEndsWithNewline.has(tag)) {
                    const last = node.lastChild;
                    const lastIsBr =
                        last &&
                        last.nodeType === Node.ELEMENT_NODE &&
                        last.tagName === 'BR';
                    const skipRootDivSuffix = isRootWrapper && tag === 'DIV';
                    if (!lastIsBr && !skipRootDivSuffix) {
                        segments.push({
                            type: 'break',
                            variant: 'para'
                        });
                    }
                }
            }
        };

        traverse(element, '#f0f0f2', true);
        return segments;
    },

    /**
     * Add staffing summary page to PDF
     */
    addStaffingSummaryPage(doc, snapshots, pageWidth, pageHeight, margin) {
        doc.addPage();
        
        // Background
        doc.setFillColor(20, 20, 22);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');

        // Header bar
        doc.setFillColor(26, 26, 30);
        doc.rect(0, 0, pageWidth, 18, 'F');

        // Header text
        doc.setTextColor(240, 240, 242);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('STAFFING & RESOURCE SUMMARY', margin, 11);

        // Calculate totals per department
        const totals = {};
        const allTags = TagManager.getAllTags();
        
        allTags.forEach(tag => {
            totals[tag.name] = { shots: 0, hours: 0 };
        });

        snapshots.forEach(snapshot => {
            const hours = snapshot.tagHours || {};
            (snapshot.tags || []).forEach(tag => {
                if (!totals[tag]) {
                    totals[tag] = { shots: 0, hours: 0 };
                }
                totals[tag].shots++;
                totals[tag].hours += (hours[tag] || 0);
            });
        });

        // Draw table
        let y = 35;
        const colWidths = [60, 50, 50, 80];
        const headers = ['Department', 'Shots', 'Hours', 'Estimated Days'];
        
        // Table header
        doc.setFillColor(30, 30, 35);
        doc.rect(margin, y - 6, pageWidth - margin * 2, 10, 'F');
        
        doc.setTextColor(160, 160, 168);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        
        let x = margin + 5;
        headers.forEach((header, i) => {
            doc.text(header, x, y);
            x += colWidths[i];
        });

        y += 12;

        // Table rows
        doc.setFont('helvetica', 'normal');
        let totalShots = 0;
        let totalHours = 0;

        // Iterate through all tags in totals (includes dynamically added ones)
        Object.keys(totals).forEach(tagName => {
            if (totals[tagName] && (totals[tagName].shots > 0 || totals[tagName].hours > 0)) {
                const color = this.hexToRgb(TagManager.getTagColor(tagName));
                
                // Row background (alternating)
                doc.setFillColor(25, 25, 28);
                doc.rect(margin, y - 5, pageWidth - margin * 2, 9, 'F');

                // Color indicator
                doc.setFillColor(color.r, color.g, color.b);
                doc.rect(margin, y - 5, 3, 9, 'F');

                x = margin + 8;
                
                // Department name
                doc.setTextColor(240, 240, 242);
                doc.text(TagManager.getTagLabel(tagName), x, y);
                x += colWidths[0] - 3;

                // Shots count
                doc.setTextColor(160, 160, 168);
                doc.text(totals[tagName].shots.toString(), x, y);
                x += colWidths[1];

                // Hours
                doc.text(totals[tagName].hours.toFixed(1) + 'h', x, y);
                x += colWidths[2];

                // Days (assuming 8h workday)
                const days = (totals[tagName].hours / 8).toFixed(1);
                doc.text(days + ' days', x, y);

                totalShots += totals[tagName].shots;
                totalHours += totals[tagName].hours;

                y += 10;
            }
        });

        // Totals row
        y += 5;
        doc.setFillColor(40, 40, 50);
        doc.rect(margin, y - 5, pageWidth - margin * 2, 10, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(240, 240, 242);
        
        x = margin + 8;
        doc.text('TOTAL', x, y);
        x += colWidths[0] - 3;
        doc.text(totalShots.toString(), x, y);
        x += colWidths[1];
        doc.text(totalHours.toFixed(1) + 'h', x, y);
        x += colWidths[2];
        doc.text((totalHours / 8).toFixed(1) + ' days', x, y);

        // Summary box
        y += 30;
        doc.setFillColor(26, 26, 30);
        doc.roundedRect(margin, y, pageWidth - margin * 2, 40, 3, 3, 'F');
        
        y += 12;
        doc.setFontSize(10);
        doc.setTextColor(160, 160, 168);
        doc.text('Project Summary:', margin + 10, y);
        
        y += 10;
        doc.setTextColor(240, 240, 242);
        doc.setFont('helvetica', 'normal');
        doc.text(`Total shots requiring work: ${totalShots}`, margin + 10, y);
        
        y += 8;
        doc.text(`Total estimated hours: ${totalHours.toFixed(1)} hours (${(totalHours / 8).toFixed(1)} work days)`, margin + 10, y);

        // Footer
        doc.setFontSize(8);
        doc.setTextColor(96, 96, 104);
        doc.text('Page 2 - Staffing Summary', pageWidth / 2, pageHeight - 8, { align: 'center' });
        
        // Add Hogarth logo
        this.addLogoToPage(doc, pageWidth, pageHeight);
    },
    
    /**
     * Add Hogarth logo to bottom right of page
     */
    addLogoToPage(doc, pageWidth, pageHeight) {
        if (this.logoDataUrl) {
            const logoSize = 12;
            const margin = 10;
            const logoX = pageWidth - logoSize - margin;
            const logoY = pageHeight - logoSize - margin;
            
            try {
                doc.addImage(this.logoDataUrl, 'PNG', logoX, logoY, logoSize, logoSize);
            } catch (error) {
                console.error('Error adding logo to page:', error);
            }
        }
    },
    
    /**
     * Capture first frame of video
     */
    async captureFirstFrame(videoElement) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const currentTime = videoElement.currentTime;
            
            // Set to first frame
            videoElement.currentTime = 0;
            
            const captureFrame = () => {
                canvas.width = videoElement.videoWidth;
                canvas.height = videoElement.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(videoElement, 0, 0);
                const dataUrl = canvas.toDataURL('image/png');
                
                // Restore original time
                videoElement.currentTime = currentTime;
                
                resolve(dataUrl);
            };
            
            // Wait for seek to complete
            videoElement.addEventListener('seeked', captureFrame, { once: true });
        });
    }
};

// Make PDFExporter globally available
window.PDFExporter = PDFExporter;

