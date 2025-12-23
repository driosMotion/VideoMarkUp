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
        if (playIcon) playIcon.hidden = true;
        if (pauseIcon) pauseIcon.hidden = false;
        
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
    },

    /**
     * Called when video is paused
     */
    onPause() {
        this.isPlaying = false;
        const playIcon = document.querySelector('.play-icon');
        const pauseIcon = document.querySelector('.pause-icon');
        // When paused, show play "▶️" button (action available)
        if (playIcon) playIcon.hidden = false;
        if (pauseIcon) pauseIcon.hidden = true;

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
        this.isPlaying = false;
        this.onPause();
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
    }
};

// Make VideoHandler globally available
window.VideoHandler = VideoHandler;

