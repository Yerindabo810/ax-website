/**
 * AX TECHNOLOGIES UGANDA - INTERACTIONS SCRIPT
 * Handles mobile navigation, screenshot lightbox modal, policy popups, and contact submission.
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initImageLightbox();
  initLegalPopups();
  initSimpleContactForm();
  initScrollReveal();
  initMediaProtection();
});

/* 1. Mobile Navigation Menu (Slide from Left & Collapse on Click Outside) */
function initMobileNav() {
  const toggleBtn = document.getElementById('menu-toggle');
  const navMenu = document.getElementById('nav-menu');

  if (!toggleBtn || !navMenu) return;

  // 1. Inject dark backdrop overlay if not present
  let backdrop = document.querySelector('.nav-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'nav-backdrop';
    document.body.appendChild(backdrop);
  }

  // 2. Break navMenu out of header stacking context on mobile so it sits strictly above backdrop
  const navContainer = navMenu.parentElement;
  function syncNavPlacement() {
    if (window.innerWidth <= 768) {
      if (navMenu.parentElement !== document.body) {
        document.body.appendChild(navMenu);
      }
    } else {
      if (navMenu.parentElement !== navContainer && navContainer) {
        navContainer.appendChild(navMenu);
      }
      closeMenu();
    }
  }
  syncNavPlacement();
  window.addEventListener('resize', syncNavPlacement);

  // 3. Add branded drawer header with logo and close button inside the sliding drawer
  if (!navMenu.querySelector('.nav-drawer-header')) {
    const drawerHeader = document.createElement('div');
    drawerHeader.className = 'nav-drawer-header';
    drawerHeader.innerHTML = `
      <a href="index.html" class="nav-drawer-brand">
        <img src="ax-logo.png" alt="AX Technologies Logo">
        <span>AX <span style="color: var(--primary-orange);">TECH</span></span>
      </a>
      <button class="nav-drawer-close" id="nav-drawer-close-btn" aria-label="Close Navigation">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;
    navMenu.insertBefore(drawerHeader, navMenu.firstChild);

    const closeBtn = drawerHeader.querySelector('.nav-drawer-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeMenu);
    }
  }

  function openMenu() {
    navMenu.classList.add('active');
    backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
    const icon = toggleBtn.querySelector('i');
    if (icon) {
      icon.className = 'fa-solid fa-xmark';
    }
  }

  function closeMenu() {
    navMenu.classList.remove('active');
    backdrop.classList.remove('active');
    document.body.style.overflow = '';
    const icon = toggleBtn.querySelector('i');
    if (icon) {
      icon.className = 'fa-solid fa-bars';
    }
  }

  // Toggle button click
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (navMenu.classList.contains('active')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Clicking on backdrop collapses menu
  backdrop.addEventListener('click', closeMenu);

  // Clicking ANYWHERE outside the menu collapses it
  document.addEventListener('click', (e) => {
    if (navMenu.classList.contains('active')) {
      if (!navMenu.contains(e.target) && !toggleBtn.contains(e.target)) {
        closeMenu();
      }
    }
  });

  // Clicking any menu link collapses it
  navMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      closeMenu();
    });
  });

  // Pressing Escape key collapses menu
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navMenu.classList.contains('active')) {
      closeMenu();
    }
  });
}

/* 2. Image Lightbox Modal */
function initImageLightbox() {
  const modal = document.getElementById('image-modal');
  const imgElem = document.getElementById('image-element');
  const titleElem = document.getElementById('image-title');
  const closeBtn = document.getElementById('close-image-btn');
  const triggers = document.querySelectorAll('.open-img-modal');

  if (!modal || !imgElem) return;

  function openImage(src, title) {
    imgElem.src = src;
    if (titleElem) titleElem.textContent = title || 'System Screenshot';
    modal.classList.add('active');
  }

  function closeImage() {
    imgElem.src = '';
    modal.classList.remove('active');
  }

  triggers.forEach(card => {
    card.addEventListener('click', () => {
      const src = card.getAttribute('data-src');
      const title = card.getAttribute('data-title');
      if (src) openImage(src, title);
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', closeImage);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeImage();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeImage();
    }
  });
}

/* 3. Legal Modals (Privacy & Terms) */
function initLegalPopups() {
  const privacyModal = document.getElementById('privacy-modal');
  const termsModal = document.getElementById('terms-modal');

  const openPrivacy = document.querySelectorAll('.modal-trigger-privacy');
  const openTerms = document.querySelectorAll('.modal-trigger-terms');

  const closePrivacy = document.getElementById('close-privacy-btn');
  const closeTerms = document.getElementById('close-terms-btn');

  function open(m) { if (m) m.classList.add('active'); }
  function close(m) { if (m) m.classList.remove('active'); }

  openPrivacy.forEach(btn => btn.addEventListener('click', (e) => {
    e.preventDefault();
    open(privacyModal);
  }));

  openTerms.forEach(btn => btn.addEventListener('click', (e) => {
    e.preventDefault();
    open(termsModal);
  }));

  if (closePrivacy) closePrivacy.addEventListener('click', () => close(privacyModal));
  if (closeTerms) closeTerms.addEventListener('click', () => close(termsModal));

  [privacyModal, termsModal].forEach(m => {
    if (!m) return;
    m.addEventListener('click', (e) => {
      if (e.target === m) close(m);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      close(privacyModal);
      close(termsModal);
    }
  });
}

/* 4. Contact Form Submission */
function initSimpleContactForm() {
  const form = document.getElementById('contact-form');
  const alertBox = document.getElementById('form-alert');

  if (!form || !alertBox) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const oldText = btn.innerHTML;

    btn.innerHTML = 'Sending...';
    btn.disabled = true;

    const data = new FormData(form);

    try {
      const res = await fetch('contact.php', {
        method: 'POST',
        body: data
      });

      const json = await res.json();

      if (json && json.status === 'success') {
        alertBox.className = 'form-alert success';
        alertBox.innerHTML = `<strong>Thank you, ${json.name || ''}!</strong> ${json.message}`;
        form.reset();
      } else {
        alertBox.className = 'form-alert error';
        alertBox.innerHTML = `<strong>Error:</strong> ${json.message || 'Could not send message. Please try again.'}`;
      }
    } catch (err) {
      alertBox.className = 'form-alert error';
      if (window.location.protocol === 'file:') {
        alertBox.innerHTML = `<strong>Notice:</strong> You are viewing the site via local <code>file://</code> protocol. PHP mail scripts require Apache at <a href="http://localhost/ax-website/contact.html" style="text-decoration: underline; font-weight: bold;">http://localhost/ax-website/contact.html</a>. Alternatively, chat directly on WhatsApp at <strong>0772 651 444</strong> or email <strong>axtechnologiesug@gmail.com</strong>.`;
      } else {
        alertBox.innerHTML = `<strong>Notice:</strong> Unable to connect to the mail server. Please reach our team directly on WhatsApp at <strong>0772 651 444</strong> or email <strong>axtechnologiesug@gmail.com</strong>.`;
      }
    } finally {
      btn.innerHTML = oldText;
      btn.disabled = false;
    }
  });
}

