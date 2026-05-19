/**
 * Storage Module - IndexedDB operations using Dexie.js
 * Handles persistence of projects, snapshots, and drawings
 */

const db = new Dexie('VideoMarkupDB');

// Define database schema
db.version(1).stores({
    projects: '++id, name, createdAt',
    snapshots: '++id, projectId, timestamp, createdAt'
});

// Version 2: Add lastEditedAt index for sorting projects
db.version(2).stores({
    projects: '++id, name, createdAt, lastEditedAt',
    snapshots: '++id, projectId, timestamp, createdAt'
}).upgrade(async tx => {
    // Migrate existing projects to have lastEditedAt
    const projects = await tx.table('projects').toArray();
    for (const project of projects) {
        if (!project.lastEditedAt) {
            await tx.table('projects').update(project.id, {
                lastEditedAt: project.createdAt || new Date()
            });
        }
    }
    console.log(`Migrated ${projects.length} projects to version 2`);
});

// Version 3: Add folders table and folderId to projects
db.version(3).stores({
    projects: '++id, name, createdAt, lastEditedAt, folderId',
    snapshots: '++id, projectId, timestamp, createdAt',
    folders: '++id, name, createdAt'
}).upgrade(async tx => {
    // Migrate existing projects to have folderId (null = no folder)
    const projects = await tx.table('projects').toArray();
    for (const project of projects) {
        if (project.folderId === undefined) {
            await tx.table('projects').update(project.id, {
                folderId: null
            });
        }
    }
    console.log(`Migrated ${projects.length} projects to version 3 with folder support`);
});

// Version 4: Force migration for existing users (same schema as v3, just to trigger upgrade)
db.version(4).stores({
    projects: '++id, name, createdAt, lastEditedAt, folderId',
    snapshots: '++id, projectId, timestamp, createdAt',
    folders: '++id, name, createdAt'
}).upgrade(async tx => {
    // Ensure all projects have folderId field set to null if undefined
    const projects = await tx.table('projects').toArray();
    let migratedCount = 0;
    for (const project of projects) {
        if (project.folderId === undefined) {
            await tx.table('projects').update(project.id, { folderId: null });
            migratedCount++;
        }
    }
    console.log(`Version 4 migration: Fixed ${migratedCount} projects without folderId field`);
});

// Log database version on open
db.on('ready', () => {
    console.log(`Database opened at version ${db.verno}`);
    return db.projects.toArray().then(projects => {
        if (projects.length > 0) {
            console.log('Sample project structure:', projects[0]);
        }
    });
});

/**
 * Storage API
 */
