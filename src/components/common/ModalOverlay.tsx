import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

let openDialogs = 0;
let previousOverflow = '';

/** Render dialogs outside page containers and inside the visible mobile viewport. */
export const ModalOverlay: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children, className = '', style, ...props
}) => {
  const [viewport, setViewport] = useState<React.CSSProperties>({});
  useEffect(() => {
    const visible = window.visualViewport;
    const update = () => setViewport(visible ? {
      top: visible.offsetTop, left: visible.offsetLeft,
      width: visible.width, height: visible.height, bottom: 'auto', right: 'auto'
    } : {});
    update();
    visible?.addEventListener('resize', update);
    visible?.addEventListener('scroll', update);
    if (openDialogs++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    return () => {
      visible?.removeEventListener('resize', update);
      visible?.removeEventListener('scroll', update);
      if (--openDialogs === 0) document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    <div {...props} role="dialog" aria-modal="true"
      className={`modal-overlay ${className}`} style={{ ...style, ...viewport }}>
      {children}
    </div>, document.body
  );
};
