
document.addEventListener('DOMContentLoaded', function() {
    const swipeWrap = document.querySelector('.swipe-wrap');
    const swipeItems = swipeWrap.querySelectorAll('.swipe-item');
    const leftArrow = document.getElementById('leftArrow');
    const rightArrow = document.getElementById('rightArrow');
    let currentIndex = 0;

    function showImage(index) {
        swipeItems.forEach((item, i) => {
            item.style.display = i === index ? 'block' : 'none';
        });
    }

    showImage(currentIndex);

    leftArrow.addEventListener('click', function() {
        currentIndex = (currentIndex > 0) ? currentIndex - 1 : swipeItems.length - 1;
        showImage(currentIndex);
    });

    rightArrow.addEventListener('click', function() {
        currentIndex = (currentIndex < swipeItems.length - 1) ? currentIndex + 1 : 0;
        showImage(currentIndex);
    });

});