/**
 * FAQ Module
 * Simple modal open/close behavior for the FAQ panel.
 */

const FAQ = {
    _bound: false,
    init() {
        if (this._bound) return;
        const btn = document.getElementById('faqBtn');
        const modal = document.getElementById('faqModal');
        const closeBtn = document.getElementById('faqClose');
        const modalInner = modal ? modal.querySelector('.faq-modal') : null;

        if (!btn || !modal || !closeBtn) return;
        this._bound = true;

        const open = () => {
            modal.hidden = false;
        };

        const close = () => {
            modal.hidden = true;
        };

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            open();
        });

        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            close();
        });

        // Click outside to close
        modal.addEventListener('mousedown', (e) => {
            if (modalInner && !modalInner.contains(e.target)) {
                close();
            }
        });

        // Escape to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.hidden) {
                close();
            }
        });
    }
};

window.FAQ = FAQ;

// Initialize even if App.init fails or runs before FAQ is available
document.addEventListener('DOMContentLoaded', () => {
    if (window.FAQ && typeof window.FAQ.init === 'function') {
        window.FAQ.init();
    }
});


