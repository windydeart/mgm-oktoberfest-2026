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

window.addEventListener('pageshow', (e) => {
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  window.scrollTo(0, 0);
});

document.addEventListener('DOMContentLoaded', () => {
  // Always start at top on DOM ready
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  window.scrollTo(0, 0);

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
    mobileToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
    });
  }

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
        if (navMenu) navMenu.classList.remove('active');
        return;
      }

      if (anchor.classList.contains('open-reg-modal') || href === '#registration') {
        if (navMenu) navMenu.classList.remove('active');
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
        if (navMenu) navMenu.classList.remove('active');
      }
    });
  });

  // 4. Hero Beer Bubbles Canvas Animation
  initBeerBubbles();

  // 5. Countdown Timer (Target: Sat, 19 Sep 2026 17:00:00 GMT+7)
  initCountdownTimer(new Date('2026-09-19T17:00:00+07:00'));

  // 6. Scroll Reveal Observer
  initScrollReveal();

  // 7. Auto-play Memories Slider (4s)
  initMemoriesSlider();

  // 8. Pop-up Registration Modal Handlers
  initRegistrationModal();

  // 9. Character Greetings (Hoa & Loan Talk Frames)
  initCharacterGreetings();
});

/* ─── SCROLL REVEAL OBSERVER ─── */
function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal');

  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.12
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
      }
    });
  }, observerOptions);

  reveals.forEach(el => observer.observe(el));
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

