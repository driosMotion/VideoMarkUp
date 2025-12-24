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

// Version 2: Add lastEditedAt index for efficient querying
db.version(2).stores({
    projects: '++id, name, createdAt, lastEditedAt',
    snapshots: '++id, projectId, timestamp, createdAt'
}).upgrade(async tx => {
    // Add lastEditedAt to existing projects
    const projects = await tx.table('projects').toArray();
    for (const project of projects) {
        if (!project.lastEditedAt) {
            await tx.table('projects').update(project.id, {
                lastEditedAt: project.createdAt || new Date()
            });
        }
    }
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
            lastEditedAt: p.lastEditedAt
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
     * Clear all data (for debugging)
     */
    async clearAll() {
        await db.projects.clear();
        await db.snapshots.clear();
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

