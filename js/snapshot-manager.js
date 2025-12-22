/**
 * Snapshot Manager Module
 * Handles capturing, storing, and displaying snapshots
 */

const SnapshotManager = {
    snapshots: [],
    currentSnapshotId: null,
    quickCommentSnapshotId: null,

    /**
     * Initialize snapshot manager
     */
    init() {
        this.setupEventListeners();
    },

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        const modalClose = document.getElementById('modalClose');
        const saveBtn = document.getElementById('saveSnapshotBtn');
        const deleteBtn = document.getElementById('deleteSnapshotBtn');
        const modal = document.getElementById('snapshotModal');
        const commentInput = document.getElementById('commentInput');
        const quickCommentInput = document.getElementById('quickCommentInput');

        modalClose.addEventListener('click', () => this.closeModal());
        saveBtn.addEventListener('click', () => this.saveAndClose());
        deleteBtn.addEventListener('click', () => this.deleteCurrentSnapshot());

        // Quick comment - auto-create snapshot on first letter
        if (quickCommentInput) {
            quickCommentInput.addEventListener('input', (e) => {
                this.handleQuickComment(e.target.value);
            });
        }

        // Comment color picker - apply to selected text
        document.querySelectorAll('.comment-color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.applyColorToSelection(btn.dataset.color);
            });
        });

        // Close modal on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });

        // Close modal on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.hidden) {
                this.closeModal();
            }
        });
    },

    /**
     * Handle quick comment input
     * @param {string} value - Comment text
     */
    async handleQuickComment(value) {
        if (!VideoHandler.currentProjectId) return;

        // On first character, create snapshot
        if (value.length === 1 && !this.quickCommentSnapshotId) {
            await this.captureSnapshotWithComment(value);
        } else if (this.quickCommentSnapshotId && value.length > 0) {
            // Update existing snapshot comment
            await Storage.updateSnapshot(this.quickCommentSnapshotId, {
                comment: value
            });
            this.updateSnapshotCard(this.quickCommentSnapshotId, { comment: value });
        } else if (value.length === 0) {
            // Reset if comment is cleared
            this.quickCommentSnapshotId = null;
        }
    },

    /**
     * Capture snapshot with initial comment text
     * @param {string} initialComment - Initial comment text
     */
    async captureSnapshotWithComment(initialComment = '') {
        if (!VideoHandler.currentProjectId) {
            App.showToast('No video loaded', 'error');
            return;
        }

        // Pause video
        VideoHandler.video.pause();

        // Flash effect
        const wrapper = document.querySelector('.video-wrapper');
        wrapper.classList.add('flash');
        setTimeout(() => wrapper.classList.remove('flash'), 150);

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

        // Store reference for updating
        this.quickCommentSnapshotId = snapshotId;

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
    },

    /**
     * Sort snapshots in the list by timecode order
     */
    sortSnapshotsByTimecode() {
        const listEl = document.getElementById('snapshotsList');
        const cards = Array.from(listEl.querySelectorAll('.snapshot-card'));
        
        if (cards.length === 0) return;
        
        // Sort cards by data-timestamp attribute
        cards.sort((a, b) => {
            const timeA = parseFloat(a.dataset.timestamp) || 0;
            const timeB = parseFloat(b.dataset.timestamp) || 0;
            return timeA - timeB;
        });

        // Clear and re-append in sorted order
        cards.forEach(card => {
            card.remove();
        });
        cards.forEach(card => {
            listEl.appendChild(card);
        });
    },

    /**
     * Apply color to selected text in comment
     * @param {string} color - Hex color code
     */
    applyColorToSelection(color) {
        const commentInput = document.getElementById('commentInput');
        commentInput.focus();
        
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        
        // If no text is selected, do nothing
        if (range.collapsed) {
            return;
        }
        
        // Create a span with the color
        const span = document.createElement('span');
        span.style.color = color;
        
        try {
            // Extract the selected content
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
            
            // Move cursor to end of inserted span
            range.setStartAfter(span);
            range.setEndAfter(span);
            selection.removeAllRanges();
            selection.addRange(range);
        } catch (e) {
            console.error('Error applying color:', e);
        }
    },

    /**
     * Capture a snapshot from current video frame
     */
    async captureSnapshot() {
        if (!VideoHandler.currentProjectId) {
            App.showToast('No video loaded', 'error');
            return;
        }

        // Pause video
        VideoHandler.video.pause();

        // Flash effect
        const wrapper = document.querySelector('.video-wrapper');
        wrapper.classList.add('flash');
        setTimeout(() => wrapper.classList.remove('flash'), 150);

        // Capture frame
        const canvas = VideoHandler.captureFrame();
        const imageData = canvas.toDataURL('image/png');
        const timestamp = VideoHandler.getCurrentTime();

        // Save to storage
        const snapshotId = await Storage.addSnapshot({
            projectId: VideoHandler.currentProjectId,
            timestamp: timestamp,
            originalImage: imageData,
            comment: '',
            tags: []
        });

        // Get the full snapshot data
        const snapshot = await Storage.getSnapshot(snapshotId);
        this.snapshots.push(snapshot);

        // Add to list
        this.addSnapshotToList(snapshot);

        // Sort snapshots by timecode
        this.sortSnapshotsByTimecode();

        // Add marker to timeline
        this.addTimelineMarker(snapshot);

        // Update count
        this.updateSnapshotCount();

        App.showToast('Snapshot captured!', 'success');
    },

    /**
     * Add a snapshot card to the list
     * @param {Object} snapshot - Snapshot data
     */
    addSnapshotToList(snapshot) {
        const list = document.getElementById('snapshotsList');
        const emptyState = document.getElementById('emptyState');
        
        // Hide empty state
        if (emptyState) {
            emptyState.hidden = true;
        }

        const card = document.createElement('div');
        card.className = 'snapshot-card';
        card.dataset.id = snapshot.id;
        card.dataset.timestamp = snapshot.timestamp; // Store timestamp for sorting
        
        if (snapshot.fabricData) {
            card.classList.add('has-markup');
        }

        // Format tags with hours
        const tagsHtml = (snapshot.tags || []).map(tag => {
            const hours = snapshot.tagHours && snapshot.tagHours[tag];
            const hoursText = hours ? ` (${hours}h)` : '';
            return `<span class="snapshot-tag" data-tag="${tag}">${this.getTagLabel(tag)}${hoursText}</span>`;
        }).join('');

        card.innerHTML = `
            <div class="snapshot-card-thumbnail">
                <button class="snapshot-card-delete" title="Delete snapshot">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
                <img src="${snapshot.originalImage}" alt="Snapshot at ${VideoHandler.formatTimecode(snapshot.timestamp)}">
                <span class="snapshot-card-timecode">${VideoHandler.formatTimecode(snapshot.timestamp)}</span>
            </div>
            <div class="snapshot-card-body">
                <div class="snapshot-card-tags">${tagsHtml}</div>
                <div class="snapshot-card-comment">${snapshot.comment || ''}</div>
            </div>
        `;

        // Delete button click
        const deleteBtn = card.querySelector('.snapshot-card-delete');
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.deleteSnapshotById(snapshot.id);
        });

        // Click to open modal
        card.addEventListener('click', () => this.openSnapshot(snapshot.id));

        // Double-click to seek
        card.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            VideoHandler.seekTo(snapshot.timestamp);
        });

        list.appendChild(card);
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
     * Open snapshot in modal for editing
     * @param {number} id - Snapshot ID
     */
    async openSnapshot(id) {
        const snapshot = await Storage.getSnapshot(id);
        if (!snapshot) return;

        this.currentSnapshotId = id;

        // Update modal header
        document.getElementById('modalTimecode').textContent = 
            VideoHandler.formatTimecode(snapshot.timestamp);

        // Initialize drawing canvas with snapshot image
        DrawingTool.loadImage(snapshot.originalImage, snapshot.fabricData);

        // Set comment (HTML content)
        const commentInput = document.getElementById('commentInput');
        commentInput.innerHTML = snapshot.comment || '';

        // Set tags and hours
        TagManager.setTags(snapshot.tags || [], snapshot.tagHours || {});

        // Show modal
        document.getElementById('snapshotModal').hidden = false;
        document.body.style.overflow = 'hidden';
    },

    /**
     * Close the modal
     */
    closeModal() {
        document.getElementById('snapshotModal').hidden = true;
        document.body.style.overflow = '';
        this.currentSnapshotId = null;
    },

    /**
     * Save current snapshot and close modal
     */
    async saveAndClose() {
        if (!this.currentSnapshotId) return;

        // Get current state (HTML content for rich text)
        const comment = document.getElementById('commentInput').innerHTML;
        const tags = TagManager.getTags();
        const tagHours = TagManager.getTagHours();
        const fabricData = DrawingTool.getCanvasData();
        const markedUpImage = DrawingTool.getMarkedUpImage();

        // Update storage
        await Storage.updateSnapshot(this.currentSnapshotId, {
            comment,
            tags,
            tagHours,
            fabricData,
            markedUpImage
        });

        // Update card in list
        this.updateSnapshotCard(this.currentSnapshotId, { comment, tags, tagHours, fabricData });

        App.showToast('Snapshot saved!', 'success');
        this.closeModal();
    },

    /**
     * Update a snapshot card in the list
     * @param {number} id - Snapshot ID
     * @param {Object} data - Updated data
     */
    updateSnapshotCard(id, data) {
        const card = document.querySelector(`.snapshot-card[data-id="${id}"]`);
        if (!card) return;

        // Update tags with hours
        const tagsContainer = card.querySelector('.snapshot-card-tags');
        tagsContainer.innerHTML = (data.tags || []).map(tag => {
            const hours = data.tagHours && data.tagHours[tag];
            const hoursText = hours ? ` (${hours}h)` : '';
            return `<span class="snapshot-tag" data-tag="${tag}">${this.getTagLabel(tag)}${hoursText}</span>`;
        }).join('');

        // Update comment (HTML content)
        const commentEl = card.querySelector('.snapshot-card-comment');
        commentEl.innerHTML = data.comment || '';

        // Update markup indicator
        if (data.fabricData) {
            card.classList.add('has-markup');
        } else {
            card.classList.remove('has-markup');
        }
    },

    /**
     * Delete current snapshot (from modal)
     */
    async deleteCurrentSnapshot() {
        if (!this.currentSnapshotId) return;

        if (!confirm('Are you sure you want to delete this snapshot?')) return;

        await this.deleteSnapshotById(this.currentSnapshotId);
        this.closeModal();
    },

    /**
     * Delete a snapshot by ID
     * @param {number} id - Snapshot ID
     */
    async deleteSnapshotById(id) {
        if (!confirm('Delete this snapshot?')) return;

        // Remove from storage
        await Storage.deleteSnapshot(id);

        // Remove card from list
        const card = document.querySelector(`.snapshot-card[data-id="${id}"]`);
        if (card) card.remove();

        // Remove timeline marker
        const marker = document.querySelector(`.snapshot-marker[data-id="${id}"]`);
        if (marker) marker.remove();

        // Update count
        this.updateSnapshotCount();

        // Show empty state if no snapshots
        const count = document.querySelectorAll('.snapshot-card').length;
        if (count === 0) {
            document.getElementById('emptyState').hidden = false;
        }

        // Remove from local array
        this.snapshots = this.snapshots.filter(s => s.id !== id);

        // If this was the current snapshot in modal, clear it
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

// Make SnapshotManager globally available
window.SnapshotManager = SnapshotManager;

