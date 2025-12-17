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
            createdAt: new Date()
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
            createdAt: p.createdAt
        }));
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
        return await db.snapshots.add({
            projectId: snapshot.projectId,
            timestamp: snapshot.timestamp, // Video time in seconds
            originalImage: snapshot.originalImage, // Blob or base64
            markedUpImage: snapshot.markedUpImage || null,
            fabricData: snapshot.fabricData || null, // Fabric.js JSON
            comment: snapshot.comment || '',
            commentColor: snapshot.commentColor || '#f0f0f2',
            tags: snapshot.tags || [],
            tagHours: snapshot.tagHours || {}, // Hours per tag for staffing
            createdAt: new Date()
        });
    },

    /**
     * Get all snapshots for a project
     * @param {number} projectId - Project ID
     * @returns {Promise<Array>} Snapshots list
     */
    async getSnapshots(projectId) {
        return await db.snapshots
            .where('projectId')
            .equals(projectId)
            .sortBy('timestamp');
    },

    /**
     * Get a single snapshot
     * @param {number} id - Snapshot ID
     * @returns {Promise<Object>} Snapshot data
     */
    async getSnapshot(id) {
        return await db.snapshots.get(id);
    },

    /**
     * Update a snapshot
     * @param {number} id - Snapshot ID
     * @param {Object} updates - Fields to update
     */
    async updateSnapshot(id, updates) {
        await db.snapshots.update(id, updates);
    },

    /**
     * Delete a snapshot
     * @param {number} id - Snapshot ID
     */
    async deleteSnapshot(id) {
        await db.snapshots.delete(id);
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

