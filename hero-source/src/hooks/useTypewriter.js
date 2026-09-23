import { useState, useEffect } from 'react';

export function useTypewriter(phrases, typingSpeed = 75, deletingSpeed = 40, pause = 1500) {
  const [text, setText] = useState('');
  const [index, setIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);
 
  useEffect(() => {
    const current = phrases[index % phrases.length];
    let timeout;
    if (!deleting) {
      if (text.length < current.length) {
        timeout = setTimeout(() => setText(current.slice(0, text.length + 1)), typingSpeed);
      } else {
        timeout = setTimeout(() => setDeleting(true), pause);
      }
    } else {
      if (text.length > 0) {
        timeout = setTimeout(() => setText(current.slice(0, text.length - 1)), deletingSpeed);
      } else {
        setDeleting(false);
        setIndex((i) => i + 1);
      }
    }
    return () => clearTimeout(timeout);
  }, [text, deleting, index, phrases, typingSpeed, deletingSpeed, pause]);
 
  return text;
}
