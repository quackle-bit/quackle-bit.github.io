!function () {
    function update() {
        var h = document.querySelector('.header');
        if (h) h.classList.toggle('is-scrolled', window.scrollY > 100);
    }

    // Move the light/dark switch out of the logo so it can sit at the top right
    function placeSwitch() {
        var sw = document.querySelector('.header .logo .mode-switch-btn');
        var top = document.querySelector('.header .head-top');
        if (sw && top) top.appendChild(sw);
    }

    window.addEventListener('scroll', update, { passive: true });
    document.addEventListener('DOMContentLoaded', function () { placeSwitch(); update(); });
    placeSwitch();
    update();
}();
