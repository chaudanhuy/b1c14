import React, { useState, useRef } from 'react';

export function TiltCard({ children, className = '' }) {
  const ref = useRef(null);
  const [style, setStyle] = useState({ transform: 'perspective(900px) rotateX(0) rotateY(0) scale3d(1,1,1)' });
  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        const rx = (0.5 - py) * 10;
        const ry = (px - 0.5) * 10;
        setStyle({
          transform: `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) scale3d(1.03,1.03,1.03)`,
        });
      }}
      onMouseLeave={() =>
        setStyle({ transform: 'perspective(900px) rotateX(0) rotateY(0) scale3d(1,1,1)' })
      }
      style={{ ...style, transition: 'transform 0.25s cubic-bezier(.22,1,.36,1)' }}
      className={className}
    >
      {children}
    </div>
  );
}
