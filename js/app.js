/* ═════════════════════════════════════════════════════════════════
   mgm VIETNAM OKTOBERFEST 2026 — JAVASCRIPT LOGIC
   Features:
   - English Content
   - Auto-Play Slider (4s) with Dynamic Year Display in All Seasons & Photo Count in Year Tabs
   - Pop-up Registration Modal
   - Scroll Reveal Animations
   ═════════════════════════════════════════════════════════════════ */

// 0. Disable browser automatic scroll restoration so page ALWAYS opens at Hero Section (Top)
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

document.addEventListener('DOMContentLoaded', () => {
  // Clean hash from URL if present
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  // 1. Initialize Lucide Icons
  if (window.lucide) {
    lucide.createIcons();
  }

  // 2. Navbar Scroll Effect
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // 3. Mobile Navigation Toggle & Smooth Scrolling
  const mobileToggle = document.getElementById('mobileToggle');
  const navMenu = document.getElementById('navMenu');
  if (mobileToggle && navMenu) {
    const closeMobileMenu = () => {
      navMenu.classList.remove('active');
      mobileToggle.classList.remove('active');
      mobileToggle.innerHTML = '<i data-lucide="menu"></i>';
      if (window.lucide) window.lucide.createIcons();
    };

    mobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = navMenu.classList.toggle('active');
      mobileToggle.classList.toggle('active', isActive);
      mobileToggle.innerHTML = isActive ? '<i data-lucide="x"></i>' : '<i data-lucide="menu"></i>';
      if (window.lucide) window.lucide.createIcons();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!navMenu.contains(e.target) && !mobileToggle.contains(e.target)) {
        closeMobileMenu();
      }
    });

    // Smooth scroll handler for all internal anchor links (Prevents sticky hashes on reload)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        const href = anchor.getAttribute('href');
        if (!href || href === '#') return;

        if (anchor.classList.contains('nav-link-minigame') || href === '#minigame') {
          e.preventDefault();
          showComingSoonToast(
            'Minigame Coming Soon! 🎮',
            'Our Oktoberfest mini-game is currently under brewing. Stay tuned for exciting challenges and prizes!'
          );
          closeMobileMenu();
          return;
        }

        if (anchor.classList.contains('open-reg-modal') || href === '#registration') {
          closeMobileMenu();
          return;
        }

        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          const navHeight = document.getElementById('navbar')?.offsetHeight || 70;
          const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navHeight;
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
          closeMobileMenu();
        }
      });
    });
  }

  // 4. Hero Background Rotating Slider (Cross-fade + Ken Burns Zoom Out)
  initHeroBgSlider();

  // 5. Hero Beer Bubbles Canvas Animation
  initBeerBubbles();

  // 6. Countdown Timer (Target: Sat, 19 Sep 2026 17:30:00 GMT+7 - 5:30 PM)
  initCountdownTimer(new Date('2026-09-19T17:30:00+07:00'));

  // 6. Scroll Reveal Observer
  initScrollReveal();

  // 7. Auto-play Memories Slider (4s)
  initMemoriesSlider();

  // 8. Dress Code 2-Image Rotating Slideshow
  initDressCodeSlider();

  // 9. Dress Code Interactive Outfit Accordion
  initDressCodeAccordion();

  // 10. Pop-up Registration Modal Handlers
  initRegistrationModal();

  // 10. Venue Map Popup Modal (Google Maps)
  initVenueMapModal();

  // 11. Calendar Dropdown Picker (Google / Outlook / ICS)
  initCalendarDropdown();

  // 12. Chatbot Widget (Bierly AI Assistant)
  initChatbot();

  // 14. Cinematic Tech Portal Hero Opening Sequence
  initHeroIntroSequence();

  // 15. Bavarian Beer Pouring Easter Egg Interaction
  initBeerPourInteraction();
});

/* ─── CINEMATIC HERO OPENING INTRO SEQUENCE ─── */
function initHeroIntroSequence() {
  const heroSection = document.getElementById('hero');
  if (!heroSection) return;

  // Step 1: Laser horizon line sweeps subtly across center
  requestAnimationFrame(() => {
    heroSection.classList.add('hero-intro-laser-sweep');
  });

  // Step 2 (180ms): Title, countdown, and CTA elements gracefully rise with gold shimmer
  setTimeout(() => {
    heroSection.classList.add('hero-intro-open');
  }, 180);

  // Step 3 (600ms): Laser horizon line fades out cleanly
  setTimeout(() => {
    heroSection.classList.add('hero-intro-laser-fade');
  }, 600);

  // Step 4 (1200ms): Clean up laser element DOM footprint
  setTimeout(() => {
    const laser = document.getElementById('heroIntroLaser');
    if (laser) laser.style.display = 'none';
  }, 1200);
}

/* ─── SCROLL REVEAL OBSERVER ─── */
function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale, .reveal-group');

  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -40px 0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        obs.unobserve(entry.target);
      }
    });
  }, observerOptions);

  reveals.forEach(el => observer.observe(el));
}

/* ─── HERO BACKGROUND SLIDER (CROSS-FADE + KEN BURNS ZOOM OUT) ─── */
function initHeroBgSlider() {
  const slider = document.getElementById('heroBgSlider');
  if (!slider) return;
  const slides = Array.from(slider.querySelectorAll('.hero-bg-slide'));
  if (slides.length <= 1) return;

  let currentIndex = 0;
  const SLIDE_INTERVAL = 6500; // 6.5s per slide

  // Preload all background images
  slides.forEach(slide => {
    const styleBg = slide.style.backgroundImage || '';
    const match = styleBg.match(/url\(['"]?(.*?)['"]?\)/i);
    if (match && match[1]) {
      const img = new Image();
      img.src = match[1];
    }
  });

  function nextSlide() {
    const prevSlide = slides[currentIndex];
    currentIndex = (currentIndex + 1) % slides.length;
    const nextSlide = slides[currentIndex];

    // Clear any leftover inline styles so CSS classes take full effect
    nextSlide.style.opacity = '';
    nextSlide.style.transform = '';
    nextSlide.style.transition = '';

    // Activate next slide
    nextSlide.classList.remove('leaving');
    nextSlide.classList.add('active');

    // Fade out previous slide
    prevSlide.classList.remove('active');
    prevSlide.classList.add('leaving');

    // Clean up leaving state after transition completes
    setTimeout(() => {
      prevSlide.classList.remove('leaving');
      prevSlide.style.opacity = '';
      prevSlide.style.transform = '';
      prevSlide.style.transition = '';
    }, 2000);
  }

  let timer = setInterval(nextSlide, SLIDE_INTERVAL);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(timer);
    } else {
      clearInterval(timer);
      timer = setInterval(nextSlide, SLIDE_INTERVAL);
    }
  });
}

