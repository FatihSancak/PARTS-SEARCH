Web Sitesi Tasarım Kuralları & Rehberi
Bu dosyayı herhangi bir AI modeline, geliştiriciye veya tasarımcıya ver. Amaç: profesyonel, akılda kalıcı ve production-ready web siteleri üretmek. Generic "AI slop" estetikten tamamen kaçınmak.


1. Tasarım Felsefesi
Her proje başlamadan önce net bir estetik yön belirle. Rastgele güzel değil, kasıtlı güzel olmalı.
Mümkün olan estetik yönlerden birini seç ve sonuna kadar uygula:
Brutalist / Raw
Luxury / Refined
Editorial / Magazine
Retro-Futuristic
Organic / Natural
Art Deco / Geometric
Soft / Pastel
Industrial / Utilitarian
Playful / Toy-like
Dark Cinematic
Maximalist Chaos
Seçtiğin yönü her detayda tutarlı uygula: font, renk, spacing, animasyon, ikonografi.


2. Tipografi
Kurallar
Inter, Roboto, Arial, system-ui gibi generic fontları ASLA kullanma. Bunlar AI-generated görünüm verir.
Bir display font + bir body font eşleştirmesi yap.
Google Fonts'tan karakterli seçimler yap. Önerilen kombinasyonlar:

Kullanım Alanı
Display Font Önerileri
Body Font Önerileri
Luxury / Refined
Playfair Display, Cormorant Garamond, Libre Baskerville
Source Serif Pro, Lora, EB Garamond
Modern / Clean
Syne, Outfit, General Sans, Satoshi
DM Sans, Plus Jakarta Sans, Manrope
Bold / Brutalist
Bebas Neue, Oswald, Anton, Big Shoulders
Space Mono, JetBrains Mono, IBM Plex Mono
Editorial
Fraunces, Newsreader, Literata
Crimson Pro, Spectral, Noto Serif
Playful
Fredoka, Quicksand, Comfortaa
Nunito, Karla, Rubik

Uygulama
Heading'lerde font-weight: 700-900 kullan, cesur ol.
Body text minimum 16px, ideal 18px.
Line-height: heading'lerde 1.1-1.2, body'de 1.5-1.7.
Letter-spacing: büyük heading'lerde -0.02em ile -0.04em (tighter), küçük label'larda 0.05em-0.1em (wider).
Maksimum 2-3 font ailesi. Daha fazlası kaos yaratır.


3. Renk & Tema
Kurallar
Mor gradient + beyaz arka plan kombinasyonunu ASLA kullanma. Bu, AI'ın en klişe çıktısıdır.
Dominant renk + keskin accent renk stratejisi kullan.
Renkleri CSS custom properties (variables) ile tanımla.
Koyu ve açık temalar arasında bilinçli seçim yap. Her site açık tema olmak zorunda değil.
Renk Sistemi Şablonu
:root {

  /* Ana Renkler */

  --color-primary: #...;

  --color-secondary: #...;

  --color-accent: #...;

  /* Nötr Renkler */

  --color-bg: #...;

  --color-surface: #...;

  --color-text-primary: #...;

  --color-text-secondary: #...;

  --color-border: #...;

  /* Fonksiyonel Renkler */

  --color-success: #...;

  --color-warning: #...;

  --color-error: #...;

  /* Spacing Sistemi (8px grid) */

  --space-xs: 4px;

  --space-sm: 8px;

  --space-md: 16px;

  --space-lg: 24px;

  --space-xl: 32px;

  --space-2xl: 48px;

  --space-3xl: 64px;

  --space-4xl: 96px;

  --space-5xl: 128px;

  /* Border Radius */

  --radius-sm: 4px;

  --radius-md: 8px;

  --radius-lg: 16px;

  --radius-xl: 24px;

  --radius-full: 9999px;

  /* Shadow Sistemi */

  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);

  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);

  --shadow-lg: 0 12px 32px rgba(0,0,0,0.12);

  --shadow-xl: 0 24px 64px rgba(0,0,0,0.16);

  /* Tipografi */

  --font-display: '...', serif;

  --font-body: '...', sans-serif;

  --font-mono: '...', monospace;

}
Renk Paleti Yönlendirmesi
Estetik
Arka Plan
Ana Renk
Accent
Luxury Dark
#0a0a0a - #1a1a1a
#c8a96e (gold)
#e8d5b0
Editorial Warm
#faf7f2
#2d2d2d
#c45d3e (terracotta)
Tech Modern
#0f172a
#38bdf8 (sky)
#f472b6 (pink)
Organic Earth
#f5f0e8
#3d5a3e (forest)
#d4a574 (sand)
Bold Contrast
#ffffff
#000000
#ff3333 (red)
Soft Pastel
#fdf4f5
#7c6c77 (mauve)
#e8b4b8



