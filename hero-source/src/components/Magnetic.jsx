import React, { useState, useRef } from 'react';

export function Magnetic({ children, className = '', strength = 0.3, style = {}, ...rest }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  return (
    <button
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current.getBoundingClientRect();
        setPos({
          x: (e.clientX - r.left - r.width / 2) * strength,
          y: (e.clientY - r.top - r.height / 2) * strength,
        });
      }}
      onMouseLeave={() => setPos({ x: 0, y: 0 })}
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        transition: 'transform 0.2s cubic-bezier(.22,1,.36,1)',
        ...style,
      }}
      className={`focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