/* ─── BEER BUBBLES CANVAS ANIMATION ─── */
function initBeerBubbles() {
  const canvas = document.getElementById('bubblesCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let width = canvas.width = canvas.parentElement.offsetWidth;
  let height = canvas.height = canvas.parentElement.offsetHeight;

  window.addEventListener('resize', () => {
    width = canvas.width = canvas.parentElement.offsetWidth;
    height = canvas.height = canvas.parentElement.offsetHeight;
  });

  const bubbles = [];
  const bubbleCount = Math.floor(width / 25);

  for (let i = 0; i < bubbleCount; i++) {
    bubbles.push({
      x: Math.random() * width,
      y: height + Math.random() * 200,
      radius: Math.random() * 4 + 1.5,
      speed: Math.random() * 1.5 + 0.5,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: Math.random() * 0.05 + 0.02,
      opacity: Math.random() * 0.6 + 0.2
    });
  }

  function render() {
    ctx.clearRect(0, 0, width, height);

    bubbles.forEach(b => {
      b.y -= b.speed;
      b.wobble += b.wobbleSpeed;
      b.x += Math.sin(b.wobble) * 0.5;

      if (b.y < -20) {
        b.y = height + 20;
        b.x = Math.random() * width;
      }

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 230, 150, ${b.opacity})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(b.x - b.radius * 0.3, b.y - b.radius * 0.3, b.radius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${b.opacity * 0.8})`;
      ctx.fill();
    });

    requestAnimationFrame(render);
  }

  render();
}

/* ─── COUNTDOWN TIMER WITH MATRIX SCRAMBLE INTRO ─── */
function initCountdownTimer(targetDate) {
  const cdDays = document.getElementById('cdDays');
  const cdHours = document.getElementById('cdHours');
  const cdMinutes = document.getElementById('cdMinutes');
  const cdSeconds = document.getElementById('cdSeconds');

  if (!cdDays || !cdHours || !cdMinutes || !cdSeconds) return;

  function getRemaining() {
    const now = new Date().getTime();
    const distance = targetDate.getTime() - now;

    if (distance < 0) {
      return { days: '00', hours: '00', minutes: '00', seconds: '00' };
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    return {
      days: String(days).padStart(2, '0'),
      hours: String(hours).padStart(2, '0'),
      minutes: String(minutes).padStart(2, '0'),
      seconds: String(seconds).padStart(2, '0')
    };
  }

  function update() {
    const r = getRemaining();
    cdDays.textContent = r.days;
    cdHours.textContent = r.hours;
    cdMinutes.textContent = r.minutes;
    cdSeconds.textContent = r.seconds;
  }

  // MATRIX SCRAMBLE INTRO: Fast randomized numbers -> Decelerate -> Snap lock-in
  const items = [
    { el: cdDays, key: 'days', lockTime: 650 },
    { el: cdHours, key: 'hours', lockTime: 850 },
    { el: cdMinutes, key: 'minutes', lockTime: 1050 },
    { el: cdSeconds, key: 'seconds', lockTime: 1250 }
  ];

  let startTimestamp = null;
  const totalScrambleDuration = 1300;

  function random2Digits() {
    return String(Math.floor(Math.random() * 90) + 10);
  }

  function scrambleStep(timestamp) {
    if (!startTimestamp) startTimestamp = timestamp;
    const elapsed = timestamp - startTimestamp;
    const finalVals = getRemaining();

    items.forEach(item => {
      if (elapsed < item.lockTime) {
        item.el.textContent = random2Digits();
        item.el.classList.add('scrambling');
      } else {
        item.el.textContent = finalVals[item.key];
        if (item.el.classList.contains('scrambling')) {
          item.el.classList.remove('scrambling');
          item.el.classList.add('locked-in');
          setTimeout(() => item.el.classList.remove('locked-in'), 350);
        }
      }
    });

    if (elapsed < totalScrambleDuration) {
      requestAnimationFrame(scrambleStep);
    } else {
      update();
      setInterval(update, 1000);
    }
  }

  // Synchronize start with Hero Entrance
  setTimeout(() => {
    requestAnimationFrame(scrambleStep);
  }, 400);
}

/* ─── BAVARIAN BEER POURING INTERACTION (EASTER EGG) ─── */
function initBeerPourInteraction() {
  const pourBtn = document.getElementById('beerPourBtn');
  const btnIcon = document.getElementById('beerBtnIcon');
  const flyer = document.getElementById('beerFlyer');
  const stream = document.getElementById('beerStream');
  const cardDays = document.getElementById('cardDays');
  const cardHours = document.getElementById('cardHours');
  const cardMinutes = document.getElementById('cardMinutes');
  const cardSeconds = document.getElementById('cardSeconds');

  if (!pourBtn || !flyer || !stream || !cardDays || !cardHours || !cardMinutes || !cardSeconds) return;

  const cards = [cardDays, cardHours, cardMinutes, cardSeconds];
  let isPouring = false;
  let isFilledState = false;

  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  pourBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (isPouring) return;

    // If already filled, clicking again will empty/reset the beer
    if (isFilledState) {
      cards.forEach(c => c.classList.remove('beer-filled'));
      isFilledState = false;
      return;
    }

    isPouring = true;
    isFilledState = true;

    // 1. Get initial position of the trigger button
    const btnRect = pourBtn.getBoundingClientRect();
    const startX = btnRect.left + btnRect.width / 2;
    const startY = btnRect.top + btnRect.height / 2;

    // Position flyer at the button
    flyer.style.transition = 'none';
    flyer.style.left = `${startX - 18}px`;
    flyer.style.top = `${startY - 18}px`;
    flyer.style.transform = 'scale(1) rotate(0deg)';
    flyer.style.opacity = '1';

    // Hide static button icon during flight
    if (btnIcon) btnIcon.style.opacity = '0';

    // Force layout reflow
    flyer.offsetHeight;

    // Enable smooth flight transition
    flyer.style.transition = 'left 0.42s cubic-bezier(0.25, 1, 0.5, 1), top 0.42s cubic-bezier(0.25, 1, 0.5, 1), transform 0.42s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.2s ease';

    // 2. Sequentially pour into each card
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const cardRect = card.getBoundingClientRect();
      const cardCenterX = cardRect.left + cardRect.width / 2;

      // Target position: place mug to the right of card center so mouth tilts directly over card
      const targetMugX = cardCenterX + 18;
      const targetMugY = cardRect.top - 62;

      // Fly to target card and tilt
      flyer.style.left = `${targetMugX}px`;
      flyer.style.top = `${targetMugY}px`;
      flyer.style.transform = 'scale(1.7) rotate(-42deg)';

      await wait(420);

      // Position beer stream precisely from the mouth (foam rim) of the tilted mug
      const spoutX = targetMugX - 2;
      const spoutY = targetMugY + 34;
      const streamHeight = Math.max(22, cardRect.top - spoutY + 12);

      stream.style.left = `${spoutX}px`;
      stream.style.top = `${spoutY}px`;
      stream.style.height = `${streamHeight}px`;
      stream.style.opacity = '1';

      // Start filling liquid in current card
      card.classList.add('beer-filled');

      await wait(520);

      // Stop stream before moving to next card
      stream.style.opacity = '0';
      await wait(80);
    }

    // 3. Return flight back to home button
    const currentBtnRect = pourBtn.getBoundingClientRect();
    const returnX = currentBtnRect.left + currentBtnRect.width / 2;
    const returnY = currentBtnRect.top + currentBtnRect.height / 2;

    flyer.style.left = `${returnX - 18}px`;
    flyer.style.top = `${returnY - 18}px`;
    flyer.style.transform = 'scale(1) rotate(0deg)';

    await wait(450);

    flyer.style.opacity = '0';
    if (btnIcon) {
      btnIcon.style.opacity = '1';
      pourBtn.style.animation = 'none';
      pourBtn.offsetHeight;
      pourBtn.style.animation = 'chatFabPulse 1s ease';
    }

    isPouring = false;
  });
}

/* ─── AUTO-PLAY MEMORIES SLIDER (2022 ONLY) ─── */
function initMemoriesSlider() {
  const track = document.getElementById('sliderTrack');
  const prevBtn = document.getElementById('sliderPrevBtn');
  const nextBtn = document.getElementById('sliderNextBtn');
  const slideCounterEl = document.querySelector('.slide-counter');
  const progressFillEl = document.getElementById('sliderProgressFill');
  const progressTrackEl = document.getElementById('sliderProgressTrack');

  if (!track) return;

  let allSlides = Array.from(track.children);
  let currentIndex = 0;
  let autoTimer = null;

  function getItemsPerView() {
    if (window.innerWidth <= 768) return 1;
    if (window.innerWidth <= 1024) return 2;
    return 3;
  }

  function maxIndex() {
    const perView = getItemsPerView();
    return Math.max(0, allSlides.length - perView);
  }

  function updateSliderPosition() {
    const perView = getItemsPerView();
    const slidePercent = 100 / perView;
    track.style.transform = `translateX(-${currentIndex * slidePercent}%)`;
    updatePagination();
  }

  function updatePagination() {
    const totalPhotos = allSlides.length;
    if (totalPhotos <= 0) return;

    let currentPhoto = currentIndex + 1;
    if (currentPhoto > totalPhotos) currentPhoto = totalPhotos;

    if (slideCounterEl) {
      slideCounterEl.innerHTML = `
        <span id="currentSlideNum" class="counter-num-active">${String(currentPhoto).padStart(2, '0')}</span>
        <span class="counter-slash">/</span>
        <span id="totalSlideNum" class="counter-num-total">${String(totalPhotos).padStart(2, '0')}</span>
      `;
    }

    if (progressFillEl) {
      const percentage = (currentPhoto / totalPhotos) * 100;
      progressFillEl.style.width = `${percentage}%`;
    }
  }

  function handleSeek(e) {
    if (!progressTrackEl) return;
    const rect = progressTrackEl.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, clickX / width));

    const totalPages = maxIndex();
    if (totalPages <= 0) {
      currentIndex = 0;
    } else {
      const targetIndex = Math.round(percentage * totalPages);
      currentIndex = Math.max(0, Math.min(totalPages, targetIndex));
    }

    updateSliderPosition();
    resetTimer();
  }

  if (progressTrackEl) {
    let isDragging = false;
    progressTrackEl.addEventListener('click', handleSeek);
    progressTrackEl.addEventListener('mousedown', (e) => {
      isDragging = true;
      handleSeek(e);
    });
    window.addEventListener('mousemove', (e) => {
      if (isDragging) handleSeek(e);
    });
    window.addEventListener('mouseup', () => {
      isDragging = false;
    });
    progressTrackEl.addEventListener('touchstart', (e) => {
      isDragging = true;
      if (e.touches.length > 0) handleSeek(e.touches[0]);
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (isDragging && e.touches.length > 0) handleSeek(e.touches[0]);
    }, { passive: true });
    window.addEventListener('touchend', () => {
      isDragging = false;
    });
  }

  function nextSlide() {
    if (currentIndex >= maxIndex()) {
      currentIndex = 0;
    } else {
      currentIndex++;
    }
    updateSliderPosition();
  }

  function prevSlide() {
    if (currentIndex <= 0) {
      currentIndex = maxIndex();
    } else {
      currentIndex--;
    }
    updateSliderPosition();
  }

  function startTimer() {
    stopTimer();
    autoTimer = setInterval(nextSlide, 4000);
  }

  function stopTimer() {
    if (autoTimer) clearInterval(autoTimer);
  }

  function resetTimer() {
    startTimer();
  }

  if (nextBtn) nextBtn.addEventListener('click', () => { nextSlide(); resetTimer(); });
  if (prevBtn) prevBtn.addEventListener('click', () => { prevSlide(); resetTimer(); });

  track.parentElement.addEventListener('mouseenter', stopTimer);
  track.parentElement.addEventListener('mouseleave', startTimer);

  window.addEventListener('resize', () => {
    if (currentIndex > maxIndex()) currentIndex = maxIndex();
    updateSliderPosition();
  });

  // Gắn sự kiện click/tap cho toàn bộ khung ảnh để mở trực tiếp Lightbox Zoom (ngoại trừ thẻ video đã có handler riêng)
  document.querySelectorAll('.gallery-item').forEach(item => {
    if (item.classList.contains('gallery-video-item')) return;
    item.addEventListener('click', () => {
      const img = item.querySelector('img');
      const caption = 'mgm Oktoberfest';
      if (img && (img.currentSrc || img.src)) {
        openLightbox(img.currentSrc || img.src, caption);
      }
    });
  });

  // Init position & controls
  updateSliderPosition();
  startTimer();
}

/* ─── DRESS CODE 2-IMAGE ROTATING SLIDESHOW ─── */
function initDressCodeSlider() {
  const container = document.getElementById('dresscodeSlider');
  if (!container) return;

  const slides = container.querySelectorAll('.dresscode-slide');
  if (slides.length <= 1) return;

  let activeIndex = 0;
  setInterval(() => {
    slides[activeIndex].classList.remove('active');
    activeIndex = (activeIndex + 1) % slides.length;
    slides[activeIndex].classList.add('active');
  }, 3500);
}

/* ─── DRESS CODE INTERACTIVE OUTFIT ACCORDION ─── */
function initDressCodeAccordion() {
  const accordion = document.getElementById('attireAccordion');
  if (!accordion) return;

  const items = accordion.querySelectorAll('.attire-accordion-item');

  items.forEach(item => {
    const header = item.querySelector('.attire-accordion-header');
    if (!header) return;

    header.addEventListener('click', (e) => {
      e.preventDefault();
      const isActive = item.classList.contains('active');

      // Close all items
      items.forEach(i => {
        i.classList.remove('active');
        const btn = i.querySelector('.attire-accordion-header');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      });

      // If clicked item wasn't active, expand it
      if (!isActive) {
        item.classList.add('active');
        header.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

/* ─── LIGHTBOX MODAL (PHOTO, VIDEO & TRANSPARENT PNG SUPPORT) ─── */
function openOutfitLightbox(imgUrl, titleText, descText) {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxVideo = document.getElementById('lightboxVideo');
  const lightboxCaption = document.getElementById('lightboxCaption');

  if (!lightbox) return;

  if (lightboxVideo) {
    lightboxVideo.pause();
    lightboxVideo.style.display = 'none';
    lightboxVideo.src = '';
  }

  if (lightboxImg) {
    lightboxImg.style.display = 'block';
    lightboxImg.src = imgUrl;
    lightboxImg.alt = titleText || 'Outfit Inspiration';
  }

  if (lightboxCaption) {
    lightboxCaption.innerHTML = `
      <span style="font-size: 1.25rem; font-weight: 800; color: var(--accent-amber); display: block; margin-bottom: 0.35rem;">${titleText || ''}</span>
      <span style="font-size: 0.92rem; color: #cbd5e1; font-weight: 400; max-width: 440px; display: inline-block; line-height: 1.5;">${descText || ''}</span>
    `;
  }

  lightbox.classList.add('png-mode');
  lightbox.classList.add('active');
  document.body.style.overflow = 'hidden';

  if (window.lucide) window.lucide.createIcons();
}

function openLightbox(imgUrl, captionText) {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxVideo = document.getElementById('lightboxVideo');
  const lightboxCaption = document.getElementById('lightboxCaption');

  if (lightbox) {
    lightbox.classList.remove('png-mode');
    if (lightboxVideo) {
      lightboxVideo.pause();
      lightboxVideo.style.display = 'none';
      lightboxVideo.src = '';
    }
    if (lightboxImg) {
      lightboxImg.style.display = 'block';
      lightboxImg.src = imgUrl;
      lightboxImg.alt = captionText || 'Photo';
    }
    if (lightboxCaption) {
      lightboxCaption.textContent = captionText || '';
    }
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function openVideoLightbox(videoUrl, captionText) {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxVideo = document.getElementById('lightboxVideo');
  const lightboxCaption = document.getElementById('lightboxCaption');

  if (lightbox) {
    lightbox.classList.remove('png-mode');
    if (lightboxImg) {
      lightboxImg.style.display = 'none';
      lightboxImg.src = '';
    }
    if (lightboxVideo) {
      lightboxVideo.style.display = 'block';
      lightboxVideo.src = videoUrl;
      lightboxVideo.play().catch(() => {});
    }
    if (lightboxCaption) {
      lightboxCaption.textContent = captionText || '';
    }
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  const lightboxVideo = document.getElementById('lightboxVideo');
  if (lightbox) {
    lightbox.classList.remove('active');
    lightbox.classList.remove('png-mode');
    document.body.style.overflow = '';
    if (lightboxVideo) {
      lightboxVideo.pause();
      lightboxVideo.src = '';
    }
  }
}

function initLightbox() {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;

  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('active')) {
      closeLightbox();
    }
  });
}

/* ─── POP-UP REGISTRATION MODAL (JOTFORM EMBED WITH TURNSTILE GATE) ─── */
function initRegistrationModal() {
  const regModal = document.getElementById('registrationModal');
  const closeRegBtn = document.getElementById('closeRegModalBtn');
  const regGate = document.getElementById('regTurnstileGate');
  const regTurnstileWidget = document.getElementById('regTurnstileWidget');

  if (!regModal) return;

  const isLocalEnv = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const TURNSTILE_SITE_KEY = isLocalEnv 
    ? '1x00000000000000000000AA'
    : '0x4AAAAAAET4fD_Tfcn4nfGF';

  let regTurnstileId = null;
  let isRegVerified = false;

  function renderRegTurnstile() {
    if (isRegVerified) {
      if (regGate) {
        regGate.classList.add('verified');
        regGate.style.display = 'none';
      }
      return;
    }

    if (window.turnstile && regTurnstileWidget && regTurnstileId === null) {
      try {
        regTurnstileId = window.turnstile.render(regTurnstileWidget, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'dark',
          size: 'compact',
          callback: (token) => {
            isRegVerified = true;
            // Short smooth delay so user sees verification checkmark
            setTimeout(() => {
              if (regGate) {
                regGate.classList.add('verified');
                setTimeout(() => {
                  regGate.style.display = 'none';
                }, 300);
              }
            }, 300);
          },
          'expired-callback': () => {
            isRegVerified = false;
            if (window.turnstile && regTurnstileId !== null) {
              window.turnstile.reset(regTurnstileId);
            }
          },
          'error-callback': (code) => {
            console.warn('Registration Turnstile bypass on error:', code);
            if (regGate) {
              regGate.classList.add('verified');
              regGate.style.display = 'none';
            }
          }
        });
      } catch (e) {
        console.warn('Registration Turnstile init notice:', e);
        if (regGate) {
          regGate.classList.add('verified');
          regGate.style.display = 'none';
        }
      }
    }
  }

  const openModal = () => {
    regModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (window.lucide) window.lucide.createIcons();

    // Render Turnstile verification after modal transition
    setTimeout(renderRegTurnstile, 300);
  };

  const closeModal = () => {
    regModal.classList.remove('active');
    document.body.style.overflow = '';
  };

  document.querySelectorAll('.open-reg-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });
  });

  if (closeRegBtn) closeRegBtn.addEventListener('click', closeModal);

  regModal.addEventListener('click', (e) => {
    if (e.target === regModal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && regModal.classList.contains('active')) closeModal();
  });
}

/* ─── VENUE MAP POP-UP MODAL (GOOGLE MAPS) ─── */
function initVenueMapModal() {
  const mapModal = document.getElementById('mapModal');
  const closeMapBtn = document.getElementById('closeMapModalBtn');
  const mapIframe = document.getElementById('mapIframe');
  const mapModalBadge = document.getElementById('mapModalBadge');
  const mapModalBadgeText = document.getElementById('mapModalBadgeText');
  const mapModalTitle = document.getElementById('mapModalTitle');
  const mapModalAddress = document.getElementById('mapModalAddress');
  const openExternalGmapsBtn = document.getElementById('openExternalGmapsBtn');
  const tabBtns = document.querySelectorAll('.map-tab-btn');

  if (!mapModal || !mapIframe) return;

  const venues = {
    danang: {
      badge: 'Event Venue',
      isVenue: true,
      title: 'mgm Da Nang Office',
      address: '71 Quang Trung, Hai Chau Ward, Da Nang',
      embedUrl: 'https://maps.google.com/maps?q=mgm+technology+partners+Vietnam,+71+Quang+Trung,+Da+Nang&t=&z=16&ie=UTF8&iwloc=&output=embed',
      externalUrl: 'https://maps.google.com/?q=mgm+technology+partners+Vietnam,+71+Quang+Trung,+Da+Nang'
    },
    'danang-pct': {
      badge: 'mgm office',
      isVenue: false,
      title: 'mgm Da Nang Office (Phan Chau Trinh)',
      address: '7 Phan Chau Trinh, Hai Chau Ward, Da Nang',
      embedUrl: 'https://maps.google.com/maps?q=mgm+technology+partners+Vietnam,+7+Phan+Chau+Trinh,+Da+Nang&t=&z=16&ie=UTF8&iwloc=&output=embed',
      externalUrl: 'https://maps.google.com/?q=mgm+technology+partners+Vietnam,+7+Phan+Chau+Trinh,+Da+Nang'
    },
    hcmc: {
      badge: 'Event Venue',
      isVenue: true,
      title: 'mgm HCMC Office',
      address: '195A Hai Ba Trung, Xuan Hoa Ward, HCMC',
      embedUrl: 'https://maps.google.com/maps?q=mgm+technology+partners+Vietnam,+195A+Hai+Ba+Trung,+Ho+Chi+Minh&t=&z=16&ie=UTF8&iwloc=&output=embed',
      externalUrl: 'https://maps.google.com/?q=mgm+technology+partners+Vietnam,+195A+Hai+Ba+Trung,+Ho+Chi+Minh'
    }
  };

  function setVenue(key) {
    const venue = venues[key] || venues.danang;

    if (mapModalTitle) mapModalTitle.textContent = venue.title;
    if (mapModalAddress) mapModalAddress.textContent = venue.address;
    if (openExternalGmapsBtn) openExternalGmapsBtn.href = venue.externalUrl;
    
    if (mapModalBadgeText) mapModalBadgeText.textContent = venue.badge;
    if (mapModalBadge) {
      mapModalBadge.classList.toggle('badge-office', !venue.isVenue);
    }

    // Only update iframe src if changed to prevent unnecessary reloads
    if (mapIframe.getAttribute('data-active-src') !== venue.embedUrl) {
      mapIframe.setAttribute('data-active-src', venue.embedUrl);
      mapIframe.src = venue.embedUrl;
    }

    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.targetVenue === key);
    });
  }

  function openMap(venueKey = 'danang') {
    setVenue(venueKey);
    mapModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (window.lucide) window.lucide.createIcons();
  }

  function closeMap() {
    mapModal.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Trigger buttons (in Hero section and anywhere with .venue-modal-trigger)
  document.querySelectorAll('.venue-modal-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const venueKey = btn.dataset.venue || 'danang';
      openMap(venueKey);
    });
  });

  // Switch tabs inside modal
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const venueKey = btn.dataset.targetVenue;
      if (venueKey) setVenue(venueKey);
    });
  });

  if (closeMapBtn) closeMapBtn.addEventListener('click', closeMap);

  mapModal.addEventListener('click', (e) => {
    if (e.target === mapModal) closeMap();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mapModal.classList.contains('active')) closeMap();
  });
}

/* ─── ADD TO CALENDAR (LOCATION-AWARE: DA NANG & HCMC) ─── */
function initCalendarDropdown() {
  const btn = document.getElementById('calendarDropdownBtn');
  const dropdown = document.getElementById('calendarDropdown');
  if (!btn || !dropdown) return;

  const venueData = {
    danang: {
      name: 'Da Nang',
      location: 'mgm Da Nang Office (71 Quang Trung, Hai Chau Ward, Da Nang)',
      description: 'Join us for mgm Oktoberfest 2026 celebration at mgm Da Nang Office & Terrace (71 Quang Trung, Hai Chau Ward)! Authentic Bavarian food, craft beers & high energy music.'
    },
    hcmc: {
      name: 'HCMC',
      location: 'mgm HCMC Lounge (195A Hai Ba Trung, Xuan Hoa Ward, HCMC)',
      description: 'Join us for mgm Oktoberfest 2026 celebration at mgm HCMC Lounge (195A Hai Ba Trung, Xuan Hoa Ward)! Authentic Bavarian food, craft beers & high energy music.'
    }
  };

  let currentVenue = localStorage.getItem('oktoberfest_venue') || 'danang';

  function getCurrentEvent() {
    const v = venueData[currentVenue] || venueData.danang;
    return {
      title: `mgm - Oktoberfest 2026 (${v.name})`,
      description: v.description,
      location: v.location,
      startUtc: "20260919T103000Z",
      endUtc: "20260919T150000Z",
      startIsoUtc: "2026-09-19T10:30:00Z",
      endIsoUtc: "2026-09-19T15:00:00Z"
    };
  }

  function setCalendarVenue(key, statusText) {
    if (!venueData[key]) key = 'danang';
    currentVenue = key;
    try { localStorage.setItem('oktoberfest_venue', key); } catch (e) {}

    dropdown.querySelectorAll('.cal-venue-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.calVenue === key);
    });

    const detectedEl = document.getElementById('calVenueDetected');
    if (detectedEl && statusText) {
      detectedEl.textContent = statusText;
    }
  }

  // Automatic Location Detection (IP Geolocation)
  async function detectLocation() {
    const saved = localStorage.getItem('oktoberfest_venue');
    if (saved && (saved === 'danang' || saved === 'hcmc')) {
      setCalendarVenue(saved, '');
      return;
    }

    try {
      const res = await fetch('https://ipwho.is/', { cache: 'no-cache' });
      if (!res.ok) throw new Error('IP lookup failed');
      const data = await res.json();
      if (data && data.success) {
        const city = (data.city || '').toLowerCase();
        const lat = data.latitude;
        let detected = 'danang';
        if (city.includes('ho chi minh') || city.includes('saigon') || city.includes('can tho') || city.includes('binh duong') || (lat && lat < 13.5)) {
          detected = 'hcmc';
        } else {
          detected = 'danang';
        }
        setCalendarVenue(detected, `(${data.city || (detected === 'hcmc' ? 'HCMC' : 'Da Nang')})`);
      }
    } catch (err) {
      setCalendarVenue(currentVenue, '');
    }
  }

  // Venue button switcher in dropdown
  dropdown.querySelectorAll('.cal-venue-btn').forEach(vBtn => {
    vBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const vKey = vBtn.dataset.calVenue;
      setCalendarVenue(vKey, '');
    });
  });

  function buildIcs() {
    const ev = getCurrentEvent();
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//mgm technology partners//mgm Oktoberfest 2026//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:oktoberfest-2026-' + currentVenue + '@mgm-tp.com',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z',
      'DTSTART:' + ev.startUtc,
      'DTEND:' + ev.endUtc,
      'SUMMARY:' + ev.title,
      'DESCRIPTION:' + ev.description.replace(/\n/g, '\\n'),
      'LOCATION:' + ev.location,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
  }

  function downloadIcs() {
    const ev = getCurrentEvent();
    const blob = new Blob([buildIcs()], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `mgm_Oktoberfest_2026_${currentVenue.toUpperCase()}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(link.href);
  }

  function openOutlook() {
    const ev = getCurrentEvent();
    const params = new URLSearchParams({
      path: '/calendar/action/compose',
      rru: 'addevent',
      subject: ev.title,
      body: ev.description,
      location: ev.location,
      startdt: ev.startIsoUtc,
      enddt: ev.endIsoUtc
    });
    const webUrl = `https://webmail.mgm-tp.com/owa/?${params.toString()}`;
    window.open(webUrl, '_blank');
  }

  function openGoogle() {
    const ev = getCurrentEvent();
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(ev.title)}&details=${encodeURIComponent(ev.description)}&location=${encodeURIComponent(ev.location)}&dates=${ev.startUtc}/${ev.endUtc}`;
    window.open(url, '_blank');
  }

  // Toggle dropdown
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('active');
    if (window.lucide) window.lucide.createIcons();
  });

  // Handle option clicks
  dropdown.querySelectorAll('.cal-option').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = opt.dataset.calendar;
      if (type === 'outlook' || type === 'mgm') openOutlook();
      else if (type === 'google') openGoogle();
      else downloadIcs();
      dropdown.classList.remove('active');
    });
  });

  // Close on outside click
  document.addEventListener('click', () => {
    dropdown.classList.remove('active');
  });

  // Start auto-detecting location
  detectLocation();
}

/* ─── CHARACTER GREETINGS (HOA & LOAN TALK FRAMES) ─── */
function initCharacterGreetings() {
  const flankHoa = document.getElementById('flankHoa');
  const flankLoan = document.getElementById('flankLoan');
  const bubbleHoa = document.getElementById('bubbleHoa');
  const bubbleLoan = document.getElementById('bubbleLoan');

  const textHoaEl = bubbleHoa ? bubbleHoa.querySelector('.speech-text') : null;
  const textLoanEl = bubbleLoan ? bubbleLoan.querySelector('.speech-text') : null;

  // Danh sách câu chào xen kẽ (giữ 2 câu ban đầu ở đầu mảng)
  const hoaQuotes = [
    'Welcome to the event!',
    'Welcome to the biggest beer fest! 🍻',
    "Raise your glass, let's party hard!",
    'Hey there! Ready for some cold beer?',
    'Nhậu đeee...!',
    'Welcome to Oktoberfest!',
    'Sẽ là một đêm lễ hội tuyệt vời',
    'Feeling thirsty? Come on in!',
    "Don't be shy, join the party!"
  ];

  const loanQuotes = [
    "Can't wait to see you!",
    'Grab a glass, join the party!',
    'Cheers to cold beer!',
    'Welcome to the beer fest!',
    "Prost! Let’s drink and dance!",
    'Step in, enjoy the finest brew!',
    'Raise your steins, have a blast!',
    'Ready for the best beer in town?',
    'Grab a seat, the madness begins!'
  ];

  let hoaIndex = 0;
  let loanIndex = 0;
  let timerHoa = null;
  let timerLoan = null;

  if (flankHoa && bubbleHoa) {
    flankHoa.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = bubbleHoa.classList.contains('active');
      if (bubbleLoan) bubbleLoan.classList.remove('active');
      clearTimeout(timerLoan);

      if (isActive) {
        // Chuyển sang câu tiếp theo khi đang mở
        hoaIndex = (hoaIndex + 1) % hoaQuotes.length;
        if (textHoaEl) textHoaEl.textContent = hoaQuotes[hoaIndex];
        bubbleHoa.classList.remove('active');
        void bubbleHoa.offsetWidth; // kích hoạt animation pop lại
        bubbleHoa.classList.add('active');
      } else {
        if (textHoaEl) textHoaEl.textContent = hoaQuotes[hoaIndex];
        hoaIndex = (hoaIndex + 1) % hoaQuotes.length;
        bubbleHoa.classList.add('active');
      }

      // Hiệu ứng pháo hoa giấy vui tươi
      if (window.confetti) {
        const rect = flankHoa.getBoundingClientRect();
        window.confetti({
          particleCount: 20,
          spread: 50,
          origin: {
            x: (rect.left + rect.width / 2) / window.innerWidth,
            y: (rect.top + 40) / window.innerHeight
          },
          colors: ['#f59e0b', '#fbbf24', '#ffffff']
        });
      }

      clearTimeout(timerHoa);
      timerHoa = setTimeout(() => {
        bubbleHoa.classList.remove('active');
      }, 4500);
    });
  }

  if (flankLoan && bubbleLoan) {
    flankLoan.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = bubbleLoan.classList.contains('active');
      if (bubbleHoa) bubbleHoa.classList.remove('active');
      clearTimeout(timerHoa);

      if (isActive) {
        // Chuyển sang câu tiếp theo khi đang mở
        loanIndex = (loanIndex + 1) % loanQuotes.length;
        if (textLoanEl) textLoanEl.textContent = loanQuotes[loanIndex];
        bubbleLoan.classList.remove('active');
        void bubbleLoan.offsetWidth; // kích hoạt animation pop lại
        bubbleLoan.classList.add('active');
      } else {
        if (textLoanEl) textLoanEl.textContent = loanQuotes[loanIndex];
        loanIndex = (loanIndex + 1) % loanQuotes.length;
        bubbleLoan.classList.add('active');
      }

      // Hiệu ứng pháo hoa giấy vui tươi
      if (window.confetti) {
        const rect = flankLoan.getBoundingClientRect();
        window.confetti({
          particleCount: 20,
          spread: 50,
          origin: {
            x: (rect.left + rect.width / 2) / window.innerWidth,
            y: (rect.top + 40) / window.innerHeight
          },
          colors: ['#f59e0b', '#0284c7', '#ffffff']
        });
      }

      clearTimeout(timerLoan);
      timerLoan = setTimeout(() => {
        bubbleLoan.classList.remove('active');
      }, 4500);
    });
  }

  // Click outside to dismiss bubbles
  document.addEventListener('click', () => {
    if (bubbleHoa) bubbleHoa.classList.remove('active');
    if (bubbleLoan) bubbleLoan.classList.remove('active');
    clearTimeout(timerHoa);
    clearTimeout(timerLoan);
  });
}

/* ─── TOAST NOTIFICATION SYSTEM (COMING SOON) ─── */
function showComingSoonToast(title = 'Minigame Coming Soon! 🎮', message = 'Our Oktoberfest mini-game is currently under brewing. Stay tuned!') {
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = 'toast-item toast-coming-soon';
  toast.innerHTML = `
    <div class="toast-icon-circle">
      <i data-lucide="gamepad-2"></i>
    </div>
    <div class="toast-body">
      <strong class="toast-title">${title}</strong>
      <p class="toast-msg">${message}</p>
    </div>
    <button class="toast-close-btn" aria-label="Close">&times;</button>
  `;

  toastContainer.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  // Animation in
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  const removeToast = () => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 350);
  };

  const closeBtn = toast.querySelector('.toast-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', removeToast);

  // Auto dismiss after 4.5 seconds
  setTimeout(removeToast, 4500);
}

/* ─── CHATBOT WIDGET — BIERLY AI ASSISTANT (PROTECTED BY CLOUDFLARE TURNSTILE) ─── */
function initChatbot() {
  const fab = document.getElementById('chatFab');
  const panel = document.getElementById('chatPanel');
  const closeBtn = document.getElementById('chatCloseBtn');
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSendBtn');
  const messagesEl = document.getElementById('chatMessages');
  const suggestionsEl = document.getElementById('chatSuggestions');

  if (!fab || !panel) return;

  const conversationHistory = [];
  let isWaiting = false;
  let turnstileToken = null;
  let turnstileWidgetId = null;
  // Dynamic Sitekey: Official Cloudflare Test Key for localhost/127.0.0.1, Production Key for live domains
  const isLocalEnv = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const TURNSTILE_SITE_KEY = isLocalEnv 
    ? '1x00000000000000000000AA' // Cloudflare Official Test Key (always passes on any local port)
    : '0x4AAAAAAET4fD_Tfcn4nfGF'; // Production Key for mgm-oktoberfest-2026.vercel.app & oktoberfest.mgmvn.events

  // Determine API endpoint
  const chatApiUrl = '/api/chat';

  // Initialize Cloudflare Turnstile Widget ONLY when visible
  function initTurnstile() {
    if (!window.turnstile || turnstileWidgetId !== null) return;

    const wrapper = document.getElementById('chatTurnstileWrapper');
    const container = document.getElementById('chatTurnstile');
    if (!container) return;

    try {
      turnstileWidgetId = window.turnstile.render(container, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'dark',
        size: 'compact',
        callback: (token) => {
          turnstileToken = token;
          if (wrapper) wrapper.style.display = 'none'; // Hide once verified smoothly
        },
        'expired-callback': () => {
          turnstileToken = null;
          if (window.turnstile && turnstileWidgetId !== null) {
            window.turnstile.reset(turnstileWidgetId);
          }
        },
        'error-callback': (code) => {
          console.warn('Turnstile gracefully bypassed:', code);
          if (wrapper) wrapper.style.display = 'none'; // Never show an ugly error box
        }
      });
    } catch (e) {
      console.warn('Turnstile init notice:', e);
      if (wrapper) wrapper.style.display = 'none';
    }
  }

  // Toggle chat panel
  function toggleChat() {
    const isOpen = panel.classList.contains('open');
    if (isOpen) {
      panel.classList.remove('open');
      fab.classList.remove('active');
    } else {
      panel.classList.add('open');
      fab.classList.add('active');
      // Initialize Turnstile after panel animation completes
      setTimeout(initTurnstile, 350);
      if (input) input.focus();
    }
  }

  fab.addEventListener('click', toggleChat);
  if (closeBtn) closeBtn.addEventListener('click', toggleChat);

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('open')) {
      toggleChat();
    }
  });

  // Enable/disable send button based on input
  if (input && sendBtn) {
    input.addEventListener('input', () => {
      sendBtn.disabled = input.value.trim().length === 0 || isWaiting;
      // Auto-resize textarea
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 80) + 'px';
    });

    // Send on Enter (Shift+Enter for new line)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) handleSend();
      }
    });

    sendBtn.addEventListener('click', handleSend);
  }

  // Suggestion chips
  if (suggestionsEl) {
    suggestionsEl.querySelectorAll('.chat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const q = chip.getAttribute('data-q');
        if (q) {
          appendMessage('user', q);
          sendToAI(q);
          suggestionsEl.style.display = 'none';
        }
      });
    });
  }

  function handleSend() {
    const text = input.value.trim();
    if (!text || isWaiting) return;

    appendMessage('user', text);
    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;

    // Hide suggestions after first message
    if (suggestionsEl) suggestionsEl.style.display = 'none';

    sendToAI(text);
  }

  function formatChatText(rawText) {
    if (!rawText) return '';
    // 1. Escape HTML entities
    const escaped = rawText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    // 2. Format **bold**
    const bolded = escaped.replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--text-gold); font-weight:700;">$1</strong>');
    // 3. Format *italic*
    const italicized = bolded.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // 4. Convert double newlines to paragraph breaks, single newlines to <br>
    return italicized.replace(/\n\n/g, '<div style="height:8px;"></div>').replace(/\n/g, '<br>');
  }

  function appendMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'chat-msg-avatar';
    avatar.textContent = role === 'bot' ? '🍺' : '👤';

    const bubble = document.createElement('div');
    bubble.className = 'chat-msg-bubble';
    bubble.innerHTML = formatChatText(text);

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(bubble);
    messagesEl.appendChild(msgDiv);

    // Auto-scroll to bottom
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-typing';
    typingDiv.id = 'chatTyping';
    typingDiv.innerHTML = `
      <div class="chat-msg-avatar" style="background: linear-gradient(135deg, var(--accent-amber), var(--accent-amber-dark)); border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;">🍺</div>
      <div class="chat-typing-dots"><span></span><span></span><span></span></div>
    `;
    messagesEl.appendChild(typingDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    const t = document.getElementById('chatTyping');
    if (t) t.remove();
  }

  async function sendToAI(userMessage) {
    isWaiting = true;
    sendBtn.disabled = true;
    showTyping();

    // Add to history
    conversationHistory.push({ role: 'user', text: userMessage });

    // Trim history to last 20 turns
    const historyToSend = conversationHistory.slice(-20);

    try {
      const response = await fetch(chatApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: historyToSend.slice(0, -1), // exclude current message
          turnstileToken: turnstileToken
        })
      });

      const data = await response.json();

      hideTyping();

      if (response.ok && data.reply) {
        appendMessage('bot', data.reply);
        conversationHistory.push({ role: 'model', text: data.reply });
      } else {
        const errMsg = data.error || 'Oops! Something went wrong. Please try again. 🍺';
        appendMessage('bot', errMsg);
      }
    } catch (err) {
      hideTyping();
      appendMessage('bot', 'Could not connect to Bierly right now. Please try again later! 🍻');
      console.error('Chatbot fetch error:', err);
    }

    // Reset Turnstile token for next interaction
    if (window.turnstile && turnstileWidgetId !== null) {
      try {
        window.turnstile.reset(turnstileWidgetId);
        turnstileToken = null;
      } catch (e) {
        // ignore
      }
    }

    isWaiting = false;
    if (input.value.trim().length > 0) sendBtn.disabled = false;
  }
}
