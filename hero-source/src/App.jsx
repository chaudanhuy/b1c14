import { ArrowRight, ChevronDown, Cpu, Github, Layers, Linkedin, Menu, Palette, Sparkles, Twitter, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Magnetic } from './components/Magnetic';
import { RevealWords } from './components/RevealWords';
import { TiltCard } from './components/TiltCard';
import { useTypewriter } from './hooks/useTypewriter';
import './styles/global.css';

const PHRASES = [
  'Khám phá hệ sinh thái ĐH31LQA.',
  'Hướng đến xây dựng Nhà trường thông minh.',
  'Nền tảng số cho giáo dục.',
  'Chinh phục những công nghệ mới.',
];

export default function App() {
  const typed = useTypewriter(PHRASES);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
 
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
 
  const features = [
    {
      icon: Layers,
      title: 'Systems that scale',
      desc: 'Component libraries and design tokens built once, reused across every product surface without drifting apart.',
    },
    {
      icon: Cpu,
      title: 'Sixty frames, always',
      desc: 'We budget for performance the same way we budget for design — every animation is profiled before it ships.',
    },
    {
      icon: Palette,
      title: 'Detail, obsessively',
      desc: 'Kerning, easing curves, corner radii — the parts nobody mentions are the parts people actually feel.',
    },
  ];
 
  return (
    <div
      className="relative min-h-screen text-white overflow-x-hidden selection:bg-fuchsia-500/30 selection:text-white"
      style={{ backgroundColor: '#07070b' }}
    >
      {/* Background mesh */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute rounded-full blur-3xl animate-blob1"
          style={{ top: '-10%', left: '-10%', width: '500px', height: '500px', background: 'rgba(147,51,234,0.30)' }}
        />
        <div
          className="absolute rounded-full blur-3xl animate-blob2"
          style={{ top: '15%', right: '-15%', width: '600px', height: '600px', background: 'rgba(6,182,212,0.20)' }}
        />
        <div
          className="absolute rounded-full blur-3xl animate-blob3"
          style={{ bottom: '-15%', left: '20%', width: '550px', height: '550px', background: 'rgba(16,185,129,0.18)' }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)',
            backgroundSize: '38px 38px',
          }}
        />
      </div>
 
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 px-4 sm:px-6 pt-5">
        <div
          className={`mx-auto max-w-6xl flex items-center justify-between rounded-2xl transition-all duration-500 px-5 ${
            scrolled
              ? 'bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg shadow-black/40 py-3'
              : 'py-2 border border-transparent'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-fuchsia-400" />
            <span className="text-lg font-semibold tracking-tight">Aura</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-neutral-300">
            <a href="#reveal" className="hover:text-white transition-colors">
              Approach
            </a>
            <a href="#features" className="hover:text-white transition-colors">
              Craft
            </a>
            <a href="#contact" className="hover:text-white transition-colors">
              Contact
            </a>
          </div>
          <Magnetic onClick={() => window.location.href = '/app.html'} className="glow-hover hidden md:inline-flex items-center rounded-full bg-white text-black text-sm font-medium px-4 py-2">
            Start a project
          </Magnetic>
          <button
            className="md:hidden text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 rounded-lg p-1"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden mx-1 mt-2 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-5 flex flex-col gap-4 text-sm text-neutral-200">
            <a href="#reveal" onClick={() => setMenuOpen(false)}>
              Approach
            </a>
            <a href="#features" onClick={() => setMenuOpen(false)}>
              Craft
            </a>
            <a href="#contact" onClick={() => setMenuOpen(false)}>
              Contact
            </a>
          </div>
        )}
      </nav>
 
      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center pt-28">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-4 py-1.5 text-xs text-neutral-300 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Taking on a limited number of projects for 2026
        </div>
 
        <h1
          className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight max-w-4xl"
          style={{ lineHeight: 1.08 }}
        >
          <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent gradient-text">
            {typed}
          </span>
          <span
            className="inline-block bg-cyan-300 ml-1 align-middle animate-blink"
            style={{ width: '3px', height: '0.9em' }}
          />
        </h1>
 
        <p className="mt-6 max-w-xl text-neutral-400 text-base md:text-lg leading-relaxed">
          We're a small studio that designs and builds interfaces for teams who care how
          the details feel, not just how they look.
        </p>
 
        <div className="mt-10 flex flex-col sm:flex-row items-center gap-5">
          <Magnetic
            onClick={() => window.location.href = '/app.html'}
            className="glow-hover-purple group relative inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-medium text-white"
            style={{ background: 'linear-gradient(90deg,#7c3aed,#06b6d4)' }}
          >
            Start a project
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Magnetic>
          <a
            href="#reveal"
            className="text-sm text-neutral-300 hover:text-white transition-colors underline underline-offset-4 decoration-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 rounded"
          >
            See how we think
          </a>
        </div>
 
        <div className="absolute bottom-10 animate-bounce-soft text-neutral-500">
          <ChevronDown className="w-5 h-5" />
        </div>
      </section>
 
      {/* Scroll reveal */}
      <section id="reveal" className="relative px-6 py-32 md:py-44 max-w-5xl mx-auto">
        <RevealWords
          text="We believe great design is invisible until it isn't. Every pixel, every motion, every interaction is engineered to feel inevitable."
          className="text-3xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-neutral-100"
        />
      </section>
 
      {/* Features */}
      <section id="features" className="relative px-6 py-24 md:py-32 max-w-6xl mx-auto">
        <div className="text-center mb-16 max-w-xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            What makes it feel different
          </h2>
          <p className="mt-4 text-neutral-400 leading-relaxed">
            Three commitments we don't compromise on, project after project.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <TiltCard
              key={i}
              className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 hover:border-white/20 hover:bg-white/10 transition-colors"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-6"
                style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.28), rgba(6,182,212,0.28))' }}
              >
                <f.icon className="w-5 h-5 text-cyan-300" />
              </div>
              <h3 className="text-lg font-semibold mb-2 tracking-tight">{f.title}</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">{f.desc}</p>
            </TiltCard>
          ))}
        </div>
      </section>
 
      {/* Contact / CTA */}
      <section id="contact" className="relative px-6 py-28 md:py-36 max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
          Tell us what you're building
        </h2>
        <p className="text-neutral-400 mb-10 max-w-lg mx-auto leading-relaxed">
          We reply within a day, with next steps — not a sales pitch.
        </p>
        <Magnetic onClick={() => window.location.href = '/app.html'} className="glow-hover inline-flex items-center rounded-full px-8 py-4 font-medium text-black bg-white">
          Start a project
        </Magnetic>
      </section>
 
      {/* Footer */}
      <footer className="relative border-t border-white/10 px-6 py-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <Sparkles className="w-4 h-4 text-fuchsia-400" /> Aura — © 2026
          </div>
          <div className="flex items-center gap-5 text-neutral-400">
            <a href="#" className="hover:text-white transition-colors" aria-label="Github">
              <Github className="w-4 h-4" />
            </a>
            <a href="#" className="hover:text-white transition-colors" aria-label="Twitter">
              <Twitter className="w-4 h-4" />
            </a>
            <a href="#" className="hover:text-white transition-colors" aria-label="LinkedIn">
              <Linkedin className="w-4 h-4" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
