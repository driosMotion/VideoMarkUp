/**
 * Project Sharing Module
 * Handles export/import of projects as .zip files
 */

const ProjectSharing = {
    /**
     * Initialize project sharing
     */
    init() {
        this.setupEventListeners();
    },

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        const exportBtn = document.getElementById('exportProjectBtn');
        const importBtn = document.getElementById('importProjectBtn');
        const importInput = document.getElementById('importProjectInput');

        exportBtn.addEventListener('click', () => this.exportProject());
        importBtn.addEventListener('click', () => importInput.click());
        importInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.importProject(e.target.files[0]);
                e.target.value = ''; // Reset for future imports
            }
        });
    },

    /**
     * Export current project as .zip file
     */
    async exportProject() {
        if (!VideoHandler.currentProjectId) {
            App.showToast('No project to export', 'error');
            return;
        }

        App.showToast('Preparing project package...', 'info');

        try {
            const zip = new JSZip();
            
            // Get project data
            const project = await Storage.getProject(VideoHandler.currentProjectId);
            const snapshots = await Storage.getSnapshots(VideoHandler.currentProjectId);

            // Create project manifest
            const manifest = {
                version: '1.0',
                name: project.name,
                videoFileName: project.videoFileName,
                createdAt: project.createdAt,
                exportedAt: new Date().toISOString(),
                snapshotCount: snapshots.length
            };
            zip.file('manifest.json', JSON.stringify(manifest, null, 2));

            // Add video file
            if (project.videoData) {
                zip.file(`video/${project.videoFileName}`, project.videoData);
            }

            // Add snapshots
            const snapshotsData = [];
            for (let i = 0; i < snapshots.length; i++) {
                const snapshot = snapshots[i];
                const snapshotFolder = `snapshots/${i.toString().padStart(4, '0')}`;
                
                // Save snapshot metadata
                const snapshotMeta = {
                    id: snapshot.id,
                    timestamp: snapshot.timestamp,
                    comment: snapshot.comment,
                    tags: snapshot.tags,
                    tagHours: snapshot.tagHours,
                    createdAt: snapshot.createdAt
                };
                snapshotsData.push(snapshotMeta);

                // Save original image
                if (snapshot.originalImage) {
                    const imgData = this.dataURLtoBlob(snapshot.originalImage);
                    zip.file(`${snapshotFolder}/original.png`, imgData);
                }

                // Save marked up image
                if (snapshot.markedUpImage) {
                    const imgData = this.dataURLtoBlob(snapshot.markedUpImage);
                    zip.file(`${snapshotFolder}/markup.png`, imgData);
                }

                // Save fabric data
                if (snapshot.fabricData) {
                    zip.file(`${snapshotFolder}/fabric.json`, JSON.stringify(snapshot.fabricData));
                }
            }

            // Save all snapshot metadata
            zip.file('snapshots.json', JSON.stringify(snapshotsData, null, 2));

            // Generate zip file
            const content = await zip.generateAsync({ 
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            }, (metadata) => {
                // Progress callback
                if (metadata.percent) {
                    console.log(`Zipping: ${metadata.percent.toFixed(0)}%`);
                }
            });

            // Download the file
            const fileName = `${project.name.replace(/[^a-z0-9]/gi, '_')}_${this.formatDate(new Date())}.zip`;
            this.downloadBlob(content, fileName);

            App.showToast('Project exported successfully!', 'success');
        } catch (error) {
            console.error('Export error:', error);
            App.showToast('Error exporting project', 'error');
        }
    },

    /**
     * Import a project from .zip file
     * @param {File} file - The zip file to import
     */
    async importProject(file) {
        App.showToast('Importing project...', 'info');

        try {
            const zip = await JSZip.loadAsync(file);

            // Read manifest
            const manifestFile = zip.file('manifest.json');
            if (!manifestFile) {
                throw new Error('Invalid project file: missing manifest');
            }
            const manifest = JSON.parse(await manifestFile.async('text'));

            // Read video file
            const videoFiles = zip.folder('video').file(/.*/);
            if (videoFiles.length === 0) {
                throw new Error('Invalid project file: missing video');
            }
            const videoBlob = await videoFiles[0].async('blob');

            // Create new project in storage
            const projectId = await Storage.createProject({
                name: manifest.name + ' (imported)',
                videoFileName: manifest.videoFileName,
                videoData: videoBlob
            });

            // Read snapshots metadata
            const snapshotsFile = zip.file('snapshots.json');
            const snapshotsData = snapshotsFile ? JSON.parse(await snapshotsFile.async('text')) : [];

            // Import each snapshot
            for (let i = 0; i < snapshotsData.length; i++) {
                const snapshotMeta = snapshotsData[i];
                const snapshotFolder = `snapshots/${i.toString().padStart(4, '0')}`;

                // Read original image
                const originalFile = zip.file(`${snapshotFolder}/original.png`);
                const originalImage = originalFile ? await this.blobToDataURL(await originalFile.async('blob')) : null;

                // Read markup image
                const markupFile = zip.file(`${snapshotFolder}/markup.png`);
                const markedUpImage = markupFile ? await this.blobToDataURL(await markupFile.async('blob')) : null;

                // Read fabric data
                const fabricFile = zip.file(`${snapshotFolder}/fabric.json`);
                const fabricData = fabricFile ? JSON.parse(await fabricFile.async('text')) : null;

                // Add snapshot to storage
                await Storage.addSnapshot({
                    projectId: projectId,
                    timestamp: snapshotMeta.timestamp,
                    originalImage: originalImage,
                    markedUpImage: markedUpImage,
                    fabricData: fabricData,
                    comment: snapshotMeta.comment || '',
                    tags: snapshotMeta.tags || [],
                    tagHours: snapshotMeta.tagHours || {}
                });
            }

            // Clear current view and load the imported project
            SnapshotManager.clearList();
            await VideoHandler.loadProject(projectId);

            App.showToast(`Project imported: ${manifest.name}`, 'success');
        } catch (error) {
            console.error('Import error:', error);
            App.showToast('Error importing project: ' + error.message, 'error');
        }
    },

    /**
     * Convert data URL to Blob
     * @param {string} dataURL
     * @returns {Blob}
     */
    dataURLtoBlob(dataURL) {
        const parts = dataURL.split(',');
        const mime = parts[0].match(/:(.*?);/)[1];
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    },

    /**
     * Convert Blob to data URL
     * @param {Blob} blob
     * @returns {Promise<string>}
     */
    blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    },

    /**
     * Download a blob as a file
     * @param {Blob} blob
     * @param {string} fileName
     */
    downloadBlob(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Format date as YYYY-MM-DD
     * @param {Date} date
     * @returns {string}
     */
    formatDate(date) {
        return date.toISOString().split('T')[0];
    }
};

// Make ProjectSharing globally available
window.ProjectSharing = ProjectSharing;