const Storage = {
    /**
     * Create a new project
     * @param {Object} project - Project data
     * @returns {Promise<number>} Project ID
     */
    async createProject(project) {
        return await db.projects.add({
            name: project.name || 'Untitled Project',
            videoFileName: project.videoFileName,
            videoData: project.videoData, // Blob
            isImageProject: !!project.isImageProject,
            folderId: project.folderId != null ? project.folderId : null,
            createdAt: new Date(),
            lastEditedAt: new Date()
        });
    },

    /**
     * Get a project by ID
     * @param {number} id - Project ID
     * @returns {Promise<Object>} Project data
     */
    async getProject(id) {
        return await db.projects.get(id);
    },

    /**
     * Get all projects (without video data for performance)
     * @returns {Promise<Array>} Projects list
     */
    async getAllProjects() {
        const projects = await db.projects.toArray();
        // Don't include video data in listing
        return projects.map(p => ({
            id: p.id,
            name: p.name,
            videoFileName: p.videoFileName,
            createdAt: p.createdAt,
            lastEditedAt: p.lastEditedAt,
            folderId: p.folderId, // CRITICAL: Include folderId for folder organization!
            isImageProject: p.isImageProject // Also include this flag
        }));
    },

    /**
     * Get the most recently edited project
     * @returns {Promise<Object|null>}
     */
    async getLatestProject() {
        try {
            const projects = await db.projects.toArray();
            if (projects.length === 0) return null;
            
            // Sort by lastEditedAt (fallback to createdAt)
            projects.sort((a, b) => {
                const dateA = a.lastEditedAt || a.createdAt || new Date(0);
                const dateB = b.lastEditedAt || b.createdAt || new Date(0);
                return new Date(dateB) - new Date(dateA);
            });
            
            return projects[0];
        } catch (error) {
            console.error('Error getting latest project:', error);
            return null;
        }
    },

    /**
     * Update a project
     * @param {number} id - Project ID
     * @param {Object} updates - Fields to update
     */
    async updateProject(id, updates) {
        await db.projects.update(id, updates);
    },

    /**
     * Delete a project and its snapshots
     * @param {number} id - Project ID
     */
    async deleteProject(id) {
        await db.transaction('rw', db.projects, db.snapshots, async () => {
            await db.snapshots.where('projectId').equals(id).delete();
            await db.projects.delete(id);
        });
    },

    /**
     * Add a snapshot
     * @param {Object} snapshot - Snapshot data
     * @returns {Promise<number>} Snapshot ID
     */
    async addSnapshot(snapshot) {
        // Deduplicate tags before adding
        const tags = snapshot.tags && Array.isArray(snapshot.tags) 
            ? [...new Set(snapshot.tags)] 
            : [];
        
        const id = await db.snapshots.add({
            projectId: snapshot.projectId,
            timestamp: snapshot.timestamp, // Video time in seconds
            originalImage: snapshot.originalImage, // Blob or base64
            markedUpImage: snapshot.markedUpImage || null,
            fabricData: snapshot.fabricData || null, // Fabric.js JSON
            comment: snapshot.comment || '', // HTML content with inline colors
            tags: tags, // Deduplicated tags
            tagHours: snapshot.tagHours || {}, // Hours per tag for staffing
            createdAt: new Date()
        });
        
        // Update project's lastEditedAt timestamp
        if (snapshot.projectId) {
            await db.projects.update(snapshot.projectId, {
                lastEditedAt: new Date()
            });
        }
        
        return id;
    },

    /**
     * Get all snapshots for a project
     * @param {number} projectId - Project ID
     * @returns {Promise<Array>} Snapshots list
     */
    async getSnapshots(projectId) {
        const snapshots = await db.snapshots
            .where('projectId')
            .equals(projectId)
            .sortBy('timestamp');
        
        // Deduplicate tags in all snapshots
        return snapshots.map(snapshot => {
            if (snapshot.tags && Array.isArray(snapshot.tags)) {
                snapshot.tags = [...new Set(snapshot.tags)];
            }
            return snapshot;
        });
    },

    /**
     * Get a single snapshot
     * @param {number} id - Snapshot ID
     * @returns {Promise<Object>} Snapshot data
     */
    async getSnapshot(id) {
        const snapshot = await db.snapshots.get(id);
        
        // Deduplicate tags if present
        if (snapshot && snapshot.tags && Array.isArray(snapshot.tags)) {
            snapshot.tags = [...new Set(snapshot.tags)];
        }
        
        return snapshot;
    },

    /**
     * Update a snapshot
     * @param {number} id - Snapshot ID
     * @param {Object} updates - Fields to update
     */
    async updateSnapshot(id, updates) {
        // Deduplicate tags if provided
        if (updates.tags && Array.isArray(updates.tags)) {
            updates.tags = [...new Set(updates.tags)]; // Remove duplicates
        }
        
        await db.snapshots.update(id, updates);
        
        // Update project's lastEditedAt timestamp
        const snapshot = await db.snapshots.get(id);
        if (snapshot && snapshot.projectId) {
            await db.projects.update(snapshot.projectId, {
                lastEditedAt: new Date()
            });
        }
    },

    /**
     * Delete a snapshot
     * @param {number} id - Snapshot ID
     */
    async deleteSnapshot(id) {
        // Get snapshot before deleting to update project
        const snapshot = await db.snapshots.get(id);
        
        await db.snapshots.delete(id);
        
        // Update project's lastEditedAt timestamp
        if (snapshot && snapshot.projectId) {
            await db.projects.update(snapshot.projectId, {
                lastEditedAt: new Date()
            });
        }
    },

    /**
     * True if project record is an image-only (stills) project.
     * @param {Object} project
     * @returns {boolean}
     */
    isImageProjectRecord(project) {
        if (!project) return false;
        return !!(project.isImageProject || project.videoFileName === 'IMAGE_PROJECT');
    },

    /**
     * Merge multiple image projects into a new project. Snapshots are **copied**;
     * source projects and their snapshots are left unchanged.
     * @param {number[]} orderedProjectIds - Project IDs in merge order
     * @param {string} mergedName - Name for the new project
     * @returns {Promise<number>} New project id
     */
    async mergeImageProjects(orderedProjectIds, mergedName) {
        if (!orderedProjectIds || orderedProjectIds.length < 2) {
            throw new Error('Select at least two image projects to merge.');
        }

        const name =
            (mergedName && String(mergedName).trim()) ||
            `Merged stills (${orderedProjectIds.length} projects)`;

        const placeholderBlob = new Blob(['IMAGE_PROJECT'], { type: 'text/plain' });

        return await db.transaction('rw', db.projects, db.snapshots, async () => {
            const newProjectId = await db.projects.add({
                name,
                videoFileName: 'IMAGE_PROJECT',
                videoData: placeholderBlob,
                isImageProject: true,
                folderId: null,
                createdAt: new Date(),
                lastEditedAt: new Date()
            });

            let timestamp = 0;

            for (const projectId of orderedProjectIds) {
                const proj = await db.projects.get(projectId);
                if (!proj) continue;
                if (!Storage.isImageProjectRecord(proj)) continue;

                const snaps = await db.snapshots
                    .where('projectId')
                    .equals(projectId)
                    .sortBy('timestamp');

                for (const s of snaps) {
                    const tags = s.tags && Array.isArray(s.tags)
                        ? [...new Set(s.tags)]
                        : [];

                    await db.snapshots.add({
                        projectId: newProjectId,
                        timestamp: timestamp++,
                        originalImage: s.originalImage,
                        markedUpImage: s.markedUpImage || null,
                        fabricData: s.fabricData || null,
                        comment: s.comment || '',
                        tags,
                        tagHours: s.tagHours || {},
                        createdAt: new Date()
                    });
                }
            }

            if (timestamp === 0) {
                await db.projects.delete(newProjectId);
                throw new Error('No stills found in the selected projects.');
            }

            return newProjectId;
        });
    },

    /**
     * Clear all data (for debugging)
     */
    async clearAll() {
        await db.projects.clear();
        await db.snapshots.clear();
        await db.folders.clear();
    },

    // ========================================
    // Folder Management Methods
    // ========================================

    /**
     * Create a new folder
     * @param {string} name - Folder name
     * @param {string} color - Optional folder color
     * @returns {Promise<number>} Folder ID
     */
    async createFolder(name, color = null) {
        return await db.folders.add({
            name: name,
            color: color,
            createdAt: new Date()
        });
    },

    /**
     * Get a folder by ID
     * @param {number} id - Folder ID
     * @returns {Promise<Object>} Folder data
     */
    async getFolder(id) {
        return await db.folders.get(id);
    },

    /**
     * Get all folders
     * @returns {Promise<Array>} Array of folders
     */
    async getAllFolders() {
        return await db.folders.orderBy('name').toArray();
    },

    /**
     * Update a folder
     * @param {number} id - Folder ID
     * @param {Object} updates - Fields to update
     */
    async updateFolder(id, updates) {
        await db.folders.update(id, updates);
    },

    /**
     * Delete a folder
     * @param {number} id - Folder ID
     */
    async deleteFolder(id) {
        await db.folders.delete(id);
    },

    /**
     * Update a project's folder
     * @param {number} projectId - Project ID
     * @param {number|null} folderId - Folder ID (null = no folder)
     */
    async updateProjectFolder(projectId, folderId) {
        console.log('Storage.updateProjectFolder called:', { projectId, folderId });
        const result = await db.projects.update(projectId, {
            folderId: folderId,
            lastEditedAt: new Date()
        });
        console.log('Update result:', result);
        
        // Verify the update
        const project = await db.projects.get(projectId);
        console.log('Project after update:', project);
        return result;
    },

    /**
     * Get all projects in a folder
     * @param {number} folderId - Folder ID
     * @returns {Promise<Array>} Array of projects
     */
    async getProjectsByFolder(folderId) {
        return await db.projects
            .where('folderId')
            .equals(folderId)
            .sortBy('lastEditedAt');
    },

    /**
     * Get projects without a folder (root level)
     * @returns {Promise<Array>} Array of projects
     */
    async getProjectsWithoutFolder() {
        return await db.projects
            .where('folderId')
            .equals(null)
            .or('folderId')
            .equals(undefined)
            .sortBy('lastEditedAt');
    },

    /**
     * Move all projects from a folder to root level
     * @param {number} folderId - Folder ID
     */
    async moveProjectsToRoot(folderId) {
        const projects = await this.getProjectsByFolder(folderId);
        for (const project of projects) {
            await this.updateProjectFolder(project.id, null);
        }
    },

    /**
     * Delete all projects in a folder
     * @param {number} folderId - Folder ID
     */
    async deleteProjectsInFolder(folderId) {
        const projects = await this.getProjectsByFolder(folderId);
        for (const project of projects) {
            await this.deleteProject(project.id);
        }
    },

    /**
     * Export project data as JSON
     * @param {number} projectId - Project ID
     * @returns {Promise<Object>} Exportable project data
     */
    async exportProject(projectId) {
        const project = await this.getProject(projectId);
        const snapshots = await this.getSnapshots(projectId);
        
        return {
            project: {
                name: project.name,
                videoFileName: project.videoFileName,
                createdAt: project.createdAt
            },
            snapshots: snapshots.map(s => ({
                timestamp: s.timestamp,
                comment: s.comment,
                tags: s.tags,
                createdAt: s.createdAt
            }))
        };
    }
};

// Make Storage globally available
window.Storage = Storage;