/* ─── COUNTDOWN TIMER ─── */
function initCountdownTimer(targetDate) {
  const cdDays = document.getElementById('cdDays');
  const cdHours = document.getElementById('cdHours');
  const cdMinutes = document.getElementById('cdMinutes');
  const cdSeconds = document.getElementById('cdSeconds');

  if (!cdDays || !cdHours || !cdMinutes || !cdSeconds) return;

  function update() {
    const now = new Date().getTime();
    const distance = targetDate.getTime() - now;

    if (distance < 0) {
      cdDays.textContent = '00';
      cdHours.textContent = '00';
      cdMinutes.textContent = '00';
      cdSeconds.textContent = '00';
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    cdDays.textContent = String(days).padStart(2, '0');
    cdHours.textContent = String(hours).padStart(2, '0');
    cdMinutes.textContent = String(minutes).padStart(2, '0');
    cdSeconds.textContent = String(seconds).padStart(2, '0');
  }

  update();
  setInterval(update, 1000);
}

/* ─── AUTO-PLAY MEMORIES SLIDER ─── */
function initMemoriesSlider() {
  const track = document.getElementById('sliderTrack');
  const prevBtn = document.getElementById('sliderPrevBtn');
  const nextBtn = document.getElementById('sliderNextBtn');
  const filterTabs = document.querySelectorAll('.filter-tab');

  const slideCounterEl = document.querySelector('.slide-counter');
  const progressFillEl = document.getElementById('sliderProgressFill');
  const progressTrackEl = document.getElementById('sliderProgressTrack');
  const dotsContainer = document.getElementById('sliderDots');

  if (!track) return;

  let allSlides = Array.from(track.children);
  let visibleSlides = [...allSlides];
  let currentIndex = 0;
  let autoTimer = null;
  let currentFilter = 'all';

  function getItemsPerView() {
    if (window.innerWidth <= 768) return 1;
    if (window.innerWidth <= 1024) return 2;
    return 3;
  }

  function maxIndex() {
    const perView = getItemsPerView();
    return Math.max(0, visibleSlides.length - perView);
  }

  function updateSliderPosition() {
    const perView = getItemsPerView();
    const slidePercent = 100 / perView;
    track.style.transform = `translateX(-${currentIndex * slidePercent}%)`;
    updatePagination();
    updateDots();
  }

  function updateControlsVisibility() {
    if (currentFilter === 'all') {
      if (progressTrackEl) progressTrackEl.style.display = 'block';
      if (dotsContainer) dotsContainer.style.display = 'none';
    } else {
      if (progressTrackEl) progressTrackEl.style.display = 'none';
      if (dotsContainer) {
        dotsContainer.style.display = 'flex';
        renderDots();
      }
    }
  }

  function renderDots() {
    if (!dotsContainer) return;
    dotsContainer.innerHTML = '';
    const totalDots = maxIndex() + 1;
    for (let i = 0; i < totalDots; i++) {
      const dot = document.createElement('div');
      dot.className = `slider-dot ${i === currentIndex ? 'active' : ''}`;
      dot.addEventListener('click', () => {
        currentIndex = i;
        updateSliderPosition();
        resetTimer();
      });
      dotsContainer.appendChild(dot);
    }
  }

  function updateDots() {
    if (dotsContainer && currentFilter !== 'all') {
      const dots = Array.from(dotsContainer.children);
      dots.forEach((d, idx) => {
        d.classList.toggle('active', idx === currentIndex);
      });
    }
  }

  function updatePagination() {
    const totalPhotos = visibleSlides.length;
    if (totalPhotos <= 0) return;

    let currentPhoto = currentIndex + 1;
    if (currentPhoto > totalPhotos) currentPhoto = totalPhotos;

    if (currentFilter === 'all') {
      // In All Seasons mode: display the year of the currently visible leading photo!
      const currentSlideEl = visibleSlides[currentIndex];
      if (currentSlideEl) {
        const slideYear = currentSlideEl.getAttribute('data-category');
        if (slideCounterEl) {
          slideCounterEl.innerHTML = `<span class="counter-num-active">${slideYear}</span>`;
        }
      }
    } else {
      // In specific year mode: display the photo counter (e.g. 01 / 07)
      if (slideCounterEl) {
        slideCounterEl.innerHTML = `
          <span id="currentSlideNum" class="counter-num-active">${String(currentPhoto).padStart(2, '0')}</span>
          <span class="counter-slash">/</span>
          <span id="totalSlideNum" class="counter-num-total">${String(totalPhotos).padStart(2, '0')}</span>
        `;
      }
    }

    if (progressFillEl) {
      const percentage = (currentPhoto / totalPhotos) * 100;
      progressFillEl.style.width = `${percentage}%`;
    }
  }

  function handleSeek(e) {
    if (!progressTrackEl || currentFilter !== 'all') return;
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
      if (currentFilter !== 'all') return;
      isDragging = true;
      handleSeek(e);
    });

    window.addEventListener('mousemove', (e) => {
      if (isDragging) {
        handleSeek(e);
      }
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
      }
    });

    // Touch support for mobile devices
    progressTrackEl.addEventListener('touchstart', (e) => {
      if (currentFilter !== 'all') return;
      isDragging = true;
      if (e.touches.length > 0) handleSeek(e.touches[0]);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (isDragging && e.touches.length > 0) {
        handleSeek(e.touches[0]);
      }
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

  // Pause on hover
  track.parentElement.addEventListener('mouseenter', stopTimer);
  track.parentElement.addEventListener('mouseleave', startTimer);

  // Window resize handler
  window.addEventListener('resize', () => {
    if (currentIndex > maxIndex()) currentIndex = maxIndex();
    updateControlsVisibility();
    updateSliderPosition();
  });

  // Filter Tabs logic
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      currentFilter = tab.getAttribute('data-filter');

      visibleSlides = allSlides.filter(slide => {
        const cat = slide.getAttribute('data-category');
        const match = (currentFilter === 'all' || currentFilter === cat);
        slide.style.display = match ? 'block' : 'none';
        return match;
      });

      currentIndex = 0;
      updateControlsVisibility();
      updateSliderPosition();
      resetTimer();
    });
  });

  // Gắn sự kiện click/tap cho toàn bộ khung ảnh để mở trực tiếp Lightbox Zoom (ngoại trừ thẻ video đã có handler riêng)
  document.querySelectorAll('.gallery-item').forEach(item => {
    if (item.classList.contains('gallery-video-item')) return;
    item.addEventListener('click', () => {
      const img = item.querySelector('img');
      const tag = item.querySelector('.gallery-tag');
      const year = tag ? tag.textContent.trim() : '';
      const caption = year ? `mgm Oktoberfest ${year}` : '';
      if (img && (img.currentSrc || img.src)) {
        openLightbox(img.currentSrc || img.src, caption);
      }
    });
  });

  // Init position & controls
  updateControlsVisibility();
  updateSliderPosition();
  startTimer();
}