4. Layout & Spatial Composition
Kurallar
Cookie-cutter layout yapma. Her bölüm aynı padding ve yapıda olmamalı.
Asimetri kullan. Grid-breaking elementler ekle.
Generous negative space VEYA controlled density — ikisinden birini bilinçli seç.
Öngörülebilir "section-section-section" ritmi kır.
Grid Sistemi
/* Base container */

.container {

  max-width: 1200px;       /* Standart içerik genişliği */

  margin: 0 auto;

  padding: 0 var(--space-lg);

}

/* Full-bleed bölümler için */

.full-bleed {

  width: 100vw;

  margin-left: calc(-50vw + 50%);

}

/* Responsive grid */

.grid {

  display: grid;

  gap: var(--space-lg);

}

.grid-2 { grid-template-columns: repeat(2, 1fr); }

.grid-3 { grid-template-columns: repeat(3, 1fr); }

.grid-asymmetric { grid-template-columns: 2fr 1fr; }

.grid-golden { grid-template-columns: 1.618fr 1fr; }

@media (max-width: 768px) {

  .grid-2, .grid-3, .grid-asymmetric, .grid-golden {

    grid-template-columns: 1fr;

  }

}
Section Spacing
Hero bölümünde padding: 120px - 200px üst-alt.
Normal bölümlerde padding: 80px - 120px üst-alt.
Bölümler arası görsel ayrım: renk değişimi, subtle divider, ya da büyük boşluk.


5. Animasyon & Motion
Kurallar
Animasyon amaçlı olmalı. Her şeyi animate etme; yüksek etkili anlara odaklan.
Sayfa yüklenişinde staggered reveal animasyonu, her elemana tek tek animation-delay ver.
Scroll-triggered animasyonlar için IntersectionObserver kullan.
Hover state'lerde kullanıcıyı şaşırt.
CSS-only çözümleri öncelikle tercih et. Gerekirse JS ekle.
Temel Animasyon Kütüphanesi
/* Fade In Up — en çok kullanacağın animasyon */

@keyframes fadeInUp {

  from {

    opacity: 0;

    transform: translateY(30px);

  }

  to {

    opacity: 1;

    transform: translateY(0);

  }

}

/* Scale In */

@keyframes scaleIn {

  from {

    opacity: 0;

    transform: scale(0.95);

  }

  to {

    opacity: 1;

    transform: scale(1);

  }

}

/* Slide In Left */

@keyframes slideInLeft {

  from {

    opacity: 0;

    transform: translateX(-40px);

  }

  to {

    opacity: 1;

    transform: translateX(0);

  }

}

/* Kullanım */

.animate-on-scroll {

  opacity: 0;

  animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;

}

/* Staggered delay sistemi */

.stagger-1 { animation-delay: 0.1s; }

.stagger-2 { animation-delay: 0.2s; }

.stagger-3 { animation-delay: 0.3s; }

.stagger-4 { animation-delay: 0.4s; }

.stagger-5 { animation-delay: 0.5s; }

/* Easing — cubic-bezier değerleri */

--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);

--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);

--ease-in-out: cubic-bezier(0.76, 0, 0.24, 1);

--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
IntersectionObserver Snippet
const observer = new IntersectionObserver((entries) => {

  entries.forEach(entry => {

    if (entry.isIntersecting) {

      entry.target.classList.add('is-visible');

      observer.unobserve(entry.target);

    }

  });

}, { threshold: 0.15 });

document.querySelectorAll('.animate-on-scroll').forEach(el => {

  observer.observe(el);

});


6. Arka Plan & Görsel Derinlik
Kurallar
Düz beyaz veya düz siyah arka plana varsayılan olarak gitme. Atmosfer yarat.
Derinlik katmanları oluştur: background → surface → content.
Kullanılabilecek teknikler:
Gradient mesh: Çok noktalı, karmaşık gradientler.
Noise/grain texture: Subtle grain overlay ile düz renklere hayat ver.
Geometric patterns: SVG pattern'ler ile repeating motifler.
Glassmorphism: backdrop-filter: blur() + yarı saydam yüzeyler.
Layered shadows: Birden fazla shadow katmanı ile doğal derinlik.
Dot grid / line grid: Arka planda subtle grid deseni.
Noise Texture Overlay
/* Subtle grain effect */

