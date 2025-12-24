/**
 * Video Handler Module
 * Manages video upload, playback controls, and frame navigation
 */

const VideoHandler = {
    video: null,
    isPlaying: false,
    duration: 0,
    frameRate: 24, // Default, can be updated
    currentProjectId: null,
    previousVolume: 1, // Store volume level before muting
    currentFile: null, // Store current video file for metadata
    loopEnabled: false, // Loop playback toggle
    currentSafezone: 'none', // Current safezone ratio
    gridEnabled: false, // Grid overlay toggle
    currentChannel: 'rgb', // Current channel view
    currentExposure: 0, // Current exposure value
    currentSpeed: 1, // Current playback speed

    /**
     * Initialize video handler
     */
    init() {
        this.video = document.getElementById('videoPlayer');
        this.setupEventListeners();
    },

    /**
     * Set up all event listeners
     */
    setupEventListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const videoInput = document.getElementById('videoInput');
        const playPauseBtn = document.getElementById('playPauseBtn');
        const prevFrameBtn = document.getElementById('prevFrameBtn');
        const nextFrameBtn = document.getElementById('nextFrameBtn');
        const muteBtn = document.getElementById('muteBtn');
        const volumeSlider = document.getElementById('volumeSlider');
        const progressContainer = document.getElementById('progressContainer');

        // Upload area click
        uploadArea.addEventListener('click', () => videoInput.click());

        // File input change
        videoInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.loadVideo(e.target.files[0]);
            }
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) {
                // Accept any file - browser will determine if it can play it
                this.loadVideo(file);
            }
        });

        // Video events
        this.video.addEventListener('loadedmetadata', () => this.onVideoLoaded());
        this.video.addEventListener('timeupdate', () => this.onTimeUpdate());
        this.video.addEventListener('play', () => this.onPlay());
        this.video.addEventListener('pause', () => this.onPause());
        this.video.addEventListener('ended', () => this.onEnded());

        // Playback controls
        playPauseBtn.addEventListener('click', () => this.togglePlay());
        prevFrameBtn.addEventListener('click', () => this.prevFrame());
        nextFrameBtn.addEventListener('click', () => this.nextFrame());

        // New timeline controls
        const loopBtn = document.getElementById('loopBtn');
        const prevMarkerBtn = document.getElementById('prevMarkerBtn');
        const nextMarkerBtn = document.getElementById('nextMarkerBtn');
        const safezoneBtn = document.getElementById('safezoneBtn');
        const safezoneMenu = document.getElementById('safezoneMenu');
        const gridBtn = document.getElementById('gridBtn');
        const channelBtn = document.getElementById('channelBtn');
        const channelMenu = document.getElementById('channelMenu');
        const exposureSlider = document.getElementById('exposureSlider');
        const speedBtn = document.getElementById('speedBtn');
        const speedMenu = document.getElementById('speedMenu');

        if (loopBtn) {
            loopBtn.addEventListener('click', () => this.toggleLoop());
        }

        if (prevMarkerBtn) {
            prevMarkerBtn.addEventListener('click', () => {
                if (window.SnapshotManager) {
                    SnapshotManager.navigateToPreviousSnapshot();
                }
            });
        }

        if (nextMarkerBtn) {
            nextMarkerBtn.addEventListener('click', () => {
                if (window.SnapshotManager) {
                    SnapshotManager.navigateToNextSnapshot();
                }
            });
        }

        if (safezoneBtn && safezoneMenu) {
            safezoneBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                safezoneMenu.hidden = !safezoneMenu.hidden;
            });

            document.addEventListener('click', () => {
                safezoneMenu.hidden = true;
            });

            safezoneMenu.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            safezoneMenu.querySelectorAll('.safezone-item').forEach(item => {
                item.addEventListener('click', () => {
                    const ratio = item.dataset.ratio;
                    this.setSafezone(ratio);
                    safezoneMenu.hidden = true;
                });
            });
        }

        // Grid toggle
        if (gridBtn) {
            gridBtn.addEventListener('click', () => this.toggleGrid());
        }

        // Channel view
        if (channelBtn && channelMenu) {
            channelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                channelMenu.hidden = !channelMenu.hidden;
            });

            document.addEventListener('click', () => {
                channelMenu.hidden = true;
            });

            channelMenu.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            channelMenu.querySelectorAll('.channel-item').forEach(item => {
                item.addEventListener('click', () => {
                    const channel = item.dataset.channel;
                    this.setChannel(channel);
                    channelMenu.hidden = true;
                });
            });
        }

        // Exposure control
        if (exposureSlider) {
            exposureSlider.addEventListener('input', (e) => {
                this.setExposure(parseFloat(e.target.value));
            });
        }

        // Exposure reset button
        const exposureResetBtn = document.getElementById('exposureResetBtn');
        if (exposureResetBtn && exposureSlider) {
            exposureResetBtn.addEventListener('click', () => {
                exposureSlider.value = 0;
                this.setExposure(0);
            });
        }

        // Playback speed
        if (speedBtn && speedMenu) {
            speedBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                speedMenu.hidden = !speedMenu.hidden;
            });

            document.addEventListener('click', () => {
                speedMenu.hidden = true;
            });

            speedMenu.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            speedMenu.querySelectorAll('.speed-item').forEach(item => {
                item.addEventListener('click', () => {
                    const speed = parseFloat(item.dataset.speed);
                    this.setPlaybackSpeed(speed);
                    speedMenu.hidden = true;
                });
            });
        }

        // Volume controls
        muteBtn.addEventListener('click', () => this.toggleMute());
        volumeSlider.addEventListener('input', (e) => {
            this.video.volume = e.target.value;
            // Unmute if volume is increased
            if (e.target.value > 0) {
                this.video.muted = false;
            }
            this.updateVolumeIcon();
        });

        // Progress bar
        let isDragging = false;
        
        progressContainer.addEventListener('mousedown', (e) => {
            isDragging = true;
            progressContainer.querySelector('.progress-bar').classList.add('dragging');
            this.seekToPosition(e);
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                this.seekToPosition(e);
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                progressContainer.querySelector('.progress-bar').classList.remove('dragging');
            }
        });
    },

    /**
     * Load a video file
     * @param {File} file - Video file
     */
    async loadVideo(file) {
        const url = URL.createObjectURL(file);
        this.video.src = url;
        
        // Store file for metadata
        this.currentFile = file;
        
        // Store video data
        const videoData = await file.arrayBuffer();
        
        // Create project in storage
        this.currentProjectId = await Storage.createProject({
            name: file.name.replace(/\.[^/.]+$/, ''),
            videoFileName: file.name,
            videoData: new Blob([videoData], { type: file.type })
        });

        // Update UI
        document.getElementById('projectName').textContent = file.name;
        document.getElementById('uploadArea').hidden = true;
        document.getElementById('videoPlayerContainer').hidden = false;
        document.getElementById('exportPdfBtn').disabled = false;
        document.getElementById('exportProjectBtn').disabled = false;

        App.showToast(`Loaded: ${file.name}`, 'success');
    },

    /**
     * Load an existing project
     * @param {number} projectId - Project ID
     */
    async loadProject(projectId) {
        const project = await Storage.getProject(projectId);
        if (!project) {
            App.showToast('Project not found', 'error');
            return;
        }

        this.currentProjectId = projectId;
        
        // Create URL from stored blob
        const url = URL.createObjectURL(project.videoData);
        this.video.src = url;

        // Store file info for metadata (convert Blob back to File-like object)
        this.currentFile = new File([project.videoData], project.videoFileName, { 
            type: project.videoData.type 
        });

        // Update UI
        document.getElementById('projectName').textContent = project.videoFileName;
        document.getElementById('uploadArea').hidden = true;
        document.getElementById('videoPlayerContainer').hidden = false;
        document.getElementById('exportPdfBtn').disabled = false;
        document.getElementById('exportProjectBtn').disabled = false;

        // Wait for video metadata before loading snapshots (need duration for markers)
        this.video.addEventListener('loadedmetadata', async () => {
            // Load snapshots after video metadata is loaded
            const snapshots = await Storage.getSnapshots(projectId);
            SnapshotManager.snapshots = snapshots; // Store in manager
            snapshots.forEach(snapshot => {
                SnapshotManager.addSnapshotToList(snapshot);
                SnapshotManager.addTimelineMarker(snapshot);
            });
            // Sort snapshots by timecode after loading
            SnapshotManager.sortSnapshotsByTimecode();
            SnapshotManager.updateSnapshotCount();
        }, { once: true });
    },

    /**
     * Called when video metadata is loaded
     */
    onVideoLoaded() {
        this.duration = this.video.duration;
        document.getElementById('duration').textContent = this.formatTimecode(this.duration);
        document.getElementById('currentTime').textContent = this.formatTimecode(0);
        
        // Detect aspect ratio and add class for vertical videos
        const wrapper = document.querySelector('.video-wrapper');
        const aspectRatio = this.video.videoWidth / this.video.videoHeight;
        
        if (aspectRatio < 1) {
            // Vertical/portrait video
            wrapper.classList.add('vertical');
        } else {
            wrapper.classList.remove('vertical');
        }

        // Update video metadata display
        this.updateVideoMetadata();

        // Initialize drawing canvas overlay with video DISPLAY dimensions
        // Use a small delay to ensure video layout is complete
        setTimeout(() => {
            if (window.DrawingTool && !window.DrawingTool.canvas) {
                const videoRect = this.video.getBoundingClientRect();
                const displayWidth = videoRect.width;
                const displayHeight = videoRect.height;
                
                window.DrawingTool.initCanvas(displayWidth, displayHeight);
                
                const canvasEl = document.getElementById('mainDrawingCanvas');
                canvasEl.style.width = displayWidth + 'px';
                canvasEl.style.height = displayHeight + 'px';
                
                console.log('Initial canvas setup:', displayWidth, 'x', displayHeight);
            }
        }, 100);
    },

    /**
     * Update video metadata display in header
     */
    updateVideoMetadata() {
        const metadataContainer = document.getElementById('videoMetadata');
        const resolutionEl = document.getElementById('metadataResolution');
        const aspectRatioEl = document.getElementById('metadataAspectRatio');
        const fpsEl = document.getElementById('metadataFps');
        const channelsEl = document.getElementById('metadataChannels');
        const sizeEl = document.getElementById('metadataSize');
        const codecEl = document.getElementById('metadataCodec');

        // Resolution
        const width = this.video.videoWidth;
        const height = this.video.videoHeight;
        resolutionEl.textContent = `${width}×${height}`;

        // Aspect Ratio
        const aspectRatio = this.calculateAspectRatio(width, height);
        aspectRatioEl.textContent = aspectRatio;

        // FPS (estimate based on standard frame rates)
        const estimatedFps = this.estimateFrameRate();
        fpsEl.textContent = `${estimatedFps} fps`;

        // Channels (detect if video has alpha channel)
        const channels = this.detectChannels();
        channelsEl.textContent = channels;

        // File size
        if (this.currentFile) {
            const sizeMB = (this.currentFile.size / (1024 * 1024)).toFixed(2);
            sizeEl.textContent = `${sizeMB} MB`;

            // Codec/Container (from MIME type)
            const mimeType = this.currentFile.type;
            const codec = this.getCodecFromMime(mimeType);
            codecEl.textContent = codec;
        }

        // Show metadata container
        metadataContainer.hidden = false;
    },

    /**
     * Calculate aspect ratio from dimensions
     */
    calculateAspectRatio(width, height) {
        // Calculate GCD for simplified ratio
        const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
        const divisor = gcd(width, height);
        const aspectWidth = width / divisor;
        const aspectHeight = height / divisor;
        
        // Common aspect ratios
        const commonRatios = {
            '16:9': 16/9,
            '4:3': 4/3,
            '21:9': 21/9,
            '1:1': 1/1,
            '9:16': 9/16,
            '4:5': 4/5,
            '2.39:1': 2.39/1,
            '1.85:1': 1.85/1
        };
        
        const actualRatio = width / height;
        
        // Find closest common ratio (within 2% tolerance)
        for (const [name, value] of Object.entries(commonRatios)) {
            if (Math.abs(actualRatio - value) / value < 0.02) {
                return name;
            }
        }
        
        // Return simplified ratio if no common match
        return `${aspectWidth}:${aspectHeight}`;
    },

    /**
     * Detect color channels (RGB or RGBA)
     */
    detectChannels() {
        // HTML5 video doesn't directly expose alpha channel info
        // Check if the codec/container typically supports alpha
        if (this.currentFile) {
            const mimeType = this.currentFile.type.toLowerCase();
            const fileName = this.currentFile.name.toLowerCase();
            
            // WebM VP8/VP9 and certain MOV files can have alpha
            if (mimeType.includes('webm') || 
                fileName.endsWith('.webm') ||
                (mimeType.includes('quicktime') && fileName.includes('prores'))) {
                // These formats CAN have alpha, but we can't detect for certain
                // without rendering a frame to canvas
                return 'RGB/RGBA';
            }
        }
        
        // Most common video formats are RGB only
        return 'RGB';
    },

    /**
     * Estimate frame rate (HTML5 video doesn't expose this directly)
     */
    estimateFrameRate() {
        // Common frame rates for detection
        const commonFps = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
        
        // For now, return default or try to detect
        // A more sophisticated approach would analyze frame timestamps
        return this.frameRate; // Use the default frameRate property
    },

    /**
     * Extract codec/container info from MIME type
     */
    getCodecFromMime(mimeType) {
        if (!mimeType) return 'Unknown';
        
        // Extract container format
        const parts = mimeType.split('/');
        if (parts.length > 1) {
            const format = parts[1].split(';')[0].toUpperCase();
            
            // Map common MIME types to readable formats
            const formatMap = {
                'MP4': 'H.264/MP4',
                'WEBM': 'VP8/WebM',
                'OGG': 'Theora/Ogg',
                'QUICKTIME': 'ProRes/MOV',
                'X-MATROSKA': 'H.264/MKV'
            };
            
            return formatMap[format] || format;
        }
        
        return 'Unknown';
    },

    /**
     * Called on time update
     */
    onTimeUpdate() {
        const currentTime = this.video.currentTime;
        const progress = (currentTime / this.duration) * 100;
        
        document.getElementById('currentTime').textContent = this.formatTimecode(currentTime);
        document.getElementById('progressFilled').style.width = `${progress}%`;
    },

    /**
     * Called when video starts playing
     */
    onPlay() {
        this.isPlaying = true;
        const playIcon = document.querySelector('.play-icon');
        const pauseIcon = document.querySelector('.pause-icon');
        // When playing, show pause "II" button (action available)
        if (playIcon) {
            playIcon.style.display = 'none';
        }
        if (pauseIcon) {
            pauseIcon.style.display = 'block';
            pauseIcon.removeAttribute('hidden');
        }
        
        // Reset comment bar when playback resumes
        const commentInputInline = document.getElementById('commentInputInline');
        if (commentInputInline) {
            commentInputInline.innerHTML = '';
            // Reset snapshot reference in SnapshotManager
            if (window.SnapshotManager) {
                window.SnapshotManager.quickCommentSnapshotId = null;
            }
        }

        // Hide markups during playback
        if (window.DrawingTool) {
            window.DrawingTool.hideMarkups();
        }

        // Exit inline edit mode if active
        if (window.SnapshotManager && window.SnapshotManager.currentSnapshotId) {
            window.SnapshotManager.exitInlineEditMode();
        }

        // Reset tags/hours UI whenever playback resumes
        if (window.SnapshotManager && typeof window.SnapshotManager.resetInlineTagsUI === 'function') {
            window.SnapshotManager.resetInlineTagsUI();
            // #region agent log
            console.log('[DEBUG-PLAY-RESET] VideoHandler.onPlay requested tags reset');
            // #endregion
        }
    },

    /**
     * Called when video is paused
     */
    onPause() {
        this.isPlaying = false;
        const playIcon = document.querySelector('.play-icon');
        const pauseIcon = document.querySelector('.pause-icon');
        // When paused, show play "▶️" button (action available)
        if (playIcon) {
            playIcon.style.display = 'block';
            playIcon.removeAttribute('hidden');
        }
        if (pauseIcon) {
            pauseIcon.style.display = 'none';
        }

        // Display markups if at a snapshot timestamp
        if (window.SnapshotManager) {
            const currentTime = this.getCurrentTime();
            window.SnapshotManager.displayMarkupsAtTimestamp(currentTime);
        }
    },

    /**
     * Called when video ends
     */
    onEnded() {
        if (this.loopEnabled) {
            this.video.currentTime = 0;
            this.video.play();
        } else {
            this.isPlaying = false;
            this.onPause();
        }
    },

    /**
     * Toggle play/pause
     */
    togglePlay() {
        if (this.isPlaying) {
            this.video.pause();
        } else {
            this.video.play();
        }
    },

    /**
     * Go to previous frame
     */
    prevFrame() {
        this.video.pause();
        this.video.currentTime = Math.max(0, this.video.currentTime - (1 / this.frameRate));
    },

    /**
     * Go to next frame
     */
    nextFrame() {
        this.video.pause();
        this.video.currentTime = Math.min(this.duration, this.video.currentTime + (1 / this.frameRate));
    },

    /**
     * Seek to a specific time
     * @param {number} time - Time in seconds
     */
    seekTo(time) {
        this.video.currentTime = Math.max(0, Math.min(this.duration, time));
    },

    /**
     * Seek based on click position
     * @param {MouseEvent} event
     */
    seekToPosition(event) {
        const progressBar = document.querySelector('.progress-bar');
        const rect = progressBar.getBoundingClientRect();
        const pos = (event.clientX - rect.left) / rect.width;
        this.seekTo(pos * this.duration);
    },

    /**
     * Toggle mute
     */
    toggleMute() {
        const volumeSlider = document.getElementById('volumeSlider');
        
        if (this.video.muted || this.video.volume === 0) {
            // Currently muted - UNMUTE: restore previous volume
            const volumeToRestore = this.previousVolume || 1;
            this.video.volume = volumeToRestore;
            this.video.muted = false;
            volumeSlider.value = volumeToRestore;
        } else {
            // Currently unmuted - MUTE: store current volume and set to 0
            this.previousVolume = this.video.volume;
            this.video.volume = 0;
            this.video.muted = true;
            volumeSlider.value = 0;
        }
        
        this.updateVolumeIcon();
    },

    /**
     * Toggle loop playback
     */
    toggleLoop() {
        this.loopEnabled = !this.loopEnabled;
        const loopBtn = document.getElementById('loopBtn');
        
        if (this.loopEnabled) {
            loopBtn.classList.add('active');
            loopBtn.title = 'Loop enabled (click to disable)';
        } else {
            loopBtn.classList.remove('active');
            loopBtn.title = 'Loop disabled (click to enable)';
        }
    },

    /**
     * Set safezone overlay
     */
    setSafezone(ratio) {
        this.currentSafezone = ratio;
        const videoWrapper = document.querySelector('.video-wrapper');
        
        // Remove existing overlay
        const existingOverlay = videoWrapper.querySelector('.safezone-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        // Update active state in menu
        document.querySelectorAll('.safezone-item').forEach(item => {
            item.classList.toggle('active', item.dataset.ratio === ratio);
        });

        // Update button active state
        const safezoneBtn = document.getElementById('safezoneBtn');
        if (ratio === 'none') {
            safezoneBtn.classList.remove('active');
            return;
        }

        safezoneBtn.classList.add('active');

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'safezone-overlay';

        const guide = document.createElement('div');
        guide.className = 'safezone-guide';

        // Calculate dimensions based on video
        const video = this.video;
        const videoAspect = video.videoWidth / video.videoHeight;
        const videoRect = video.getBoundingClientRect();

        let guideWidth, guideHeight;

        switch (ratio) {
            case '9:16': // Story/Vertical
                const targetAspect916 = 9 / 16;
                if (videoAspect > targetAspect916) {
                    // Video is wider, constrain by height
                    guideHeight = videoRect.height;
                    guideWidth = guideHeight * targetAspect916;
                } else {
                    // Video is taller, constrain by width
                    guideWidth = videoRect.width;
                    guideHeight = guideWidth / targetAspect916;
                }
                break;

            case '1:1': // Square
                const size = Math.min(videoRect.width, videoRect.height);
                guideWidth = size;
                guideHeight = size;
                break;

            case '4:5': // Feed
                const targetAspect45 = 4 / 5;
                if (videoAspect > targetAspect45) {
                    guideHeight = videoRect.height;
                    guideWidth = guideHeight * targetAspect45;
                } else {
                    guideWidth = videoRect.width;
                    guideHeight = guideWidth / targetAspect45;
                }
                break;
        }

        guide.style.width = `${guideWidth}px`;
        guide.style.height = `${guideHeight}px`;

        overlay.appendChild(guide);
        videoWrapper.appendChild(overlay);

        // Update on window resize
        window.addEventListener('resize', () => {
            if (this.currentSafezone !== 'none') {
                this.setSafezone(this.currentSafezone);
            }
        });
    },

    /**
     * Update volume icon based on state
     */
    updateVolumeIcon() {
        const volumeIcon = document.querySelector('.volume-icon');
        const muteIcon = document.querySelector('.mute-icon');
        
        if (this.video.muted || this.video.volume === 0) {
            volumeIcon.hidden = true;
            muteIcon.hidden = false;
        } else {
            volumeIcon.hidden = false;
            muteIcon.hidden = true;
        }
    },

    /**
     * Format time as timecode (HH:MM:SS:FF)
     * @param {number} seconds - Time in seconds
     * @returns {string} Formatted timecode
     */
    formatTimecode(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const f = Math.floor((seconds % 1) * this.frameRate);

        return [h, m, s, f]
            .map(v => v.toString().padStart(2, '0'))
            .join(':');
    },

    /**
     * Get current video frame as canvas
     * @returns {HTMLCanvasElement}
     */
    captureFrame() {
        const canvas = document.createElement('canvas');
        canvas.width = this.video.videoWidth;
        canvas.height = this.video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.video, 0, 0);
        
        return canvas;
    },

    /**
     * Get current time
     * @returns {number}
     */
    getCurrentTime() {
        return this.video.currentTime;
    },

    /**
     * Get video dimensions
     * @returns {Object}
     */
    getDimensions() {
        return {
            width: this.video.videoWidth,
            height: this.video.videoHeight
        };
    },

    /**
     * Toggle grid overlay
     */
    toggleGrid() {
        this.gridEnabled = !this.gridEnabled;
        const videoWrapper = document.querySelector('.video-wrapper');
        const gridBtn = document.getElementById('gridBtn');
        
        // Remove existing grid
        const existingGrid = videoWrapper.querySelector('.grid-overlay');
        if (existingGrid) {
            existingGrid.remove();
        }

        if (this.gridEnabled) {
            gridBtn.classList.add('active');
            const grid = document.createElement('div');
            grid.className = 'grid-overlay';
            
            // Size grid to match video, not wrapper
            const videoRect = this.video.getBoundingClientRect();
            const wrapperRect = videoWrapper.getBoundingClientRect();
            
            grid.style.width = `${videoRect.width}px`;
            grid.style.height = `${videoRect.height}px`;
            grid.style.left = `${videoRect.left - wrapperRect.left}px`;
            grid.style.top = `${videoRect.top - wrapperRect.top}px`;
            
            videoWrapper.appendChild(grid);
            
            // Update on resize
            window.addEventListener('resize', () => {
                if (this.gridEnabled) {
                    this.toggleGrid();
                    this.toggleGrid(); // Toggle twice to refresh
                }
            });
        } else {
            gridBtn.classList.remove('active');
        }
    },

    /**
     * Set color channel view
     */
    setChannel(channel) {
        this.currentChannel = channel;
        
        // Update active state in menu
        document.querySelectorAll('.channel-item').forEach(item => {
            item.classList.toggle('active', item.dataset.channel === channel);
        });

        // Update button state
        const channelBtn = document.getElementById('channelBtn');
        if (channel === 'rgb') {
            channelBtn.classList.remove('active');
        } else {
            channelBtn.classList.add('active');
        }

        // Apply filters
        this.applyFilters();
    },

    /**
     * Set exposure/brightness
     */
    setExposure(value) {
        this.currentExposure = value;
        this.applyFilters();
    },

    /**
     * Apply current filters to video and snapshots
     */
    applyFilters() {
        // Get current channel filter
        let channelFilter = '';
        if (this.currentChannel !== 'rgb') {
            // Reapply channel filter
            switch (this.currentChannel) {
                case 'red':
                    channelFilter = 'saturate(0) brightness(1.2) sepia(1) hue-rotate(-60deg) saturate(5)';
                    break;
                case 'green':
                    channelFilter = 'saturate(0) brightness(1.2) sepia(1) hue-rotate(60deg) saturate(5)';
                    break;
                case 'blue':
                    channelFilter = 'saturate(0) brightness(1.2) sepia(1) hue-rotate(180deg) saturate(5)';
                    break;
                case 'alpha':
                    channelFilter = 'contrast(2) brightness(1.5)';
                    break;
            }
        }

        // Apply brightness
        const brightness = 1 + this.currentExposure;
        const filter = channelFilter ? `${channelFilter} brightness(${brightness})` : `brightness(${brightness})`;
        
        // Apply to video
        this.video.style.filter = filter;
        
        // Apply to snapshot overlay
        const snapshotOverlay = document.getElementById('snapshotOverlay');
        if (snapshotOverlay) {
            snapshotOverlay.style.filter = filter;
        }

        // Apply to all snapshot thumbnails in sidebar
        const snapshotThumbnails = document.querySelectorAll('.snapshot-card-thumbnail img');
        snapshotThumbnails.forEach(img => {
            img.style.filter = filter;
        });
    },

    /**
     * Set playback speed
     */
    setPlaybackSpeed(speed) {
        this.currentSpeed = speed;
        this.video.playbackRate = speed;

        // Update active state in menu
        document.querySelectorAll('.speed-item').forEach(item => {
            item.classList.toggle('active', parseFloat(item.dataset.speed) === speed);
        });

        // Update button text
        const speedValue = document.querySelector('.speed-value');
        if (speedValue) {
            speedValue.textContent = `${speed}×`;
        }
    }
};

// Make VideoHandler globally available
window.VideoHandler = VideoHandler;

