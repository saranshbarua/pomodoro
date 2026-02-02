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

    // Dynamic Download Link (Optional: Can be used to detect OS, though we focus on Mac)
    const downloadBtns = document.querySelectorAll('a[href*="releases/latest"]');
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    if (!isMac) {
        downloadBtns.forEach(btn => {
            // Optional: Show warning or change text if not on Mac
            // btn.innerText = "Download for macOS (Universal)";
        });
    }
});