/* 5. Smooth Scroll Progress Bar & Dynamic Reveal Engine */
function initScrollProgressBar() {
  let bar = document.querySelector('.scroll-progress-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'scroll-progress-bar';
    document.body.appendChild(bar);
  }

  const updateProgress = () => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
  };

  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();
}

function initScrollReveal() {
  initScrollProgressBar();

  // 1. Zoom Pop for Mockups & Media Elements
  const zoomSelectors = [
    '.browser-mockup-frame',
    '.floating-mobile-preview',
    '.whole-image-wrapper',
    '.video-large-container',
    '.hero-mockup-container'
  ];
  document.querySelectorAll(zoomSelectors.join(', ')).forEach(el => {
    el.classList.add('reveal-zoom');
  });

  // 2. Directional Slide-In for 2-Column Sections
  const leftSelectors = ['.contact-info-card', '.about-col-left'];
  const rightSelectors = ['.contact-form-card', '.about-col-right'];
  document.querySelectorAll(leftSelectors.join(', ')).forEach(el => el.classList.add('reveal-slide-left'));
  document.querySelectorAll(rightSelectors.join(', ')).forEach(el => el.classList.add('reveal-slide-right'));

  // 3. Staggered Ripple Animations for Cards in Grids
  const gridContainers = [
    '.systems-directory-grid',
    '.pricing-table-grid',
    '.showcase-grid',
    '.full-screenshots-grid',
    '.stats-bar',
    '.partners-section .container',
    '.stack-cards-grid'
  ];

  gridContainers.forEach(containerSelector => {
    const containers = document.querySelectorAll(containerSelector);
    containers.forEach(container => {
      const items = Array.from(container.children);
      items.forEach((item, index) => {
        if (!item.classList.contains('reveal-on-scroll') && 
            !item.classList.contains('reveal-zoom') &&
            !item.classList.contains('reveal-slide-left') &&
            !item.classList.contains('reveal-slide-right')) {
          item.classList.add('reveal-on-scroll');
        }
        // Stagger progressive delay by index (0ms, 120ms, 240ms, 360ms...)
        item.style.transitionDelay = `${(index % 4) * 120}ms`;
      });
    });
  });

  // 4. Section Headings & Titles
  document.querySelectorAll('.section-title-wrap, .section-heading, .legal-container, .pricing-note-card').forEach(el => {
    if (!el.classList.contains('reveal-on-scroll') && !el.classList.contains('reveal-zoom')) {
      el.classList.add('reveal-on-scroll');
    }
  });

  // 5. Gather All Reveal Targets
  const allRevealElements = document.querySelectorAll(
    '.reveal-on-scroll, .reveal-slide-left, .reveal-slide-right, .reveal-zoom'
  );

  if (!allRevealElements.length) return;

  if (!('IntersectionObserver' in window)) {
    allRevealElements.forEach(el => el.classList.add('revealed'));
    return;
  }

  // 6. IntersectionObserver with tuned rootMargin
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        obs.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -45px 0px'
  });

  allRevealElements.forEach(el => {
    // If element is already high up in the viewport on initial page load, reveal quickly
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.75) {
      setTimeout(() => el.classList.add('revealed'), 80);
    } else {
      observer.observe(el);
    }
  });
}

/* 6. Media Protection (Disable image & video downloading) */
function initMediaProtection() {
  // Prevent right-click context menu on images, videos, and media containers
  document.addEventListener('contextmenu', (e) => {
    const isMedia = e.target.tagName === 'IMG' || 
                    e.target.tagName === 'VIDEO' || 
                    e.target.closest('.video-large-container') || 
                    e.target.closest('.whole-image-wrapper') || 
                    e.target.closest('#image-modal') ||
                    e.target.closest('.logo-item-box');
    if (isMedia) {
      e.preventDefault();
      return false;
    }
  });

  // Prevent dragging on images and videos (drag-to-save)
  document.addEventListener('dragstart', (e) => {
    if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') {
      e.preventDefault();
      return false;
    }
  });

  // Enforce nodownload and disable Picture-in-Picture on all video tags
  document.querySelectorAll('video').forEach((v) => {
    v.setAttribute('controlsList', 'nodownload noplaybackrate');
    v.setAttribute('disablePictureInPicture', 'true');
    v.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  // Block Ctrl+S / Cmd+S save shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      return false;
    }
  });
}

