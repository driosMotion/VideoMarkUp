/**
 * Tag Editor Module
 * Handles tag management and customization
 */

const TagEditor = {
    // Default tags (cannot be deleted)
    defaultTags: [
        { id: 'vfx', label: 'VFX', color: '#ff6b6b', isDefault: true },
        { id: 'roto', label: 'Roto', color: '#4ecdc4', isDefault: true },
        { id: '3d', label: '3D', color: '#a855f7', isDefault: true },
        { id: 'comp', label: 'Comp', color: '#48dbfb', isDefault: true },
        { id: 'color', label: 'Color', color: '#feca57', isDefault: true },
        { id: 'cleanup', label: 'Clean', color: '#1dd1a1', isDefault: true },
        { id: 'audio', label: 'Audio', color: '#ff9ff3', isDefault: true },
        { id: 'review', label: 'Review', color: '#f39c12', isDefault: true }
    ],

    // All tags (default + custom)
    allTags: [],

    // Custom tags (user-created)
    customTags: [],

    // Active tags (max 4)
    activeTags: ['vfx', 'roto', '3d', 'comp'],

    /**
     * Initialize tag editor
     */
    init() {
        try {
            this.loadCustomTags();
            this.allTags = [...this.defaultTags, ...this.customTags];
            this.loadActiveTags();
            this.setupEventListeners();
        } catch (error) {
            console.error('TagEditor init error:', error);
        }
    },

    /**
     * Load custom tags from storage
     */
    loadCustomTags() {
        const saved = localStorage.getItem('customTags');
        if (saved) {
            try {
                this.customTags = JSON.parse(saved);
            } catch (e) {
                console.error('Failed to load custom tags:', e);
                this.customTags = [];
            }
        }
    },

    /**
     * Save custom tags to storage
     */
    saveCustomTags() {
        localStorage.setItem('customTags', JSON.stringify(this.customTags));
        this.allTags = [...this.defaultTags, ...this.customTags];
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
            const addBtn = document.getElementById('addTagBtn');

            if (!editBtn || !modal || !closeBtn) {
                console.warn('Tag editor elements not found in DOM');
                return;
            }

            editBtn.addEventListener('click', () => this.openModal());
            closeBtn.addEventListener('click', () => this.closeModal());
            
            if (addBtn) {
                addBtn.addEventListener('click', () => this.addNewTag());
            }

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

            const deleteBtn = tag.isDefault ? '' : `
                <button class="tag-editor-delete" data-tag-id="${tag.id}" title="Delete tag">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            `;

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
                ${deleteBtn}
            `;

            const mainArea = item.querySelector('.tag-editor-tag-preview').parentElement;
            mainArea.addEventListener('click', (e) => {
                if (!e.target.closest('.tag-editor-delete')) {
                    this.toggleTag(tag.id, item);
                }
            });

            const deleteButton = item.querySelector('.tag-editor-delete');
            if (deleteButton) {
                deleteButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteTag(tag.id);
                });
            }

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
            // Add tag (max 8)
            if (this.activeTags.length >= 8) {
                App.showToast('Maximum 8 tags allowed', 'warning');
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
    },

    /**
     * Add a new custom tag
     */
    addNewTag() {
        const name = prompt('Enter tag name:');
        if (!name || !name.trim()) return;

        const color = prompt('Enter color (hex, e.g. #ff0000):', '#ff6b6b');
        if (!color || !color.trim()) return;

        // Generate ID from name
        const id = name.toLowerCase().replace(/\s+/g, '_');

        // Check if tag with this ID already exists
        if (this.allTags.find(t => t.id === id)) {
            App.showToast('A tag with this name already exists', 'warning');
            return;
        }

        // Add to custom tags
        const newTag = { id, label: name.trim(), color: color.trim(), isDefault: false };
        this.customTags.push(newTag);
        this.saveCustomTags();

        // Refresh modal
        this.openModal();
        App.showToast('Tag added successfully', 'success');
    },

    /**
     * Delete a custom tag
     */
    deleteTag(tagId) {
        // Remove from custom tags
        this.customTags = this.customTags.filter(t => t.id !== tagId);
        this.saveCustomTags();

        // Remove from active tags if present
        this.activeTags = this.activeTags.filter(id => id !== tagId);
        this.saveActiveTags();

        // Refresh modal
        this.openModal();
        App.showToast('Tag deleted', 'success');
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TagEditor;
}

