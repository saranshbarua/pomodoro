document.addEventListener('DOMContentLoaded', () => {
    // Scroll Fade-in Animation using Intersection Observer
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // Once visible, no need to observe anymore
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const fadeElements = document.querySelectorAll('.fade-in');
    fadeElements.forEach(el => observer.observe(el));

    // Smooth Scroll for Nav Links and in-page anchors
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            e.preventDefault();
            
            const target = document.querySelector(href);
            if (target) {
                const headerOffset = 80; // Match --nav-height
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Download modal: show setup guide first, then download on button click
    const downloadUrl = 'https://github.com/saranshbarua/flumen/releases/latest/download/Flumen_macOS_Universal.zip';
    const downloadLinks = document.querySelectorAll('a[href*="releases/latest"]');
    const modal = document.getElementById('download-modal');
    const modalDownloadBtn = document.getElementById('modal-download-btn');
    const closeTriggers = document.querySelectorAll('[data-close-modal]');

    function openModal() {
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    function triggerDownload() {
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = 'Flumen_macOS_Universal.zip';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    // Open modal when any download link is clicked
    downloadLinks.forEach((link) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            openModal();
        });
    });

    // Trigger download when the modal button is clicked
    modalDownloadBtn.addEventListener('click', () => {
        triggerDownload();
        closeModal();
    });

    closeTriggers.forEach((el) => {
        el.addEventListener('click', closeModal);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('is-open')) {
            closeModal();
        }
    });
});

