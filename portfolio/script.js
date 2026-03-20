// ========== Scroll-based active nav link ==========
const sections = document.querySelectorAll('.section');
const navLinks = document.querySelectorAll('.nav-link');

function updateActiveNav() {
  const scrollY = window.scrollY + 120;

  sections.forEach(section => {
    const top = section.offsetTop;
    const height = section.offsetHeight;
    const id = section.getAttribute('id');

    if (scrollY >= top && scrollY < top + height) {
      navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.dataset.section === id) {
          link.classList.add('active');
        }
      });
    }
  });
}

window.addEventListener('scroll', updateActiveNav, { passive: true });

// ========== Fade-in on scroll ==========
function initFadeIn() {
  const elements = document.querySelectorAll(
    '.timeline-item, .project-card, .ai-card, .contact-item'
  );

  elements.forEach(el => el.classList.add('fade-in'));

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    },
    { threshold: 0.15 }
  );

  elements.forEach(el => observer.observe(el));
}

// ========== Nav background on scroll ==========
const nav = document.getElementById('nav');

function updateNavBg() {
  if (window.scrollY > 50) {
    nav.style.background = 'rgba(10, 10, 11, 0.95)';
  } else {
    nav.style.background = 'rgba(10, 10, 11, 0.8)';
  }
}

window.addEventListener('scroll', updateNavBg, { passive: true });

// ========== Init ==========
document.addEventListener('DOMContentLoaded', () => {
  initFadeIn();
  updateActiveNav();
  updateNavBg();
});
