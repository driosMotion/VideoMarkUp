/**
 * Drawing Tool Module
 * Handles Fabric.js canvas for image markup
 */

const DrawingTool = {
    canvas: null,
    currentTool: 'select',
    currentColor: '#ff3b3b',
    brushSize: 4,
    isDrawing: false,
    startPoint: null,
    currentShape: null,
    backgroundImage: null,

    /**
     * Initialize drawing tool
     */
    init() {
        this.setupEventListeners();
    },

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setTool(btn.dataset.tool);
            });
        });

        // Color swatches
        document.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
                swatch.classList.add('active');
                this.currentColor = swatch.dataset.color;
                this.updateBrushColor();
            });
        });

        // Brush size
        const brushSizeSlider = document.getElementById('brushSize');
        brushSizeSlider.addEventListener('input', (e) => {
            this.brushSize = parseInt(e.target.value);
            document.getElementById('brushSizeValue').textContent = this.brushSize;
            this.updateBrushSize();
        });

        // Reference image upload
        const uploadRefBtn = document.getElementById('uploadReferenceBtn');
        const refInput = document.getElementById('referenceImageInput');
        
        uploadRefBtn.addEventListener('click', () => refInput.click());
        refInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.addReferenceImage(e.target.files[0]);
                e.target.value = ''; // Reset for future uploads
            }
        });

        // Undo button
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());

        // Clear button
        document.getElementById('clearBtn').addEventListener('click', () => this.clearCanvas());
    },

    /**
     * Load an image into the canvas
     * @param {string} imageData - Base64 image data
     * @param {Object} fabricData - Saved Fabric.js JSON (optional)
     */
    loadImage(imageData, fabricData = null) {
        const container = document.getElementById('canvasContainer');
        const canvasEl = document.getElementById('drawingCanvas');

        // Create Fabric canvas
        if (this.canvas) {
            this.canvas.dispose();
        }

        // Load image to get dimensions
        const img = new Image();
        img.onload = () => {
            // Calculate canvas size to fit container while maintaining aspect ratio
            const containerRect = container.getBoundingClientRect();
            const maxWidth = containerRect.width - 40;
            const maxHeight = containerRect.height - 40;
            
            let width = img.width;
            let height = img.height;
            
            const scale = Math.min(maxWidth / width, maxHeight / height, 1);
            width *= scale;
            height *= scale;

            // Set canvas dimensions
            canvasEl.width = width;
            canvasEl.height = height;

            // Initialize Fabric canvas
            this.canvas = new fabric.Canvas('drawingCanvas', {
                width: width,
                height: height,
                selection: true,
                preserveObjectStacking: true
            });

            // Set background image
            fabric.Image.fromURL(imageData, (fabricImg) => {
                fabricImg.scaleToWidth(width);
                this.canvas.setBackgroundImage(fabricImg, this.canvas.renderAll.bind(this.canvas));
                this.backgroundImage = fabricImg;

                // Load saved fabric data if available
                if (fabricData) {
                    this.loadCanvasData(fabricData);
                }
            });

            // Set up canvas events
            this.setupCanvasEvents();
            
            // Set default tool
            this.setTool('select');
        };
        img.src = imageData;
    },

    /**
     * Set up canvas mouse events for shape drawing
     */
    setupCanvasEvents() {
        this.canvas.on('mouse:down', (opt) => {
            if (['rect', 'circle', 'arrow'].includes(this.currentTool)) {
                this.isDrawing = true;
                const pointer = this.canvas.getPointer(opt.e);
                this.startPoint = { x: pointer.x, y: pointer.y };
                this.createShape(pointer);
            }
        });

        this.canvas.on('mouse:move', (opt) => {
            if (!this.isDrawing || !this.currentShape) return;
            
            const pointer = this.canvas.getPointer(opt.e);
            this.updateShape(pointer);
            this.canvas.renderAll();
        });

        this.canvas.on('mouse:up', () => {
            if (this.isDrawing && this.currentShape) {
                this.canvas.setActiveObject(this.currentShape);
            }
            this.isDrawing = false;
            this.currentShape = null;
            this.startPoint = null;
        });
    },

    /**
     * Create a new shape at the pointer position
     * @param {Object} pointer - Mouse pointer position
     */
    createShape(pointer) {
        const options = {
            left: pointer.x,
            top: pointer.y,
            fill: 'transparent',
            stroke: this.currentColor,
            strokeWidth: this.brushSize,
            selectable: true,
            originX: 'left',
            originY: 'top'
        };

        switch (this.currentTool) {
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
                        fill: this.currentColor
                    }
                );
                break;
        }

        if (this.currentShape) {
            this.canvas.add(this.currentShape);
        }
    },

    /**
     * Update shape during drawing
     * @param {Object} pointer - Current mouse position
     */
    updateShape(pointer) {
        if (!this.currentShape || !this.startPoint) return;

        switch (this.currentTool) {
            case 'rect':
                const width = pointer.x - this.startPoint.x;
                const height = pointer.y - this.startPoint.y;
                
                this.currentShape.set({
                    width: Math.abs(width),
                    height: Math.abs(height),
                    left: width > 0 ? this.startPoint.x : pointer.x,
                    top: height > 0 ? this.startPoint.y : pointer.y
                });
                break;

            case 'circle':
                const rx = Math.abs(pointer.x - this.startPoint.x) / 2;
                const ry = Math.abs(pointer.y - this.startPoint.y) / 2;
                
                this.currentShape.set({
                    rx: rx,
                    ry: ry,
                    left: Math.min(this.startPoint.x, pointer.x),
                    top: Math.min(this.startPoint.y, pointer.y)
                });
                break;

            case 'arrow':
                this.currentShape.set({
                    x2: pointer.x,
                    y2: pointer.y
                });
                
                // Remove old arrowhead if exists
                if (this.currentShape.arrowHead) {
                    this.canvas.remove(this.currentShape.arrowHead);
                }
                
                // Add arrowhead
                const angle = Math.atan2(
                    pointer.y - this.startPoint.y,
                    pointer.x - this.startPoint.x
                );
                const headLen = 15;
                
                const arrowHead = new fabric.Triangle({
                    left: pointer.x,
                    top: pointer.y,
                    width: headLen,
                    height: headLen,
                    fill: this.currentColor,
                    angle: (angle * 180 / Math.PI) + 90,
                    originX: 'center',
                    originY: 'center',
                    selectable: false
                });
                
                this.canvas.add(arrowHead);
                this.currentShape.arrowHead = arrowHead;
                break;
        }
    },

    /**
     * Set active tool
     * @param {string} tool - Tool name
     */
    setTool(tool) {
        this.currentTool = tool;

        // Update UI
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });

        // Update canvas container cursor class
        const container = document.getElementById('canvasContainer');
        container.className = 'canvas-container tool-' + tool;

        if (!this.canvas) return;

        // Configure canvas based on tool
        switch (tool) {
            case 'select':
                this.canvas.isDrawingMode = false;
                this.canvas.selection = true;
                break;

            case 'draw':
                this.canvas.isDrawingMode = true;
                this.canvas.freeDrawingBrush.color = this.currentColor;
                this.canvas.freeDrawingBrush.width = this.brushSize;
                break;

            case 'eraser':
                this.canvas.isDrawingMode = true;
                this.canvas.freeDrawingBrush.color = '#000000';
                this.canvas.freeDrawingBrush.width = this.brushSize * 3;
                // We'll handle eraser differently - by removing objects on click
                this.canvas.isDrawingMode = false;
                this.setupEraserMode();
                break;

            case 'text':
                this.canvas.isDrawingMode = false;
                this.setupTextMode();
                break;

            default:
                this.canvas.isDrawingMode = false;
                this.canvas.selection = false;
                break;
        }
    },

    /**
     * Set up eraser mode - delete objects on click
     */
    setupEraserMode() {
        // Remove previous eraser handler if exists
        if (this._eraserHandler) {
            this.canvas.off('mouse:down', this._eraserHandler);
        }
        
        this._eraserHandler = (opt) => {
            if (this.currentTool !== 'eraser') return;
            
            const target = this.canvas.findTarget(opt.e);
            if (target && target !== this.backgroundImage) {
                this.canvas.remove(target);
                // Remove arrowhead if it's an arrow
                if (target.arrowHead) {
                    this.canvas.remove(target.arrowHead);
                }
            }
        };
        
        this.canvas.on('mouse:down', this._eraserHandler);
    },

    /**
     * Set up text mode - add text on click
     */
    setupTextMode() {
        // Remove previous text handler if exists
        if (this._textHandler) {
            this.canvas.off('mouse:down', this._textHandler);
        }
        
        this._textHandler = (opt) => {
            if (this.currentTool !== 'text') return;
            
            // Don't add text if clicking on existing object
            const target = this.canvas.findTarget(opt.e);
            if (target) return;

            const pointer = this.canvas.getPointer(opt.e);
            
            const text = new fabric.IText('Text', {
                left: pointer.x,
                top: pointer.y,
                fill: this.currentColor,
                fontSize: this.brushSize * 6,
                fontFamily: 'Outfit, sans-serif',
                fontWeight: '600'
            });

            this.canvas.add(text);
            this.canvas.setActiveObject(text);
            text.enterEditing();
            text.selectAll();
        };

        this.canvas.on('mouse:down', this._textHandler);
    },

    /**
     * Update brush color
     */
    updateBrushColor() {
        if (this.canvas && this.canvas.freeDrawingBrush) {
            this.canvas.freeDrawingBrush.color = this.currentColor;
        }
    },

    /**
     * Update brush size
     */
    updateBrushSize() {
        if (this.canvas && this.canvas.freeDrawingBrush) {
            this.canvas.freeDrawingBrush.width = this.brushSize;
        }
    },

    /**
     * Undo last action
     */
    undo() {
        if (!this.canvas) return;
        
        const objects = this.canvas.getObjects();
        if (objects.length > 0) {
            const lastObj = objects[objects.length - 1];
            // Remove arrowhead if it's an arrow
            if (lastObj.arrowHead) {
                this.canvas.remove(lastObj.arrowHead);
            }
            this.canvas.remove(lastObj);
        }
    },

    /**
     * Clear all drawings (keep background)
     */
    clearCanvas() {
        if (!this.canvas) return;
        
        if (!confirm('Clear all markups?')) return;
        
        const objects = this.canvas.getObjects();
        objects.forEach(obj => {
            this.canvas.remove(obj);
        });
    },

    /**
     * Get canvas data as JSON (for saving)
     * @returns {Object}
     */
    getCanvasData() {
        if (!this.canvas) return null;
        
        const json = this.canvas.toJSON();
        // Remove background image from JSON (we store it separately)
        delete json.backgroundImage;
        
        // Only return if there are objects
        if (json.objects && json.objects.length > 0) {
            return json;
        }
        return null;
    },

    /**
     * Load canvas data from JSON
     * @param {Object} data - Fabric.js JSON data
     */
    loadCanvasData(data) {
        if (!this.canvas || !data) return;
        
        // Load objects only (background is already set)
        if (data.objects) {
            data.objects.forEach(objData => {
                fabric.util.enlivenObjects([objData], (objects) => {
                    objects.forEach(obj => {
                        this.canvas.add(obj);
                    });
                    this.canvas.renderAll();
                });
            });
        }
    },

    /**
     * Get marked up image as data URL
     * @returns {string}
     */
    getMarkedUpImage() {
        if (!this.canvas) return null;
        return this.canvas.toDataURL({
            format: 'png',
            quality: 1
        });
    },

    /**
     * Add a reference image to the canvas
     * @param {File} file - Image file
     */
    addReferenceImage(file) {
        if (!this.canvas) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            fabric.Image.fromURL(e.target.result, (img) => {
                // Scale image to fit canvas (max 50% of canvas size)
                const maxWidth = this.canvas.width * 0.5;
                const maxHeight = this.canvas.height * 0.5;
                
                const scale = Math.min(
                    maxWidth / img.width,
                    maxHeight / img.height,
                    1 // Don't upscale
                );

                img.scale(scale);
                
                // Center the image
                img.set({
                    left: (this.canvas.width - img.width * scale) / 2,
                    top: (this.canvas.height - img.height * scale) / 2,
                    selectable: true,
                    hasControls: true,
                    hasBorders: true,
                    lockUniScaling: false
                });

                this.canvas.add(img);
                this.canvas.setActiveObject(img);
                this.canvas.renderAll();

                App.showToast('Reference image added', 'success');
            });
        };
        reader.readAsDataURL(file);
    }
};

// Make DrawingTool globally available
window.DrawingTool = DrawingTool;

