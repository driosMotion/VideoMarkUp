/**
 * App State Manager
 * Centralized state management for the application
 */

const AppState = {
    // Project state
    currentProjectId: null,
    projectName: '',
    
    // Video state
    videoLoaded: false,
    videoPlaying: false,
    videoDuration: 0,
    videoCurrentTime: 0,
    
    // Snapshot state
    activeSnapshotId: null,
    quickCommentSnapshotId: null,
    snapshots: [],
    isCreatingSnapshot: false,
    
    // Drawing state
    currentTool: 'select',
    currentColor: '#ff3b3b',
    brushSize: 6,
    canvasInitialized: false,
    isEditMode: false,
    
    // UI state
    activeTags: [],
    
    // State change listeners
    listeners: {},
    
    /**
     * Initialize state manager
     */
    init() {
        ErrorHandler.debug('AppState initialized');
    },
    
    /**
     * Subscribe to state changes
     * @param {string} key - State key to watch
     * @param {function} callback - Callback function
     * @returns {function} Unsubscribe function
     */
    subscribe(key, callback) {
        if (!this.listeners[key]) {
            this.listeners[key] = [];
        }
        
        this.listeners[key].push(callback);
        
        // Return unsubscribe function
        return () => {
            this.listeners[key] = this.listeners[key].filter(cb => cb !== callback);
        };
    },
    
    /**
     * Notify listeners of state change
     * @param {string} key - State key that changed
     * @param {any} newValue - New value
     * @param {any} oldValue - Old value
     */
    notify(key, newValue, oldValue) {
        if (this.listeners[key]) {
            this.listeners[key].forEach(callback => {
                try {
                    callback(newValue, oldValue);
                } catch (error) {
                    ErrorHandler.error(`State listener error for key: ${key}`, error);
                }
            });
        }
    },
    
    /**
     * Set state value
     * @param {string} key - State key
     * @param {any} value - New value
     */
    set(key, value) {
        const oldValue = this[key];
        
        if (oldValue !== value) {
            this[key] = value;
            this.notify(key, value, oldValue);
            ErrorHandler.debug(`State changed: ${key}`, { old: oldValue, new: value });
        }
    },
    
    /**
     * Get state value
     * @param {string} key - State key
     * @returns {any} State value
     */
    get(key) {
        return this[key];
    },
    
    /**
     * Update multiple state values
     * @param {Object} updates - Object with key-value pairs
     */
    update(updates) {
        Object.entries(updates).forEach(([key, value]) => {
            this.set(key, value);
        });
    },
    
    /**
     * Reset state to defaults
     */
    reset() {
        const defaults = {
            currentProjectId: null,
            projectName: '',
            videoLoaded: false,
            videoPlaying: false,
            videoDuration: 0,
            videoCurrentTime: 0,
            activeSnapshotId: null,
            quickCommentSnapshotId: null,
            snapshots: [],
            isCreatingSnapshot: false,
            currentTool: 'select',
            currentColor: '#ff3b3b',
            brushSize: 6,
            canvasInitialized: false,
            isEditMode: false,
            activeTags: []
        };
        
        this.update(defaults);
        ErrorHandler.info('AppState reset to defaults');
    },
    
    /**
     * Get current snapshot from state
     * @returns {Object|null} Current snapshot or null
     */
    getCurrentSnapshot() {
        if (!this.activeSnapshotId) return null;
        return this.snapshots.find(s => s.id === this.activeSnapshotId) || null;
    },
    
    /**
     * Add snapshot to state
     * @param {Object} snapshot - Snapshot object
     */
    addSnapshot(snapshot) {
        this.snapshots.push(snapshot);
        this.notify('snapshots', this.snapshots, [...this.snapshots]);
    },
    
    /**
     * Update snapshot in state
     * @param {number} snapshotId - Snapshot ID
     * @param {Object} updates - Updates to apply
     */
    updateSnapshot(snapshotId, updates) {
        const index = this.snapshots.findIndex(s => s.id === snapshotId);
        if (index !== -1) {
            this.snapshots[index] = { ...this.snapshots[index], ...updates };
            this.notify('snapshots', this.snapshots, [...this.snapshots]);
        }
    },
    
    /**
     * Remove snapshot from state
     * @param {number} snapshotId - Snapshot ID
     */
    removeSnapshot(snapshotId) {
        const oldSnapshots = [...this.snapshots];
        this.snapshots = this.snapshots.filter(s => s.id !== snapshotId);
        this.notify('snapshots', this.snapshots, oldSnapshots);
    },
    
    /**
     * Get state snapshot (for debugging)
     * @returns {Object} Current state
     */
    getSnapshot() {
        return {
            currentProjectId: this.currentProjectId,
            projectName: this.projectName,
            videoLoaded: this.videoLoaded,
            videoPlaying: this.videoPlaying,
            videoDuration: this.videoDuration,
            videoCurrentTime: this.videoCurrentTime,
            activeSnapshotId: this.activeSnapshotId,
            quickCommentSnapshotId: this.quickCommentSnapshotId,
            snapshotCount: this.snapshots.length,
            isCreatingSnapshot: this.isCreatingSnapshot,
            currentTool: this.currentTool,
            currentColor: this.currentColor,
            brushSize: this.brushSize,
            canvasInitialized: this.canvasInitialized,
            isEditMode: this.isEditMode,
            activeTagsCount: this.activeTags.length
        };
    }
};

