/**
 * Shape Drawing Module
 * Handles drawing rectangles, circles, arrows, and text
 */

const ShapeDrawing = {
    isDrawing: false,
    startPoint: null,
    currentShape: null,
    _textHandler: null,
    _eraserHandler: null,
    
    /**
     * Initialize shape drawing
     */
    init() {
        ErrorHandler.debug('ShapeDrawing initialized');
    },
    
    /**
     * Set up canvas mouse events for shape drawing
     * @param {fabric.Canvas} canvas - Fabric canvas instance
     */
    setupCanvasEvents(canvas) {
        if (!canvas) return;
        
        canvas.on('mouse:down', (opt) => this.onMouseDown(opt, canvas));
        canvas.on('mouse:move', (opt) => this.onMouseMove(opt, canvas));
        canvas.on('mouse:up', () => this.onMouseUp(canvas));
    },
    
    /**
     * Handle mouse down event
     */
    onMouseDown(opt, canvas) {
        const tool = AppState.get('currentTool');
        
        if (['rect', 'circle', 'arrow'].includes(tool)) {
            this.isDrawing = true;
            const pointer = canvas.getPointer(opt.e);
            this.startPoint = { x: pointer.x, y: pointer.y };
            this.createShape(pointer, canvas);
        }
    },
    
    /**
     * Handle mouse move event
     */
    onMouseMove(opt, canvas) {
        if (!this.isDrawing || !this.currentShape) return;
        
        const pointer = canvas.getPointer(opt.e);
        this.updateShape(pointer, canvas);
        canvas.renderAll();
    },
    
    /**
     * Handle mouse up event
     */
    onMouseUp(canvas) {
        if (this.isDrawing && this.currentShape) {
            const tool = AppState.get('currentTool');
            
            // Make newly created shape non-selectable (until switching to select tool)
            if (tool !== 'select') {
                this.currentShape.selectable = false;
                this.currentShape.evented = false;
            }
            canvas.discardActiveObject();
        }
        
        this.isDrawing = false;
        this.currentShape = null;
        this.startPoint = null;
    },
    
    /**
     * Create a new shape at the pointer position
     * @param {Object} pointer - Mouse pointer position
     * @param {fabric.Canvas} canvas - Fabric canvas instance
     */
    createShape(pointer, canvas) {
        const tool = AppState.get('currentTool');
        const color = AppState.get('currentColor');
        const brushSize = AppState.get('brushSize');
        
        const options = {
            left: pointer.x,
            top: pointer.y,
            fill: 'transparent',
            stroke: color,
            strokeWidth: brushSize,
            selectable: true,
            originX: 'left',
            originY: 'top',
            opacity: 1,
            strokeUniform: true,
            strokeLineCap: 'round',
            strokeLineJoin: 'round'
        };

        try {
            switch (tool) {
                case 'rect':
                    this.currentShape = new fabric.Rect({
                        ...options,
                        width: 0,
                        height: 0
                    });
                    break;

                case 'circle':
                    this.currentShape = new fabric.Ellipse({
                        ...options,
                        rx: 0,
                        ry: 0
                    });
                    break;

                case 'arrow':
                    this.currentShape = new fabric.Line(
                        [pointer.x, pointer.y, pointer.x, pointer.y],
                        {
                            ...options,
                            fill: color
                        }
                    );
                    break;
            }

            if (this.currentShape) {
                canvas.add(this.currentShape);
                canvas.renderAll();
                ErrorHandler.debug('Created shape', { tool, position: pointer });
            }
        } catch (error) {
            ErrorHandler.error('Failed to create shape', error);
        }
    },
    
    /**
     * Update shape during drawing
     * @param {Object} pointer - Mouse pointer position
     * @param {fabric.Canvas} canvas - Fabric canvas instance
     */
    updateShape(pointer, canvas) {
        if (!this.currentShape || !this.startPoint) return;

        const tool = AppState.get('currentTool');
        const color = AppState.get('currentColor');

        try {
            switch (tool) {
                case 'rect':
                    this.updateRectangle(pointer);
                    break;

                case 'circle':
                    this.updateCircle(pointer);
                    break;

                case 'arrow':
                    this.updateArrow(pointer, canvas, color);
                    break;
            }
        } catch (error) {
            ErrorHandler.error('Failed to update shape', error);
        }
    },
    
    /**
     * Update rectangle shape
     */
    updateRectangle(pointer) {
        const width = pointer.x - this.startPoint.x;
        const height = pointer.y - this.startPoint.y;
        
        this.currentShape.set({
            width: Math.abs(width),
            height: Math.abs(height),
            left: width > 0 ? this.startPoint.x : pointer.x,
            top: height > 0 ? this.startPoint.y : pointer.y
        });
    },
    
    /**
     * Update circle shape
     */
    updateCircle(pointer) {
        const rx = Math.abs(pointer.x - this.startPoint.x) / 2;
        const ry = Math.abs(pointer.y - this.startPoint.y) / 2;
        
        this.currentShape.set({
            rx: rx,
            ry: ry,
            left: Math.min(this.startPoint.x, pointer.x) + rx,
            top: Math.min(this.startPoint.y, pointer.y) + ry,
            originX: 'center',
            originY: 'center'
        });
    },
    
    /**
     * Update arrow shape
     */
    updateArrow(pointer, canvas, color) {
        this.currentShape.set({
            x2: pointer.x,
            y2: pointer.y
        });
        
        // Remove old arrowhead
        if (this.currentShape.arrowHead) {
            canvas.remove(this.currentShape.arrowHead);
        }
        
        // Calculate angle
        const angle = Math.atan2(
            pointer.y - this.startPoint.y,
            pointer.x - this.startPoint.x
        );
        const headLen = 15;
        
        // Create new arrowhead
        const arrowHead = new fabric.Triangle({
            left: pointer.x,
            top: pointer.y,
            width: headLen,
            height: headLen,
            fill: color,
            angle: (angle * 180 / Math.PI) + 90,
            originX: 'center',
            originY: 'center',
            selectable: false
        });
        
        canvas.add(arrowHead);
        canvas.bringToFront(arrowHead);
        this.currentShape.arrowHead = arrowHead;
        arrowHead.arrowLine = this.currentShape;
    },
    
    /**
     * Set up text mode - add text on click
     * @param {fabric.Canvas} canvas - Fabric canvas instance
     */
    setupTextMode(canvas) {
        if (!canvas) return;
        
        // Remove old handler
        if (this._textHandler) {
            canvas.off('mouse:down', this._textHandler);
        }
        
        this._textHandler = (opt) => {
            const tool = AppState.get('currentTool');
            if (tool !== 'text') return;
            
            const target = canvas.findTarget(opt.e);
            if (target) return;

            const pointer = canvas.getPointer(opt.e);
            const color = AppState.get('currentColor');
            const brushSize = AppState.get('brushSize');
            
            try {
                const text = new fabric.IText('Text', {
                    left: pointer.x,
                    top: pointer.y,
                    fill: color,
                    fontSize: brushSize * 6,
                    fontFamily: 'Outfit, sans-serif',
                    fontWeight: '600',
                    selectable: true,
                    evented: true
                });

                canvas.add(text);
                canvas.setActiveObject(text);
                text.enterEditing();
                text.selectAll();
                
                // After text is finished editing, make it non-selectable
                text.on('editing:exited', () => {
                    if (AppState.get('currentTool') !== 'select') {
                        text.selectable = false;
                        text.evented = false;
                        canvas.discardActiveObject();
                        canvas.renderAll();
                    }
                });
                
                ErrorHandler.debug('Text added', { position: pointer });
            } catch (error) {
                ErrorHandler.error('Failed to add text', error);
            }
        };

        canvas.on('mouse:down', this._textHandler);
    },
    
    /**
     * Setup eraser mode - click objects to delete them
     * @param {fabric.Canvas} canvas - Fabric canvas instance
     */
    setupEraserMode(canvas) {
        if (!canvas) return;
        
        // Remove old handler
        if (this._eraserHandler) {
            canvas.off('mouse:down', this._eraserHandler);
        }

        this._eraserHandler = (opt) => {
            const tool = AppState.get('currentTool');
            if (tool !== 'eraser') return;

            const target = canvas.findTarget(opt.e);
            if (target) {
                try {
                    // If it's an arrow with a head, remove both
                    if (target.arrowHead) {
                        canvas.remove(target.arrowHead);
                    } else if (target.arrowLine) {
                        canvas.remove(target.arrowLine);
                    }
                    canvas.remove(target);
                    canvas.renderAll();
                    ErrorHandler.debug('Object erased');
                } catch (error) {
                    ErrorHandler.error('Failed to erase object', error);
                }
            }
        };

        canvas.on('mouse:down', this._eraserHandler);
    },
    
    /**
     * Clean up event handlers
     * @param {fabric.Canvas} canvas - Fabric canvas instance
     */
    cleanup(canvas) {
        if (!canvas) return;
        
        if (this._textHandler) {
            canvas.off('mouse:down', this._textHandler);
            this._textHandler = null;
        }
        
        if (this._eraserHandler) {
            canvas.off('mouse:down', this._eraserHandler);
            this._eraserHandler = null;
        }
    }
};

