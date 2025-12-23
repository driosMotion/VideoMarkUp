/**
 * Canvas Manager Module
 * Handles Fabric.js canvas lifecycle, initialization, and sizing
 */

const CanvasManager = {
    canvas: null,
    canvasElement: null,
    
    /**
     * Initialize canvas manager
     */
    init() {
        this.canvasElement = document.getElementById('mainDrawingCanvas');
        if (!this.canvasElement) {
            ErrorHandler.error('Canvas element not found');
            return false;
        }
        return true;
    },
    
    /**
     * Initialize or resize the Fabric canvas
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @returns {fabric.Canvas|null} Fabric canvas instance
     */
    initCanvas(width = null, height = null) {
        try {
            // If no dimensions provided, use video display dimensions
            if (!width || !height) {
                const videoEl = document.getElementById('videoPlayer');
                if (videoEl) {
                    const rect = videoEl.getBoundingClientRect();
                    width = rect.width;
                    height = rect.height;
                } else {
                    ErrorHandler.warn('Video element not found, using default canvas size');
                    width = 560;
                    height = 560;
                }
            }

            // Only create canvas once
            if (!this.canvas) {
                this.createCanvas(width, height);
            } else if (this.canvas && this.canvas.setDimensions) {
                // Just resize existing canvas
                this.resizeCanvas(width, height);
            }
            
            AppState.set('canvasInitialized', true);
            return this.canvas;
            
        } catch (error) {
            ErrorHandler.error('Canvas initialization failed', error);
            // Try to recreate canvas
            return this.recreateCanvas(width, height);
        }
    },
    
    /**
     * Create new Fabric canvas
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     */
    createCanvas(width, height) {
        // Set canvas dimensions
        this.canvasElement.width = width;
        this.canvasElement.height = height;
        this.canvasElement.style.width = width + 'px';
        this.canvasElement.style.height = height + 'px';

        // Initialize Fabric canvas
        this.canvas = new fabric.Canvas('mainDrawingCanvas', {
            width: width,
            height: height,
            selection: true,
            preserveObjectStacking: true,
            backgroundColor: null,
            renderOnAddRemove: true,
            enableRetinaScaling: false,
            allowTouchScrolling: false,
            skipTargetFind: false
        });

        ErrorHandler.debug('Canvas created', { width, height });
    },
    
    /**
     * Resize existing canvas
     * @param {number} width - New width
     * @param {number} height - New height
     */
    resizeCanvas(width, height) {
        try {
            this.canvasElement.width = width;
            this.canvasElement.height = height;
            this.canvasElement.style.width = width + 'px';
            this.canvasElement.style.height = height + 'px';
            
            this.canvas.setDimensions({
                width: width,
                height: height
            });
            
            ErrorHandler.debug('Canvas resized', { width, height });
        } catch (error) {
            ErrorHandler.warn('Canvas resize failed, recreating', error);
            this.recreateCanvas(width, height);
        }
    },
    
    /**
     * Recreate canvas after fatal error
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @returns {fabric.Canvas|null} New canvas instance
     */
    recreateCanvas(width, height) {
        try {
            if (this.canvas) {
                this.disposeCanvas();
            }
            this.createCanvas(width, height);
            return this.canvas;
        } catch (error) {
            ErrorHandler.error('Canvas recreation failed', error);
            return null;
        }
    },
    
    /**
     * Safely dispose of canvas
     */
    disposeCanvas() {
        if (this.canvas && typeof this.canvas.dispose === 'function') {
            try {
                this.canvas.dispose();
                this.canvas = null;
                AppState.set('canvasInitialized', false);
                ErrorHandler.debug('Canvas disposed');
            } catch (error) {
                ErrorHandler.warn('Canvas disposal error', error);
                this.canvas = null;
            }
        }
    },
    
    /**
     * Clear canvas safely
     */
    clearCanvas() {
        if (this.canvas && typeof this.canvas.clear === 'function') {
            try {
                this.canvas.clear();
                if (typeof this.canvas.renderAll === 'function') {
                    this.canvas.renderAll();
                }
            } catch (error) {
                ErrorHandler.warn('Canvas clear error', error);
            }
        }
    },
    
    /**
     * Get canvas instance
     * @returns {fabric.Canvas|null} Canvas instance
     */
    getCanvas() {
        return this.canvas;
    },
    
    /**
     * Check if canvas is ready
     * @returns {boolean} True if canvas is initialized
     */
    isReady() {
        return this.canvas !== null && typeof this.canvas.isDrawingMode !== 'undefined';
    },
    
    /**
     * Load canvas data from JSON
     * @param {string} jsonData - Fabric.js JSON data
     */
    loadCanvasData(jsonData) {
        if (!this.isReady()) {
            ErrorHandler.warn('Cannot load canvas data: canvas not ready');
            return;
        }
        
        try {
            this.canvas.loadFromJSON(jsonData, () => {
                this.canvas.renderAll();
                ErrorHandler.debug('Canvas data loaded');
            });
        } catch (error) {
            ErrorHandler.error('Failed to load canvas data', error);
        }
    },
    
    /**
     * Get canvas data as JSON
     * @returns {Object|null} Canvas data
     */
    getCanvasData() {
        if (!this.isReady()) {
            return null;
        }
        
        try {
            // Only return data if there are objects
            if (this.canvas.getObjects().length > 0) {
                return this.canvas.toJSON();
            }
            return null;
        } catch (error) {
            ErrorHandler.error('Failed to get canvas data', error);
            return null;
        }
    }
};