.grain-overlay::after {

  content: '';

  position: fixed;

  top: 0; left: 0;

  width: 100%; height: 100%;

  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");

  pointer-events: none;

  z-index: 9999;

}
Gradient Mesh Örneği
.hero-bg {

  background:

    radial-gradient(ellipse at 20% 50%, rgba(120, 80, 200, 0.15) 0%, transparent 50%),

    radial-gradient(ellipse at 80% 20%, rgba(255, 120, 80, 0.1) 0%, transparent 50%),

    radial-gradient(ellipse at 50% 80%, rgba(60, 180, 160, 0.1) 0%, transparent 50%),

    var(--color-bg);

}


7. Bileşen Standartları
Butonlar
/* Primary Button */

.btn-primary {

  display: inline-flex;

  align-items: center;

  gap: 8px;

  padding: 14px 28px;

  font-family: var(--font-body);

  font-size: 15px;

  font-weight: 600;

  letter-spacing: 0.01em;

  color: var(--color-bg);

  background: var(--color-primary);

  border: none;

  border-radius: var(--radius-md);

  cursor: pointer;

  transition: all 0.3s var(--ease-out-expo);

}

.btn-primary:hover {

  transform: translateY(-2px);

  box-shadow: var(--shadow-lg);

}

/* Ghost Button */

.btn-ghost {

  padding: 14px 28px;

  font-weight: 600;

  color: var(--color-text-primary);

  background: transparent;

  border: 1.5px solid var(--color-border);

  border-radius: var(--radius-md);

  cursor: pointer;

  transition: all 0.3s ease;

}

.btn-ghost:hover {

  border-color: var(--color-primary);

  color: var(--color-primary);

}
Kartlar
.card {

  background: var(--color-surface);

  border: 1px solid var(--color-border);

  border-radius: var(--radius-lg);

  padding: var(--space-xl);

  transition: all 0.4s var(--ease-out-expo);

}

.card:hover {

  transform: translateY(-4px);

  box-shadow: var(--shadow-lg);

  border-color: var(--color-primary);

}
Navigation
.nav {

  position: fixed;

  top: 0;

  width: 100%;

  z-index: 100;

  padding: var(--space-md) 0;

  backdrop-filter: blur(12px);

  background: rgba(var(--color-bg-rgb), 0.8);

  border-bottom: 1px solid var(--color-border);

  transition: all 0.3s ease;

}
Input Fields
.input {

  width: 100%;

  padding: 14px 18px;

  font-family: var(--font-body);

  font-size: 16px;

  color: var(--color-text-primary);

  background: var(--color-surface);

  border: 1.5px solid var(--color-border);

  border-radius: var(--radius-md);

  outline: none;

  transition: all 0.25s ease;

}

.input:focus {

  border-color: var(--color-primary);

  box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.15);

}

.input::placeholder {

  color: var(--color-text-secondary);

  opacity: 0.6;

}


8. Responsive Design
Breakpoint Sistemi
/* Mobile First Yaklaşımı */

/* Base: 0 - 640px (Mobile) */

/* sm: 640px+ (Large Mobile / Small Tablet) */

/* md: 768px+ (Tablet) */

/* lg: 1024px+ (Laptop) */

/* xl: 1280px+ (Desktop) */

/* 2xl: 1536px+ (Large Desktop) */

@media (min-width: 640px)  { /* sm */ }

@media (min-width: 768px)  { /* md */ }

@media (min-width: 1024px) { /* lg */ }

@media (min-width: 1280px) { /* xl */ }
Responsive Tipografi
/* Fluid typography — clamp() kullan */

h1 { font-size: clamp(2.5rem, 5vw + 1rem, 5rem); }

h2 { font-size: clamp(1.8rem, 3vw + 0.5rem, 3rem); }

h3 { font-size: clamp(1.3rem, 2vw + 0.5rem, 2rem); }

p  { font-size: clamp(1rem, 1vw + 0.5rem, 1.125rem); }
Responsive Kuralları
Mobilde hamburger menü kullan, desktop'ta inline navigation.
Görseller max-width: 100% ve height: auto olmalı.
Touch target minimum 44px × 44px.
Mobilde horizontal scroll ASLA olmamalı.
Grid'ler mobilde tek kolona düşmeli.
Padding ve margin'ler mobilde %60-70'e küçülmeli.


