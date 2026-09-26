import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useTypewriter } from './hooks/useTypewriter';
import { Magnetic } from './components/Magnetic';
import './styles/global.css';

gsap.registerPlugin(ScrollTrigger);

// ── CONSTANTS ──────────────────────────────────────────────
const PHRASES = [
  'Eco ĐH31LQA.',
  'Nền tảng số cho giáo dục.',
  'Hướng đến xây dựng Nhà trường thông minh.',
  'Nơi công nghệ không có giới hạn.',
];

const TUNNEL_RINGS = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  size: 60 + i * 80,
  opacity: 0.9 - i * 0.028,
  rotation: i % 2 === 0 ? i * 3 : -i * 3,
  isHex: i % 4 === 0,
}));

const DATA_CARDS = [
  {
    title: 'Hạ tầng số hóa',
    subtitle: 'Digital Infrastructure',
    stat: '99.9%',
    statLabel: 'Uptime',
    desc: 'Xây dựng cốt lõi vững chắc, đảm bảo luồng dữ liệu thông suốt và bảo mật toàn diện cho từng tác vụ.',
    color: '#00f7ff',
    glowColor: 'rgba(0,247,255,0.3)',
  },
  {
    title: 'Hệ sinh thái đồng bộ',
    subtitle: 'Sync Ecosystem',
    stat: '100%',
    statLabel: 'Cloud Sync',
    desc: 'Tích hợp nhiều ứng dụng vào một nền tảng duy nhất, quản lý tập trung và cộng tác liền mạch.',
    color: '#a78bfa',
    glowColor: 'rgba(124,58,237,0.4)',
  },
  {
    title: 'Giao diện tương lai',
    subtitle: 'Next-Gen UI',
    stat: 'v5.1',
    statLabel: 'Platform',
    desc: 'Trải nghiệm người dùng được đặt lên hàng đầu, thiết kế tinh tế và phản hồi mượt mà ở mọi thiết bị.',
    color: '#f472b6',
    glowColor: 'rgba(244,114,182,0.3)',
  },
  {
    title: 'Trí tuệ phân tích',
    subtitle: 'Analytics Engine',
    stat: '28+',
    statLabel: 'Users',
    desc: 'Theo dõi và phân tích dữ liệu học tập theo thời gian thực, hỗ trợ ra quyết định chính xác hơn.',
    color: '#34d399',
    glowColor: 'rgba(52,211,153,0.3)',
  },
  {
    title: 'Kỷ luật & Đoàn kết',
    subtitle: 'Discipline & Unity',
    stat: 'ĐH31',
    statLabel: 'LQA',
    desc: 'Nền tảng số hóa phục vụ mục tiêu xây dựng môi trường học tập kỷ luật, đoàn kết và chuyên nghiệp.',
    color: '#fb923c',
    glowColor: 'rgba(251,146,60,0.3)',
  },
];

const CASCADE_ITEMS = [
  {
    label: 'Kỷ luật',
    heading: 'Kỷ luật tạo nên sự khác biệt',
    body: 'Chúng tôi tin rằng kỷ luật không phải là gánh nặng, mà là nền tảng để mỗi cá nhân và tập thể vươn tới những mục tiêu lớn hơn trong thời đại số.',
    accent: '#00f7ff',
  },
  {
    label: 'Đoàn kết',
    heading: 'Đoàn kết là sức mạnh',
    body: 'Hệ sinh thái ĐH31LQA được xây dựng trên tinh thần đồng lòng, nơi mọi thành viên cùng chia sẻ kiến thức, nguồn lực và cùng nhau tiến bộ.',
    accent: '#a78bfa',
  },
  {
    label: 'Nhà trường thông minh',
    heading: 'Xây dựng Nhà trường thông minh',
    body: 'Mục tiêu dài hạn là xây dựng một mô hình giáo dục số hóa toàn diện, nơi công nghệ phục vụ cho từng quyết định giảng dạy và học tập.',
    accent: '#f472b6',
  },
];

