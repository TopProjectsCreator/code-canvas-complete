/**
 * Editable shadow value input overlay for Scratch reporter slots.
 * - Maintains its own local state during editing so parent re-renders don't disrupt typing.
 * - Commits on blur/Enter.
 * - Stops propagation of pointer events so workspace drag/drop isn't triggered.
 * - When `disablePointer` is true (e.g., another block is being dragged), pointer events
 *   pass through to the workspace below so reporters can be snapped into the slot.
 */
import { useEffect, useRef, useState } from 'react';

interface ShadowInputProps {
  value: string;
  left: number;
  top: number;
  width: number;
  height: number;
  disablePointer: boolean;
  onCommit: (value: string) => void;
}

export const ShadowInput = ({
  value,
  left,
  top,
  width,
  height,
  disablePointer,
  onCommit,
}: ShadowInputProps) => {
  const [local, setLocal] = useState(value);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  // Sync external value into local state ONLY when not focused (so typing isn't clobbered).
  useEffect(() => {
    if (!focused) setLocal(value);
  }, [value, focused]);

  return (
    <input
      ref={ref}
      type="text"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onPointerDown={(e) => { e.stopPropagation(); }}
      onPointerUp={(e) => { e.stopPropagation(); }}
      onMouseDown={(e) => { e.stopPropagation(); }}
      onMouseUp={(e) => { e.stopPropagation(); }}
      onClick={(e) => { e.stopPropagation(); ref.current?.focus(); ref.current?.select(); }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        if (local !== value) onCommit(local);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          ref.current?.blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setLocal(value);
          ref.current?.blur();
        }
      }}
      className="absolute text-center outline-none"
      style={{
        left,
        top,
        width,
        height,
        borderRadius: height / 2,
        background: 'white',
        color: '#575e75',
        fontSize: 11,
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        border: focused ? '2px solid #ffbf00' : 'none',
        padding: 0,
        boxSizing: 'border-box',
        // Pass clicks through to the workspace while another block is dragging,
        // so reporters can be dropped into this slot.
        pointerEvents: disablePointer && !focused ? 'none' : 'auto',
        zIndex: 1,
      }}
    />
  );
};
