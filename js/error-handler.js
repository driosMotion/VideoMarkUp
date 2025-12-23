/**
 * Error Handler Module
 * Centralized error handling and logging
 */

const ErrorHandler = {
    logLevel: 'info', // 'debug', 'info', 'warn', 'error'
    errorQueue: [],
    maxQueueSize: 50,

    /**
     * Initialize error handler
     */
    init() {
        // Global error handler
        window.addEventListener('error', (event) => {
            this.logError('Uncaught Error', event.error, {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno
            });
        });

        // Promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            this.logError('Unhandled Promise Rejection', event.reason);
        });
    },

    /**
     * Log debug message
     */
    debug(message, data = null) {
        if (this.logLevel === 'debug') {
            console.debug(`[DEBUG] ${message}`, data || '');
        }
    },

    /**
     * Log info message
     */
    info(message, data = null) {
        if (['debug', 'info'].includes(this.logLevel)) {
            console.info(`[INFO] ${message}`, data || '');
        }
    },

    /**
     * Log warning
     */
    warn(message, data = null) {
        if (['debug', 'info', 'warn'].includes(this.logLevel)) {
            console.warn(`[WARN] ${message}`, data || '');
        }
        this.addToQueue('warn', message, data);
    },

    /**
     * Log error
     */
    error(message, error = null, context = null) {
        console.error(`[ERROR] ${message}`, error || '', context || '');
        this.addToQueue('error', message, { error, context });
    },

    /**
     * Log critical error and show toast
     */
    logError(message, error = null, context = null) {
        this.error(message, error, context);
        
        // Show user-friendly message
        if (window.App && typeof App.showToast === 'function') {
            App.showToast(this.getUserFriendlyMessage(message), 'error');
        }
    },

    /**
     * Handle async operation with error handling
     */
    async handleAsync(operation, errorMessage = 'Operation failed') {
        try {
            return await operation();
        } catch (error) {
            this.logError(errorMessage, error);
            throw error;
        }
    },

    /**
     * Wrap function with error handling
     */
    wrap(fn, errorMessage = 'Function execution failed') {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                this.logError(errorMessage, error);
                throw error;
            }
        };
    },

    /**
     * Add error to queue for debugging
     */
    addToQueue(level, message, data) {
        this.errorQueue.push({
            level,
            message,
            data,
            timestamp: new Date().toISOString()
        });

        // Keep queue size manageable
        if (this.errorQueue.length > this.maxQueueSize) {
            this.errorQueue.shift();
        }
    },

    /**
     * Get user-friendly error message
     */
    getUserFriendlyMessage(message) {
        const messageMap = {
            'Canvas': 'Drawing canvas error. Please refresh the page.',
            'Storage': 'Failed to save data. Please check your browser storage.',
            'Video': 'Video loading failed. Please check the file format.',
            'Network': 'Network error. Please check your connection.',
            'Permission': 'Permission denied. Please check browser settings.',
            'Database': 'Database error. Your data may not be saved.',
            'Invalid': 'Invalid data. Please check your input.'
        };

        // Find matching key in message
        for (const [key, friendlyMsg] of Object.entries(messageMap)) {
            if (message.includes(key)) {
                return friendlyMsg;
            }
        }

        return 'An error occurred. Please try again.';
    },

    /**
     * Get error logs (for debugging)
     */
    getLogs() {
        return [...this.errorQueue];
    },

    /**
     * Clear error logs
     */
    clearLogs() {
        this.errorQueue = [];
    },

    /**
     * Export logs as JSON
     */
    exportLogs() {
        const data = JSON.stringify(this.errorQueue, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `error-logs-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