// ── HEX SVG HELPER ──────────────────────────────────────────
function HexRing({ size, opacity, rotation, color = '#00f7ff' }) {
  const r = size / 2;
  const cx = r, cy = r;
  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    return `${cx + r * 0.95 * Math.cos(angle)},${cy + r * 0.95 * Math.sin(angle)}`;
  }).join(' ');

  return (
    <svg
      width={size}
      height={size}
      style={{
        position: 'absolute',
        opacity,
        transform: `rotate(${rotation}deg)`,
        filter: `drop-shadow(0 0 6px ${color})`,
        top: '50%',
        left: '50%',
        marginLeft: -size / 2,
        marginTop: -size / 2,
        pointerEvents: 'none',
      }}
    >
      <polygon
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.2"
      />
    </svg>
  );
}

function CircleRing({ size, opacity, rotation }) {
  return (
    <div
      className="tunnel-ring"
      style={{
        width: size,
        height: size,
        opacity,
        top: '50%',
        left: '50%',
        marginLeft: -size / 2,
        marginTop: -size / 2,
        transform: `rotate(${rotation}deg)`,
      }}
    />
  );
}

// ── FLOATING PARTICLE ──────────────────────────────────────
function Particle({ x, y, size, color, speed }) {
  return (
    <div
      className="particle"
      data-speed={speed}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        background: color,
        boxShadow: `0 0 ${size * 2}px ${color}`,
        opacity: 0.6,
      }}
    />
  );
}

