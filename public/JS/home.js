// BANNER IMGS
 const slides = document.getElementById('slides');
  const totalSlides = slides.children.length;
  let index = 0;

  function showSlide(i) {
    if (i < 0) index = totalSlides - 1;
    else if (i >= totalSlides) index = 0;
    else index = i;

    slides.style.transform = `translateX(-${index * 100}%)`;
  }

  function nextSlide() {
    showSlide(index + 1);
  }

  function prevSlide() {
    showSlide(index - 1);
  }

  // Auto-slide every 5 seconds
  setInterval(nextSlide, 5000);