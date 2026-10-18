// Wait for the page and Elfsight widget to load
document.addEventListener('DOMContentLoaded', function() {
    const gallery = document.querySelector('#elfsight_app_1');
    if (!gallery) return;

    // Function to force category buttons visible
    function showCategories() {
        const filters = gallery.querySelectorAll('.eapps-filter-item');
        filters.forEach(f => {
            f.style.display = 'inline-block'; // make sure they show
            f.style.opacity = '1';             // fully visible
            f.style.visibility = 'visible';
        });
    }

    // Run once after load
    showCategories();

    // Also observe DOM changes (e.g., theme JS dark mode switch)
    const observer = new MutationObserver(showCategories);
    observer.observe(gallery, { attributes: true, childList: true, subtree: true });
});
