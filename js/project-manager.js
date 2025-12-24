/**
 * Project Manager Module
 * Handles project dropdown, switching, and management
 */

const ProjectManager = {
    isOpen: false,

    /**
     * Initialize project manager
     */
    init() {
        this.setupEventListeners();
        this.loadProjectList();
    },

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        const dropdownBtn = document.getElementById('projectDropdownBtn');
        const dropdown = document.getElementById('projectDropdown');
        const newProjectBtn = document.getElementById('newProjectBtn');

        // Toggle dropdown
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                this.closeDropdown();
            }
        });

        // New project button
        newProjectBtn.addEventListener('click', () => {
            this.newProject();
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.closeDropdown();
            }
        });
        
        // Close on scroll
        window.addEventListener('scroll', () => {
            if (this.isOpen) {
                this.closeDropdown();
            }
        }, true);
        
        // Reposition on window resize
        window.addEventListener('resize', () => {
            if (this.isOpen) {
                this.repositionMenu();
            }
        });
    },

    /**
     * Toggle dropdown visibility
     */
    toggleDropdown() {
        if (this.isOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    },

    /**
     * Open dropdown
     */
    openDropdown() {
        this.isOpen = true;
        const dropdown = document.getElementById('projectDropdown');
        const menu = document.getElementById('projectDropdownMenu');
        
        dropdown.classList.add('open');
        menu.hidden = false;
        
        // Portal the menu to body to escape stacking contexts
        document.body.appendChild(menu);
        
        // Position the menu
        this.repositionMenu();
        
        this.loadProjectList();
    },
    
    /**
     * Reposition the dropdown menu
     */
    repositionMenu() {
        const menu = document.getElementById('projectDropdownMenu');
        const btn = document.getElementById('projectDropdownBtn');
        
        if (!menu || !btn || menu.parentElement !== document.body) {
            return;
        }
        
        // Position the menu relative to the button
        const btnRect = btn.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = `${btnRect.bottom + 4}px`;
        menu.style.left = `${btnRect.left}px`;
        menu.style.zIndex = '999999';
    },

    /**
     * Close dropdown
     */
    closeDropdown() {
        this.isOpen = false;
        const dropdown = document.getElementById('projectDropdown');
        const menu = document.getElementById('projectDropdownMenu');
        
        dropdown.classList.remove('open');
        menu.hidden = true;
        
        // Move menu back to its original parent
        if (menu.parentElement !== dropdown) {
            dropdown.appendChild(menu);
        }
        
        // Reset inline styles
        menu.style.position = '';
        menu.style.top = '';
        menu.style.left = '';
        menu.style.zIndex = '';
    },

    /**
     * Load and display project list
     */
    async loadProjectList() {
        const listEl = document.getElementById('projectList');
        const projects = await Storage.getAllProjects();

        if (projects.length === 0) {
            listEl.innerHTML = '<div class="dropdown-empty">No saved projects</div>';
            return;
        }

        // Sort by last edited date (most recent first)
        projects.sort((a, b) => new Date(b.lastEditedAt || b.createdAt) - new Date(a.lastEditedAt || a.createdAt));

        listEl.innerHTML = projects.map(project => `
            <div class="dropdown-item ${project.id === VideoHandler.currentProjectId ? 'dropdown-item-active' : ''}" data-id="${project.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="23 7 16 12 23 17 23 7"></polygon>
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                </svg>
                <div class="dropdown-item-info">
                    <span class="dropdown-item-name">${this.escapeHtml(project.name)}</span>
                    <span class="dropdown-item-meta">Last edited: ${this.formatDate(project.lastEditedAt || project.createdAt)}</span>
                </div>
                <div class="dropdown-item-actions">
                    <button class="dropdown-item-action dropdown-item-rename" data-id="${project.id}" data-name="${this.escapeHtml(project.name)}" title="Rename project">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="dropdown-item-action dropdown-item-delete" data-id="${project.id}" title="Delete project">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');

        // Add click handlers
        listEl.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Don't switch if clicking action buttons
                if (e.target.closest('.dropdown-item-rename') || e.target.closest('.dropdown-item-delete')) return;

                const projectId = parseInt(item.dataset.id);
                this.switchProject(projectId);
            });
        });

        // Rename button handlers
        listEl.querySelectorAll('.dropdown-item-rename').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const projectId = parseInt(btn.dataset.id);
                await this.renameProject(projectId);
            });
        });

        // Delete button handlers with hold-to-delete
        listEl.querySelectorAll('.dropdown-item-delete').forEach(btn => {
            let deleteHoldTimer = null;
            let deleteProgress = null;
            
            // Mouse down - start delete timer
            btn.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                const projectId = parseInt(btn.dataset.id);
                btn.classList.add('deleting');
                
                // Create progress overlay
                deleteProgress = document.createElement('div');
                deleteProgress.className = 'delete-progress';
                btn.insertBefore(deleteProgress, btn.firstChild);
                
                // Start animation
                deleteProgress.style.animation = 'deleteProgress 1s linear forwards';
                
                // Set timer for actual deletion
                deleteHoldTimer = setTimeout(async () => {
                    btn.classList.remove('deleting');
                    if (deleteProgress && deleteProgress.parentNode) {
                        deleteProgress.remove();
                    }
                    await this.deleteProject(projectId);
                }, 1000);
            });
            
            // Cancel on release or leave
            const cancelDelete = () => {
                btn.classList.remove('deleting');
                if (deleteHoldTimer) {
                    clearTimeout(deleteHoldTimer);
                    deleteHoldTimer = null;
                }
                if (deleteProgress && deleteProgress.parentNode) {
                    deleteProgress.remove();
                }
            };
            
            btn.addEventListener('mouseup', cancelDelete);
            btn.addEventListener('mouseleave', cancelDelete);
            
            // Touch support
            btn.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                const projectId = parseInt(btn.dataset.id);
                btn.classList.add('deleting');
                
                deleteProgress = document.createElement('div');
                deleteProgress.className = 'delete-progress';
                btn.insertBefore(deleteProgress, btn.firstChild);
                deleteProgress.style.animation = 'deleteProgress 1s linear forwards';
                
                deleteHoldTimer = setTimeout(async () => {
                    btn.classList.remove('deleting');
                    if (deleteProgress && deleteProgress.parentNode) {
                        deleteProgress.remove();
                    }
                    await this.deleteProject(projectId);
                }, 1000);
            });
            
            btn.addEventListener('touchend', cancelDelete);
            btn.addEventListener('touchcancel', cancelDelete);
        });
    },

    /**
     * Switch to a different project
     * @param {number} projectId
     */
    async switchProject(projectId) {
        if (projectId === VideoHandler.currentProjectId) {
            this.closeDropdown();
            return;
        }

        // Clear current state
        SnapshotManager.clearList();
        
        // Load the selected project
        await VideoHandler.loadProject(projectId);
        
        this.closeDropdown();
        App.showToast('Project loaded', 'success');
    },

    /**
     * Create a new project (reset to upload state)
     */
    newProject() {
        // Reset UI to upload state
        document.getElementById('uploadArea').hidden = false;
        document.getElementById('videoPlayerContainer').hidden = true;
        document.getElementById('exportPdfBtn').disabled = true;
        document.getElementById('exportProjectBtn').disabled = true;
        document.getElementById('projectName').textContent = 'No project loaded';
        
        // Clear video
        const video = document.getElementById('videoPlayer');
        video.src = '';
        
        // Clear snapshots
        SnapshotManager.clearList();
        
        // Reset current project
        VideoHandler.currentProjectId = null;
        
        this.closeDropdown();
    },

    /**
     * Rename a project
     * @param {number} projectId
     */
    async renameProject(projectId) {
        const project = await Storage.getProject(projectId);
        const newName = prompt('Enter new project name:', project.name);
        
        if (!newName || newName.trim() === '') {
            return;
        }

        if (newName === project.name) {
            return;
        }

        // Update in storage
        await Storage.updateProject(projectId, { name: newName.trim() });

        // If we renamed the current project, update the header
        if (projectId === VideoHandler.currentProjectId) {
            this.setProjectName(newName.trim());
        }

        // Refresh list
        this.loadProjectList();
        App.showToast('Project renamed', 'success');
    },

    /**
     * Delete a project
     * @param {number} projectId
     */
    async deleteProject(projectId) {
        const project = await Storage.getProject(projectId);
        
        // No confirmation needed - hold-to-delete provides confirmation
        await Storage.deleteProject(projectId);

        // If we deleted the current project, reset
        if (projectId === VideoHandler.currentProjectId) {
            this.newProject();
        }

        // Refresh list
        this.loadProjectList();
        App.showToast('Project deleted', 'success');
    },

    /**
     * Update displayed project name
     * @param {string} name
     */
    setProjectName(name) {
        document.getElementById('projectName').textContent = name;
    },

    /**
     * Escape HTML to prevent XSS
     * @param {string} str
     * @returns {string}
     */
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    /**
     * Format date for display
     * @param {string|Date} date
     * @returns {string}
     */
    formatDate(date) {
        const d = new Date(date);
        const now = new Date();
        const diff = now - d;
        
        // Less than 24 hours ago
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            if (hours < 1) {
                const mins = Math.floor(diff / 60000);
                return mins < 1 ? 'Just now' : `${mins}m ago`;
            }
            return `${hours}h ago`;
        }
        
        // Less than 7 days ago
        if (diff < 604800000) {
            const days = Math.floor(diff / 86400000);
            return `${days}d ago`;
        }
        
        // Otherwise show date
        return d.toLocaleDateString();
    }
};

// Make ProjectManager globally available
window.ProjectManager = ProjectManager;

