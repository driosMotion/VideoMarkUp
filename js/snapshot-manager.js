/**
 * Snapshot Manager Module - Inline Editing Version
 * Handles capturing, storing, and displaying snapshots with inline editing
 */

const SnapshotManager = {
    snapshots: [],
    currentSnapshotId: null,
    quickCommentSnapshotId: null,
    isCreatingSnapshot: false,

    /**
     * Initialize snapshot manager
     */
    init() {
        this.setupEventListeners();
    },

    /**
     * Find a snapshot at the current video timestamp
     * @param {number} timestamp - Video timestamp in seconds
     * @returns {Promise<Object|null>} Snapshot or null
     */
    async findSnapshotAtTime(timestamp) {
        const snapshots = await Storage.getSnapshots(VideoHandler.currentProjectId);
        // Allow 0.1 second tolerance for floating point comparison
        return snapshots.find(s => Math.abs(s.timestamp - timestamp) < 0.1) || null;
    },

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        const commentInputInline = document.getElementById('commentInputInline');

        // Comment input - auto-create snapshot on first character
        if (commentInputInline) {
            commentInputInline.addEventListener('input', () => {
                this.handleCommentInput();
            });
        }

        // Inline tag buttons
        document.querySelectorAll('.tag-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
                // Auto-save tag changes
                if (this.currentSnapshotId) {
                    this.triggerAutoSave();
                }
            });
        });

        // Tag hours input
        document.querySelectorAll('.tag-hours-input').forEach(input => {
            input.addEventListener('change', () => {
                // Auto-save hour changes
                if (this.currentSnapshotId) {
                    this.triggerAutoSave();
                }
            });
        });
    },

    /**
     * Handle comment input
     */
    async handleCommentInput() {
        if (!VideoHandler.currentProjectId) return;

        const commentInputInline = document.getElementById('commentInputInline');
        const text = commentInputInline.textContent.trim();
        const html = commentInputInline.innerHTML;

        // If already editing a snapshot (either via click or quick comment), just auto-save
        if (this.currentSnapshotId || this.quickCommentSnapshotId) {
            this.triggerAutoSave();
            return;
        }

        // If already creating a snapshot, don't create another
        if (this.isCreatingSnapshot) {
            return;
        }

        // Check if snapshot already exists at current timestamp
        const currentTime = VideoHandler.video.currentTime;
        const existingSnapshot = await this.findSnapshotAtTime(currentTime);
        
        if (existingSnapshot) {
            // Load existing snapshot for editing
            this.currentSnapshotId = existingSnapshot.id;
            this.quickCommentSnapshotId = existingSnapshot.id;
            await this.enterInlineEditMode(existingSnapshot.id);
            return;
        }

        // Only create new snapshot if no snapshot is being edited and text is entered
        if (text.length > 0) {
            this.isCreatingSnapshot = true;
            await this.captureSnapshotWithComment(html);
            this.isCreatingSnapshot = false;
        }
    },

    /**
     * Capture snapshot with initial comment and enter edit mode
     * @param {string} initialComment - Initial comment HTML
     */
    async captureSnapshotWithComment(initialComment = '') {
        if (!VideoHandler.currentProjectId) {
            App.showToast('No video loaded', 'error');
            return;
        }

        // Pause video
        VideoHandler.video.pause();

        // Flash effect (optimized timing)
        const wrapper = document.querySelector('.video-wrapper');
        wrapper.classList.add('flash');
        setTimeout(() => wrapper.classList.remove('flash'), 100);

        // Capture frame
        const canvas = VideoHandler.captureFrame();
        const imageData = canvas.toDataURL('image/png');
        const timestamp = VideoHandler.getCurrentTime();

        // Save to storage
        const snapshotId = await Storage.addSnapshot({
            projectId: VideoHandler.currentProjectId,
            timestamp: timestamp,
            originalImage: imageData,
            comment: initialComment,
            tags: []
        });

        // Store reference (both IDs for compatibility)
        this.quickCommentSnapshotId = snapshotId;
        this.currentSnapshotId = snapshotId;

        // Get the full snapshot data
        const snapshot = await Storage.getSnapshot(snapshotId);
        this.snapshots.push(snapshot);

        // Add to list (will be sorted)
        this.addSnapshotToList(snapshot);

        // Sort snapshots by timecode
        this.sortSnapshotsByTimecode();

        // Add marker to timeline
        this.addTimelineMarker(snapshot);

        // Update count
        this.updateSnapshotCount();

        // Enter inline edit mode immediately (preserve comment to avoid cursor jump)
        this.enterInlineEditMode(snapshotId, imageData, null, true);
    },

    /**
     * Enter inline editing mode for a snapshot
     * @param {number} snapshotId - Snapshot ID
     * @param {string} imageData - Base64 image data
     * @param {Object} fabricData - Saved Fabric.js JSON
     * @param {boolean} preserveComment - Don't reload comment (preserve cursor)
     */
    async enterInlineEditMode(snapshotId, imageData = null, fabricData = null, preserveComment = false) {
        // If no image data provided, fetch snapshot
        if (!imageData) {
            const snapshot = await Storage.getSnapshot(snapshotId);
            if (!snapshot) return;
            imageData = snapshot.originalImage;
            fabricData = snapshot.fabricData;
        }

        this.currentSnapshotId = snapshotId;

        // Load snapshot data into inline panels
        await this.loadSnapshotDataInline(snapshotId, preserveComment);

        // Initialize drawing tool with this snapshot
        DrawingTool.enterEditMode(snapshotId, imageData, fabricData);

        if (!preserveComment) {
            App.showToast('Edit mode active', 'info');
        }
    },

    /**
     * Load snapshot data into inline panels
     * @param {number} snapshotId - Snapshot ID
     * @param {boolean} skipComment - Skip reloading comment (preserve cursor)
     */
    async loadSnapshotDataInline(snapshotId, skipComment = false) {
        const snapshot = await Storage.getSnapshot(snapshotId);
        if (!snapshot) return;

        // Load tags
        const tagButtons = document.querySelectorAll('.tag-btn');
        tagButtons.forEach(btn => {
            const tagName = btn.dataset.tag;
            if (snapshot.tags && snapshot.tags.includes(tagName)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Load tag hours
        document.querySelectorAll('.tag-hours-input').forEach(input => {
            const tagName = input.dataset.tag;
            if (snapshot.tagHours && snapshot.tagHours[tagName]) {
                input.value = snapshot.tagHours[tagName];
            } else {
                input.value = '';
            }
        });

        // Load comment only if not skipping (to preserve cursor position)
        if (!skipComment) {
            const commentInputInline = document.getElementById('commentInputInline');
            commentInputInline.innerHTML = snapshot.comment || '';
        }
    },

    /**
     * Clear inline panels (reset to empty state)
     */
    clearInlinePanels() {
        // Clear tags
        document.querySelectorAll('.tag-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Clear tag hours
        document.querySelectorAll('.tag-hours-input').forEach(input => {
            input.value = '';
        });

        // Clear comment
        const commentInputInline = document.getElementById('commentInputInline');
        if (commentInputInline) {
            commentInputInline.innerHTML = '';
        }
    },

    /**
     * Trigger auto-save (debounced)
     */
    triggerAutoSave() {
        if (!this.currentSnapshotId) return;

        // Debounce auto-save
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }

        this.autoSaveTimeout = setTimeout(async () => {
            const fabricData = DrawingTool.canvas ? DrawingTool.getCanvasData() : null;
            await this.saveInlineEdit(this.currentSnapshotId, fabricData, true);
        }, 500);
    },

    /**
     * Save inline edits to snapshot
     * @param {number} snapshotId - Snapshot ID
     * @param {Object} fabricData - Fabric.js canvas data
     * @param {boolean} silent - Don't clear panels or show toast (for auto-save)
     */
    async saveInlineEdit(snapshotId, fabricData, silent = false) {
        // Validate snapshot ID
        if (!snapshotId || typeof snapshotId !== 'number') {
            console.warn('Invalid snapshot ID:', snapshotId);
            return;
        }
        
        const snapshot = await Storage.getSnapshot(snapshotId);
        if (!snapshot) {
            console.warn('Snapshot not found:', snapshotId);
            return;
        }

        // Collect data from inline panels
        const comment = document.getElementById('commentInputInline').innerHTML;
        
        // Get active tags
        const tags = [];
        document.querySelectorAll('.tag-btn.active').forEach(btn => {
            tags.push(btn.dataset.tag);
        });

        // Get tag hours
        const tagHours = {};
        document.querySelectorAll('.tag-hours-input').forEach(input => {
            if (input.value) {
                tagHours[input.dataset.tag] = parseFloat(input.value);
            }
        });

        // Generate marked up image (composite snapshot + drawings)
        let markedUpImage = null;
        if (fabricData && DrawingTool.canvas) {
            try {
                // Get the current snapshot
                const snapshot = await Storage.getSnapshot(snapshotId);
                if (snapshot && snapshot.originalImage) {
                    // Create a temporary canvas to composite
                    const tempCanvas = document.createElement('canvas');
                    const ctx = tempCanvas.getContext('2d');
                    
                    // Get dimensions from the fabric canvas
                    const width = DrawingTool.canvas.width;
                    const height = DrawingTool.canvas.height;
                    tempCanvas.width = width;
                    tempCanvas.height = height;
                    
                    // Load the snapshot image
                    const img = new Image();
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                        img.src = snapshot.originalImage;
                    });
                    
                    // Draw snapshot image first
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Draw fabric canvas on top
                    const fabricImage = new Image();
                    await new Promise((resolve, reject) => {
                        fabricImage.onload = resolve;
                        fabricImage.onerror = reject;
                        fabricImage.src = DrawingTool.canvas.toDataURL({ format: 'png', quality: 1 });
                    });
                    ctx.drawImage(fabricImage, 0, 0);
                    
                    // Get the composited image
                    markedUpImage = tempCanvas.toDataURL('image/png', 1);
                }
            } catch (error) {
                ErrorHandler.error('Failed to generate marked up image', error);
                // Fallback to just the canvas
                markedUpImage = DrawingTool.canvas.toDataURL({ format: 'png', quality: 1 });
            }
        }

        // Update storage
        await Storage.updateSnapshot(snapshotId, {
            comment,
            tags,
            tagHours,
            fabricData,
            markedUpImage
        });

        // Update card in list (with thumbnail)
        await this.updateSnapshotCard(snapshotId, { comment, tags, tagHours, fabricData, markedUpImage });

        // Only clear when explicitly exiting (not auto-saving)
        if (!silent) {
            // Clear comment bar
            const commentInputInline = document.getElementById('commentInputInline');
            if (commentInputInline) {
                commentInputInline.innerHTML = '';
            }
            this.quickCommentSnapshotId = null;

            // Clear inline panels
            this.clearInlinePanels();
        }
    },

    /**
     * Exit inline edit mode
     */
    exitInlineEditMode() {
        this.currentSnapshotId = null;
        this.quickCommentSnapshotId = null;
        DrawingTool.exitEditMode();
    },

    /**
     * Apply color to selected text in inline comment
     * @param {string} color - Hex color code
     */
    applyColorToSelection(color) {
        const commentInput = document.getElementById('commentInputInline');
        commentInput.focus();
        
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        
        if (range.collapsed) return;
        
        const span = document.createElement('span');
        span.style.color = color;
        
        try {
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
            
            range.setStartAfter(span);
            range.setEndAfter(span);
            selection.removeAllRanges();
            selection.addRange(range);
        } catch (e) {
            console.error('Error applying color:', e);
        }
    },

    /**
     * Sort snapshots in the list by timecode order
     */
    sortSnapshotsByTimecode() {
        const listEl = document.getElementById('snapshotsList');
        const cards = Array.from(listEl.querySelectorAll('.snapshot-card'));
        
        if (cards.length === 0) return;
        
        cards.sort((a, b) => {
            const timeA = parseFloat(a.dataset.timestamp) || 0;
            const timeB = parseFloat(b.dataset.timestamp) || 0;
            return timeA - timeB;
        });

        cards.forEach(card => {
            card.remove();
        });
        cards.forEach(card => {
            listEl.appendChild(card);
        });
    },

    /**
     * Add a snapshot card to the list
     * @param {Object} snapshot - Snapshot data
     */
    addSnapshotToList(snapshot) {
        const list = document.getElementById('snapshotsList');
        const emptyState = document.getElementById('emptyState');
        
        if (emptyState) {
            emptyState.hidden = true;
        }

        const card = document.createElement('div');
        card.className = 'snapshot-card';
        card.dataset.id = snapshot.id;
        card.dataset.timestamp = snapshot.timestamp;
        
        if (snapshot.fabricData) {
            card.classList.add('has-markup');
        }

        // Format tags with hours
        const tagsHtml = (snapshot.tags || []).map(tag => {
            const hours = snapshot.tagHours && snapshot.tagHours[tag];
            const hoursText = hours ? ` (${hours}h)` : '';
            return `<span class="snapshot-tag" data-tag="${tag}">${this.getTagLabel(tag)}${hoursText}</span>`;
        }).join('');

        // Use marked up image if available, otherwise original
        const thumbnailImage = snapshot.markedUpImage || snapshot.originalImage;
        
        card.innerHTML = `
            <div class="snapshot-card-thumbnail">
                <button class="snapshot-card-delete" title="Delete snapshot">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
                <img src="${thumbnailImage}" alt="Snapshot at ${VideoHandler.formatTimecode(snapshot.timestamp)}">
                <span class="snapshot-card-timecode">${VideoHandler.formatTimecode(snapshot.timestamp)}</span>
            </div>
            <div class="snapshot-card-body">
                <div class="snapshot-card-tags">${tagsHtml}</div>
                <div class="snapshot-card-comment">${snapshot.comment || ''}</div>
            </div>
        `;

        // Delete button - hold for 2 seconds to delete
        const deleteBtn = card.querySelector('.snapshot-card-delete');
        let deleteHoldTimer = null;
        let deleteProgress = null;
        
        deleteBtn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            
            // Add deleting class to show progress
            deleteBtn.classList.add('deleting');
            
            // Create progress overlay
            deleteProgress = document.createElement('div');
            deleteProgress.className = 'delete-progress';
            // Insert before SVG so z-index layering works
            deleteBtn.insertBefore(deleteProgress, deleteBtn.firstChild);
            
            // Start animation
            deleteProgress.style.animation = 'deleteProgress 1s linear forwards';
            
            // Set timer for actual deletion
            deleteHoldTimer = setTimeout(async () => {
                await this.deleteSnapshotById(snapshot.id, true); // true = no confirmation
                deleteBtn.classList.remove('deleting');
                if (deleteProgress && deleteProgress.parentNode) {
                    deleteProgress.remove();
                }
            }, 1000);
        });
        
        const cancelDelete = () => {
            deleteBtn.classList.remove('deleting');
            if (deleteHoldTimer) {
                clearTimeout(deleteHoldTimer);
                deleteHoldTimer = null;
            }
            if (deleteProgress && deleteProgress.parentNode) {
                deleteProgress.remove();
            }
        };
        
        deleteBtn.addEventListener('mouseup', cancelDelete);
        deleteBtn.addEventListener('mouseleave', cancelDelete);
        
        // Touch support
        deleteBtn.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            // Add deleting class to show progress
            deleteBtn.classList.add('deleting');
            
            // Trigger same as mousedown
            deleteProgress = document.createElement('div');
            deleteProgress.className = 'delete-progress';
            // Insert before SVG so z-index layering works
            deleteBtn.insertBefore(deleteProgress, deleteBtn.firstChild);
            deleteProgress.style.animation = 'deleteProgress 1s linear forwards';
            
            deleteHoldTimer = setTimeout(async () => {
                await this.deleteSnapshotById(snapshot.id, true);
                deleteBtn.classList.remove('deleting');
                if (deleteProgress && deleteProgress.parentNode) {
                    deleteProgress.remove();
                }
            }, 1000);
        });
        
        deleteBtn.addEventListener('touchend', cancelDelete);
        deleteBtn.addEventListener('touchcancel', cancelDelete);

        // Click to seek and enter edit mode
        card.addEventListener('click', () => this.openSnapshotInline(snapshot.id));

        list.appendChild(card);
    },

    /**
     * Update snapshot card in the list
     * @param {number} snapshotId - Snapshot ID
     * @param {Object} updates - Updated data (comment, tags, tagHours, markedUpImage)
     */
    async updateSnapshotCard(snapshotId, updates) {
        const card = document.querySelector(`.snapshot-card[data-id="${snapshotId}"]`);
        if (!card) return;

        // Get full snapshot data for thumbnail
        const snapshot = await Storage.getSnapshot(snapshotId);
        if (!snapshot) return;

        // Update thumbnail if marked up image exists
        if (snapshot.markedUpImage) {
            const img = card.querySelector('.snapshot-card-thumbnail img');
            if (img) {
                img.src = snapshot.markedUpImage;
            }
        }

        // Update tags
        if (updates.tags) {
            const tagsHtml = updates.tags.map(tag => {
                const hours = updates.tagHours && updates.tagHours[tag];
                const hoursText = hours ? ` (${hours}h)` : '';
                return `<span class="snapshot-tag" data-tag="${tag}">${this.getTagLabel(tag)}${hoursText}</span>`;
            }).join('');
            const tagsContainer = card.querySelector('.snapshot-card-tags');
            if (tagsContainer) {
                tagsContainer.innerHTML = tagsHtml;
            }
        }

        // Update comment
        if (updates.comment !== undefined) {
            const commentEl = card.querySelector('.snapshot-card-comment');
            if (commentEl) {
                commentEl.innerHTML = updates.comment || '';
            }
        }

        // Update has-markup class
        if (updates.fabricData) {
            card.classList.add('has-markup');
        } else {
            card.classList.remove('has-markup');
        }
    },

    /**
     * Open snapshot inline (seek and enter edit mode)
     * @param {number} id - Snapshot ID
     */
    async openSnapshotInline(id) {
        const snapshot = await Storage.getSnapshot(id);
        if (!snapshot) return;

        // Seek to snapshot timestamp
        VideoHandler.seekTo(snapshot.timestamp);
        VideoHandler.video.pause();

        // Set both IDs to prevent duplicate creation
        this.currentSnapshotId = id;
        this.quickCommentSnapshotId = id;

        // Enter edit mode (which will also set currentSnapshotId, but that's fine)
        await this.enterInlineEditMode(id, snapshot.originalImage, snapshot.fabricData);
    },

    /**
     * Display snapshot markups when video is at a mark (read-only)
     * @param {number} timestamp - Current video timestamp
     */
    async displayMarkupsAtTimestamp(timestamp) {
        // Find snapshot at this timestamp (within 0.1s tolerance)
        const snapshot = this.snapshots.find(s => Math.abs(s.timestamp - timestamp) < 0.1);
        
        if (snapshot) {
            DrawingTool.displayMarkups(snapshot.originalImage, snapshot.fabricData);
        } else {
            DrawingTool.hideMarkups();
        }
    },

    /**
     * Add a marker on the video timeline
     * @param {Object} snapshot - Snapshot data
     */
    addTimelineMarker(snapshot) {
        const markers = document.getElementById('snapshotMarkers');
        const position = (snapshot.timestamp / VideoHandler.duration) * 100;

        const marker = document.createElement('div');
        marker.className = 'snapshot-marker';
        marker.style.left = `${position}%`;
        marker.dataset.id = snapshot.id;
        marker.title = `Snapshot @ ${VideoHandler.formatTimecode(snapshot.timestamp)}`;

        marker.addEventListener('click', (e) => {
            e.stopPropagation();
            VideoHandler.seekTo(snapshot.timestamp);
        });

        markers.appendChild(marker);
    },

    /**
     * Update snapshot count badge
     */
    updateSnapshotCount() {
        const count = document.querySelectorAll('.snapshot-card').length;
        document.getElementById('snapshotCount').textContent = count;
    },


    /**
     * Delete a snapshot by ID
     * @param {number} id - Snapshot ID
     * @param {boolean} skipConfirm - Skip confirmation dialog
     */
    async deleteSnapshotById(id, skipConfirm = false) {
        if (!skipConfirm && !confirm('Delete this snapshot?')) return;

        // Exit edit mode if this snapshot is being edited
        if (this.currentSnapshotId === id) {
            this.exitInlineEditMode();
        }

        await Storage.deleteSnapshot(id);

        const card = document.querySelector(`.snapshot-card[data-id="${id}"]`);
        if (card) card.remove();

        const marker = document.querySelector(`.snapshot-marker[data-id="${id}"]`);
        if (marker) marker.remove();

        this.updateSnapshotCount();

        const count = document.querySelectorAll('.snapshot-card').length;
        if (count === 0) {
            document.getElementById('emptyState').hidden = false;
        }

        this.snapshots = this.snapshots.filter(s => s.id !== id);

        if (this.currentSnapshotId === id) {
            this.currentSnapshotId = null;
        }

        App.showToast('Snapshot deleted', 'success');
    },

    /**
     * Get display label for a tag
     * @param {string} tag - Tag ID
     * @returns {string} Display label
     */
    getTagLabel(tag) {
        const labels = {
            vfx: 'VFX',
            roto: 'Roto',
            '3d': '3D',
            color: 'Color',
            comp: 'Comp',
            cleanup: 'Cleanup',
            audio: 'Audio',
            review: 'Review'
        };
        return labels[tag] || tag;
    },

    /**
     * Get all snapshots for export
     * @returns {Promise<Array>}
     */
    async getAllSnapshots() {
        if (!VideoHandler.currentProjectId) return [];
        return await Storage.getSnapshots(VideoHandler.currentProjectId);
    },

    /**
     * Clear all snapshots from the list (UI only)
     */
    clearList() {
        const list = document.getElementById('snapshotsList');
        const cards = list.querySelectorAll('.snapshot-card');
        cards.forEach(card => card.remove());
        
        const markers = document.getElementById('snapshotMarkers');
        markers.innerHTML = '';
        
        document.getElementById('emptyState').hidden = false;
        this.updateSnapshotCount();
        this.snapshots = [];
    }
};

window.SnapshotManager = SnapshotManager;
