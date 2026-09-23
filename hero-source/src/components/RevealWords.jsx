import React from 'react';
import { useInView } from '../hooks/useInView';

export function RevealWords({ text, className = '' }) {
  const [ref, inView] = useInView(0.35);
  const words = text.split(' ');
  return (
    <p ref={ref} className={className}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden" style={{ marginRight: '0.28em' }}>
          <span
            className="inline-block will-change-transform"
            style={{
              transform: inView ? 'translateY(0)' : 'translateY(115%)',
              opacity: inView ? 1 : 0,
              transition: `transform 0.8s cubic-bezier(.22,1,.36,1) ${i * 32}ms, opacity 0.7s ease ${i * 32}ms`,
            }}
          >
            {w}
          </span>
        </span>
      ))}
    </p>
  );
}
