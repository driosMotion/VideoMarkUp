/**
 * Snapshot Manager Module - Inline Editing Version
 * Handles capturing, storing, and displaying snapshots with inline editing
 */

// #region agent log
console.log('[BUILD] snapshot-manager.js loaded buildStamp=debug-2025-12-23-1');
// #endregion

const SnapshotManager = {
    snapshots: [],
    currentSnapshotId: null,
    quickCommentSnapshotId: null,
    isCreatingSnapshot: false,
    _inlineTagsDelegationBound: false,
    currentImageIndex: 0, // For image-only projects
    _reorderDraggingCard: null,
    _snapshotOrderBeforeDrag: null,
    _snapshotReorderDelegatesBound: false,

    /**
     * Insert point for reorder: card to insert BEFORE, or null to append dragging card at end.
     * @param {HTMLElement} list
     * @param {HTMLElement} draggingCard
     * @param {number} mouseY
     * @returns {HTMLElement|null}
     */
    getReorderInsertBeforeCard(list, draggingCard, mouseY) {
        const siblings = [
            ...list.querySelectorAll('.snapshot-card')
        ].filter((c) => c !== draggingCard && c.parentNode === list);

        if (siblings.length === 0) return null;

        let closestBelow = /** @type {{ offset: number, el: HTMLElement } | null} */ (
            null
        );

        siblings.forEach((child) => {
            const box = child.getBoundingClientRect();
            const offset = mouseY - box.top - box.height / 2;
            if (offset < 0) {
                if (!closestBelow || offset > closestBelow.offset) {
                    closestBelow = { offset, el: child };
                }
            }
        });

        if (closestBelow) return closestBelow.el;

        return null;
    },

    /** @param {HTMLElement} card */
    updateCardTimestampDisplay(card, timestamp) {
        const ts = Number(timestamp);
        card.dataset.timestamp = String(ts);

        const tcEl = card.querySelector('.snapshot-card-timecode');
        if (tcEl && window.VideoHandler && typeof VideoHandler.formatTimecode === 'function') {
            tcEl.textContent = VideoHandler.formatTimecode(ts);
        }

        const img = card.querySelector('.snapshot-card-thumbnail img');
        if (
            img &&
            window.VideoHandler &&
            typeof VideoHandler.formatTimecode === 'function'
        ) {
            img.alt = `Snapshot at ${VideoHandler.formatTimecode(ts)}`;
        }
    },

    /**
     * After drag-reorder on image projects, persist timestamp order as 0..n-1.
     */
    async persistSnapshotReorderFromDOM() {
        if (
            !VideoHandler?.isImageProject ||
            !VideoHandler?.currentProjectId
        ) {
            return;
        }

        const list = document.getElementById('snapshotsList');
        if (!list) return;

        const cards = [...list.querySelectorAll('.snapshot-card')];
        if (cards.length === 0) return;

        const orderIds = cards.map((c) => Number(c.dataset.id));
        if (
            this._snapshotOrderBeforeDrag &&
            JSON.stringify(orderIds) ===
                JSON.stringify(this._snapshotOrderBeforeDrag)
        ) {
            this._snapshotOrderBeforeDrag = null;
            return;
        }
        this._snapshotOrderBeforeDrag = null;

        const updates = [];
        let idx = 0;

        for (const card of cards) {
            const id = Number(card.dataset.id);
            const newTs = idx++;
            const snap = this.snapshots.find((s) => s.id === id);

            this.updateCardTimestampDisplay(card, newTs);

            if (snap && snap.timestamp !== newTs) {
                snap.timestamp = newTs;
                updates.push(Storage.updateSnapshot(id, { timestamp: newTs }));
            }
        }

        if (updates.length > 0) {
            await Promise.all(updates);
        }

        this.updateSnapshotNumbers();
    },

    /**
     * Delegated drag/drop for snapshot card reorder (image projects only).
     */
    setupSnapshotImageReorderDelegates() {
        const list = document.getElementById('snapshotsList');
        if (!list || this._snapshotReorderDelegatesBound) return;
        this._snapshotReorderDelegatesBound = true;

        list.addEventListener(
            'dragstart',
            (e) => {
                const handle = e.target.closest('.snapshot-card-drag-handle');
                if (!handle || !VideoHandler?.isImageProject) return;

                e.stopPropagation();

                const card = handle.closest('.snapshot-card');
                if (!card || !list.contains(card)) return;

                this._reorderDraggingCard = card;
                this._snapshotOrderBeforeDrag = [
                    ...list.querySelectorAll('.snapshot-card')
                ].map((c) => Number(c.dataset.id));

                card.classList.add('snapshot-card--dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(card.dataset.id));
            },
            true
        );

        list.addEventListener('dragend', async (e) => {
            const handle = e.target.closest('.snapshot-card-drag-handle');
            if (!handle) return;

            e.stopPropagation();

            const card = handle.closest('.snapshot-card');
            if (card) {
                card.classList.remove('snapshot-card--dragging');
            }

            this._reorderDraggingCard = null;
            try {
                await this.persistSnapshotReorderFromDOM();
            } catch (err) {
                console.error('Snapshot reorder persist failed:', err);
                App.showToast('Could not save new order', 'error');
            }
        });

        list.addEventListener('dragover', (e) => {
            if (!this._reorderDraggingCard || !VideoHandler?.isImageProject) {
                return;
            }
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            const dragging = this._reorderDraggingCard;
            const insertBefore = this.getReorderInsertBeforeCard(
                list,
                dragging,
                e.clientY
            );

            if (insertBefore == null) {
                if (dragging.nextSibling !== null || dragging.parentNode !== list) {
                    list.appendChild(dragging);
                }
            } else if (insertBefore !== dragging) {
                list.insertBefore(dragging, insertBefore);
            }
        });

        list.addEventListener('drop', (e) => {
            if (!VideoHandler?.isImageProject) return;
            e.preventDefault();
        });
    },

    /**
     * Reset ONLY the tags/hours UI (does not clear comment)
     */
    resetInlineTagsUI() {
        const inlinePanel = document.querySelector('.tags-grid-inline');
        if (!inlinePanel) return;

        inlinePanel.querySelectorAll('.tag-btn').forEach(btn => btn.classList.remove('active'));
        inlinePanel.querySelectorAll('.tag-hours-input').forEach(input => (input.value = ''));

        // #region agent log
        console.log('[DEBUG-PLAY-RESET] resetInlineTagsUI cleared tags/hours');
        // #endregion
    },

    /**
     * Enter = new paragraph (block), Shift+Enter = soft line inside same block.
     * Makes HTML consistent across browsers and matches PDF soft vs paragraph breaks.
     * @param {HTMLElement | null} el
     */
    setupRichCommentEnter(el) {
        if (!el) return;
        el.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            if (e.isComposing) return;
            e.preventDefault();
            if (e.shiftKey) {
                document.execCommand('insertLineBreak');
            } else {
                document.execCommand('insertParagraph');
            }
        });
    },

    /**
     * Initialize snapshot manager
     */
    init() {
        // #region agent log
        console.log('[DEBUG-INIT] SnapshotManager.init() called at', new Date().toISOString());
        // #endregion
        this.setupEventListeners();
        this.initAddStillsImport();
        this.initReplaceStillAsset();
        this.setupSnapshotImageReorderDelegates();
        // #region agent log
        console.log('[DEBUG-INIT] SnapshotManager.init() completed');
        // #endregion
    },

    /**
     * Refresh UI for image-only project controls (sidebar + toolbar).
     */
    syncImageProjectExtras() {
        this.syncAddStillsImportButton();
        this.syncReplaceStillAssetButton();
    },

    /**
     * Show “add stills” only for image-only projects with an open project.
     */
    syncAddStillsImportButton() {
        const btn = document.getElementById('addStillsImagesBtn');
        if (!btn) return;
        const show = !!(
            VideoHandler &&
            VideoHandler.isImageProject &&
            VideoHandler.currentProjectId
        );
        btn.hidden = !show;
    },

    /**
     * Tools bar: replace underlying still (image projects only).
     */
    syncReplaceStillAssetButton() {
        const btn = document.getElementById('replaceStillAssetBtn');
        if (!btn) return;
        const eligible = !!(
            VideoHandler?.isImageProject &&
            VideoHandler?.currentProjectId &&
            this.snapshots?.length > 0
        );
        btn.hidden = !eligible;
        if (eligible) {
            btn.disabled = !this.getTargetSnapshotIdForReplace();
        } else {
            btn.disabled = false;
        }
    },

    /**
     * Snapshot to use for “replace still” when in image mode.
     * @returns {number|null}
     */
    getTargetSnapshotIdForReplace() {
        if (!VideoHandler?.isImageProject || !this.snapshots?.length) {
            return null;
        }
        if (this.currentSnapshotId) {
            return this.currentSnapshotId;
        }
        if (window.DrawingTool?.activeSnapshotId) {
            return DrawingTool.activeSnapshotId;
        }

        const sorted = [...this.snapshots].sort(
            (a, b) => a.timestamp - b.timestamp
        );
        if (sorted.length === 1) {
            return sorted[0].id;
        }

        const o = document.getElementById('snapshotOverlay');
        if (o && !o.hidden && (o.getAttribute('src') || o.src)) {
            return sorted[0].id;
        }
        return null;
    },

    initReplaceStillAsset() {
        const btn = document.getElementById('replaceStillAssetBtn');
        const input = document.getElementById('replaceStillAssetInput');
        if (!btn || !input) return;

        btn.addEventListener('click', () => {
            if (!VideoHandler?.isImageProject) {
                App.showToast(
                    'Replace still is only available in image projects.',
                    'info'
                );
                return;
            }
            this.syncReplaceStillAssetButton();
            if (!this.getTargetSnapshotIdForReplace()) {
                App.showToast(
                    'Select a snapshot first (click a card in the list).',
                    'warning'
                );
                return;
            }
            input.value = '';
            input.click();
        });

        input.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            await this.replaceStillAssetFromFile(file);
            input.value = '';
        });

        this.syncReplaceStillAssetButton();
    },

    /**
     * Replace stored image for target snapshot; clears fabric/markedUpImage.
     * @param {File} file
     */
    async replaceStillAssetFromFile(file) {
        if (!file?.type?.startsWith('image/')) {
            App.showToast('Choose an image file', 'warning');
            return;
        }
        if (!VideoHandler?.isImageProject || !VideoHandler?.currentProjectId) {
            App.showToast('Open an image project first.', 'warning');
            return;
        }

        const id = this.getTargetSnapshotIdForReplace();
        if (!id) {
            App.showToast(
                'Select a snapshot first (click a card in the list).',
                'warning'
            );
            return;
        }

        if (
            !confirm(
                'Replace this still? Markups drawn on the image will be removed. Tags and comment are kept.'
            )
        ) {
            return;
        }

        if (DrawingTool.autoSaveTimeout) {
            clearTimeout(DrawingTool.autoSaveTimeout);
            DrawingTool.autoSaveTimeout = null;
        }
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
            this.autoSaveTimeout = null;
        }

        try {
            const dataUrl = await VideoHandler.readImageAsDataURL(file);

            await Storage.updateSnapshot(id, {
                originalImage: dataUrl,
                fabricData: null,
                markedUpImage: null
            });

            const snapshot = await Storage.getSnapshot(id);
            const ix = this.snapshots.findIndex((s) => s.id === id);
            if (ix >= 0) {
                this.snapshots[ix] = snapshot;
            }

            const card = document.querySelector(
                `.snapshot-card[data-id="${id}"]`
            );
            if (card && snapshot) {
                card.classList.remove('has-markup');
                const img = card.querySelector('.snapshot-card-thumbnail img');
                const thumb = snapshot.markedUpImage || snapshot.originalImage;
                if (img && thumb) {
                    img.src = thumb;
                }
            }

            const editingThis =
                this.currentSnapshotId === id ||
                DrawingTool.activeSnapshotId === id;

            if (editingThis) {
                await this.enterInlineEditMode(id, dataUrl, null, true);
            } else if (VideoHandler.isImageProject) {
                const o = document.getElementById('snapshotOverlay');
                if (o && !o.hidden) {
                    const sorted = [...this.snapshots].sort(
                        (a, b) => a.timestamp - b.timestamp
                    );
                    if (sorted[0] && sorted[0].id === id) {
                        o.src = dataUrl;
                    }
                }
            }

            this.syncReplaceStillAssetButton();
            App.showToast('Still image replaced', 'success');
        } catch (err) {
            console.error('replaceStillAssetFromFile:', err);
            App.showToast('Could not replace still image', 'error');
        }
    },

    /**
     * Sidebar: add more image files as snapshots (image projects only).
     */
    initAddStillsImport() {
        const btn = document.getElementById('addStillsImagesBtn');
        const input = document.getElementById('addStillsImagesInput');
        if (!btn || !input) return;

        btn.addEventListener('click', () => {
            if (!VideoHandler?.isImageProject) {
                App.showToast(
                    'Add stills is only available in image projects.',
                    'info'
                );
                return;
            }
            if (!VideoHandler?.currentProjectId) {
                App.showToast('No project loaded', 'warning');
                return;
            }
            input.value = '';
            input.click();
        });

        input.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files || []).filter((f) =>
                f.type.startsWith('image/')
            );
            if (files.length === 0) return;
            await this.appendStillsFromImageFiles(files);
            input.value = '';
        });

        this.syncImageProjectExtras();
    },

    /**
     * Append still images from the file picker after the highest snapshot order.
     * @param {File[]} files - Image File objects
     */
    async appendStillsFromImageFiles(files) {
        if (
            !VideoHandler?.currentProjectId ||
            !VideoHandler?.isImageProject
        ) {
            App.showToast('Open an image project to add stills.', 'warning');
            return;
        }

        const projectId = VideoHandler.currentProjectId;
        const maxTs = this.snapshots.reduce((max, s) => {
            const t = Number(s.timestamp);
            return Number.isFinite(t) ? Math.max(max, t) : max;
        }, -1);

        App.showToast(`Adding ${files.length} image(s)...`, 'info');

        let added = 0;
        let lastSnapshot = null;
        let nextTs = maxTs + 1;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const dataUrl = await VideoHandler.readImageAsDataURL(file);
                const ts = nextTs++;
                const id = await this.createSnapshotFromImage(
                    projectId,
                    dataUrl,
                    file.name,
                    ts
                );
                const snapshot = await Storage.getSnapshot(id);
                if (
                    snapshot &&
                    !this.snapshots.some((x) => x.id === snapshot.id)
                ) {
                    this.snapshots.push(snapshot);
                }
                if (snapshot) {
                    this.addSnapshotToList(snapshot);
                    added++;
                    lastSnapshot = snapshot;
                }
            } catch (err) {
                console.error(`Error adding image ${file.name}:`, err);
            }
        }

        this.sortSnapshotsByTimecode();
        this.updateSnapshotCount();

        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
            emptyState.hidden = this.snapshots.length > 0;
        }

        if (lastSnapshot) {
            const overlay = document.getElementById('snapshotOverlay');
            if (overlay) {
                overlay.src =
                    lastSnapshot.originalImage || lastSnapshot.imageData;
            }
            await this.enterInlineEditMode(lastSnapshot.id);
        }

        App.showToast(
            added === files.length
                ? `Added ${added} still(s)`
                : `Added ${added} of ${files.length} image(s)`,
            added > 0 ? 'success' : 'warning'
        );

        this.syncImageProjectExtras();
    },

    /**
     * Find a snapshot at the current video timestamp
     * @param {number} timestamp - Video timestamp in seconds
     * @returns {Promise<Object|null>} Snapshot or null
     */
    async findSnapshotAtTime(timestamp) {
        const snapshots = await Storage.getSnapshots(VideoHandler.currentProjectId);
        // Allow 0.1 second tolerance for floating point comparison
        return snapshots.find(s => Math.abs(s.timestamp - timestamp) < 0.1) || null;
    },

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // #region agent log
        console.log('[DEBUG-INIT] snapshot-manager.js:33 - setupEventListeners called');
        // #endregion
        
        const commentInputInline = document.getElementById('commentInputInline');
        const commentInputModal = document.getElementById('commentInput');

        // Comment input - auto-create snapshot on first character
        if (commentInputInline) {
            commentInputInline.addEventListener('input', () => {
                this.handleCommentInput();
            });
        }
        this.setupRichCommentEnter(commentInputInline);
        this.setupRichCommentEnter(commentInputModal);

        // Inline tags/hours: use EVENT DELEGATION so it still works after TagEditor.updateTagsPanel()
        const inlinePanel = document.querySelector('.tags-grid-inline');
        // #region agent log
        console.log('[DEBUG-INIT] snapshot-manager.js:48 - Inline panel found:', !!inlinePanel, 'delegationBound=', this._inlineTagsDelegationBound);
        // #endregion

        if (inlinePanel && !this._inlineTagsDelegationBound) {
            this._inlineTagsDelegationBound = true;

            // #region agent log
            console.log('[DEBUG-INIT] Binding inline tag delegation listeners');
            // #endregion

            inlinePanel.addEventListener('click', async (event) => {
                const btn = event.target.closest('.tag-btn');
                if (!btn) return;

                const tag = btn.dataset.tag;
                // #region agent log
                console.log('🔥🔥🔥 [DEBUG-TAG-CLICK] delegated click', { tag, currentSnapshotId: this.currentSnapshotId });
                // #endregion

                // Toggle UI state
                btn.classList.toggle('active');
                const isNowActive = btn.classList.contains('active');

                const focusHoursForTag = () => {
                    const hoursInput = inlinePanel.querySelector(`.tag-hours-input[data-tag="${tag}"]`);
                    if (hoursInput) {
                        hoursInput.focus();
                        if (typeof hoursInput.select === 'function') {
                            hoursInput.select();
                        }
                        // #region agent log
                        console.log('[DEBUG-FOCUS] Focused hours input after tag click', { tag });
                        // #endregion
                    }
                };

                // If user is starting tagging with no snapshot yet, create snapshot now (pause required for capture)
                if (!this.currentSnapshotId && VideoHandler.video && !VideoHandler.video.paused) {
                    VideoHandler.video.pause();
                }
                if (!this.currentSnapshotId && VideoHandler.video && VideoHandler.video.paused) {
                    // Collect current inline tag state BEFORE creating snapshot (so it doesn't get reset)
                    const initialTags = Array.from(inlinePanel.querySelectorAll('.tag-btn.active')).map(b => b.dataset.tag);
                    const initialTagHours = {};
                    inlinePanel.querySelectorAll('.tag-hours-input').forEach(input => {
                        const v = parseFloat(input.value);
                        if (!isNaN(v) && v > 0) {
                            initialTagHours[input.dataset.tag] = v;
                        }
                    });
                    // #region agent log
                    console.log('[DEBUG-TAG-CLICK] Creating snapshot with initial tags/hours from UI', {
                        initialTags,
                        initialTagHours
                    });
                    // #endregion
                    // #region agent log
                    console.log('[DEBUG-TAG-CLICK] No snapshot exists, creating one from tag click');
                    // #endregion
                    await this.captureSnapshotWithComment('', initialTags, initialTagHours);
                }

                // Save immediately
                if (this.currentSnapshotId) {
                    this.triggerAutoSave(true);
                }

                // UX: when activating a tag, focus its hours input
                if (isNowActive) {
                    // Use rAF to ensure focus persists even if enterInlineEditMode updates the DOM
                    requestAnimationFrame(() => focusHoursForTag());
                }
            });

            // UX: if user clicks into an hours box, make the tag active immediately (visual)
            inlinePanel.addEventListener('focusin', (event) => {
                const input = event.target.closest('.tag-hours-input');
                if (!input) return;
                const tag = input.dataset.tag;
                const tagBtn = inlinePanel.querySelector(`.tag-btn[data-tag="${tag}"]`);
                if (tagBtn && !tagBtn.classList.contains('active')) {
                    tagBtn.classList.add('active');
                    // #region agent log
                    console.log('[DEBUG-FOCUS] Activated tag on hours focus', { tag });
                    // #endregion
                }
            });

            // Debounced save while typing hours (bubbles)
            inlinePanel.addEventListener('input', async (event) => {
                const input = event.target.closest('.tag-hours-input');
                if (!input) return;
                const tag = input.dataset.tag;
                // #region agent log
                console.log('💰💰💰 [DEBUG-H2] delegated input', { tag, value: input.value, currentSnapshotId: this.currentSnapshotId });
                // #endregion

                // If user starts typing hours with no snapshot yet, create snapshot now
                if (!this.currentSnapshotId && VideoHandler.video && !VideoHandler.video.paused) {
                    VideoHandler.video.pause();
                }

                // Ensure tag is active as soon as hours are typed
                const tagBtn = inlinePanel.querySelector(`.tag-btn[data-tag="${tag}"]`);
                if (tagBtn && !tagBtn.classList.contains('active') && input.value) {
                    tagBtn.classList.add('active');
                    // #region agent log
                    console.log('[DEBUG-H2] Activated tag due to hours typing', { tag });
                    // #endregion
                }

                if (!this.currentSnapshotId && VideoHandler.video && VideoHandler.video.paused && input.value) {
                    // If hours are being entered, ensure the tag is visually active (handled above)

                    const initialTags = Array.from(inlinePanel.querySelectorAll('.tag-btn.active')).map(b => b.dataset.tag);
                    const initialTagHours = {};
                    inlinePanel.querySelectorAll('.tag-hours-input').forEach(inp => {
                        const v = parseFloat(inp.value);
                        if (!isNaN(v) && v > 0) {
                            initialTagHours[inp.dataset.tag] = v;
                        }
                    });
                    // #region agent log
                    console.log('[DEBUG-H2] Creating snapshot with initial tags/hours from hours typing', {
                        initialTags,
                        initialTagHours
                    });
                    // #endregion
                    // #region agent log
                    console.log('[DEBUG-H2] No snapshot exists, creating one from hours typing');
                    // #endregion
                    await this.captureSnapshotWithComment('', initialTags, initialTagHours);
                }

                if (this.currentSnapshotId) {
                    this.triggerAutoSave(false);
                }
            });

            // Immediate save when leaving hours field (focusout bubbles)
            inlinePanel.addEventListener('focusout', async (event) => {
                const input = event.target.closest('.tag-hours-input');
                if (!input) return;
                const tag = input.dataset.tag;
                // #region agent log
                console.log('[DEBUG-H1] delegated focusout (blur)', { tag, value: input.value, currentSnapshotId: this.currentSnapshotId });
                // #endregion

                if (!this.currentSnapshotId && VideoHandler.video && !VideoHandler.video.paused) {
                    VideoHandler.video.pause();
                }
                if (!this.currentSnapshotId && VideoHandler.video && VideoHandler.video.paused && input.value) {
                    // If hours exist, ensure the tag is visually active
                    const tagBtn = inlinePanel.querySelector(`.tag-btn[data-tag="${tag}"]`);
                    if (tagBtn && !tagBtn.classList.contains('active')) {
                        tagBtn.classList.add('active');
                    }

                    const initialTags = Array.from(inlinePanel.querySelectorAll('.tag-btn.active')).map(b => b.dataset.tag);
                    const initialTagHours = {};
                    inlinePanel.querySelectorAll('.tag-hours-input').forEach(inp => {
                        const v = parseFloat(inp.value);
                        if (!isNaN(v) && v > 0) {
                            initialTagHours[inp.dataset.tag] = v;
                        }
                    });
                    // #region agent log
                    console.log('[DEBUG-H1] Creating snapshot with initial tags/hours from hours blur', {
                        initialTags,
                        initialTagHours
                    });
                    // #endregion
                    // #region agent log
                    console.log('[DEBUG-H1] No snapshot exists, creating one from hours blur');
                    // #endregion
                    await this.captureSnapshotWithComment('', initialTags, initialTagHours);
                }

                if (this.currentSnapshotId) {
                    this.triggerAutoSave(true);
                }
            });
        }

        // Delete All Snapshots button
        const deleteAllBtn = document.getElementById('deleteAllSnapshotsBtn');
        if (deleteAllBtn) {
            deleteAllBtn.addEventListener('click', () => {
                this.showDeleteAllModal();
            });
        }

        // Delete All Modal - Cancel
        const cancelDeleteAllBtn = document.getElementById('cancelDeleteAll');
        if (cancelDeleteAllBtn) {
            cancelDeleteAllBtn.addEventListener('click', () => {
                this.hideDeleteAllModal();
            });
        }

        // Delete All Modal - Confirm
        const confirmDeleteAllBtn = document.getElementById('confirmDeleteAll');
        if (confirmDeleteAllBtn) {
            confirmDeleteAllBtn.addEventListener('click', async () => {
                await this.deleteAllSnapshots();
                this.hideDeleteAllModal();
            });
        }

        // Delete All Modal - Close on overlay click
        const deleteAllModal = document.getElementById('deleteAllModal');
        if (deleteAllModal) {
            deleteAllModal.addEventListener('click', (e) => {
                if (e.target === deleteAllModal) {
                    this.hideDeleteAllModal();
                }
            });
        }

        // Delete All Modal - Close on Escape (guard against multiple bindings)
        if (!this._deleteAllEscapeListenerBound) {
            this._deleteAllEscapeListenerBound = true;
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    const deleteAllModal = document.getElementById('deleteAllModal');
                    if (deleteAllModal && !deleteAllModal.hidden) {
                        this.hideDeleteAllModal();
                    }
                }
            });
        }
    },

    /**
     * Handle comment input
     */
    async handleCommentInput() {
        if (!VideoHandler.currentProjectId) return;

        const commentInputInline = document.getElementById('commentInputInline');
        const text = commentInputInline.textContent.trim();
        const html = commentInputInline.innerHTML;

        // If already editing a snapshot (either via click or quick comment), just auto-save
        if (this.currentSnapshotId || this.quickCommentSnapshotId) {
            this.triggerAutoSave();
            return;
        }

        // If already creating a snapshot, don't create another
        if (this.isCreatingSnapshot) {
            return;
        }

        // Check if snapshot already exists at current timestamp
        const currentTime = VideoHandler.video.currentTime;
        const existingSnapshot = await this.findSnapshotAtTime(currentTime);
        
        if (existingSnapshot) {
            // Load existing snapshot for editing
            this.currentSnapshotId = existingSnapshot.id;
            this.quickCommentSnapshotId = existingSnapshot.id;
            await this.enterInlineEditMode(existingSnapshot.id);
            return;
        }

        // Only create new snapshot if no snapshot is being edited and text is entered
        if (text.length > 0) {
            this.isCreatingSnapshot = true;
            await this.captureSnapshotWithComment(html);
            this.isCreatingSnapshot = false;
        }
    },

    /**
     * Show delete all snapshots confirmation modal
     */
    showDeleteAllModal() {
        const modal = document.getElementById('deleteAllModal');
        if (modal) {
            modal.hidden = false;
        }
    },

    /**
     * Hide delete all snapshots confirmation modal
     */
    hideDeleteAllModal() {
        const modal = document.getElementById('deleteAllModal');
        if (modal) {
            modal.hidden = true;
        }
    },

    /**
     * Delete all snapshots for the current project
     */
    async deleteAllSnapshots() {
        if (!VideoHandler.currentProjectId) {
            console.error('No current project ID');
            return;
        }

        try {
            console.log('Deleting all snapshots for project:', VideoHandler.currentProjectId);
            
            // Get all snapshots for current project
            const snapshots = await Storage.getSnapshots(VideoHandler.currentProjectId);
            console.log('Found snapshots to delete:', snapshots.length);
            
            // Delete each snapshot
            for (const snapshot of snapshots) {
                console.log('Deleting snapshot:', snapshot.id);
                await Storage.deleteSnapshot(snapshot.id);
            }

            console.log('All snapshots deleted successfully');

            // Clear internal state
            this.snapshots = [];
            this.currentSnapshotId = null;
            this.quickCommentSnapshotId = null;
            
            // Clear the UI list
            const snapshotsList = document.getElementById('snapshotsList');
            if (snapshotsList) {
                snapshotsList.innerHTML = `
                    <div class="empty-state" id="emptyState">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                        <p>No snapshots yet</p>
                        <span>Type a comment or select a tool to capture your first snapshot</span>
                    </div>
                `;
            }
            
            // Update snapshot count
            this.updateSnapshotCount();
            
            // Clear timeline markers
            const markersContainer = document.getElementById('snapshotMarkers');
            if (markersContainer) {
                markersContainer.innerHTML = '';
            }
            
            // Clear the inline edit mode
            this.exitInlineEditMode();
            
            // Hide any markups
            DrawingTool.hideMarkups();
            
            App.showToast('All snapshots deleted', 'success');
        } catch (error) {
            console.error('Error deleting all snapshots:', error);
            console.error('Error stack:', error.stack);
            App.showToast('Failed to delete snapshots', 'error');
        }
    },

    /**
     * Capture snapshot with initial comment and enter edit mode
     * @param {string} initialComment - Initial comment HTML
     * @param {Array<string>} initialTags - Optional initial tags (for tag-first workflows)
     * @param {Object} initialTagHours - Optional initial tag hours map
     */
    async captureSnapshotWithComment(initialComment = '', initialTags = null, initialTagHours = null) {
        if (!VideoHandler.currentProjectId) {
            App.showToast('No video loaded', 'error');
            return;
        }

        // Pause video
        VideoHandler.video.pause();

        // Capture frame
        const canvas = VideoHandler.captureFrame();
        const imageData = canvas.toDataURL('image/png');
        const timestamp = VideoHandler.getCurrentTime();

        // Save to storage
        const tagsToSave = Array.isArray(initialTags) ? [...new Set(initialTags)] : [];
        const tagHoursToSave = initialTagHours && typeof initialTagHours === 'object' ? initialTagHours : {};

        // #region agent log
        console.log('[DEBUG-CAPTURE] captureSnapshotWithComment saving initial tags/hours', {
            tagsToSave,
            tagHoursToSave
        });
        // #endregion

        const snapshotId = await Storage.addSnapshot({
            projectId: VideoHandler.currentProjectId,
            timestamp: timestamp,
            originalImage: imageData,
            comment: initialComment,
            tags: tagsToSave,
            tagHours: tagHoursToSave
        });

        // Store reference (both IDs for compatibility)
        this.quickCommentSnapshotId = snapshotId;
        this.currentSnapshotId = snapshotId;

        // Get the full snapshot data
        const snapshot = await Storage.getSnapshot(snapshotId);
        this.snapshots.push(snapshot);

        // Add to list (will be sorted)
        this.addSnapshotToList(snapshot);

        // Sort snapshots by timecode
        this.sortSnapshotsByTimecode();

        // Add marker to timeline
        this.addTimelineMarker(snapshot);

        // Update count
        this.updateSnapshotCount();

        // Enter inline edit mode immediately (preserve comment to avoid cursor jump)
        this.enterInlineEditMode(snapshotId, imageData, null, true);
        
        return snapshotId;
    },

    /**
     * Create a snapshot from an image file (for image-only projects)
     * @param {number} projectId - Project ID
     * @param {string} imageDataUrl - Image data URL
     * @param {string} imageName - Name of the image file
     * @param {number} index - Index/order of the image
     * @returns {Promise<number>} Snapshot ID
     */
    async createSnapshotFromImage(projectId, imageDataUrl, imageName, index) {
        // Use index as "timestamp" for sorting
        const snapshotId = await Storage.addSnapshot({
            projectId: projectId,
            timestamp: index, // Use index as pseudo-timestamp
            originalImage: imageDataUrl,
            imageData: imageDataUrl, // Also store in imageData for compatibility
            comment: imageName, // Use filename as initial comment
            tags: [],
            tagHours: {}
        });
        
        return snapshotId;
    },

    /**
     * Capture snapshot SYNCHRONOUSLY for immediate drawing
     * Returns snapshot ID and imageData immediately, saves to DB in background
     * @param {string} initialComment - Initial comment HTML
     * @returns {Object} { snapshotId, imageData, promise }
     */
    captureSnapshotSync(initialComment = '') {
        console.log('📸 captureSnapshotSync - IMMEDIATE capture');
        if (!VideoHandler.currentProjectId) {
            App.showToast('No video loaded', 'error');
            return null;
        }

        // Pause video
        VideoHandler.video.pause();

        // Capture frame IMMEDIATELY (synchronous)
        const canvas = VideoHandler.captureFrame();
        const imageData = canvas.toDataURL('image/png');
        const timestamp = VideoHandler.getCurrentTime();
        
        console.log('✅ Frame captured, timestamp:', timestamp);

        // Generate temporary ID (will be replaced with real ID from DB)
        const tempSnapshotId = Date.now();

        // Start background save (don't await)
        const savePromise = (async () => {
            const snapshotId = await Storage.addSnapshot({
                projectId: VideoHandler.currentProjectId,
                timestamp: timestamp,
                originalImage: imageData,
                comment: initialComment,
                tags: []
            });

            // Update references with real ID
            this.quickCommentSnapshotId = snapshotId;
            this.currentSnapshotId = snapshotId;

            // Get the full snapshot data
            const snapshot = await Storage.getSnapshot(snapshotId);
            this.snapshots.push(snapshot);

            // Add to list (will be sorted)
            this.addSnapshotToList(snapshot);

            // Sort snapshots by timecode
            this.sortSnapshotsByTimecode();

            // Add marker to timeline
            this.addTimelineMarker(snapshot);

            // Update count
            this.updateSnapshotCount();
            
            console.log('💾 Snapshot saved to DB with ID:', snapshotId);
            
            return snapshotId;
        })();

        return {
            snapshotId: tempSnapshotId,
            imageData: imageData,
            savePromise: savePromise
        };
    },

    /**
     * Enter inline editing mode for a snapshot
     * @param {number} snapshotId - Snapshot ID
     * @param {string} imageData - Base64 image data
     * @param {Object} fabricData - Saved Fabric.js JSON
     * @param {boolean} preserveComment - Don't reload comment (preserve cursor)
     */
    async enterInlineEditMode(snapshotId, imageData = null, fabricData = null, preserveComment = false) {
        // If no image data provided, fetch snapshot
        if (!imageData) {
            const snapshot = await Storage.getSnapshot(snapshotId);
            if (!snapshot) return;
            imageData = snapshot.originalImage;
            fabricData = snapshot.fabricData;
        }

        this.currentSnapshotId = snapshotId;

        // Highlight active snapshot card
        this.highlightActiveSnapshot(snapshotId);

        // Load snapshot data into inline panels
        await this.loadSnapshotDataInline(snapshotId, preserveComment);

        // Initialize drawing tool with this snapshot
        DrawingTool.enterEditMode(snapshotId, imageData, fabricData);
        this.syncImageProjectExtras();
    },

    /**
     * Load snapshot data into inline panels
     * @param {number} snapshotId - Snapshot ID
     * @param {boolean} skipComment - Skip reloading comment (preserve cursor)
     */
    async loadSnapshotDataInline(snapshotId, skipComment = false) {
        const snapshot = await Storage.getSnapshot(snapshotId);
        if (!snapshot) return;

        // Load tags - ONLY from inline panel to avoid conflicts with modal
        const inlinePanel = document.querySelector('.tags-grid-inline');
        if (inlinePanel) {
            const tagButtons = inlinePanel.querySelectorAll('.tag-btn');
            tagButtons.forEach(btn => {
                const tagName = btn.dataset.tag;
                if (snapshot.tags && snapshot.tags.includes(tagName)) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            // #region agent log
            console.log('[DEBUG-LOAD] loadSnapshotDataInline applied tags/hours', {
                snapshotId,
                snapshotTags: snapshot.tags,
                snapshotTagHours: snapshot.tagHours
            });
            // #endregion

            // Load tag hours - ONLY from inline panel
            inlinePanel.querySelectorAll('.tag-hours-input').forEach(input => {
                const tagName = input.dataset.tag;
                if (snapshot.tagHours && snapshot.tagHours[tagName]) {
                    input.value = snapshot.tagHours[tagName];
                } else {
                    input.value = '';
                }
            });
        }

        // Load comment only if not skipping (to preserve cursor position)
        if (!skipComment) {
            const commentInputInline = document.getElementById('commentInputInline');
            commentInputInline.innerHTML = snapshot.comment || '';
        }
    },

    /**
     * Clear inline panels (reset to empty state)
     */
    clearInlinePanels() {
        // Clear tags - ONLY from inline panel
        const inlinePanel = document.querySelector('.tags-grid-inline');
        if (inlinePanel) {
            inlinePanel.querySelectorAll('.tag-btn').forEach(btn => {
                btn.classList.remove('active');
            });

            // Clear tag hours - ONLY from inline panel
            inlinePanel.querySelectorAll('.tag-hours-input').forEach(input => {
                input.value = '';
            });
        }

        // Clear comment
        const commentInputInline = document.getElementById('commentInputInline');
        if (commentInputInline) {
            commentInputInline.innerHTML = '';
        }
    },

    /**
     * Trigger auto-save (debounced)
     */
    triggerAutoSave(immediate = false) {
        if (!this.currentSnapshotId) {
            console.warn('⚠️ triggerAutoSave called but no currentSnapshotId');
            return;
        }

        // #region agent log
        console.log('[DEBUG-H2] snapshot-manager.js:337 - triggerAutoSave called', {immediate,currentSnapshotId:this.currentSnapshotId,hasTimeout:!!this.autoSaveTimeout});
        // #endregion

        // Clear existing timeout
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }

        const doSave = async () => {
            // #region agent log
            console.log('[DEBUG-H2] snapshot-manager.js:350 - Executing save', {currentSnapshotId:this.currentSnapshotId,immediate});
            // #endregion
            console.log('⏱️ Auto-save triggered for snapshot:', this.currentSnapshotId);
            
            // Get fabricData from DrawingTool if canvas exists
            // Otherwise, preserve existing fabricData from snapshot
            let fabricData = undefined; // undefined means "don't update fabricData"
            
            if (DrawingTool.canvas && DrawingTool.activeSnapshotId === this.currentSnapshotId) {
                // Canvas is active for this snapshot, get current data
                fabricData = DrawingTool.getCanvasData();
                console.log('✏️ Including canvas data in save');
            } else {
                console.log('📋 Tags/hours only save (no canvas)');
            }
            
            await this.saveInlineEdit(this.currentSnapshotId, fabricData, true);
        };

        if (immediate) {
            // #region agent log
            console.log('[DEBUG-H2] Immediate save requested');
            // #endregion
            doSave();
        } else {
            // Debounce auto-save for typing
            this.autoSaveTimeout = setTimeout(doSave, 300); // 300ms debounce for smooth typing
        }
    },

    /**
     * Save inline edits to snapshot
     * @param {number} snapshotId - Snapshot ID
     * @param {Object|undefined} fabricData - Fabric.js canvas data (undefined = don't update)
     * @param {boolean} silent - Don't clear panels or show toast (for auto-save)
     */
    async saveInlineEdit(snapshotId, fabricData, silent = false) {
        // Validate snapshot ID
        if (!snapshotId || typeof snapshotId !== 'number') {
            console.warn('❌ Invalid snapshot ID:', snapshotId);
            return;
        }
        
        const snapshot = await Storage.getSnapshot(snapshotId);
        if (!snapshot) {
            console.warn('❌ Snapshot not found:', snapshotId);
            return;
        }

        // Collect data from inline panels ONLY (not from modal)
        const comment = document.getElementById('commentInputInline')?.innerHTML || '';
        
        // Get active tags - ONLY from inline panel
        const tags = [];
        const inlinePanel = document.querySelector('.tags-grid-inline');
        
        // #region agent log
        console.log('[DEBUG-H6] snapshot-manager.js:382 - Collecting tags - before', {hasinlinePanel:!!inlinePanel});
        // #endregion
        
        if (inlinePanel) {
            const activeBtns = inlinePanel.querySelectorAll('.tag-btn.active');
            // #region agent log
            console.log('[DEBUG-H6] snapshot-manager.js:390 - Active tag buttons found', {count:activeBtns.length,tags:Array.from(activeBtns).map(b=>b.dataset.tag)});
            // #endregion
            
            activeBtns.forEach(btn => {
                const tagName = btn.dataset.tag;
                // Only add if not already in array (prevent duplicates)
                if (!tags.includes(tagName)) {
                    tags.push(tagName);
                } else {
                    // #region agent log
                    console.error('[DEBUG-H6] snapshot-manager.js:402 - ⚠️ DUPLICATE TAG DETECTED', {tag:tagName,currentTags:tags});
                    // #endregion
                }
            });
        }

        // Get tag hours - ONLY from inline panel, and only for active tags
        const tagHours = {};
        if (inlinePanel) {
            const hourInputs = inlinePanel.querySelectorAll('.tag-hours-input');
            // #region agent log
            console.log('[DEBUG-H3] snapshot-manager.js:415 - Collecting hours - before', {hourInputsCount:hourInputs.length,activeTags:tags});
            // #endregion
            
            hourInputs.forEach(input => {
                const tagName = input.dataset.tag;
                // #region agent log
                console.log('[DEBUG-H3] snapshot-manager.js:423 - Checking hour input', {tag:tagName,value:input.value,isActive:tags.includes(tagName)});
                // #endregion
                
                // Only save hours for active tags
                if (input.value && tags.includes(tagName)) {
                    const hours = parseFloat(input.value);
                    if (!isNaN(hours) && hours > 0) {
                        tagHours[tagName] = hours;
                    }
                }
            });
        }
        
        // Debug logging - detailed save info
        // #region agent log
        console.log('[DEBUG-SAVE] snapshot-manager.js:453 - saveInlineEdit called', {
            snapshotId,
            tags,
            tagHours,
            hasFabricData: fabricData !== undefined,
            hasCanvas: !!DrawingTool.canvas,
            tagCount: tags.length,
            hourCount: Object.keys(tagHours).length
        });
        // #endregion
        
        console.log('💾 Saving snapshot:', { 
            snapshotId, 
            tags, 
            tagHours, 
            hasFabricData: fabricData !== undefined,
            hasCanvas: !!DrawingTool.canvas,
            tagCount: tags.length,
            hourCount: Object.keys(tagHours).length
        });
        
        // Validate tags/hours match
        Object.keys(tagHours).forEach(tag => {
            if (!tags.includes(tag)) {
                console.warn('⚠️ Hour specified for inactive tag:', tag);
            }
        });

        // Build updates object - only include fabricData if it's being updated
        const updates = {
            comment,
            tags,
            tagHours
        };

        // Generate marked up image (composite snapshot + drawings)
        // Only if fabricData is being updated (not undefined)
        if (fabricData !== undefined) {
            updates.fabricData = fabricData;
            
            if (fabricData && DrawingTool.canvas) {
                try {
                    // Get the current snapshot
                    const snapshot = await Storage.getSnapshot(snapshotId);
                    if (snapshot && snapshot.originalImage) {
                        // Create a temporary canvas to composite
                        const tempCanvas = document.createElement('canvas');
                        const ctx = tempCanvas.getContext('2d');
                        
                        // Get dimensions from the fabric canvas
                        const width = DrawingTool.canvas.width;
                        const height = DrawingTool.canvas.height;
                        tempCanvas.width = width;
                        tempCanvas.height = height;
                        
                        // Load the snapshot image
                        const img = new Image();
                        await new Promise((resolve, reject) => {
                            img.onload = resolve;
                            img.onerror = reject;
                            img.src = snapshot.originalImage;
                        });
                        
                        // Draw snapshot image first
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        // Draw fabric canvas on top
                        const fabricImage = new Image();
                        await new Promise((resolve, reject) => {
                            fabricImage.onload = resolve;
                            fabricImage.onerror = reject;
                            fabricImage.src = DrawingTool.canvas.toDataURL({ format: 'png', quality: 1 });
                        });
                        ctx.drawImage(fabricImage, 0, 0);
                        
                        // Get the composited image
                        updates.markedUpImage = tempCanvas.toDataURL('image/png', 1);
                    }
                } catch (error) {
                    ErrorHandler.error('Failed to generate marked up image', error);
                    // Fallback to just the canvas
                    updates.markedUpImage = DrawingTool.canvas.toDataURL({ format: 'png', quality: 1 });
                }
            }
        }

        // Update storage
        await Storage.updateSnapshot(snapshotId, updates);

        // Update card in list (with thumbnail)
        await this.updateSnapshotCard(snapshotId, updates);

        // Only clear when explicitly exiting (not auto-saving)
        if (!silent) {
            // Clear comment bar
            const commentInputInline = document.getElementById('commentInputInline');
            if (commentInputInline) {
                commentInputInline.innerHTML = '';
            }
            this.quickCommentSnapshotId = null;

            // Clear inline panels
            this.clearInlinePanels();
        }
    },

    /**
     * Exit inline edit mode
     */
    exitInlineEditMode() {
        // Remove active class from all snapshot cards
        document.querySelectorAll('.snapshot-card').forEach(card => {
            card.classList.remove('active');
        });

        this.currentSnapshotId = null;
        this.quickCommentSnapshotId = null;
        DrawingTool.exitEditMode();
        this.syncImageProjectExtras();
    },

    /**
     * Highlight the active snapshot card
     * @param {number} snapshotId - Snapshot ID to highlight
     */
    highlightActiveSnapshot(snapshotId) {
        // Remove active class from all cards
        document.querySelectorAll('.snapshot-card').forEach(card => {
            card.classList.remove('active');
        });

        // Add active class to current card
        const activeCard = document.querySelector(`.snapshot-card[data-id="${snapshotId}"]`);
        if (activeCard) {
            activeCard.classList.add('active');
            // Scroll into view if needed
            activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    },

    /**
     * Apply color to selected text in inline comment
     * @param {string} color - Hex color code
     */
    applyColorToSelection(color) {
        const commentInput = document.getElementById('commentInputInline');
        commentInput.focus();
        
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        
        if (range.collapsed) return;
        
        const span = document.createElement('span');
        span.style.color = color;
        
        try {
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
            
            range.setStartAfter(span);
            range.setEndAfter(span);
            selection.removeAllRanges();
            selection.addRange(range);
            
            // Auto-save the color change
            this.saveColorChange();
        } catch (e) {
            console.error('Error applying color:', e);
        }
    },
    
    /**
     * Save color change with debouncing
     */
    saveColorChange() {
        // Clear existing timeout
        if (this.colorSaveTimeout) {
            clearTimeout(this.colorSaveTimeout);
        }
        
        // Debounce save to avoid too many saves
        this.colorSaveTimeout = setTimeout(() => {
            const snapshotId = this.currentSnapshotId || this.quickCommentSnapshotId;
            if (snapshotId) {
                // Get fabric data if canvas exists
                const fabricData = DrawingTool.canvas ? DrawingTool.canvas.toJSON() : undefined;
                this.saveInlineEdit(snapshotId, fabricData, true);
                console.log('💾 Auto-saved color change for snapshot:', snapshotId);
            }
        }, 500); // Wait 500ms after last color change
    },

    /**
     * Sort snapshots in the list by timecode order
     */
    sortSnapshotsByTimecode() {
        const listEl = document.getElementById('snapshotsList');
        const cards = Array.from(listEl.querySelectorAll('.snapshot-card'));
        
        if (cards.length === 0) return;
        
        cards.sort((a, b) => {
            const timeA = parseFloat(a.dataset.timestamp) || 0;
            const timeB = parseFloat(b.dataset.timestamp) || 0;
            return timeA - timeB;
        });

        cards.forEach(card => {
            card.remove();
        });
        cards.forEach(card => {
            listEl.appendChild(card);
        });

        // Update snapshot numbers based on sorted order
        this.updateSnapshotNumbers();
    },

    /**
     * Update snapshot numbers based on current order
     */
    updateSnapshotNumbers() {
        const cards = document.querySelectorAll('.snapshot-card');
        cards.forEach((card, index) => {
            const numberEl = card.querySelector('.snapshot-card-number');
            if (numberEl) {
                numberEl.textContent = index + 1;
            }
        });
    },

    /**
     * Add a snapshot card to the list
     * @param {Object} snapshot - Snapshot data
     */
    addSnapshotToList(snapshot) {
        const list = document.getElementById('snapshotsList');
        const emptyState = document.getElementById('emptyState');
        
        if (emptyState) {
            emptyState.hidden = true;
        }

        const card = document.createElement('div');
        card.className = 'snapshot-card';
        card.dataset.id = snapshot.id;
        card.dataset.timestamp = snapshot.timestamp;
        
        if (snapshot.fabricData) {
            card.classList.add('has-markup');
        }

        // Format tags with hours (dedupe defensively)
        const uniqueTags = [...new Set(snapshot.tags || [])];
        const tagsHtml = uniqueTags.map(tag => {
            const hours = snapshot.tagHours && snapshot.tagHours[tag];
            const hoursText = hours ? ` (${hours}h)` : '';
            const pillStyle = this.snapshotTagInlineStyle(tag);
            return `<span class="snapshot-tag" data-tag="${tag}" style="${pillStyle}">${this.escapeHtmlSnapshot(this.getTagLabel(tag))}${hoursText}</span>`;
        }).join('');

        // Use marked up image if available, otherwise original
        const thumbnailImage = snapshot.markedUpImage || snapshot.originalImage;
        
        card.innerHTML = `
            <div class="snapshot-card-thumbnail">
                <span class="snapshot-card-number"></span>
                <button class="snapshot-card-delete" title="Delete snapshot">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
                <img src="${thumbnailImage}" alt="Snapshot at ${VideoHandler.formatTimecode(snapshot.timestamp)}">
                <span class="snapshot-card-timecode">${VideoHandler.formatTimecode(snapshot.timestamp)}</span>
            </div>
            <div class="snapshot-card-body">
                <div class="snapshot-card-tags">${tagsHtml}</div>
                <div class="snapshot-card-comment">${snapshot.comment || ''}</div>
            </div>
        `;

        // Delete button - hold for 2 seconds to delete
        const deleteBtn = card.querySelector('.snapshot-card-delete');
        let deleteHoldTimer = null;
        let deleteProgress = null;
        
        deleteBtn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            
            // Add deleting class to show progress
            deleteBtn.classList.add('deleting');
            
            // Create progress overlay
            deleteProgress = document.createElement('div');
            deleteProgress.className = 'delete-progress';
            // Insert before SVG so z-index layering works
            deleteBtn.insertBefore(deleteProgress, deleteBtn.firstChild);
            
            // Start animation
            deleteProgress.style.animation = 'deleteProgress 1s linear forwards';
            
            // Set timer for actual deletion
            deleteHoldTimer = setTimeout(async () => {
                await this.deleteSnapshotById(snapshot.id, true); // true = no confirmation
                deleteBtn.classList.remove('deleting');
                if (deleteProgress && deleteProgress.parentNode) {
                    deleteProgress.remove();
                }
            }, 1000);
        });
        
        const cancelDelete = () => {
            deleteBtn.classList.remove('deleting');
            if (deleteHoldTimer) {
                clearTimeout(deleteHoldTimer);
                deleteHoldTimer = null;
            }
            if (deleteProgress && deleteProgress.parentNode) {
                deleteProgress.remove();
            }
        };
        
        deleteBtn.addEventListener('mouseup', cancelDelete);
        deleteBtn.addEventListener('mouseleave', cancelDelete);
        
        // Touch support
        deleteBtn.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            // Add deleting class to show progress
            deleteBtn.classList.add('deleting');
            
            // Trigger same as mousedown
            deleteProgress = document.createElement('div');
            deleteProgress.className = 'delete-progress';
            // Insert before SVG so z-index layering works
            deleteBtn.insertBefore(deleteProgress, deleteBtn.firstChild);
            deleteProgress.style.animation = 'deleteProgress 1s linear forwards';
            
            deleteHoldTimer = setTimeout(async () => {
                await this.deleteSnapshotById(snapshot.id, true);
                deleteBtn.classList.remove('deleting');
                if (deleteProgress && deleteProgress.parentNode) {
                    deleteProgress.remove();
                }
            }, 1000);
        });
        
        deleteBtn.addEventListener('touchend', cancelDelete);
        deleteBtn.addEventListener('touchcancel', cancelDelete);

        // Image-only projects: draggable grip so stills can be reordered without stealing card clicks
        if (window.VideoHandler && VideoHandler.isImageProject) {
            const thumbEl = card.querySelector('.snapshot-card-thumbnail');
            if (thumbEl && !thumbEl.querySelector('.snapshot-card-drag-handle')) {
                const handle = document.createElement('span');
                handle.className = 'snapshot-card-drag-handle';
                handle.setAttribute('draggable', 'true');
                handle.setAttribute('role', 'button');
                handle.setAttribute('tabindex', '0');
                handle.setAttribute('aria-grabbed', 'false');
                handle.setAttribute('aria-label', 'Drag to reorder still');
                handle.dataset.tooltip = 'Drag to reorder';
                handle.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <circle cx="9" cy="7" r="1.5" fill="currentColor"></circle>
                        <circle cx="15" cy="7" r="1.5" fill="currentColor"></circle>
                        <circle cx="9" cy="12" r="1.5" fill="currentColor"></circle>
                        <circle cx="15" cy="12" r="1.5" fill="currentColor"></circle>
                        <circle cx="9" cy="17" r="1.5" fill="currentColor"></circle>
                        <circle cx="15" cy="17" r="1.5" fill="currentColor"></circle>
                    </svg>`;
                handle.addEventListener('click', (ev) => ev.stopPropagation());
                handle.addEventListener('dblclick', (ev) => ev.stopPropagation());

                thumbEl.appendChild(handle);
            }
        }

        // Click to seek and enter edit mode
        card.addEventListener('click', () => this.openSnapshotInline(snapshot.id));

        list.appendChild(card);

        // Apply current video filters to snapshot thumbnail
        if (window.VideoHandler && typeof VideoHandler.applyFilters === 'function') {
            VideoHandler.applyFilters();
        }
    },

    /**
     * Update snapshot card in the list
     * @param {number} snapshotId - Snapshot ID
     * @param {Object} updates - Updated data (comment, tags, tagHours, markedUpImage)
     */
    async updateSnapshotCard(snapshotId, updates) {
        const card = document.querySelector(`.snapshot-card[data-id="${snapshotId}"]`);
        if (!card) {
            console.warn('⚠️ Card not found for snapshot:', snapshotId);
            return;
        }

        // Get full snapshot data for thumbnail and fabricData check
        const snapshot = await Storage.getSnapshot(snapshotId);
        if (!snapshot) {
            console.warn('⚠️ Snapshot not found for card update:', snapshotId);
            return;
        }

        // Update thumbnail if marked up image exists
        if (updates.markedUpImage || snapshot.markedUpImage) {
            const img = card.querySelector('.snapshot-card-thumbnail img');
            if (img) {
                img.src = updates.markedUpImage || snapshot.markedUpImage;
            }
        }

        // Update tags - ALWAYS update if provided
        if (updates.tags !== undefined) {
            // #region agent log
            console.log('[DEBUG-H7] snapshot-manager.js:755 - Updating card tags', {snapshotId,updatesTags:updates.tags,updatesTagHours:updates.tagHours,snapshotTagHours:snapshot.tagHours});
            // #endregion
            
            const tagsHtml = updates.tags.map(tag => {
                const hours = (updates.tagHours || snapshot.tagHours) && (updates.tagHours || snapshot.tagHours)[tag];
                const hoursText = hours ? ` (${hours}h)` : '';
                const pillStyle = this.snapshotTagInlineStyle(tag);
                return `<span class="snapshot-tag" data-tag="${tag}" style="${pillStyle}">${this.escapeHtmlSnapshot(this.getTagLabel(tag))}${hoursText}</span>`;
            }).join('');
            const tagsContainer = card.querySelector('.snapshot-card-tags');
            if (tagsContainer) {
                // #region agent log
                console.log('[DEBUG-H7] snapshot-manager.js:767 - Setting tagsContainer innerHTML', {oldHTML:tagsContainer.innerHTML,newHTML:tagsHtml});
                // #endregion
                tagsContainer.innerHTML = tagsHtml;
            }
        }

        // Update comment
        if (updates.comment !== undefined) {
            const commentEl = card.querySelector('.snapshot-card-comment');
            if (commentEl) {
                commentEl.innerHTML = updates.comment || '';
            }
        }

        // Update has-markup class based on final snapshot state
        if (snapshot.fabricData && snapshot.fabricData.objects && snapshot.fabricData.objects.length > 0) {
            card.classList.add('has-markup');
        } else {
            card.classList.remove('has-markup');
        }
        
        console.log('✅ Card updated:', { snapshotId, tags: updates.tags, tagHours: updates.tagHours });
    },

    /**
     * Open snapshot inline (seek and enter edit mode)
     * @param {number} id - Snapshot ID
     */
    async openSnapshotInline(id) {
        const snapshot = await Storage.getSnapshot(id);
        if (!snapshot) return;

        // Seek to snapshot timestamp
        VideoHandler.seekTo(snapshot.timestamp);
        VideoHandler.video.pause();

        // Set both IDs to prevent duplicate creation
        this.currentSnapshotId = id;
        this.quickCommentSnapshotId = id;

        // Enter edit mode (which will also set currentSnapshotId, but that's fine)
        await this.enterInlineEditMode(id, snapshot.originalImage, snapshot.fabricData);
    },

    /**
     * Display snapshot markups when video is at a mark (read-only)
     * @param {number} timestamp - Current video timestamp
     */
    async displayMarkupsAtTimestamp(timestamp) {
        // Find snapshot at this timestamp (within 0.1s tolerance)
        const snapshot = this.snapshots.find(s => Math.abs(s.timestamp - timestamp) < 0.1);
        
        if (snapshot) {
            DrawingTool.displayMarkups(snapshot.originalImage, snapshot.fabricData);
        } else {
            DrawingTool.hideMarkups();
        }
    },

    /**
     * Add a marker on the video timeline
     * @param {Object} snapshot - Snapshot data
     */
    addTimelineMarker(snapshot) {
        const markers = document.getElementById('snapshotMarkers');
        const position = (snapshot.timestamp / VideoHandler.duration) * 100;

        const marker = document.createElement('div');
        marker.className = 'snapshot-marker';
        marker.style.left = `${position}%`;
        marker.dataset.id = snapshot.id;
        marker.title = `Snapshot @ ${VideoHandler.formatTimecode(snapshot.timestamp)}`;

        marker.addEventListener('click', (e) => {
            e.stopPropagation();
            VideoHandler.seekTo(snapshot.timestamp);
        });

        markers.appendChild(marker);
    },

    /**
     * Update snapshot count badge
     */
    updateSnapshotCount() {
        const count = document.querySelectorAll('.snapshot-card').length;
        document.getElementById('snapshotCount').textContent = count;
    },


    /**
     * Delete a snapshot by ID
     * @param {number} id - Snapshot ID
     * @param {boolean} skipConfirm - Skip confirmation dialog
     */
    async deleteSnapshotById(id, skipConfirm = false) {
        if (!skipConfirm && !confirm('Delete this snapshot?')) return;

        // Exit edit mode if this snapshot is being edited
        if (this.currentSnapshotId === id) {
            this.exitInlineEditMode();
        }

        await Storage.deleteSnapshot(id);

        const card = document.querySelector(`.snapshot-card[data-id="${id}"]`);
        if (card) card.remove();

        const marker = document.querySelector(`.snapshot-marker[data-id="${id}"]`);
        if (marker) marker.remove();

        this.updateSnapshotCount();

        const count = document.querySelectorAll('.snapshot-card').length;
        if (count === 0) {
            document.getElementById('emptyState').hidden = false;
        }

        this.snapshots = this.snapshots.filter(s => s.id !== id);

        if (this.currentSnapshotId === id) {
            this.currentSnapshotId = null;
        }
    },

    /**
     * Get display label for a tag
     * @param {string} tag - Tag ID
     * @returns {string} Display label
     */
    getTagLabel(tag) {
        return typeof TagManager !== 'undefined' && TagManager.getTagLabel
            ? TagManager.getTagLabel(tag)
            : tag;
    },

    /**
     * Tint + text color for snapshot-card tag pills (custom tags + built-ins).
     * @param {string} tag
     * @returns {string}
     */
    snapshotTagInlineStyle(tag) {
        const hex =
            typeof TagManager !== 'undefined' && TagManager.getTagColor
                ? TagManager.getTagColor(tag)
                : '#888888';
        const rgb = this.hexToRgb(hex);
        if (!rgb) {
            return '';
        }
        const { r, g, b } = rgb;
        return `background: rgba(${r}, ${g}, ${b}, 0.2); color: ${hex};`;
    },

    /**
     * Parse #rgb / #rrggbb to components
     * @param {string} hex
     * @returns {{r:number,g:number,b:number}|null}
     */
    hexToRgb(hex) {
        if (!hex || typeof hex !== 'string') return null;
        let h = hex.trim().replace(/^#/, '');
        if (h.length === 3) {
            h = h.split('').map((c) => c + c).join('');
        }
        if (h.length !== 6 || !/^[0-9a-fA-F]+$/.test(h)) return null;
        const n = parseInt(h, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    },

    /**
     * Minimal HTML escape for snapshot card fragments
     * @param {string} text
     * @returns {string}
     */
    escapeHtmlSnapshot(text) {
        if (text == null) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    },

    /**
     * Get all snapshots for export
     * @returns {Promise<Array>}
     */
    async getAllSnapshots() {
        if (!VideoHandler.currentProjectId) return [];
        return await Storage.getSnapshots(VideoHandler.currentProjectId);
    },

    /**
     * Clear all snapshots from the list (UI only)
     */
    clearList() {
        const list = document.getElementById('snapshotsList');
        const cards = list.querySelectorAll('.snapshot-card');
        cards.forEach(card => card.remove());
        
        const markers = document.getElementById('snapshotMarkers');
        markers.innerHTML = '';
        
        document.getElementById('emptyState').hidden = false;
        this.updateSnapshotCount();
        this.snapshots = [];
    },

    /**
     * Navigate to the next snapshot (keyboard navigation)
     */
    async navigateToNextSnapshot() {
        if (this.snapshots.length === 0) return;

        // Sort snapshots by timestamp (timeline order)
        const sortedSnapshots = [...this.snapshots].sort((a, b) => a.timestamp - b.timestamp);

        let nextSnapshot = null;

        if (this.currentSnapshotId) {
            // Find current snapshot index in sorted array
            const currentIndex = sortedSnapshots.findIndex(s => s.id === this.currentSnapshotId);
            if (currentIndex !== -1 && currentIndex < sortedSnapshots.length - 1) {
                nextSnapshot = sortedSnapshots[currentIndex + 1];
                this.currentImageIndex = currentIndex + 1;
            }
        } else {
            // No snapshot selected, select the first one (earliest timestamp)
            nextSnapshot = sortedSnapshots[0];
            this.currentImageIndex = 0;
        }

        if (nextSnapshot) {
            // For image projects, display the image in the overlay
            if (VideoHandler.isImageProject) {
                const snapshotOverlay = document.getElementById('snapshotOverlay');
                if (snapshotOverlay) {
                    snapshotOverlay.src = nextSnapshot.originalImage || nextSnapshot.imageData;
                }
            } else {
                // For video projects, seek to the snapshot's timestamp
            VideoHandler.video.currentTime = nextSnapshot.timestamp;
            }
            
            // Enter edit mode for this snapshot
            await this.enterInlineEditMode(nextSnapshot.id);
        }
    },

    /**
     * Navigate to the previous snapshot (keyboard navigation)
     */
    async navigateToPreviousSnapshot() {
        if (this.snapshots.length === 0) return;

        // Sort snapshots by timestamp (timeline order)
        const sortedSnapshots = [...this.snapshots].sort((a, b) => a.timestamp - b.timestamp);

        let prevSnapshot = null;

        if (this.currentSnapshotId) {
            // Find current snapshot index in sorted array
            const currentIndex = sortedSnapshots.findIndex(s => s.id === this.currentSnapshotId);
            if (currentIndex > 0) {
                prevSnapshot = sortedSnapshots[currentIndex - 1];
                this.currentImageIndex = currentIndex - 1;
            }
        } else {
            // No snapshot selected, select the last one (latest timestamp)
            prevSnapshot = sortedSnapshots[sortedSnapshots.length - 1];
            this.currentImageIndex = sortedSnapshots.length - 1;
        }

        if (prevSnapshot) {
            // For image projects, display the image in the overlay
            if (VideoHandler.isImageProject) {
                const snapshotOverlay = document.getElementById('snapshotOverlay');
                if (snapshotOverlay) {
                    snapshotOverlay.src = prevSnapshot.originalImage || prevSnapshot.imageData;
                }
            } else {
                // For video projects, seek to the snapshot's timestamp
            VideoHandler.video.currentTime = prevSnapshot.timestamp;
            }
            
            // Enter edit mode for this snapshot
            await this.enterInlineEditMode(prevSnapshot.id);
        }
    }
};

window.SnapshotManager = SnapshotManager;
