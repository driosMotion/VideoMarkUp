/**
 * PDF Exporter Module
 * Generates PDF reports from snapshots
 */

const PDFExporter = {
    /**
     * Initialize PDF exporter
     */
    init() {
        document.getElementById('exportPdfBtn').addEventListener('click', () => {
            this.exportPDF();
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
            this.addCoverPage(doc, pageWidth, pageHeight, snapshots);

            // Staffing summary page
            this.addStaffingSummaryPage(doc, snapshots, pageWidth, pageHeight, margin);

            // Snapshot pages
            for (let i = 0; i < snapshots.length; i++) {
                doc.addPage();
                await this.addSnapshotPage(doc, snapshots[i], i + 1, snapshots.length, pageWidth, pageHeight, margin);
            }

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
     * Add cover page to PDF
     */
    addCoverPage(doc, pageWidth, pageHeight, snapshots) {
        // Background
        doc.setFillColor(13, 13, 15);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');

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
        const titleStartY = pageHeight / 2 - 30 - ((titleLines.length - 1) * fontSize * 0.4);
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
        this.renderRichTextComment(doc, comment, margin, commentY + 8, pageWidth - (margin * 2));

        // Footer
        doc.setFontSize(8);
        doc.setTextColor(96, 96, 104);
        doc.text(`Page ${index + 1}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
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
     * Convert hex color to RGB
     * @param {string} hex - Hex color code
     * @returns {Object}
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 136, g: 136, b: 136 };
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
     * Render rich text comment with colors in PDF
     * @param {Object} doc - jsPDF document
     * @param {string} htmlContent - HTML content
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} maxWidth - Maximum width
     */
    renderRichTextComment(doc, htmlContent, x, y, maxWidth) {
        // Create a temporary div to parse HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        
        // Extract text with colors
        const textSegments = this.extractTextSegments(tempDiv);
        
        if (textSegments.length === 0) {
            doc.setTextColor(240, 240, 242);
            doc.text('No comment', x, y);
            return;
        }
        
        let currentX = x;
        let currentY = y;
        const lineHeight = 6;
        
        textSegments.forEach(segment => {
            const color = this.hexToRgb(segment.color);
            doc.setTextColor(color.r, color.g, color.b);
            
            const words = segment.text.split(' ');
            words.forEach((word, idx) => {
                const wordWithSpace = idx < words.length - 1 ? word + ' ' : word;
                const wordWidth = doc.getTextWidth(wordWithSpace);
                
                // Check if we need to wrap to next line
                if (currentX + wordWidth > x + maxWidth && currentX > x) {
                    currentX = x;
                    currentY += lineHeight;
                }
                
                doc.text(wordWithSpace, currentX, currentY);
                currentX += wordWidth;
            });
        });
    },

    /**
     * Extract text segments with their colors from HTML
     * @param {HTMLElement} element
     * @returns {Array}
     */
    extractTextSegments(element) {
        const segments = [];
        
        const traverse = (node, defaultColor = '#f0f0f2') => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.trim();
                if (text) {
                    segments.push({ text, color: defaultColor });
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const color = node.style.color || defaultColor;
                
                node.childNodes.forEach(child => {
                    traverse(child, color);
                });
            }
        };
        
        traverse(element);
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
            totals[tag] = { shots: 0, hours: 0 };
        });

        snapshots.forEach(snapshot => {
            const hours = snapshot.tagHours || {};
            (snapshot.tags || []).forEach(tag => {
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

        allTags.forEach(tag => {
            if (totals[tag].shots > 0 || totals[tag].hours > 0) {
                const color = this.hexToRgb(TagManager.getTagColor(tag));
                
                // Row background (alternating)
                doc.setFillColor(25, 25, 28);
                doc.rect(margin, y - 5, pageWidth - margin * 2, 9, 'F');

                // Color indicator
                doc.setFillColor(color.r, color.g, color.b);
                doc.rect(margin, y - 5, 3, 9, 'F');

                x = margin + 8;
                
                // Department name
                doc.setTextColor(240, 240, 242);
                doc.text(TagManager.getTagLabel(tag), x, y);
                x += colWidths[0] - 3;

                // Shots count
                doc.setTextColor(160, 160, 168);
                doc.text(totals[tag].shots.toString(), x, y);
                x += colWidths[1];

                // Hours
                doc.text(totals[tag].hours.toFixed(1) + 'h', x, y);
                x += colWidths[2];

                // Days (assuming 8h workday)
                const days = (totals[tag].hours / 8).toFixed(1);
                doc.text(days + ' days', x, y);

                totalShots += totals[tag].shots;
                totalHours += totals[tag].hours;

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
    }
};

// Make PDFExporter globally available
window.PDFExporter = PDFExporter;

