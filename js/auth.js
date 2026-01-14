/**
 * Authentication Module
 * Simple password protection with SHA-256 hashing
 */

const Auth = {
    // SHA-256 hash of "hogarth2026"
    // To change password: Use generateHash() helper and update this value
    PASSWORD_HASH: '92b1a4f7bd56d152f47cf5c68ba5c3e7a20435c5586e1188907687e63bb23a7c',
    
    SESSION_KEY: 'videoMarkup_authenticated',
    
    /**
     * Initialize authentication
     */
    init() {
        // Check if already authenticated
        if (this.isAuthenticated()) {
            this.showApp();
        } else {
            this.showLogin();
        }
        
        // Setup logout button if exists
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    },
    
    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return sessionStorage.getItem(this.SESSION_KEY) === 'true';
    },
    
    /**
     * Show login modal
     */
    showLogin() {
        const loginOverlay = document.getElementById('loginOverlay');
        const appContent = document.getElementById('appContent');
        
        if (loginOverlay) {
            loginOverlay.hidden = false;
            appContent.hidden = true;
            
            // Focus password input
            const passwordInput = document.getElementById('loginPassword');
            if (passwordInput) {
                setTimeout(() => passwordInput.focus(), 100);
            }
            
            // Setup login form
            const loginForm = document.getElementById('loginForm');
            if (loginForm) {
                loginForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.attemptLogin();
                });
            }
        }
    },
    
    /**
     * Show app content
     */
    showApp() {
        const loginOverlay = document.getElementById('loginOverlay');
        const appContent = document.getElementById('appContent');
        
        if (loginOverlay && appContent) {
            loginOverlay.hidden = true;
            appContent.hidden = false;
        }
    },
    
    /**
     * Attempt to login with entered password
     */
    async attemptLogin() {
        const passwordInput = document.getElementById('loginPassword');
        const errorMsg = document.getElementById('loginError');
        const loginBtn = document.getElementById('loginBtn');
        
        if (!passwordInput) return;
        
        const password = passwordInput.value;
        
        // Disable button during check
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.textContent = 'Verifying...';
        }
        
        try {
            const inputHash = await this.hashPassword(password);
            
            if (inputHash === this.PASSWORD_HASH) {
                // Success!
                sessionStorage.setItem(this.SESSION_KEY, 'true');
                this.showApp();
                
                // Clear password field
                passwordInput.value = '';
                if (errorMsg) errorMsg.textContent = '';
            } else {
                // Failed
                if (errorMsg) {
                    errorMsg.textContent = 'Incorrect password';
                    errorMsg.style.display = 'block';
                }
                passwordInput.value = '';
                passwordInput.focus();
            }
        } catch (error) {
            console.error('Login error:', error);
            if (errorMsg) {
                errorMsg.textContent = 'Login error occurred';
                errorMsg.style.display = 'block';
            }
        } finally {
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Login';
            }
        }
    },
    
    /**
     * Hash password using SHA-256
     * @param {string} password
     * @returns {Promise<string>}
     */
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },
    
    /**
     * Logout - clear session
     */
    logout() {
        sessionStorage.removeItem(this.SESSION_KEY);
        location.reload();
    },
    
    /**
     * Helper function to generate hash for a new password
     * Usage: Open console and run: Auth.generateHash("yourpassword")
     * @param {string} password
     */
    async generateHash(password) {
        const hash = await this.hashPassword(password);
        console.log('Password:', password);
        console.log('SHA-256 Hash:', hash);
        console.log('Copy the hash above and update PASSWORD_HASH in auth.js');
        return hash;
    }
};

// Initialize authentication when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Auth.init());
} else {
    Auth.init();
}

// Make Auth available globally
window.Auth = Auth;
