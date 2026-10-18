(function () {
    // Masonry: keep left-to-right order but let each card span its own height
    function masonry(grid, cards) {
        function layout() {
            grid.classList.add('qb-masonry');
            cards.forEach(function (it) {
                if (it.hidden) return;
                var h = it.getBoundingClientRect().height + parseFloat(getComputedStyle(it).marginBottom);
                it.style.gridRowEnd = 'span ' + Math.ceil(h);
            });
        }
        grid.querySelectorAll('img').forEach(function (img) {
            if (!img.complete) img.addEventListener('load', layout);
        });
        window.addEventListener('resize', layout);
        window.addEventListener('load', layout);
        layout();
        return layout;
    }

    function init() {
        var gallery = document.querySelector('.qb-gallery');
        if (!gallery) return;
        var items = gallery.querySelectorAll('.qb-item');
        var grid = gallery.querySelector('.qb-gallery-grid');

        var layout = masonry(grid, items);

        gallery.querySelector('.qb-filters').addEventListener('click', function (ev) {
            var btn = ev.target.closest('button');
            if (!btn) return;
            this.querySelectorAll('button').forEach(function (b) { b.classList.toggle('active', b === btn); });
            var f = btn.getAttribute('data-filter');
            items.forEach(function (it) { it.hidden = f !== '*' && it.getAttribute('data-cat') !== f; });
            layout();
        });

        var lb = document.createElement('div');
        lb.className = 'qb-lightbox';
        lb.hidden = true;
        lb.innerHTML = '<button type="button" class="qb-lb-close" aria-label="Close">&times;</button>' +
            '<button type="button" class="qb-lb-prev" aria-label="Previous">&#8249;</button>' +
            '<button type="button" class="qb-lb-next" aria-label="Next">&#8250;</button>' +
            '<div class="qb-lb-stage"></div><div class="qb-lb-caption"></div>';
        document.body.appendChild(lb);
        var stage = lb.querySelector('.qb-lb-stage'), caption = lb.querySelector('.qb-lb-caption');
        var media = [], idx = 0, name = '';

        function render() {
            var m = media[idx];
            stage.innerHTML = '';
            if (m.type === 'youtube') {
                var f = document.createElement('iframe');
                f.src = 'https://www.youtube.com/embed/' + m.id + '?autoplay=1';
                f.allow = 'autoplay; encrypted-media; picture-in-picture';
                f.allowFullscreen = true;
                stage.appendChild(f);
            } else {
                var img = document.createElement('img');
                img.src = m.src;
                img.alt = name;
                stage.appendChild(img);
            }
            caption.textContent = name + (media.length > 1 ? ' (' + (idx + 1) + '/' + media.length + ')' : '');
            lb.querySelector('.qb-lb-prev').hidden = lb.querySelector('.qb-lb-next').hidden = media.length < 2;
        }
        function close() { lb.hidden = true; stage.innerHTML = ''; document.documentElement.style.overflow = ''; }
        function step(d) { idx = (idx + d + media.length) % media.length; render(); }

        items.forEach(function (it) {
            it.addEventListener('click', function () {
                media = JSON.parse(it.getAttribute('data-media'));
                name = it.getAttribute('data-name');
                idx = 0;
                render();
                lb.hidden = false;
                document.documentElement.style.overflow = 'hidden';
            });
        });
        lb.addEventListener('click', function (ev) {
            if (ev.target === lb || ev.target.classList.contains('qb-lb-close')) close();
            else if (ev.target.classList.contains('qb-lb-prev')) step(-1);
            else if (ev.target.classList.contains('qb-lb-next')) step(1);
        });
        document.addEventListener('keydown', function (ev) {
            if (lb.hidden) return;
            if (ev.key === 'Escape') close();
            else if (ev.key === 'ArrowLeft') step(-1);
            else if (ev.key === 'ArrowRight') step(1);
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
