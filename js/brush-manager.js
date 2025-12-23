/**
 * Brush Manager Module
 * Handles drawing brush and tool configurations
 */

const BrushManager = {
    /**
     * Initialize brush manager
     */
    init() {
        ErrorHandler.debug('BrushManager initialized');
    },
    
    /**
     * Configure brush for drawing mode
     * @param {fabric.Canvas} canvas - Fabric canvas instance
     */
    setupDrawingBrush(canvas) {
        if (!canvas) return;
        
        try {
            const color = AppState.get('currentColor');
            const brushSize = AppState.get('brushSize');
            
            canvas.isDrawingMode = true;
            canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
            canvas.freeDrawingBrush.color = color;
            canvas.freeDrawingBrush.width = brushSize;
            canvas.freeDrawingBrush.strokeLineCap = 'round';
            canvas.freeDrawingBrush.strokeLineJoin = 'round';
            
            ErrorHandler.debug('Drawing brush configured', { color, brushSize });
        } catch (error) {
            ErrorHandler.error('Failed to configure drawing brush', error);
        }
    },
    
    /**
     * Update brush color
     * @param {fabric.Canvas} canvas - Fabric canvas instance
     * @param {string} color - New color
     */
    updateColor(canvas, color) {
        if (!canvas) return;
        
        AppState.set('currentColor', color);
        
        if (canvas.freeDrawingBrush) {
            canvas.freeDrawingBrush.color = color;
        }
        
        ErrorHandler.debug('Brush color updated', { color });
    },
    
    /**
     * Update brush size
     * @param {fabric.Canvas} canvas - Fabric canvas instance
     * @param {number} size - New brush size
     */
    updateSize(canvas, size) {
        if (!canvas) return;
        
        AppState.set('brushSize', size);
        
        if (canvas.freeDrawingBrush) {
            canvas.freeDrawingBrush.width = size;
        }
        
        ErrorHandler.debug('Brush size updated', { size });
    },
    
    /**
     * Apply tool settings to canvas
     * @param {fabric.Canvas} canvas - Fabric canvas instance
     * @param {string} tool - Tool name
     */
    applyToolSettings(canvas, tool) {
        if (!canvas || typeof canvas.isDrawingMode === 'undefined') {
            ErrorHandler.warn('Cannot apply tool settings: canvas not ready');
            return;
        }

        try {
            switch (tool) {
                case 'select':
                    this.setupSelectMode(canvas);
                    break;

                case 'draw':
                    this.setupDrawMode(canvas);
                    break;

                case 'text':
                    this.setupTextModeWrapper(canvas);
                    break;

                case 'eraser':
                    this.setupEraserModeWrapper(canvas);
                    break;

                default:
                    // Shape drawing tools (rect, circle, arrow)
                    this.setupShapeMode(canvas);
                    break;
            }
            
            ErrorHandler.debug('Tool settings applied', { tool });
        } catch (error) {
            ErrorHandler.error('Failed to apply tool settings', error);
        }
    },
    
    /**
     * Setup select mode
     */
    setupSelectMode(canvas) {
        canvas.isDrawingMode = false;
        canvas.selection = true;
        canvas.forEachObject(obj => {
            obj.selectable = true;
            obj.evented = true;
        });
    },
    
    /**
     * Setup draw mode
     */
    setupDrawMode(canvas) {
        canvas.isDrawingMode = true;
        canvas.selection = false;
        canvas.forEachObject(obj => {
            obj.selectable = false;
            obj.evented = false;
        });
        this.setupDrawingBrush(canvas);
    },
    
    /**
     * Setup shape mode (rect, circle, arrow)
     */
    setupShapeMode(canvas) {
        canvas.isDrawingMode = false;
        canvas.selection = false;
        canvas.forEachObject(obj => {
            obj.selectable = false;
            obj.evented = false;
        });
    },
    
    /**
     * Setup text mode wrapper
     */
    setupTextModeWrapper(canvas) {
        canvas.isDrawingMode = false;
        canvas.selection = false;
        canvas.forEachObject(obj => {
            obj.selectable = false;
            obj.evented = false;
        });
        ShapeDrawing.setupTextMode(canvas);
    },
    
    /**
     * Setup eraser mode wrapper
     */
    setupEraserModeWrapper(canvas) {
        canvas.isDrawingMode = false;
        canvas.selection = false;
        canvas.forEachObject(obj => {
            obj.selectable = true;
            obj.evented = true;
        });
        ShapeDrawing.setupEraserMode(canvas);
    },
    
    /**
     * Undo last action
     * @param {fabric.Canvas} canvas - Fabric canvas instance
     */
    undo(canvas) {
        if (!canvas) return;
        
        try {
            const objects = canvas.getObjects();
            if (objects.length > 0) {
                const lastObj = objects[objects.length - 1];
                
                // If it's an arrow, remove the arrowhead too
                if (lastObj.arrowHead) {
                    canvas.remove(lastObj.arrowHead);
                }
                
                canvas.remove(lastObj);
                canvas.renderAll();
                ErrorHandler.debug('Undo performed');
            }
        } catch (error) {
            ErrorHandler.error('Undo failed', error);
        }
    },
    
    /**
     * Clear all drawings
     * @param {fabric.Canvas} canvas - Fabric canvas instance
     */
    clearAll(canvas) {
        if (!canvas) return;
        
        try {
            const objects = canvas.getObjects();
            objects.forEach(obj => {
                canvas.remove(obj);
            });
            canvas.renderAll();
            ErrorHandler.info('Canvas cleared');
        } catch (error) {
            ErrorHandler.error('Clear canvas failed', error);
        }
    }
};