9. Performans
Kurallar
Görselleri WebP / AVIF formatında kullan, fallback olarak JPEG/PNG.
loading="lazy" tüm fold-altı görsellere ekle.
Font yükleme: font-display: swap kullan.
CSS'i minimize et, kullanılmayan stilleri temizle.
JavaScript'i defer veya async ile yükle.
Kritik CSS'i inline yap, geri kalanı lazy load.
CLS (Cumulative Layout Shift) önlemek için görsellere width ve height attribute'u ver.
Font Yükleme
<link rel="preconnect" href="https://fonts.googleapis.com">

<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<link href="https://fonts.googleapis.com/css2?family=FONT_NAME:wght@400;600;700&display=swap" rel="stylesheet">


10. Erişilebilirlik (Accessibility)
Minimum Gereksinimler
Renk kontrastı en az 4.5:1 (normal metin), 3:1 (büyük metin).
Tüm görsellerde anlamlı alt attribute.
Semantik HTML: <header>, <nav>, <main>, <section>, <article>, <footer>.
Focus state'ler görünür olmalı. outline: none yapıyorsan custom focus stili ekle.
Keyboard navigation çalışmalı (Tab, Enter, Escape).
aria-label kullan; özellikle icon-only butonlarda.
Focus Style Örneği
:focus-visible {

  outline: 2px solid var(--color-primary);

  outline-offset: 3px;

  border-radius: var(--radius-sm);

}


11. Sayfa Yapısı Şablonu
Standart Landing Page Sıralaması
Navbar — Logo + linkler + CTA butonu
Hero — Büyük başlık + alt başlık + CTA + görsel/animasyon
Social Proof / Logo Bar — Müşteri logoları veya rakamlar
Features / Benefits — 3-6 özellik, ikon + başlık + açıklama
How It Works — 3 adımlı süreç
Testimonials — Müşteri yorumları
Pricing (varsa) — Plan karşılaştırma kartları
FAQ — Accordion yapısında
Final CTA — Son dönüşüm bölümü
Footer — Linkler + sosyal medya + copyright
Her Bölüm İçin Checklist
Net bir başlık var mı?
Görsel hiyerarşi doğru mu? (En önemli bilgi en büyük)
Tek bir net CTA var mı?
Mobilde düzgün görünüyor mu?
Önceki ve sonraki bölümle görsel geçiş akıcı mı?


12. YAPMA Listesi (Anti-Patterns)
YAPMA
YAP
Inter, Roboto, Arial kullanma
Karakterli, bağlama uygun font seç
Mor gradient + beyaz arka plan
Kasıtlı, tutarlı renk paleti
Her şeyi animate etme
Yüksek etkili anlara odaklan
Generic stock fotoğraf
İllüstrasyon, 3D render veya kaliteli fotoğraf
Eşit dağılmış pastel renkler
Dominant renk + keskin accent
Her bölümde aynı padding
Ritmik varyasyon, farklı yoğunluklar
box-shadow: 0 2px 4px rgba(0,0,0,0.1) her yerde
Katmanlı, contextual shadow sistemi
Lorem ipsum ile tasarlama
Gerçek veya gerçeğe yakın içerikle tasarla
Kocaman hero image + overlay text
Yaratıcı hero composition
12 farklı font-size rastgele
Type scale sistemi (1.25 veya 1.333 ratio)



13. Son Kontrol Listesi
Siteyi teslim etmeden önce şunları kontrol et:

Tüm linkler çalışıyor
Mobil, tablet, desktop'ta test edildi
Lighthouse skoru: Performance > 90, Accessibility > 90
Tüm görsellerde alt text var
Favicon ve meta tag'ler ekli
<title> ve <meta description> her sayfada unique
Open Graph tag'leri (sosyal medya paylaşımları için)
404 sayfası tasarlandı
Form'lar doğru çalışıyor ve validation var
HTTPS aktif
Console'da hata yok
Font'lar düzgün yükleniyor
Animasyonlar prefers-reduced-motion media query'sine saygı gösteriyor

@media (prefers-reduced-motion: reduce) {

  *, *::before, *::after {

    animation-duration: 0.01ms !important;

    transition-duration: 0.01ms !important;

  }

}



Bu kurallar seti, AI ile veya manuel olarak üretilen her web sitesinin profesyonel, akılda kalıcı ve production-ready olmasını garanti eder.

