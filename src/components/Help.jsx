import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

/** ⓘ button whose explanation shows on hover, keyboard focus or tap (tap pins it; Esc / outside tap closes). */
export default function Help({ children, label = '설명', className = '', testid }) {
    const id = useId(), wrap = useRef(null), pop = useRef(null);
    const [pinned, setPinned] = useState(false), [hover, setHover] = useState(false), [focus, setFocus] = useState(false), [shift, setShift] = useState(0);
    const open = pinned || hover || focus;
    useLayoutEffect(() => {
        if (!open || !pop.current) return;
        const r = pop.current.getBoundingClientRect(), vw = document.documentElement.clientWidth, m = 8;
        const base = r.left - shift;
        setShift(Math.round(Math.max(m, Math.min(base, vw - m - r.width)) - base));
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!open) return;
        const away = e => { if (!wrap.current?.contains(e.target)) setPinned(false); };
        const esc = e => { if (e.key === 'Escape') { setPinned(false); setHover(false); setFocus(false); wrap.current?.querySelector('button')?.blur(); } };
        document.addEventListener('pointerdown', away); document.addEventListener('keydown', esc);
        return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
    }, [open]);
    return <span ref={wrap} className={'help ' + className} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <button type="button" className="help-btn" aria-label={label + ' 보기'} aria-expanded={open} aria-describedby={id}
            onClick={e => { e.preventDefault(); setPinned(p => !p); }} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}>?</button>
        <span ref={pop} id={id} data-testid={testid} role="tooltip" className="help-pop" hidden={!open} style={{ marginLeft: shift }}>{children}</span>
    </span>;
}
