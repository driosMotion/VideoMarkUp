/**
 * Video Markup - Main Application
 * Post-Production Coordination Tool
 */

const App = {
    /**
     * Initialize the application
     */
    init() {
        // Initialize all modules
        VideoHandler.init();
        SnapshotManager.init();
        DrawingTool.init();
        TagManager.init();
        PDFExporter.init();

        // Set up keyboard shortcuts
        this.setupKeyboardShortcuts();

        // Set up project loading
        this.setupProjectLoader();

        console.log('Video Markup initialized');
    },

    /**
     * Set up keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            const modal = document.getElementById('snapshotModal');
            const isModalOpen = !modal.hidden;

            // Global shortcuts
            switch (e.code) {
                case 'Space':
                    if (!isModalOpen && VideoHandler.video.src) {
                        e.preventDefault();
                        VideoHandler.togglePlay();
                    }
                    break;

                case 'ArrowLeft':
                    if (!isModalOpen && VideoHandler.video.src) {
                        e.preventDefault();
                        VideoHandler.prevFrame();
                    }
                    break;

                case 'ArrowRight':
                    if (!isModalOpen && VideoHandler.video.src) {
                        e.preventDefault();
                        VideoHandler.nextFrame();
                    }
                    break;

                case 'KeyS':
                    if (!isModalOpen && VideoHandler.video.src && !e.metaKey && !e.ctrlKey) {
                        e.preventDefault();
                        SnapshotManager.captureSnapshot();
                    }
                    break;
            }

            // Modal shortcuts (when modal is open)
            if (isModalOpen) {
                switch (e.code) {
                    case 'KeyV':
                        DrawingTool.setTool('select');
                        break;
                    case 'KeyB':
                        DrawingTool.setTool('draw');
                        break;
                    case 'KeyR':
                        DrawingTool.setTool('rect');
                        break;
                    case 'KeyC':
                        if (!e.metaKey && !e.ctrlKey) {
                            DrawingTool.setTool('circle');
                        }
                        break;
                    case 'KeyA':
                        if (!e.metaKey && !e.ctrlKey) {
                            DrawingTool.setTool('arrow');
                        }
                        break;
                    case 'KeyT':
                        DrawingTool.setTool('text');
                        break;
                    case 'KeyE':
                        DrawingTool.setTool('eraser');
                        break;
                    case 'KeyZ':
                        if (e.metaKey || e.ctrlKey) {
                            e.preventDefault();
                            DrawingTool.undo();
                        }
                        break;
                }
            }
        });
    },

    /**
     * Set up project loader dialog
     */
    setupProjectLoader() {
        const loadBtn = document.getElementById('loadProjectBtn');
        
        loadBtn.addEventListener('click', async () => {
            const projects = await Storage.getAllProjects();
            
            if (projects.length === 0) {
                this.showToast('No saved projects found', 'info');
                return;
            }

            // Create a simple project selection dialog
            const projectList = projects.map(p => 
                `${p.name} (${new Date(p.createdAt).toLocaleDateString()})`
            ).join('\n');

            const choice = prompt(
                `Select project number to load:\n\n${projects.map((p, i) => 
                    `${i + 1}. ${p.name}`
                ).join('\n')}\n\nEnter number:`
            );

            if (choice) {
                const index = parseInt(choice) - 1;
                if (index >= 0 && index < projects.length) {
                    // Clear current snapshots
                    SnapshotManager.clearList();
                    
                    // Load selected project
                    await VideoHandler.loadProject(projects[index].id);
                    this.showToast(`Loaded: ${projects[index].name}`, 'success');
                }
            }
        });
    },

    /**
     * Show a toast notification
     * @param {string} message - Toast message
     * @param {string} type - Toast type (success, error, warning, info)
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Icon based on type
        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
        };

        toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
        container.appendChild(toast);

        // Auto remove after 3 seconds
        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Make App globally available
window.App = App;

