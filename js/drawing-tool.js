/**
 * Drawing Tool Module - Inline Canvas Version
 * Handles Fabric.js canvas overlay on video for markup
 */

const DrawingTool = {
    canvas: null,
    currentTool: 'select',
    currentColor: '#ff3b3b',
    brushSize: 6,
    isDrawing: false,
    startPoint: null,
    currentShape: null,
    activeSnapshotId: null,
    canvasReady: false,
    canvasReadyPromise: null,

    /**
     * Initialize drawing tool with inline canvas
     */
    init() {
        this.setupInlineEventListeners();
    },

    /**
     * Initialize the fabric canvas on the video overlay
     */
    initCanvas(width = null, height = null) {
        const canvasEl = document.getElementById('mainDrawingCanvas');

        // If no dimensions provided, use video display dimensions
        if (!width || !height) {
            const videoEl = document.getElementById('videoPlayer');
            const rect = videoEl.getBoundingClientRect();
            width = rect.width;
            height = rect.height;
        }

        // Only create canvas once
        if (!this.canvas) {
            // Set canvas dimensions (both internal and display size are the same)
            canvasEl.width = width;
            canvasEl.height = height;
            canvasEl.style.width = width + 'px';
            canvasEl.style.height = height + 'px';

            // Initialize Fabric canvas with same dimensions
            this.canvas = new fabric.Canvas('mainDrawingCanvas', {
                width: width,
                height: height,
                selection: true,
                preserveObjectStacking: true,
                backgroundColor: null,
                renderOnAddRemove: true,
                enableRetinaScaling: false
            });

            this.setupCanvasEvents();
        } else if (this.canvas && this.canvas.setDimensions) {
            // Just resize existing canvas
            canvasEl.width = width;
            canvasEl.height = height;
            canvasEl.style.width = width + 'px';
            canvasEl.style.height = height + 'px';
            
            try {
                this.canvas.setDimensions({
                    width: width,
                    height: height
                });
            } catch (e) {
                console.warn('Canvas resize failed, recreating:', e);
                // Canvas is broken, recreate it
                this.canvas = new fabric.Canvas('mainDrawingCanvas', {
                    width: width,
                    height: height,
                    selection: true,
                    allowTouchScrolling: false,
                    skipTargetFind: false,
                    renderOnAddRemove: true,
                    enableRetinaScaling: false
                });
                this.setupCanvasEvents();
            }
        }
        
        // Only set select tool if no tool is currently active
        if (!this.currentTool || this.currentTool === 'select') {
            this.setTool('select');
        } else {
            // Re-apply the current tool settings to the canvas
            this.applyToolSettings(this.currentTool);
        }
    },

    /**
     * Set up event listeners for inline tools
     */
    setupInlineEventListeners() {
        // Tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                await this.setTool(btn.dataset.tool);
            });
        });

        // Color swatches - controls both drawing and text color
        document.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
                swatch.classList.add('active');
                this.currentColor = swatch.dataset.color;
                this.updateBrushColor();
                
                // Also apply to selected text in comment if any text is selected
                if (window.SnapshotManager) {
                    window.SnapshotManager.applyColorToSelection(swatch.dataset.color);
                }
            });
        });

        // Brush size
        const brushSizeSlider = document.getElementById('brushSizeInline');
        const brushSizeValue = document.getElementById('brushSizeValueInline');
        brushSizeSlider.addEventListener('input', (e) => {
            this.brushSize = parseInt(e.target.value);
            brushSizeValue.textContent = this.brushSize;
            this.updateBrushSize();
        });

        // Reference image upload
        const uploadRefBtn = document.getElementById('uploadReferenceInlineBtn');
        const refInput = document.getElementById('referenceImageInputInline');
        
        uploadRefBtn.addEventListener('click', () => refInput.click());
        refInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.addReferenceImage(e.target.files[0]);
                e.target.value = '';
            }
        });

        // Undo button
        document.getElementById('undoBtnInline').addEventListener('click', () => this.undo());

        // Clear button
        document.getElementById('clearBtnInline').addEventListener('click', () => this.clearCanvas());

        // Window resize
        window.addEventListener('resize', () => {
            if (this.canvas && this.activeSnapshotId) {
                this.resizeCanvas();
            }
        });
        
        // Add click handler to video wrapper for immediate drawing
        // Snapshot will be created AFTER drawing is finished (on mouseup)
        const videoWrapper = document.querySelector('.video-wrapper');
        if (videoWrapper) {
            videoWrapper.addEventListener('mousedown', async (e) => {
                console.log('🖱️ MOUSEDOWN detected', {
                    tool: this.currentTool,
                    hasCanvas: !!this.canvas,
                    activeSnapshotId: this.activeSnapshotId,
                    videoPaused: VideoHandler.video?.paused
                });

                // Only handle if a drawing tool is selected and video is paused
                if (!['draw', 'rect', 'circle', 'arrow', 'text'].includes(this.currentTool)) {
                    console.log('❌ Not a drawing tool, returning');
                    return;
                }
                
                if (!VideoHandler.video || !VideoHandler.video.paused) {
                    console.log('❌ Video not paused, returning');
                    return;
                }
                
                // If no canvas/snapshot exists, create snapshot SYNCHRONOUSLY for immediate drawing
                if (!this.canvas || !this.activeSnapshotId) {
                    console.log('📸 Creating snapshot SYNCHRONOUSLY for immediate drawing');
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Capture snapshot synchronously - returns immediately!
                    const snapshotData = SnapshotManager.captureSnapshotSync('');
                    if (!snapshotData) {
                        console.log('❌ Failed to capture snapshot');
                        return;
                    }
                    
                    console.log('✅ Snapshot captured synchronously, tempId:', snapshotData.snapshotId);
                    
                    // Enter edit mode SYNCHRONOUSLY with the image data
                    // This creates the canvas ready promise
                    this.activeSnapshotId = snapshotData.snapshotId;
                    DrawingTool.enterEditMode(snapshotData.snapshotId, snapshotData.imageData, null);
                    
                    console.log('⏳ Waiting for canvas ready promise...');
                    if (this.canvasReadyPromise) {
                        await this.canvasReadyPromise;
                        console.log('✅ Canvas ready promise resolved');
                    } else {
                        console.log('⚠️ No canvas ready promise!');
                    }
                    
                    // Update with real ID once saved
                    snapshotData.savePromise.then(realId => {
                        console.log('💾 Real snapshot ID received:', realId);
                        if (this.activeSnapshotId === snapshotData.snapshotId) {
                            this.activeSnapshotId = realId;
                        }
                        SnapshotManager.currentSnapshotId = realId;
                    });
                    
                    console.log('🎨 Canvas state:', {
                        hasCanvas: !!this.canvas,
                        canvasReady: this.canvasReady,
                        activeSnapshotId: this.activeSnapshotId
                    });
                    
                    if (this.canvas && this.canvasReady) {
                        console.log('✅ Canvas ready, starting drawing for tool:', this.currentTool);
                        
                        // Get canvas element and calculate coordinates
                        const canvasEl = this.canvas.getElement();
                        const canvasRect = canvasEl.getBoundingClientRect();
                        
                        // Calculate pointer position on canvas
                        const canvasX = e.clientX - canvasRect.left;
                        const canvasY = e.clientY - canvasRect.top;
                        
                        console.log('📐 Canvas coordinates:', {
                            canvasRect,
                            canvasX,
                            canvasY,
                            originalClientX: e.clientX,
                            originalClientY: e.clientY
                        });
                        
                        // Create a synthetic mouse event at the original click position
                        const syntheticEvent = new MouseEvent('mousedown', {
                            clientX: e.clientX,
                            clientY: e.clientY,
                            bubbles: true,
                            cancelable: true,
                            view: window
                        });
                        
                        // For shapes, start drawing and set up continuation handlers
                        if (['rect', 'circle', 'arrow'].includes(this.currentTool)) {
                            console.log('🔷 Starting shape drawing:', this.currentTool);
                            this.isDrawing = true;
                            const pointer = this.canvas.getPointer(syntheticEvent);
                            console.log('📍 Pointer position:', pointer);
                            this.startPoint = { x: pointer.x, y: pointer.y };
                            this.createShape(pointer);
                            console.log('✅ Shape created:', this.currentShape);
                            
                            // Set up temporary handlers for mouse move and up
                            const handleMove = (moveEvent) => {
                                if (this.isDrawing && this.currentShape) {
                                    const movePointer = this.canvas.getPointer(moveEvent);
                                    this.updateShape(movePointer);
                                    this.canvas.renderAll();
                                }
                            };
                            
                            const handleUp = () => {
                                if (this.isDrawing && this.currentShape) {
                                    // Make shape non-selectable
                                    if (this.currentTool !== 'select') {
                                        this.currentShape.selectable = false;
                                        this.currentShape.evented = false;
                                    }
                                    this.canvas.discardActiveObject();
                                }
                                this.isDrawing = false;
                                this.currentShape = null;
                                this.startPoint = null;
                                this.autoSave();
                                
                                // Remove temporary handlers
                                document.removeEventListener('mousemove', handleMove);
                                document.removeEventListener('mouseup', handleUp);
                            };
                            
                            document.addEventListener('mousemove', handleMove);
                            document.addEventListener('mouseup', handleUp);
                            
                        } else if (this.currentTool === 'text') {
                            console.log('✏️ Starting text tool');
                            // For text, trigger text placement
                            const pointer = this.canvas.getPointer(syntheticEvent);
                            console.log('📍 Text pointer position:', pointer);
                            
                            const text = new fabric.IText('Text', {
                                left: pointer.x,
                                top: pointer.y,
                                fill: this.currentColor,
                                fontSize: this.brushSize * 6,
                                fontFamily: 'Outfit, sans-serif',
                                fontWeight: '600',
                                selectable: true,
                                evented: true
                            });

                            this.canvas.add(text);
                            this.canvas.setActiveObject(text);
                            text.enterEditing();
                            text.selectAll();
                            console.log('✅ Text added and editing mode activated');
                            
                            text.on('editing:exited', () => {
                                if (this.currentTool !== 'select') {
                                    text.selectable = false;
                                    text.evented = false;
                                    this.canvas.discardActiveObject();
                                    this.canvas.renderAll();
                                }
                            });

                            this.autoSave();
                            
                        } else if (this.currentTool === 'draw') {
                            console.log('✏️ Starting pen/draw tool');
                            // For draw/pen tool, simulate the drawing start
                            const pointer = this.canvas.getPointer(syntheticEvent);
                            console.log('📍 Draw pointer position:', pointer);
                            console.log('🎨 Drawing mode active:', this.canvas.isDrawingMode);
                            console.log('🖌️ Free drawing brush:', this.canvas.freeDrawingBrush);
                            
                            // Manually trigger Fabric's drawing sequence
                            if (this.canvas.isDrawingMode && this.canvas.freeDrawingBrush) {
                                // Start the path
                                console.log('▶️ Calling onMouseDown on brush');
                                this.canvas.freeDrawingBrush.onMouseDown(pointer, { e: syntheticEvent });
                                
                                // Set up handlers to continue the stroke
                                const handleDrawMove = (moveEvent) => {
                                    if (this.canvas.isDrawingMode) {
                                        const movePointer = this.canvas.getPointer(moveEvent);
                                        this.canvas.freeDrawingBrush.onMouseMove(movePointer, { e: moveEvent });
                                    }
                                };
                                
                                const handleDrawUp = (upEvent) => {
                                    if (this.canvas.isDrawingMode && this.canvas.freeDrawingBrush) {
                                        const upPointer = this.canvas.getPointer(upEvent);
                                        this.canvas.freeDrawingBrush.onMouseUp({ e: upEvent });
                                    }
                                    
                                    // Remove handlers
                                    document.removeEventListener('mousemove', handleDrawMove);
                                    document.removeEventListener('mouseup', handleDrawUp);
                                    
                                    // Auto-save
                                    setTimeout(() => this.autoSave(), 100);
                                };
                                
                                document.addEventListener('mousemove', handleDrawMove);
                                document.addEventListener('mouseup', handleDrawUp);
                            } else {
                                console.log('⚠️ Drawing mode not active or brush not found');
                            }
                        }
                    } else {
                        console.log('❌ Canvas not ready after snapshot creation!', {
                            hasCanvas: !!this.canvas,
                            activeSnapshotId: this.activeSnapshotId,
                            canvasReady: this.canvasReady
                        });
                    }
                }
            }, true); // Use capture phase to catch before canvas events
        }
    },

    /**
     * Resize canvas to match overlay/video display
     */
    resizeCanvas() {
        if (!this.canvas || !this.activeSnapshotId) return;
        
        const overlayImg = document.getElementById('snapshotOverlay');
        const canvasEl = document.getElementById('mainDrawingCanvas');
        
        // Get current display size
        const rect = overlayImg.getBoundingClientRect();
        const newDisplayWidth = rect.width;
        const newDisplayHeight = rect.height;
        
        const currentWidth = this.canvas.getWidth();
        const currentHeight = this.canvas.getHeight();
        
        // Only resize if dimensions changed significantly
        if (Math.abs(currentWidth - newDisplayWidth) > 2 || 
            Math.abs(currentHeight - newDisplayHeight) > 2) {
            
            // Save current state
            const json = this.canvas.toJSON();
            
            // Resize canvas
            canvasEl.width = newDisplayWidth;
            canvasEl.height = newDisplayHeight;
            canvasEl.style.width = newDisplayWidth + 'px';
            canvasEl.style.height = newDisplayHeight + 'px';
            
            this.canvas.setDimensions({
                width: newDisplayWidth,
                height: newDisplayHeight
            });
            
            // Restore state (objects will scale automatically)
            this.canvas.loadFromJSON(json, () => {
                this.canvas.renderAll();
            });
        }
    },

    /**
     * Enter edit mode for a snapshot
     * @param {number} snapshotId - Snapshot ID
     * @param {string} imageData - Base64 image data
     * @param {Object} fabricData - Saved Fabric.js JSON
     */
    enterEditMode(snapshotId, imageData, fabricData = null) {
        console.log('🎬 enterEditMode called', { snapshotId });
        this.activeSnapshotId = snapshotId;
        this.canvasReady = false; // Track canvas readiness
        
        const overlayImg = document.getElementById('snapshotOverlay');
        const videoEl = document.getElementById('videoPlayer');
        const wrapper = document.querySelector('.video-wrapper');

        // Pause video
        if (!videoEl.paused) {
            videoEl.pause();
        }

        // Load snapshot image into overlay
        overlayImg.src = imageData;
        overlayImg.hidden = false;
        console.log('🖼️ Snapshot image loading...');

        // Create a promise to track when canvas is ready
        this.canvasReadyPromise = new Promise((resolve) => {
            // Wait for image to load to get dimensions
            overlayImg.onload = async () => {
                console.log('✅ Image loaded');
                // Decode image for faster rendering (if supported)
                if (overlayImg.decode) {
                    try {
                        await overlayImg.decode();
                        console.log('✅ Image decoded');
                    } catch (e) {
                        console.log('⚠️ Image decode failed:', e);
                    }
                }
                
                // Use requestAnimationFrame for immediate but smooth initialization
                requestAnimationFrame(() => {
                    console.log('🎨 Initializing canvas...');
                    // Get the actual displayed size of the overlay after layout
                    const rect = overlayImg.getBoundingClientRect();
                    const displayWidth = rect.width;
                    const displayHeight = rect.height;
                    console.log('📐 Canvas dimensions:', { displayWidth, displayHeight });
                    
                    // Initialize or resize canvas to match display
                    this.initCanvas(displayWidth, displayHeight);
                    console.log('✅ initCanvas called, canvas exists:', !!this.canvas);

                    // Clear existing canvas
                    if (this.canvas) {
                        this.canvas.clear();
                        console.log('🧹 Canvas cleared');
                    }

                    // Load saved markups if available
                    if (fabricData) {
                        this.loadCanvasData(fabricData);
                        console.log('📥 Loaded fabric data');
                    }
                    
                    // Enable drawing
                    wrapper.classList.add('editing');
                    console.log('✅ Editing mode enabled on wrapper');
                    
                    // Mark canvas as ready and resolve promise
                    this.canvasReady = true;
                    console.log('✅✅✅ Canvas READY - resolving promise');
                    resolve();
                });
            };
        });
    },

    /**
     * Exit edit mode
     */
    exitEditMode() {
        this.activeSnapshotId = null;
        this.canvasReady = false;
        this.canvasReadyPromise = null;
        
        // Hide snapshot overlay
        const overlayImg = document.getElementById('snapshotOverlay');
        if (overlayImg) {
            overlayImg.hidden = true;
            overlayImg.src = '';
            overlayImg.onload = null; // Clear onload handler
        }
        
        // Disable drawing
        const wrapper = document.querySelector('.video-wrapper');
        if (wrapper) {
            wrapper.classList.remove('editing');
        }

        // Clear canvas only if it exists and has proper methods
        if (this.canvas && typeof this.canvas.clear === 'function') {
            try {
                this.canvas.clear();
                if (typeof this.canvas.renderAll === 'function') {
                    this.canvas.renderAll();
                }
            } catch (e) {
                // Canvas might be disposed, ignore
            }
        }
    },

    /**
     * Display a snapshot's markups (read-only)
     * @param {string} imageData - Base64 image data
     * @param {Object} fabricData - Saved Fabric.js JSON
     */
    displayMarkups(imageData, fabricData) {
        const overlayImg = document.getElementById('snapshotOverlay');
        
        // Show snapshot overlay
        overlayImg.src = imageData;
        overlayImg.hidden = false;

        overlayImg.onload = () => {
            setTimeout(() => {
                // Get displayed dimensions
                const rect = overlayImg.getBoundingClientRect();
                const displayWidth = rect.width;
                const displayHeight = rect.height;
                
                // Initialize or resize canvas
                if (!this.canvas) {
                    this.initCanvas(displayWidth, displayHeight);
                } else {
                    // Resize existing canvas instead of disposing
                    this.canvas.setDimensions({
                        width: displayWidth,
                        height: displayHeight
                    });
                    this.canvas.clear();
                }

                // Style canvas to match
                const canvasEl = document.getElementById('mainDrawingCanvas');
                canvasEl.style.width = displayWidth + 'px';
                canvasEl.style.height = displayHeight + 'px';
                
                if (fabricData) {
                    this.loadCanvasData(fabricData);
                    
                    // Make all objects non-selectable for display mode
                    this.canvas.getObjects().forEach(obj => {
                        obj.selectable = false;
                        obj.evented = false;
                    });
                    
                    this.canvas.selection = false;
                    this.canvas.renderAll();
                }
            }, 50);
        };
    },

    /**
     * Hide markups
     */
    hideMarkups() {
        // Hide snapshot overlay
        const overlayImg = document.getElementById('snapshotOverlay');
        if (overlayImg) {
            overlayImg.hidden = true;
            overlayImg.src = '';
        }
        
        // Only clear canvas if it exists and has proper methods
        if (this.canvas && typeof this.canvas.clear === 'function') {
            try {
                this.canvas.clear();
                if (typeof this.canvas.renderAll === 'function') {
                    this.canvas.renderAll();
                }
            } catch (e) {
                // Canvas might be disposed, ignore
            }
        }
    },

    /**
     * Auto-save current snapshot
     */
    async autoSave() {
        if (!this.activeSnapshotId) return;

        // Debounce auto-save
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }

        this.autoSaveTimeout = setTimeout(async () => {
            // Double-check we still have an active snapshot (may have been cleared)
            if (!this.activeSnapshotId) return;
            
            const fabricData = this.getCanvasData();
            // Pass silent=true to prevent clearing panels during auto-save
            await SnapshotManager.saveInlineEdit(this.activeSnapshotId, fabricData, true);
        }, 300); // Save 300ms after last change (optimized)
    },

    /**
     * Check if we need to auto-create a snapshot before drawing
     */
    async ensureSnapshotExists() {
        // Only auto-create if video is paused and we're not already editing a snapshot
        if (!VideoHandler.video || !VideoHandler.video.paused) {
            ErrorHandler.debug('Cannot create snapshot: video not paused');
            return false;
        }

        // If we're already editing a snapshot, no need to create new one
        if (this.activeSnapshotId) {
            ErrorHandler.debug('Snapshot already exists, using existing');
            return true;
        }

        // Check if snapshot exists at current timestamp
        const currentTime = VideoHandler.video.currentTime;
        const existingSnapshot = await SnapshotManager.findSnapshotAtTime(currentTime);
        
        if (existingSnapshot) {
            // Load existing snapshot for editing
            ErrorHandler.info('Loading existing snapshot at timestamp', { time: currentTime });
            await SnapshotManager.enterInlineEditMode(existingSnapshot.id);
            return true;
        } else {
            // Create new snapshot
            ErrorHandler.info('Creating new snapshot at timestamp', { time: currentTime });
            await SnapshotManager.captureSnapshotWithComment('');
            
            // Canvas will be initialized via requestAnimationFrame, minimal wait
            await new Promise(resolve => requestAnimationFrame(resolve));
            return true;
        }
    },

    /**
     * Set up canvas mouse events for shape drawing
     */
    setupCanvasEvents() {
        this.canvas.on('mouse:down', (opt) => {
            if (['rect', 'circle', 'arrow'].includes(this.currentTool)) {
                ErrorHandler.debug('Shape drawing started', { tool: this.currentTool });
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
                // Make newly created shape non-selectable (until switching to select tool)
                if (this.currentTool !== 'select') {
                    this.currentShape.selectable = false;
                    this.currentShape.evented = false;
                }
                this.canvas.discardActiveObject();
            }
            this.isDrawing = false;
            this.currentShape = null;
            this.startPoint = null;
            
            // Auto-save after drawing
            this.autoSave();
        });

        this.canvas.on('object:modified', () => {
            this.autoSave();
        });

        // Auto-save after drawing mode (freehand)
        this.canvas.on('path:created', (e) => {
            // Make newly created path non-selectable if not in select mode
            if (this.currentTool !== 'select' && e.path) {
                e.path.selectable = false;
                e.path.evented = false;
            }
            this.autoSave();
        });

        this.canvas.on('object:removed', () => {
            this.autoSave();
        });
    },

    /**
     * Create a new shape at the pointer position
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
            originY: 'top',
            opacity: 1,
            strokeUniform: true
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
            this.canvas.renderAll();
            console.log('Created shape:', this.currentTool, 'at', pointer);
        }
    },

    /**
     * Update shape during drawing
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
                
                if (this.currentShape.arrowHead) {
                    this.canvas.remove(this.currentShape.arrowHead);
                }
                
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
     * Apply tool settings to canvas (without UI updates or snapshot creation)
     */
    applyToolSettings(tool) {
        if (!this.canvas || typeof this.canvas.isDrawingMode === 'undefined') {
            return;
        }

        // Update UI to show active tool
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });

        // Configure canvas based on tool
        switch (tool) {
            case 'select':
                this.canvas.isDrawingMode = false;
                this.canvas.selection = true;
                this.canvas.forEachObject(obj => {
                    obj.selectable = true;
                    obj.evented = true;
                });
                break;

            case 'draw':
                this.canvas.isDrawingMode = true;
                this.canvas.selection = false;
                this.canvas.forEachObject(obj => {
                    obj.selectable = false;
                    obj.evented = false;
                });
                this.canvas.freeDrawingBrush = new fabric.PencilBrush(this.canvas);
                this.canvas.freeDrawingBrush.color = this.currentColor;
                this.canvas.freeDrawingBrush.width = this.brushSize;
                this.canvas.freeDrawingBrush.strokeLineCap = 'round';
                this.canvas.freeDrawingBrush.strokeLineJoin = 'round';
                break;

            case 'text':
                this.canvas.isDrawingMode = false;
                this.canvas.selection = false;
                this.canvas.forEachObject(obj => {
                    obj.selectable = false;
                    obj.evented = false;
                });
                this.setupTextMode();
                break;

            case 'eraser':
                this.canvas.isDrawingMode = false;
                this.canvas.selection = false;
                this.canvas.forEachObject(obj => {
                    obj.selectable = true;
                    obj.evented = true;
                });
                this.setupEraserMode();
                break;

            default:
                // Shape drawing tools (rect, circle, arrow)
                this.canvas.isDrawingMode = false;
                this.canvas.selection = false;
                this.canvas.forEachObject(obj => {
                    obj.selectable = false;
                    obj.evented = false;
                });
                break;
        }
    },

    /**
     * Set active tool (full version with snapshot creation)
     */
    async setTool(tool) {
        this.currentTool = tool;

        // Update UI
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });

        // Don't create snapshot here - wait until actual drawing action
        // Canvas might not be ready yet if no snapshot exists
        if (!this.canvas || typeof this.canvas.isDrawingMode === 'undefined') {
            // This is OK - canvas will be created when snapshot is made
            return;
        }

        // Apply the tool settings
        this.applyToolSettings(tool);
    },

    /**
     * Set up text mode - add text on click
     */
    setupTextMode() {
        if (this._textHandler) {
            this.canvas.off('mouse:down', this._textHandler);
        }
        
        this._textHandler = (opt) => {
            if (this.currentTool !== 'text') return;
            
            const target = this.canvas.findTarget(opt.e);
            if (target) return;

            const pointer = this.canvas.getPointer(opt.e);
            ErrorHandler.debug('Text tool clicked', { position: pointer });
            
            const text = new fabric.IText('Text', {
                left: pointer.x,
                top: pointer.y,
                fill: this.currentColor,
                fontSize: this.brushSize * 6,
                fontFamily: 'Outfit, sans-serif',
                fontWeight: '600',
                selectable: true,
                evented: true
            });

            this.canvas.add(text);
            this.canvas.setActiveObject(text);
            text.enterEditing();
            text.selectAll();
            
            // After text is finished editing, make it non-selectable
            text.on('editing:exited', () => {
                if (this.currentTool !== 'select') {
                    text.selectable = false;
                    text.evented = false;
                    this.canvas.discardActiveObject();
                    this.canvas.renderAll();
                }
            });

            this.autoSave();
        };

        this.canvas.on('mouse:down', this._textHandler);
    },

    /**
     * Setup eraser mode - click objects to delete them
     */
    setupEraserMode() {
        if (this._eraserHandler) {
            this.canvas.off('mouse:down', this._eraserHandler);
        }

        this._eraserHandler = (opt) => {
            if (this.currentTool !== 'eraser') return;

            const target = this.canvas.findTarget(opt.e);
            if (target) {
                // If it's an arrow with a head, remove both
                if (target.arrowHead) {
                    this.canvas.remove(target.arrowHead);
                } else if (target.arrowLine) {
                    this.canvas.remove(target.arrowLine);
                }
                this.canvas.remove(target);
                this.canvas.renderAll();
                this.autoSave();
            }
        };

        this.canvas.on('mouse:down', this._eraserHandler);
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
            if (lastObj.arrowHead) {
                this.canvas.remove(lastObj.arrowHead);
            }
            this.canvas.remove(lastObj);
        }
    },

    /**
     * Clear all drawings
     */
    clearCanvas() {
        if (!this.canvas) return;
        
        if (!confirm('Clear all markups?')) return;
        
        this.canvas.getObjects().forEach(obj => {
            this.canvas.remove(obj);
        });
    },

    /**
     * Get canvas data as JSON (for saving)
     */
    getCanvasData() {
        if (!this.canvas) return null;
        
        const json = this.canvas.toJSON();
        
        if (json.objects && json.objects.length > 0) {
            return json;
        }
        return null;
    },

    /**
     * Load canvas data from JSON
     */
    loadCanvasData(data) {
        if (!this.canvas || !data) return;
        
        if (data.objects) {
            data.objects.forEach(objData => {
                fabric.util.enlivenObjects([objData], (objects) => {
                    objects.forEach(obj => {
                        // Set selectability based on current tool
                        if (this.currentTool === 'select') {
                            obj.selectable = true;
                            obj.evented = true;
                        } else {
                            obj.selectable = false;
                            obj.evented = false;
                        }
                        this.canvas.add(obj);
                    });
                    this.canvas.renderAll();
                });
            });
        }
    },

    /**
     * Add a reference image to the canvas
     */
    addReferenceImage(file) {
        if (!this.canvas) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            fabric.Image.fromURL(e.target.result, (img) => {
                const maxWidth = this.canvas.width * 0.5;
                const maxHeight = this.canvas.height * 0.5;
                
                const scale = Math.min(
                    maxWidth / img.width,
                    maxHeight / img.height,
                    1
                );

                img.scale(scale);
                
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
            });
        };
        reader.readAsDataURL(file);
    }
};

window.DrawingTool = DrawingTool;
