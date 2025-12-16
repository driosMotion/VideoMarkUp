/**
 * Tag Manager Module
 * Handles tag selection and hour estimates for snapshots
 */

const TagManager = {
    activeTags: [],
    tagHours: {},

    /**
     * Initialize tag manager
     */
    init() {
        this.setupEventListeners();
    },

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        document.querySelectorAll('.tag-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.toggleTag(btn.dataset.tag);
            });
        });

        // Hour inputs
        document.querySelectorAll('.tag-hours-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const tag = e.target.dataset.tag;
                const hours = parseFloat(e.target.value) || 0;
                this.tagHours[tag] = hours;
            });
        });
    },

    /**
     * Toggle a tag on/off
     * @param {string} tag - Tag identifier
     */
    toggleTag(tag) {
        const btn = document.querySelector(`.tag-btn[data-tag="${tag}"]`);
        const hoursInput = document.querySelector(`.tag-hours-input[data-tag="${tag}"]`);
        
        if (this.activeTags.includes(tag)) {
            // Remove tag
            this.activeTags = this.activeTags.filter(t => t !== tag);
            btn.classList.remove('active');
            // Clear hours when tag is removed
            delete this.tagHours[tag];
            if (hoursInput) hoursInput.value = '';
        } else {
            // Add tag
            this.activeTags.push(tag);
            btn.classList.add('active');
            // Focus the hours input
            if (hoursInput) {
                hoursInput.focus();
            }
        }
    },

    /**
     * Set tags and hours (for loading a snapshot)
     * @param {Array} tags - Array of tag identifiers
     * @param {Object} hours - Object with tag hours
     */
    setTags(tags, hours = {}) {
        // Reset all buttons and inputs
        document.querySelectorAll('.tag-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tag-hours-input').forEach(input => {
            input.value = '';
        });

        // Set active tags
        this.activeTags = tags || [];
        this.tagHours = hours || {};
        
        this.activeTags.forEach(tag => {
            const btn = document.querySelector(`.tag-btn[data-tag="${tag}"]`);
            const hoursInput = document.querySelector(`.tag-hours-input[data-tag="${tag}"]`);
            if (btn) {
                btn.classList.add('active');
            }
            if (hoursInput && this.tagHours[tag]) {
                hoursInput.value = this.tagHours[tag];
            }
        });
    },

    /**
     * Get current active tags
     * @returns {Array}
     */
    getTags() {
        return [...this.activeTags];
    },

    /**
     * Get current tag hours
     * @returns {Object}
     */
    getTagHours() {
        // Only return hours for active tags
        const hours = {};
        this.activeTags.forEach(tag => {
            if (this.tagHours[tag]) {
                hours[tag] = this.tagHours[tag];
            }
        });
        return hours;
    },

    /**
     * Clear all tags and hours
     */
    clearTags() {
        this.activeTags = [];
        this.tagHours = {};
        document.querySelectorAll('.tag-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tag-hours-input').forEach(input => {
            input.value = '';
        });
    },

    /**
     * Get tag display label
     * @param {string} tag - Tag identifier
     * @returns {string}
     */
    getTagLabel(tag) {
        const labels = {
            vfx: 'VFX',
            roto: 'Rotoscopy',
            '3d': '3D',
            color: 'Color',
            comp: 'Composite',
            cleanup: 'Cleanup',
            audio: 'Audio',
            review: 'Review'
        };
        return labels[tag] || tag;
    },

    /**
     * Get tag color
     * @param {string} tag - Tag identifier
     * @returns {string}
     */
    getTagColor(tag) {
        const colors = {
            vfx: '#ff6b6b',
            roto: '#4ecdc4',
            '3d': '#a855f7',
            color: '#feca57',
            comp: '#48dbfb',
            cleanup: '#1dd1a1',
            audio: '#ff9ff3',
            review: '#f39c12'
        };
        return colors[tag] || '#888888';
    },

    /**
     * Get all available tags
     * @returns {Array}
     */
    getAllTags() {
        return ['vfx', 'roto', '3d', 'color', 'comp', 'cleanup', 'audio', 'review'];
    }
};

// Make TagManager globally available
window.TagManager = TagManager;