// ── MAIN APP ────────────────────────────────────────────────
export default function App() {
  const typed = useTypewriter(PHRASES);

  // Refs
  const tunnelRef = useRef(null);
  const tunnelWrapperRef = useRef(null);
  const tunnelHeroRef = useRef(null);
  const textMaskRef = useRef(null);
  const maskTextRef = useRef(null);
  const maskRevealRef = useRef(null);
  const hscrollRef = useRef(null);
  const htrackRef = useRef(null);
  const cascadeRef = useRef(null);
  const ctaRef = useRef(null);
  const navRef = useRef(null);

  useEffect(() => {
    // Wait for DOM
    const ctx = gsap.context(() => {

      // ═══════════════════════════════════════════════════
      // SECTION 1: 3D TUNNEL DIVE
      // ═══════════════════════════════════════════════════
      const rings = tunnelWrapperRef.current?.querySelectorAll('.tunnel-ring, .tunnel-hex-svg');

      // Set initial scale (all start small, innermost front)
      gsap.set(rings, (i) => ({
        scale: 1,
        opacity: 0.8 - i * 0.025,
      }));

      const tl1 = gsap.timeline({
        scrollTrigger: {
          trigger: tunnelRef.current,
          start: 'top top',
          end: '+=250%',
          pin: true,
          scrub: 1.5,
          anticipatePin: 1,
        },
      });

      // Scale each ring outward to simulate flying through
      tl1
        .to(rings, {
          scale: (i) => 1 + (TUNNEL_RINGS.length - i) * 2.5,
          opacity: 0,
          stagger: { each: 0.04, from: 'end' },
          duration: 1,
          ease: 'power2.in',
        })
        .to(tunnelHeroRef.current, {
          opacity: 0,
          y: -60,
          duration: 0.4,
        }, '<0.3');


      // ═══════════════════════════════════════════════════
      // SECTION 2: TEXT MASK REVEAL
      // ═══════════════════════════════════════════════════
      const tl2 = gsap.timeline({
        scrollTrigger: {
          trigger: textMaskRef.current,
          start: 'top top',
          end: '+=200%',
          pin: true,
          scrub: 1,
          anticipatePin: 1,
        },
      });

      // Animate gradient background-position on the text
      tl2
        .fromTo(
          maskTextRef.current,
          { backgroundPosition: '0% 50%', scale: 1 },
          {
            backgroundPosition: '100% 50%',
            scale: 18,
            duration: 1,
            ease: 'power3.in',
          }
        )
        .to(
          maskRevealRef.current,
          { opacity: 0, duration: 0.3 },
          0.6
        );


      // ═══════════════════════════════════════════════════
      // SECTION 3: HORIZONTAL SCROLL (Data Stream)
      // ═══════════════════════════════════════════════════
      const totalWidth = htrackRef.current
        ? htrackRef.current.scrollWidth - window.innerWidth
        : 0;

      const tl3 = gsap.timeline({
        scrollTrigger: {
          trigger: hscrollRef.current,
          start: 'top top',
          end: () => `+=${totalWidth + window.innerWidth}`,
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      tl3.to(htrackRef.current, {
        x: () => -totalWidth,
        ease: 'none',
        duration: 1,
      });

      // Parallax particles in hscroll section
      const particles = hscrollRef.current?.querySelectorAll('.particle');
      particles?.forEach((p) => {
        const speed = parseFloat(p.dataset.speed || 1);
        tl3.to(p, {
          x: () => -totalWidth * speed * 0.3,
          ease: 'none',
          duration: 1,
        }, 0);
      });

      // Cards scale in as they enter center
      const cards = htrackRef.current?.querySelectorAll('.data-card');
      cards?.forEach((card) => {
        gsap.fromTo(
          card,
          { scale: 0.85, opacity: 0.4 },
          {
            scale: 1,
            opacity: 1,
            duration: 0.5,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: card,
              containerAnimation: tl3,
              start: 'left right',
              end: 'center center',
              scrub: true,
            },
          }
        );
      });


      // ═══════════════════════════════════════════════════
      // SECTION 4: Z-AXIS CASCADE
      // ═══════════════════════════════════════════════════
      const cascadeItems = cascadeRef.current?.querySelectorAll('.cascade-item');
      cascadeItems?.forEach((item, i) => {
        const delay = i % 2 === 0 ? 0 : 0.1;
        gsap.fromTo(
          item,
          {
            z: -600,
            opacity: 0,
            rotateX: 20,
            rotateY: i % 2 === 0 ? -15 : 15,
            y: 80,
          },
          {
            z: 0,
            opacity: 1,
            rotateX: 0,
            rotateY: 0,
            y: 0,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: item,
              start: 'top 85%',
              end: 'top 30%',
              scrub: 1,
            },
          }
        );
      });


      // ═══════════════════════════════════════════════════
      // NAVBAR — fade in slightly on scroll
      // ═══════════════════════════════════════════════════
      ScrollTrigger.create({
        start: 100,
        onUpdate: (self) => {
          if (navRef.current) {
            navRef.current.querySelector('.cyber-nav-inner').style.background =
              self.progress > 0.01
                ? 'rgba(0,0,10,0.85)'
                : 'rgba(0,0,10,0.6)';
          }
        },
      });

      // ═══════════════════════════════════════════════════
      // CTA SECTION — bloom in
      // ═══════════════════════════════════════════════════
      gsap.fromTo(
        ctaRef.current?.querySelector('.cta-content'),
        { opacity: 0, y: 60, scale: 0.96 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: ctaRef.current,
            start: 'top 70%',
            end: 'top 30%',
            scrub: 1,
          },
        }
      );

    }); // end gsap.context

    return () => ctx.revert();
  }, []);

  return (
    <>
      {/* ── NAVBAR ── */}
      <nav ref={navRef} className="cyber-nav">
        <div className="cyber-nav-inner">
          <div className="flex items-center gap-2">
            {/* Neon Spark Icon (inline SVG) */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2 L14 9 L21 9 L15.5 13.5 L17.5 21 L12 17 L6.5 21 L8.5 13.5 L3 9 L10 9 Z"
                fill="none" stroke="#00f7ff" strokeWidth="1.5"
                style={{ filter: 'drop-shadow(0 0 6px #00f7ff)' }} />
            </svg>
            <span className="text-lg font-bold tracking-tight" style={{ color: '#00f7ff', textShadow: '0 0 20px rgba(0,247,255,0.5)' }}>
              Eco ĐH31LQA
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-neutral-400">
            <a href="#tunnel-section" className="hover:text-white transition-colors hover:text-cyan-400">Kỷ luật</a>
            <a href="#hscroll-section" className="hover:text-white transition-colors hover:text-cyan-400">Đoàn kết</a>
            <a href="#cta-section" className="hover:text-white transition-colors hover:text-cyan-400">Liên hệ</a>
          </div>
          <Magnetic
            onClick={() => window.location.href = '/app.html'}
            className="hidden md:inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium cursor-pointer"
            style={{
              background: 'linear-gradient(90deg, rgba(0,247,255,0.15), rgba(124,58,237,0.15))',
              border: '1px solid rgba(0,247,255,0.35)',
              color: '#00f7ff',
              boxShadow: '0 0 20px rgba(0,247,255,0.1)',
            }}
          >
            Vào Cổng Nội Bộ →
          </Magnetic>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════
          SECTION 1 — 3D TUNNEL DIVE
      ══════════════════════════════════════════════════ */}
      <section ref={tunnelRef} id="tunnel-section" className="tunnel-section" style={{ height: '100vh' }}>

        {/* Radial vignette */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 20%, rgba(0,0,5,0.85) 100%)'
        }} />

        {/* Tunnel rings wrapper */}
        <div ref={tunnelWrapperRef} className="tunnel-wrapper" style={{ zIndex: 2 }}>
          {TUNNEL_RINGS.map((r) =>
            r.isHex
              ? <HexRing key={r.id} size={r.size} opacity={r.opacity} rotation={r.rotation} color={r.id % 8 === 0 ? '#a78bfa' : '#00f7ff'} />
              : <CircleRing key={r.id} size={r.size} opacity={r.opacity} rotation={r.rotation} />
          )}
        </div>

        {/* Cross-hair lines */}
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none', opacity: 0.25 }}>
          <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#00f7ff" strokeWidth="0.5" strokeDasharray="4 8" />
          <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#00f7ff" strokeWidth="0.5" strokeDasharray="4 8" />
        </svg>

        {/* Hero text */}
        <div ref={tunnelHeroRef} className="tunnel-hero-text" style={{ zIndex: 10, width: '100%', maxWidth: '92vw', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(0,247,255,0.08)', border: '1px solid rgba(0,247,255,0.25)',
            borderRadius: 999, padding: '6px 16px', marginBottom: 28, backdropFilter: 'blur(10px)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00f7ff', boxShadow: '0 0 10px #00f7ff', display: 'inline-block', animation: 'blink 1s step-start infinite' }} />
            <span style={{ fontSize: 11, color: 'rgba(0,247,255,0.8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Hệ thống đang hoạt động</span>
          </div>

          <h1 style={{ fontSize: 'clamp(2.5rem,7vw,6rem)', fontWeight: 900, lineHeight: 1, margin: '0 auto', letterSpacing: '-0.03em', textAlign: 'center', maxWidth: '90vw' }}>
            <span className="gradient-text">{typed}</span>
            <span className="animate-blink" style={{ display: 'inline-block', width: 3, height: '0.9em', background: '#00f7ff', marginLeft: 4, verticalAlign: 'middle', boxShadow: '0 0 12px #00f7ff' }} />
          </h1>

          <p style={{ marginTop: 24, maxWidth: 560, width: '100%', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '1.05rem', lineHeight: 1.7 }}>
            Nền tảng số phục vụ học tập và quản lý — hướng đến xây dựng Xã hội số và Nhà trường thông minh.
          </p>

          <div style={{ marginTop: 40, display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Magnetic
              onClick={() => window.location.href = '/app.html'}
              className="glow-hover-purple cursor-pointer inline-flex items-center gap-2 rounded-full px-8 py-3.5 font-semibold text-white"
              style={{ background: 'linear-gradient(90deg,#7c3aed,#00f7ff)', boxShadow: '0 0 40px rgba(0,247,255,0.2)' }}
            >
              Bắt đầu khám phá →
            </Magnetic>
            <a href="#textmask-section" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 24px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', textDecoration: 'none', backdropFilter: 'blur(8px)' }}>
              Cuộn để khám phá
            </a>
          </div>

          <div className="animate-bounce-soft" style={{ marginTop: 64, color: 'rgba(0,247,255,0.4)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 2 — TEXT MASK REVEAL
      ══════════════════════════════════════════════════ */}
      <section ref={textMaskRef} id="textmask-section" className="textmask-section" style={{ height: '100vh' }}>
        <div ref={maskRevealRef} className="mask-reveal-bg" />

        {/* Decorative grid lines */}
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.06, pointerEvents: 'none' }}>
          {Array.from({ length: 20 }, (_, i) => (
            <line key={i} x1={`${i * 5.26}%`} y1="0" x2={`${i * 5.26}%`} y2="100%"
              stroke="#00f7ff" strokeWidth="0.5" />
          ))}
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1="0" y1={`${i * 9.09}%`} x2="100%" y2={`${i * 9.09}%`}
              stroke="#00f7ff" strokeWidth="0.5" />
          ))}
        </svg>

        <div style={{ position: 'relative', zIndex: 3, textAlign: 'center', userSelect: 'none' }}>
          <p style={{ fontSize: '0.75rem', letterSpacing: '0.25em', color: 'rgba(0,247,255,0.5)', textTransform: 'uppercase', marginBottom: 16 }}>
            ĐH31LQA · Nhà trường thông minh
          </p>
          <div
            ref={maskTextRef}
            className="mask-giant-text"
            style={{
              backgroundImage: 'linear-gradient(135deg, #00f7ff 0%, #7c3aed 30%, #ff00aa 60%, #00f7ff 100%)',
              backgroundSize: '400% 400%',
              backgroundPosition: '0% 50%',
            }}
          >
            FUTURE<br />IS NOW
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 3 — HORIZONTAL DATA STREAM
      ══════════════════════════════════════════════════ */}
      <section ref={hscrollRef} id="hscroll-section" className="hscroll-section" style={{ height: '100vh', overflow: 'hidden' }}>

        {/* Floating particles (background) */}
        {[
          { x: 10, y: 20, size: 6, color: '#00f7ff', speed: 0.4 },
          { x: 80, y: 70, size: 4, color: '#a78bfa', speed: 0.7 },
          { x: 30, y: 80, size: 8, color: '#f472b6', speed: 0.5 },
          { x: 60, y: 15, size: 5, color: '#34d399', speed: 0.3 },
          { x: 90, y: 40, size: 6, color: '#00f7ff', speed: 0.6 },
          { x: 20, y: 55, size: 3, color: '#fb923c', speed: 0.8 },
          { x: 45, y: 90, size: 5, color: '#a78bfa', speed: 0.45 },
          { x: 70, y: 30, size: 7, color: '#00f7ff', speed: 0.55 },
        ].map((p, i) => (
          <Particle key={i} {...p} />
        ))}

        {/* Horizontal scan line */}
        <div style={{
          position: 'absolute', top: '50%', left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(0,247,255,0.15), transparent)',
          transform: 'translateY(-50%)', zIndex: 1, pointerEvents: 'none',
        }} />

        {/* Section heading pinned left */}
        <div style={{
          position: 'absolute', left: '5vw', top: '50%',
          transform: 'translateY(-50%)', zIndex: 5, pointerEvents: 'none',
        }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: 'rgba(0,247,255,0.5)', textTransform: 'uppercase', marginBottom: 8 }}>
            Luồng dữ liệu
          </p>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: 900, color: 'white', lineHeight: 1.1 }}>
            Hệ sinh thái<br />
            <span style={{ color: '#00f7ff', textShadow: '0 0 20px rgba(0,247,255,0.5)' }}>đồng bộ</span>
          </h2>
        </div>

        {/* Horizontal track */}
        <div ref={htrackRef} className="hscroll-track" style={{ paddingLeft: '30vw' }}>
          {DATA_CARDS.map((card, i) => (
            <div key={i} className="data-card">
              <div className="data-card-glow" style={{ background: card.glowColor }} />

              {/* Card header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
                <div>
                  <p style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 6 }}>
                    {card.subtitle}
                  </p>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'white' }}>{card.title}</h3>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '2rem', fontWeight: 900, color: card.color, textShadow: `0 0 20px ${card.color}`, lineHeight: 1 }}>
                    {card.stat}
                  </p>
                  <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>{card.statLabel}</p>
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: `linear-gradient(90deg, ${card.color}50, transparent)`, marginBottom: 20 }} />

              {/* Abstract SVG shape */}
              <svg width="100%" height="80" viewBox="0 0 300 80" style={{ marginBottom: 20, opacity: 0.7 }}>
                {/* Random data-stream waveform */}
                <polyline
                  points={Array.from({ length: 30 }, (_, j) => `${j * 10},${40 + Math.sin(j * 0.8 + i) * 25 + Math.cos(j * 0.3 + i) * 15}`).join(' ')}
                  fill="none"
                  stroke={card.color}
                  strokeWidth="1.5"
                  style={{ filter: `drop-shadow(0 0 4px ${card.color})` }}
                />
                {/* Vertical markers */}
                {[0, 5, 10, 15, 20, 25, 29].map((j) => (
                  <line key={j}
                    x1={j * 10} y1={30 + Math.sin(j * 0.8 + i) * 25 + Math.cos(j * 0.3 + i) * 15 - 5}
                    x2={j * 10} y2={30 + Math.sin(j * 0.8 + i) * 25 + Math.cos(j * 0.3 + i) * 15 + 5}
                    stroke={card.color} strokeWidth="1" opacity="0.5" />
                ))}
              </svg>

              <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.65 }}>{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 4 — Z-AXIS CASCADE
      ══════════════════════════════════════════════════ */}
      <section ref={cascadeRef} id="cascade-section" className="cascade-section">
        {/* Background decorative SVG */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.04, pointerEvents: 'none' }}>
          {Array.from({ length: 8 }, (_, i) => (
            <circle key={i} cx={`${10 + i * 12}%`} cy="50%" r="200"
              fill="none" stroke="#00f7ff" strokeWidth="0.5" />
          ))}
        </svg>

        <div style={{ textAlign: 'center', marginBottom: '6rem', padding: '0 2rem', position: 'relative', zIndex: 2 }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: 'rgba(0,247,255,0.5)', textTransform: 'uppercase', marginBottom: 12 }}>
            Giá trị cốt lõi
          </p>
          <h2 style={{ fontSize: 'clamp(2rem, 5vw, 4rem)', fontWeight: 900 }}>
            Chúng ta đang<br />
            <span className="gradient-text" style={{ fontStyle: 'normal' }}>xây dựng điều gì?</span>
          </h2>
        </div>

        {CASCADE_ITEMS.map((item, i) => (
          <div key={i} className="cascade-item" style={{ zIndex: 2 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: i % 2 === 0 ? '1fr 1.4fr' : '1.4fr 1fr',
              gap: '4rem',
              alignItems: 'center',
            }}>
              {/* Abstract shape */}
              <div style={{ order: i % 2 === 0 ? 0 : 1 }}>
                <svg width="100%" viewBox="0 0 300 300" style={{ maxWidth: 320, margin: '0 auto', display: 'block' }}>
                  {/* Concentric glowing polygons */}
                  {[1, 0.75, 0.5, 0.25].map((scale, j) => {
                    const sides = 6 + i * 2;
                    const r = 120 * scale;
                    const cx = 150, cy = 150;
                    const pts = Array.from({ length: sides }, (_, k) => {
                      const ang = (Math.PI * 2 / sides) * k - Math.PI / 2;
                      return `${cx + r * Math.cos(ang)},${cy + r * Math.sin(ang)}`;
                    }).join(' ');
                    return (
                      <polygon key={j} points={pts} fill={j === 3 ? `${item.accent}12` : 'none'}
                        stroke={item.accent} strokeWidth={j === 0 ? 1 : 0.5}
                        opacity={0.3 + j * 0.2}
                        style={{ filter: j === 0 ? `drop-shadow(0 0 8px ${item.accent})` : 'none' }} />
                    );
                  })}
                  {/* Central dot */}
                  <circle cx="150" cy="150" r="6" fill={item.accent}
                    style={{ filter: `drop-shadow(0 0 10px ${item.accent})` }} />
                  {/* Orbit lines */}
                  <circle cx="150" cy="150" r="140" fill="none" stroke={item.accent} strokeWidth="0.3" strokeDasharray="3 8" opacity="0.3" />
                </svg>
              </div>

              {/* Text content */}
              <div style={{ order: i % 2 === 0 ? 1 : 0 }}>
                <span style={{
                  display: 'inline-block',
                  fontSize: '0.65rem', letterSpacing: '0.25em', textTransform: 'uppercase',
                  color: item.accent, background: `${item.accent}18`, border: `1px solid ${item.accent}40`,
                  borderRadius: 999, padding: '4px 12px', marginBottom: 16,
                  boxShadow: `0 0 20px ${item.accent}20`,
                }}>
                  {item.label}
                </span>
                <h3 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.8rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: 20 }}>
                  {item.heading}
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.8, fontSize: '1.05rem' }}>
                  {item.body}
                </p>

                {/* Progress bar decoration */}
                <div style={{ marginTop: 28, height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 1, overflow: 'hidden', maxWidth: 240 }}>
                  <div style={{
                    height: '100%',
                    width: `${70 + i * 10}%`,
                    background: `linear-gradient(90deg, ${item.accent}, ${item.accent}60)`,
                    boxShadow: `0 0 8px ${item.accent}`,
                    borderRadius: 1,
                  }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* ══════════════════════════════════════════════════
          CTA SECTION
      ══════════════════════════════════════════════════ */}
      <section ref={ctaRef} id="cta-section" className="cta-section">
        {/* Background glow */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600, height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,247,255,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Grid */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.04, pointerEvents: 'none' }}>
          {Array.from({ length: 25 }, (_, i) => (
            <line key={i} x1={`${i * 4.17}%`} y1="0" x2={`${i * 4.17}%`} y2="100%" stroke="#00f7ff" strokeWidth="0.5" />
          ))}
        </svg>

        <div className="cta-content" style={{ position: 'relative', zIndex: 2, padding: '0 2rem', maxWidth: 700, margin: '0 auto' }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(0,247,255,0.6)', marginBottom: 20 }}>
            ĐH31LQA · Đại đội 14
          </p>
          <h2 style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', fontWeight: 900, lineHeight: 1, marginBottom: 24, letterSpacing: '-0.03em' }}>
            Bạn đã sẵn sàng<br />
            <span style={{ color: '#00f7ff', textShadow: '0 0 40px rgba(0,247,255,0.5)' }}>gia nhập chưa?</span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.1rem', lineHeight: 1.7, marginBottom: 48, maxWidth: 500, margin: '0 auto 48px' }}>
            Hệ thống đang mở cửa. Trải nghiệm nền tảng giáo dục số hóa toàn diện của ĐH31LQA ngay hôm nay.
          </p>
          <Magnetic
            onClick={() => window.location.href = '/app.html'}
            className="glow-hover cursor-pointer inline-flex items-center gap-3 rounded-full font-bold text-black"
            style={{
              background: 'white',
              padding: '18px 48px',
              fontSize: '1.05rem',
              boxShadow: '0 0 60px rgba(255,255,255,0.3)',
            }}
          >
            Đăng nhập ngay
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Magnetic>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid rgba(0,247,255,0.1)', padding: '2.5rem 2rem', background: '#000005' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2 L14 9 L21 9 L15.5 13.5 L17.5 21 L12 17 L6.5 21 L8.5 13.5 L3 9 L10 9 Z"
                fill="none" stroke="rgba(0,247,255,0.5)" strokeWidth="1.5" />
            </svg>
            Ecosystem ĐH31LQA — © 2024 – 2028
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            {['Kỷ luật', 'Đoàn kết', 'Sáng tạo'].map((t) => (
              <span key={t} style={{ fontSize: '0.8rem', color: 'rgba(0,247,255,0.35)', letterSpacing: '0.1em' }}>{t}</span>
            ))}
          </div>
        </div>
      </footer>
    </>
  );
}