/* ─── LIGHTBOX MODAL (PHOTO & VIDEO SUPPORT) ─── */
function openLightbox(imgUrl, captionText) {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxVideo = document.getElementById('lightboxVideo');
  const lightboxCaption = document.getElementById('lightboxCaption');

  if (lightbox) {
    if (lightboxVideo) {
      lightboxVideo.pause();
      lightboxVideo.style.display = 'none';
      lightboxVideo.src = '';
    }
    if (lightboxImg) {
      lightboxImg.style.display = 'block';
      lightboxImg.src = imgUrl;
    }
    if (lightboxCaption) {
      lightboxCaption.textContent = captionText || '';
    }
    lightbox.classList.add('active');
  }
}

function openVideoLightbox(videoUrl, captionText) {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxVideo = document.getElementById('lightboxVideo');
  const lightboxCaption = document.getElementById('lightboxCaption');

  if (lightbox) {
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
  }
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  const lightboxVideo = document.getElementById('lightboxVideo');
  if (lightbox) {
    lightbox.classList.remove('active');
    if (lightboxVideo) {
      lightboxVideo.pause();
      lightboxVideo.src = '';
    }
  }
}

/* ─── POP-UP REGISTRATION MODAL (SUPABASE CONNECTED) ─── */
function initRegistrationModal() {
  const regModal = document.getElementById('registrationModal');
  const closeRegBtn = document.getElementById('closeRegModalBtn');
  const closeSuccessBtn = document.getElementById('closeSuccessModalBtn');
  const regForm = document.getElementById('oktoberfestRegForm');
  const successState = document.getElementById('regSuccessState');
  const feedbackBox = document.getElementById('regFormFeedback');
  const submitBtn = document.getElementById('submitRegBtn');
  const successGuestName = document.getElementById('successGuestName');

  if (!regModal) return;

  const showFeedback = (msg, isError = true) => {
    if (!feedbackBox) return;
    feedbackBox.textContent = msg;
    feedbackBox.className = `form-feedback-box ${isError ? 'error' : 'success'}`;
    feedbackBox.style.display = 'block';
  };

  const clearFeedback = () => {
    if (!feedbackBox) return;
    feedbackBox.style.display = 'none';
    feedbackBox.textContent = '';
  };

  const openModal = () => {
    regModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (window.lucide) window.lucide.createIcons();
  };

  const closeModal = () => {
    regModal.classList.remove('active');
    document.body.style.overflow = '';
    // Reset states after animation
    setTimeout(() => {
      if (regForm) regForm.style.display = 'flex';
      if (successState) successState.style.display = 'none';
      clearFeedback();
    }, 300);
  };

  document.querySelectorAll('.open-reg-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });
  });

  if (closeRegBtn) closeRegBtn.addEventListener('click', closeModal);
  if (closeSuccessBtn) closeSuccessBtn.addEventListener('click', closeModal);

  regModal.addEventListener('click', (e) => {
    if (e.target === regModal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && regModal.classList.contains('active')) closeModal();
  });

  // Handle Form Submission
  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFeedback();

      const firstName = (document.getElementById('regFirstName')?.value || '').trim();
      const middleName = (document.getElementById('regMiddleName')?.value || '').trim();
      const lastName = (document.getElementById('regLastName')?.value || '').trim();
      const email = (document.getElementById('regEmail')?.value || '').trim().toLowerCase();
      const office = regForm.querySelector('input[name="office"]:checked')?.value || 'danang';
      const notes = (document.getElementById('regNotes')?.value || '').trim();

      // Validation
      if (!firstName) {
        showFeedback('Please enter your First Name.');
        document.getElementById('regFirstName')?.focus();
        return;
      }

      if (!lastName) {
        showFeedback('Please enter your Last Name.');
        document.getElementById('regLastName')?.focus();
        return;
      }

      if (!email || !email.includes('@')) {
        showFeedback('Please enter a valid work email address (e.g. name@mgm-tp.com).');
        document.getElementById('regEmail')?.focus();
        return;
      }

      const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');

      // Set Loading State
      const btnText = submitBtn?.querySelector('.btn-text');
      const btnSpinner = submitBtn?.querySelector('.btn-spinner');
      if (submitBtn) submitBtn.disabled = true;
      if (btnText) btnText.style.display = 'none';
      if (btnSpinner) btnSpinner.style.display = 'inline-flex';

      try {
        const payload = {
          full_name: fullName,
          email: email,
          office: office,
          notes: notes || null
        };

        const result = window.OktoberfestDB 
          ? await window.OktoberfestDB.submitRegistration(payload)
          : { success: false, error: 'Database service not initialized' };

        if (!result.success) {
          showFeedback(result.error || 'Không thể lưu đăng ký. Vui lòng thử lại sau.');
          if (submitBtn) submitBtn.disabled = false;
          if (btnText) btnText.style.display = 'inline-flex';
          if (btnSpinner) btnSpinner.style.display = 'none';
          return;
        }

        // Success!
        if (successGuestName) successGuestName.textContent = fullName;
        regForm.style.display = 'none';
        if (successState) {
          successState.style.display = 'block';
          if (window.lucide) window.lucide.createIcons();
        }

        // Celebratory Confetti!
        if (typeof confetti === 'function') {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#f59e0b', '#0284c7', '#ffffff', '#e11d48']
          });
          setTimeout(() => {
            confetti({
              particleCount: 50,
              angle: 60,
              spread: 55,
              origin: { x: 0 }
            });
            confetti({
              particleCount: 50,
              angle: 120,
              spread: 55,
              origin: { x: 1 }
            });
          }, 300);
        }

        regForm.reset();
      } catch (err) {
        console.error('Registration submission error:', err);
        showFeedback('Đã có lỗi xảy ra trong quá trình gửi. Vui lòng thử lại.');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (btnText) btnText.style.display = 'inline-flex';
        if (btnSpinner) btnSpinner.style.display = 'none';
      }
    });
  }
}

