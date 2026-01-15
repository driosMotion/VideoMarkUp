/**
 * Project Manager Module
 * Handles project dropdown, switching, and management
 */

const ProjectManager = {
    isOpen: false,
    expandedFolders: new Set(), // Track which folders are expanded
    draggedProjectId: null, // Track currently dragged project

    /**
     * Initialize project manager
     */
    init() {
        this.loadExpandedState();
        this.setupEventListeners();
        this.loadProjectList();
    },

    /**
     * Load expanded folder state from localStorage
     */
    loadExpandedState() {
        const saved = localStorage.getItem('expandedFolders');
        if (saved) {
            this.expandedFolders = new Set(JSON.parse(saved));
        }
    },

    /**
     * Save expanded folder state to localStorage
     */
    saveExpandedState() {
        localStorage.setItem('expandedFolders', JSON.stringify([...this.expandedFolders]));
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

        // New folder button
        const newFolderBtn = document.getElementById('newFolderBtn');
        if (newFolderBtn) {
            newFolderBtn.addEventListener('click', () => {
                this.createFolder();
            });
        }

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.closeDropdown();
            }
        });
        
        // Close on scroll (but not when scrolling inside the dropdown)
        window.addEventListener('scroll', (e) => {
            if (this.isOpen) {
                // Don't close if scrolling inside the dropdown list
                const listEl = document.getElementById('projectList');
                if (!listEl || !listEl.contains(e.target)) {
                    this.closeDropdown();
                }
            }
        }, true);
        
        // Prevent dropdown from closing when scrolling inside project list
        const projectList = document.getElementById('projectList');
        if (projectList) {
            projectList.addEventListener('wheel', (e) => {
                e.stopPropagation();
            }, { passive: false });
            
            projectList.addEventListener('scroll', (e) => {
                e.stopPropagation();
            }, true);
        }
        
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
     * Load and display project list with folder support
     */
    async loadProjectList() {
        const listEl = document.getElementById('projectList');
        const [folders, projects] = await Promise.all([
            Storage.getAllFolders(),
            Storage.getAllProjects()
        ]);

        if (folders.length === 0 && projects.length === 0) {
            listEl.innerHTML = '<div class="dropdown-empty">No saved projects</div>';
            return;
        }

        let html = '';

        // Render folders
        for (const folder of folders) {
            const folderProjects = projects.filter(p => p.folderId === folder.id);
            const isExpanded = this.expandedFolders.has(folder.id);
            
            html += `
                <div class="folder-item ${isExpanded ? 'expanded' : ''}" data-folder-id="${folder.id}">
                    <svg class="folder-expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                    <svg class="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span class="folder-name">${this.escapeHtml(folder.name)}</span>
                    <span class="folder-count">${folderProjects.length}</span>
                    <div class="folder-actions">
                        <button class="folder-action rename" data-folder-id="${folder.id}" title="Rename folder">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="folder-action delete" data-folder-id="${folder.id}" title="Delete folder">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="folder-projects ${isExpanded ? '' : 'collapsed'}" data-folder-id="${folder.id}">
            `;

            // Render projects in this folder
            folderProjects.sort((a, b) => new Date(b.lastEditedAt || b.createdAt) - new Date(a.lastEditedAt || a.createdAt));
            
            for (const project of folderProjects) {
                html += this.renderProjectItem(project, true);
            }

            html += '</div>';
        }

        // Render projects without folders (root level)
        const rootProjects = projects.filter(p => !p.folderId || p.folderId === null || p.folderId === undefined);
        console.log('Root projects:', rootProjects.length, 'Total projects:', projects.length);
        rootProjects.sort((a, b) => new Date(b.lastEditedAt || b.createdAt) - new Date(a.lastEditedAt || a.createdAt));
        
        for (const project of rootProjects) {
            html += this.renderProjectItem(project, false);
        }

        listEl.innerHTML = html;

        // Setup event handlers
        this.setupProjectHandlers(listEl);
        this.setupFolderHandlers(listEl);
        this.setupDragDropHandlers(listEl);
    },

    /**
     * Render a single project item
     */
    renderProjectItem(project, inFolder) {
        return `
            <div class="dropdown-item ${inFolder ? 'in-folder' : ''} ${project.id === VideoHandler.currentProjectId ? 'dropdown-item-active' : ''}" 
                 data-id="${project.id}" 
                 draggable="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="23 7 16 12 23 17 23 7"></polygon>
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                </svg>
                <div class="dropdown-item-info">
                    <span class="dropdown-item-name">${this.escapeHtml(project.name)}</span>
                    <span class="dropdown-item-meta">Last edited: ${this.formatDate(project.lastEditedAt || project.createdAt)}</span>
                </div>
                <div class="dropdown-item-actions">
                    <button class="dropdown-item-action dropdown-item-rename" data-id="${project.id}" title="Rename project">
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
        `;
    },

    /**
     * Setup project click and action handlers
     */
    setupProjectHandlers(listEl) {
        // Project click handlers
        listEl.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.dropdown-item-rename') || e.target.closest('.dropdown-item-delete')) return;
                const projectId = parseInt(item.dataset.id);
                this.switchProject(projectId);
            });
        });

        // Rename handlers
        listEl.querySelectorAll('.dropdown-item-rename').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.renameProject(parseInt(btn.dataset.id));
            });
        });

        // Delete handlers with hold-to-delete
        listEl.querySelectorAll('.dropdown-item-delete').forEach(btn => {
            this.setupHoldToDelete(btn, () => this.deleteProject(parseInt(btn.dataset.id)));
        });
    },

    /**
     * Setup folder handlers (expand/collapse, rename, delete)
     */
    setupFolderHandlers(listEl) {
        // Folder expand/collapse
        listEl.querySelectorAll('.folder-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent dropdown from closing
                if (e.target.closest('.folder-action')) return;
                const folderId = parseInt(item.dataset.folderId);
                this.toggleFolder(folderId);
            });
        });

        // Folder rename
        listEl.querySelectorAll('.folder-action.rename').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.renameFolder(parseInt(btn.dataset.folderId));
            });
        });

        // Folder delete
        listEl.querySelectorAll('.folder-action.delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.deleteFolder(parseInt(btn.dataset.folderId));
            });
        });
    },

    /**
     * Setup drag and drop handlers for projects
     */
    setupDragDropHandlers(listEl) {
        // Drag start
        listEl.querySelectorAll('.dropdown-item[draggable="true"]').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                this.draggedProjectId = parseInt(item.dataset.id);
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                console.log('Drag started:', this.draggedProjectId);
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                console.log('Drag ended');
                // Don't reset draggedProjectId here, let drop handler clear it
                // Remove all drop-target classes
                setTimeout(() => {
                    listEl.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
                }, 100);
            });
        });

        // Drag over folders
        listEl.querySelectorAll('.folder-item').forEach(folder => {
            folder.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                folder.classList.add('drop-target');
            });

            folder.addEventListener('dragleave', () => {
                folder.classList.remove('drop-target');
            });

            folder.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                folder.classList.remove('drop-target');
                
                if (this.draggedProjectId) {
                    const folderId = parseInt(folder.dataset.folderId);
                    console.log('DROP: Moving project', this.draggedProjectId, 'to folder', folderId);
                    await Storage.updateProjectFolder(this.draggedProjectId, folderId);
                    this.draggedProjectId = null; // Clear after successful move
                    console.log('Project moved, reloading list');
                    await this.loadProjectList();
                    App.showToast('Project moved to folder', 'success');
                } else {
                    console.log('DROP: No draggedProjectId');
                }
            });
        });

        // Drag over root area (project list) to move out of folder
        const dropZone = listEl;
        dropZone.addEventListener('dragover', (e) => {
            // Only allow drop if not over a folder
            if (!e.target.closest('.folder-item')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            }
        });

        dropZone.addEventListener('drop', async (e) => {
            if (!e.target.closest('.folder-item') && this.draggedProjectId) {
                e.preventDefault();
                e.stopPropagation();
                console.log('DROP: Moving project', this.draggedProjectId, 'to root');
                await Storage.updateProjectFolder(this.draggedProjectId, null);
                this.draggedProjectId = null; // Clear after successful move
                console.log('Project moved to root, reloading list');
                await this.loadProjectList();
                App.showToast('Project moved to root', 'success');
            }
        });
    },

    /**
     * Setup hold-to-delete functionality
     */
    setupHoldToDelete(btn, deleteCallback) {
        let deleteHoldTimer = null;
        let deleteProgress = null;

        const startDelete = (e) => {
            e.stopPropagation();
            e.preventDefault();
            
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
                await deleteCallback();
            }, 1000);
        };

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

        btn.addEventListener('mousedown', startDelete);
        btn.addEventListener('mouseup', cancelDelete);
        btn.addEventListener('mouseleave', cancelDelete);
        btn.addEventListener('touchstart', startDelete);
        btn.addEventListener('touchend', cancelDelete);
        btn.addEventListener('touchcancel', cancelDelete);
    },

    /**
     * Toggle folder expand/collapse
     */
    toggleFolder(folderId) {
        if (this.expandedFolders.has(folderId)) {
            this.expandedFolders.delete(folderId);
        } else {
            this.expandedFolders.add(folderId);
        }
        this.saveExpandedState();
        this.loadProjectList();
    },

    /**
     * Create a new folder
     */
    async createFolder() {
        const name = prompt('Enter folder name:');
        if (!name || !name.trim()) return;

        try {
            await Storage.createFolder(name.trim());
            await this.loadProjectList();
            App.showToast('Folder created', 'success');
        } catch (error) {
            console.error('Error creating folder:', error);
            App.showToast('Error creating folder', 'error');
        }
    },

    /**
     * Rename a folder
     */
    async renameFolder(folderId) {
        const folder = await Storage.getFolder(folderId);
        if (!folder) return;

        const newName = prompt('Rename folder:', folder.name);
        if (!newName || !newName.trim() || newName === folder.name) return;

        try {
            await Storage.updateFolder(folderId, { name: newName.trim() });
            await this.loadProjectList();
            App.showToast('Folder renamed', 'success');
        } catch (error) {
            console.error('Error renaming folder:', error);
            App.showToast('Error renaming folder', 'error');
        }
    },

    /**
     * Delete a folder
     */
    async deleteFolder(folderId) {
        const folder = await Storage.getFolder(folderId);
        const projects = await Storage.getProjectsByFolder(folderId);
        
        if (projects.length === 0) {
            // Empty folder, just delete
            if (confirm(`Delete folder "${folder.name}"?`)) {
                await Storage.deleteFolder(folderId);
                this.expandedFolders.delete(folderId);
                this.saveExpandedState();
                await this.loadProjectList();
                App.showToast('Folder deleted', 'success');
            }
            return;
        }

        // Folder has projects, ask user what to do
        const choice = confirm(
            `Folder "${folder.name}" contains ${projects.length} project(s).\n\n` +
            `OK = Move projects to root level\n` +
            `Cancel = Delete folder AND all projects inside`
        );

        if (choice) {
            // Move to root
            await Storage.moveProjectsToRoot(folderId);
            await Storage.deleteFolder(folderId);
            this.expandedFolders.delete(folderId);
            this.saveExpandedState();
            await this.loadProjectList();
            App.showToast(`Folder deleted, ${projects.length} project(s) moved to root`, 'success');
        } else {
            // Confirm deletion of all
            const confirmDelete = confirm(
                `Are you SURE you want to delete the folder AND all ${projects.length} project(s) inside?\n\n` +
                `This action cannot be undone!`
            );
            
            if (confirmDelete) {
                await Storage.deleteProjectsInFolder(folderId);
                await Storage.deleteFolder(folderId);
                this.expandedFolders.delete(folderId);
                this.saveExpandedState();
                await this.loadProjectList();
                App.showToast('Folder and all projects deleted', 'success');
            }
        }
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
        
        // Clear inline comment and editing state
        SnapshotManager.exitInlineEditMode();
        
        // Clear any active tags and hours in the inline panel
        const inlinePanel = document.querySelector('.tags-grid-inline');
        if (inlinePanel) {
            const tagBtns = inlinePanel.querySelectorAll('.tag-btn.active');
            tagBtns.forEach(btn => btn.classList.remove('active'));
            const hourInputs = inlinePanel.querySelectorAll('.tag-hours-input');
            hourInputs.forEach(input => input.value = '');
        }
        
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

