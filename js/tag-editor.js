/**
 * Tag Editor Module
 * Handles tag management and customization
 */

const TagEditor = {
    // Available tags
    allTags: [
        { id: 'vfx', label: 'VFX', color: '#ff6b6b' },
        { id: 'roto', label: 'Roto', color: '#4ecdc4' },
        { id: '3d', label: '3D', color: '#a855f7' },
        { id: 'comp', label: 'Comp', color: '#48dbfb' },
        { id: 'color', label: 'Color', color: '#feca57' },
        { id: 'cleanup', label: 'Clean', color: '#1dd1a1' },
        { id: 'audio', label: 'Audio', color: '#ff9ff3' },
        { id: 'review', label: 'Review', color: '#f39c12' }
    ],

    // Active tags (max 4)
    activeTags: ['vfx', 'roto', '3d', 'comp'],

    /**
     * Initialize tag editor
     */
    init() {
        try {
            this.loadActiveTags();
            this.setupEventListeners();
        } catch (error) {
            console.error('TagEditor init error:', error);
        }
    },

    /**
     * Load active tags from storage
     */
    loadActiveTags() {
        const saved = localStorage.getItem('activeTags');
        if (saved) {
            try {
                this.activeTags = JSON.parse(saved);
            } catch (e) {
                console.error('Failed to load active tags:', e);
            }
        }
        this.updateTagsPanel();
    },

    /**
     * Save active tags to storage
     */
    saveActiveTags() {
        localStorage.setItem('activeTags', JSON.stringify(this.activeTags));
        this.updateTagsPanel();
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        try {
            const editBtn = document.getElementById('editTagsBtn');
            const modal = document.getElementById('tagEditorModal');
            const closeBtn = document.getElementById('tagEditorClose');

            if (!editBtn || !modal || !closeBtn) {
                console.warn('Tag editor elements not found in DOM');
                return;
            }

            editBtn.addEventListener('click', () => this.openModal());
            closeBtn.addEventListener('click', () => this.closeModal());

            // Close on overlay click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });

            // Close on Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modal && !modal.hidden) {
                    this.closeModal();
                }
            });
        } catch (error) {
            console.error('Error setting up tag editor listeners:', error);
        }
    },

    /**
     * Open tag editor modal
     */
    openModal() {
        const modal = document.getElementById('tagEditorModal');
        const list = document.getElementById('tagEditorList');

        // Clear list
        list.innerHTML = '';

        // Populate tags
        this.allTags.forEach(tag => {
            const item = document.createElement('div');
            item.className = 'tag-editor-item';
            if (this.activeTags.includes(tag.id)) {
                item.classList.add('active');
            }

            item.innerHTML = `
                <div class="tag-editor-checkbox">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                <div class="tag-editor-tag-preview">
                    <div class="tag-editor-color-dot" style="background: ${tag.color};"></div>
                    <span class="tag-editor-tag-name">${tag.label}</span>
                </div>
            `;

            item.addEventListener('click', () => this.toggleTag(tag.id, item));
            list.appendChild(item);
        });

        modal.hidden = false;
    },

    /**
     * Close tag editor modal
     */
    closeModal() {
        const modal = document.getElementById('tagEditorModal');
        modal.hidden = true;
    },

    /**
     * Toggle tag selection
     */
    toggleTag(tagId, itemElement) {
        const isActive = this.activeTags.includes(tagId);

        if (isActive) {
            // Remove tag
            this.activeTags = this.activeTags.filter(id => id !== tagId);
            itemElement.classList.remove('active');
        } else {
            // Add tag (max 4)
            if (this.activeTags.length >= 4) {
                App.showToast('Maximum 4 tags allowed', 'warning');
                return;
            }
            this.activeTags.push(tagId);
            itemElement.classList.add('active');
        }

        this.saveActiveTags();
    },

    /**
     * Update the tags panel in the UI
     */
    updateTagsPanel() {
        try {
            const container = document.querySelector('.tags-grid-inline');
            if (!container) {
                console.warn('Tags container not found');
                return;
            }

            // Clear existing tags
            container.innerHTML = '';

            // Add active tags
            this.activeTags.forEach(tagId => {
                const tagInfo = this.allTags.find(t => t.id === tagId);
                if (!tagInfo) return;

                const tagItem = document.createElement('div');
                tagItem.className = 'tag-item';
                tagItem.innerHTML = `
                    <button class="tag-btn" data-tag="${tagInfo.id}">${tagInfo.label}</button>
                    <input type="number" class="tag-hours-input" data-tag="${tagInfo.id}" placeholder="h" min="0" step="0.5">
                `;

                container.appendChild(tagItem);
            });

            // Re-attach event listeners for tag manager
            if (window.TagManager) {
                TagManager.setupEventListeners();
            }
        } catch (error) {
            console.error('Error updating tags panel:', error);
        }
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TagEditor;
}