/* ─── ADD TO CALENDAR (UNIVERSAL ICS & GOOGLE CALENDAR) ─── */
function addToCalendar() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const event = {
    title: "mgm - Oktoberfest 2026",
    description: "Join us for mgm Oktoberfest 2026 celebration! Authentic Bavarian food, craft beers & high energy music.",
    location: "mgm Office (71 Quang Trung, Da Nang / 195A Hai Ba Trung, HCMC)",
    startDate: "20260919T100000Z", // 5:00 PM GMT+7 = 10:00 AM UTC
    endDate: "20260919T160000Z"    // 11:00 PM GMT+7 = 4:00 PM UTC
  };

  // Generate standard iCalendar (.ics) format compatible with Apple Calendar, Outlook, Mobile Calendar
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//mgm technology partners//mgm Oktoberfest 2026//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:oktoberfest-2026-' + Date.now() + '@mgm-tp.com',
    'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z',
    'DTSTART:' + event.startDate,
    'DTEND:' + event.endDate,
    'SUMMARY:' + event.title,
    'DESCRIPTION:' + event.description,
    'LOCATION:' + event.location,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  if (isIOS) {
    // For iOS / Apple devices: data URI / Blob download natively prompts 'Add to Calendar' in Apple Calendar app
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', 'mgm_Oktoberfest_2026.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    // For Desktop / Android / Other: Open Google Calendar in new tab and offer .ics file
    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&details=${encodeURIComponent(event.description)}&location=${encodeURIComponent(event.location)}&dates=${event.startDate}/${event.endDate}`;
    
    // Also trigger .ics download for users on Outlook / Desktop Apple Calendar
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', 'mgm_Oktoberfest_2026.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.open(googleUrl, '_blank');
  }
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
