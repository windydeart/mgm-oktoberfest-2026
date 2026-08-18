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

  // 4. Hero Beer Bubbles Canvas Animation
  initBeerBubbles();

  // 5. Countdown Timer (Target: Sat, 19 Sep 2026 17:30:00 GMT+7 - 5:30 PM)
  initCountdownTimer(new Date('2026-09-19T17:30:00+07:00'));

  // 6. Scroll Reveal Observer
  initScrollReveal();

  // 7. Auto-play Memories Slider (4s)
  initMemoriesSlider();

  // 8. Dress Code 2-Image Rotating Slideshow
  initDressCodeSlider();

  // 9. Pop-up Registration Modal Handlers
  initRegistrationModal();

  // 10. Venue Map Popup Modal (Google Maps)
  initVenueMapModal();

  // 11. Calendar Dropdown Picker (Google / Outlook / ICS)
  initCalendarDropdown();

  // 12. Chatbot Widget (Bierly AI Assistant)
  initChatbot();
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

/* ─── POP-UP REGISTRATION MODAL (JOTFORM EMBED) ─── */
function initRegistrationModal() {
  const regModal = document.getElementById('registrationModal');
  const closeRegBtn = document.getElementById('closeRegModalBtn');

  if (!regModal) return;

  const openModal = () => {
    regModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (window.lucide) window.lucide.createIcons();
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
  const mapModalTitle = document.getElementById('mapModalTitle');
  const mapModalAddress = document.getElementById('mapModalAddress');
  const openExternalGmapsBtn = document.getElementById('openExternalGmapsBtn');
  const tabBtns = document.querySelectorAll('.map-tab-btn');

  if (!mapModal || !mapIframe) return;

  const venues = {
    danang: {
      title: 'mgm Da Nang Office',
      address: '71 Quang Trung, Hai Chau Ward, Da Nang',
      embedUrl: 'https://maps.google.com/maps?q=mgm+technology+partners+Vietnam,+71+Quang+Trung,+Da+Nang&t=&z=16&ie=UTF8&iwloc=&output=embed',
      externalUrl: 'https://maps.google.com/?q=mgm+technology+partners+Vietnam,+71+Quang+Trung,+Da+Nang'
    },
    hcmc: {
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

/* ─── ADD TO CALENDAR (DROPDOWN PICKER — GOOGLE / OUTLOOK / ICS) ─── */
function initCalendarDropdown() {
  const btn = document.getElementById('calendarDropdownBtn');
  const dropdown = document.getElementById('calendarDropdown');
  if (!btn || !dropdown) return;

  const event = {
    title: "mgm - Oktoberfest 2026",
    description: "Join us for mgm Oktoberfest 2026 celebration! Authentic Bavarian food, craft beers & high energy music.",
    location: "mgm Office (71 Quang Trung, Hai Chau Ward, Da Nang / 195A Hai Ba Trung, Xuan Hoa Ward, HCMC)",
    startUtc: "20260919T103000Z",
    endUtc: "20260919T150000Z",
    startIso: "2026-09-19T17:30:00",
    endIso: "2026-09-19T22:00:00"
  };

  function buildIcs() {
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//mgm technology partners//mgm Oktoberfest 2026//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:oktoberfest-2026@mgm-tp.com',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z',
      'DTSTART:' + event.startUtc,
      'DTEND:' + event.endUtc,
      'SUMMARY:' + event.title,
      'DESCRIPTION:' + event.description,
      'LOCATION:' + event.location,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
  }

  function downloadIcs() {
    const blob = new Blob([buildIcs()], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', 'mgm_Oktoberfest_2026.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(link.href);
  }

  function openGoogle() {
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&details=${encodeURIComponent(event.description)}&location=${encodeURIComponent(event.location)}&dates=${event.startUtc}/${event.endUtc}`;
    window.open(url, '_blank');
  }

  function openOutlook() {
    const params = new URLSearchParams({
      path: '/calendar/action/compose',
      rru: 'addevent',
      subject: event.title,
      body: event.description,
      location: event.location,
      startdt: event.startIso,
      enddt: event.endIso
    });
    // Use outlook.live.com which works for both personal and work accounts
    // (Microsoft will redirect to office.com automatically if user has M365)
    const webUrl = `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
    window.open(webUrl, '_blank');
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
      if (type === 'google') openGoogle();
      else if (type === 'outlook') openOutlook();
      else downloadIcs();
      dropdown.classList.remove('active');
    });
  });

  // Close on outside click
  document.addEventListener('click', () => {
    dropdown.classList.remove('active');
  });
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

/* ─── CHATBOT WIDGET — BIERLY AI ASSISTANT ─── */
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

  // Determine API endpoint (local dev vs production)
  const chatApiUrl = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? '/api/chat'
    : '/api/chat';

  // Toggle chat panel
  function toggleChat() {
    const isOpen = panel.classList.contains('open');
    if (isOpen) {
      panel.classList.remove('open');
      fab.classList.remove('active');
    } else {
      panel.classList.add('open');
      fab.classList.add('active');
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
          history: historyToSend.slice(0, -1) // exclude current message (already in 'message')
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

    isWaiting = false;
    if (input.value.trim().length > 0) sendBtn.disabled = false;
  }
}
