import { useEffect, useRef, type TextareaHTMLAttributes } from 'react';

/** Textarea die meegroeit met de inhoud. */
export function Tekstvak(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, 640)}px`;
  }, [props.value]);
  return <textarea ref={ref} {...props} />;
}
