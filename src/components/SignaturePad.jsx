import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, RotateCcw, Trash2 } from 'lucide-react';

const MODES = [
  { id: 'drawn', label: 'Draw' },
  { id: 'typed', label: 'Type' },
  { id: 'saved', label: 'Saved' },
];

const SCRIPT_STYLES = [
  { id: 'pinyon', label: 'Classic', font: '"Pinyon Script", cursive' },
  { id: 'cormorant', label: 'Editorial', font: '"Cormorant Garamond", Georgia, serif', italic: true },
  { id: 'georgia', label: 'Formal', font: 'Georgia, serif', italic: true },
];

function canvasPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
    y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
  };
}

function drawStroke(context, stroke, scale, color) {
  if (!stroke?.length) return;
  context.strokeStyle = color;
  context.lineWidth = 2.35 * scale;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(stroke[0].x * scale, stroke[0].y * scale);
  if (stroke.length === 1) {
    context.lineTo((stroke[0].x + 0.1) * scale, (stroke[0].y + 0.1) * scale);
  } else {
    for (let index = 1; index < stroke.length - 1; index += 1) {
      const point = stroke[index];
      const next = stroke[index + 1];
      context.quadraticCurveTo(
        point.x * scale,
        point.y * scale,
        ((point.x + next.x) / 2) * scale,
        ((point.y + next.y) / 2) * scale,
      );
    }
    const last = stroke[stroke.length - 1];
    context.lineTo(last.x * scale, last.y * scale);
  }
  context.stroke();
}

function exportStrokes(strokes, width, height) {
  const output = document.createElement('canvas');
  output.width = Math.max(2, Math.round(width * 2));
  output.height = Math.max(2, Math.round(height * 2));
  const context = output.getContext('2d');
  for (const stroke of strokes) drawStroke(context, stroke, 2, '#2b2118');
  return output.toDataURL('image/png');
}

function exportTypedSignature(name, style, width, height) {
  const output = document.createElement('canvas');
  output.width = Math.max(2, Math.round(width * 2));
  output.height = Math.max(2, Math.round(height * 2));
  const context = output.getContext('2d');
  context.clearRect(0, 0, output.width, output.height);
  context.fillStyle = '#2b2118';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const fontSize = Math.min(82, Math.max(44, 900 / Math.max(8, name.length))) * 2;
  context.font = `${style.italic ? 'italic ' : ''}${fontSize}px ${style.font}`;
  context.fillText(name, output.width / 2, output.height / 2, output.width - 36);
  return output.toDataURL('image/png');
}

export function SignaturePad({ legalName = '', savedSignatures = [], value, onChange }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const activeStrokeRef = useRef([]);
  const [mode, setMode] = useState(value?.method || 'drawn');
  const [strokes, setStrokes] = useState([]);
  const [typedName, setTypedName] = useState(legalName);
  const [scriptStyle, setScriptStyle] = useState(SCRIPT_STYLES[0].id);
  const activeScript = useMemo(
    () => SCRIPT_STYLES.find(style => style.id === scriptStyle) || SCRIPT_STYLES[0],
    [scriptStyle],
  );

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, width, height);
    for (const stroke of strokes) drawStroke(context, stroke, ratio, '#f3eadb');
    if (activeStrokeRef.current.length) drawStroke(context, activeStrokeRef.current, ratio, '#f3eadb');
  }, [strokes]);

  useEffect(() => {
    redraw();
    const observer = new ResizeObserver(redraw);
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [redraw, mode]);

  useEffect(() => {
    if (legalName && !typedName) setTypedName(legalName);
  }, [legalName, typedName]);

  function emitDrawn(nextStrokes) {
    const canvas = canvasRef.current;
    if (!canvas || !nextStrokes.length) return onChange?.(null);
    const rect = canvas.getBoundingClientRect();
    onChange?.({ method: 'drawn', dataUrl: exportStrokes(nextStrokes, rect.width, rect.height) });
  }

  function finishStroke(event) {
    const canvas = canvasRef.current;
    if (!canvas || !drawingRef.current) return;
    drawingRef.current = false;
    if (event.pointerId != null && canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    const stroke = activeStrokeRef.current;
    activeStrokeRef.current = [];
    if (!stroke.length) return;
    setStrokes(current => {
      const next = [...current, stroke];
      emitDrawn(next);
      return next;
    });
  }

  function selectMode(nextMode) {
    setMode(nextMode);
    if (nextMode === 'drawn') emitDrawn(strokes);
    if (nextMode === 'typed') emitTyped(typedName, activeScript);
    if (nextMode === 'saved') onChange?.(null);
  }

  function emitTyped(name, style) {
    const cleanName = String(name || '').trim();
    if (!cleanName) return onChange?.(null);
    const canvas = canvasRef.current;
    const width = canvas?.getBoundingClientRect().width || 640;
    const height = canvas?.getBoundingClientRect().height || 220;
    onChange?.({ method: 'typed', dataUrl: exportTypedSignature(cleanName, style, width, height) });
  }

  function undo() {
    setStrokes(current => {
      const next = current.slice(0, -1);
      emitDrawn(next);
      return next;
    });
  }

  function clear() {
    activeStrokeRef.current = [];
    setStrokes([]);
    onChange?.(null);
  }

  return (
    <div className="w-full">
      <div className="flex h-12 items-end gap-7 border-b border-[#a17d40]/45 px-1" role="tablist" aria-label="Signature method">
        {MODES.map(item => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={mode === item.id}
            onClick={() => selectMode(item.id)}
            disabled={item.id === 'saved' && savedSignatures.length === 0}
            className={`relative h-12 px-1 text-xs font-semibold uppercase tracking-[0.24em] transition-colors ${
              mode === item.id ? 'text-[#f3eadb]' : 'text-[#8a806e] hover:text-[#e7dcc9] disabled:cursor-not-allowed disabled:opacity-35'
            }`}
          >
            {item.label}
            {mode === item.id && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#c9a15e]" />}
          </button>
        ))}
      </div>

      <div className="relative mt-5 h-[220px] min-h-[220px] overflow-hidden rounded-md border border-[#a17d40]/55 bg-[#0d0906] shadow-[inset_0_12px_38px_rgba(0,0,0,0.48)] sm:h-[250px] sm:min-h-[250px]">
        <div className="pointer-events-none absolute inset-x-8 bottom-[64px] h-px bg-[#c9a15e]/65" />
        {mode === 'drawn' && (
          <>
            <div className="absolute right-4 top-3 z-10 flex gap-1">
              <button type="button" onClick={undo} disabled={!strokes.length} title="Undo last stroke" aria-label="Undo last stroke" className="flex h-9 w-9 items-center justify-center text-[#8a806e] transition hover:text-[#f3eadb] disabled:opacity-30">
                <RotateCcw size={16} />
              </button>
              <button type="button" onClick={clear} disabled={!strokes.length} title="Clear signature" aria-label="Clear signature" className="flex h-9 w-9 items-center justify-center text-[#8a806e] transition hover:text-[#f3eadb] disabled:opacity-30">
                <Trash2 size={16} />
              </button>
            </div>
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full touch-none"
              aria-label="Draw your signature"
              onPointerDown={event => {
                if (event.pointerType === 'mouse' && event.button !== 0) return;
                drawingRef.current = true;
                activeStrokeRef.current = [canvasPoint(event, event.currentTarget)];
                event.currentTarget.setPointerCapture(event.pointerId);
                redraw();
              }}
              onPointerMove={event => {
                if (!drawingRef.current) return;
                activeStrokeRef.current.push(canvasPoint(event, event.currentTarget));
                redraw();
              }}
              onPointerUp={finishStroke}
              onPointerCancel={finishStroke}
            />
            <p className="pointer-events-none absolute inset-x-0 bottom-5 text-center text-xs text-[#8a806e]">Draw your signature above the line</p>
          </>
        )}

        {mode === 'typed' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 pb-9">
            <div className="flex w-full max-w-xl items-center justify-center overflow-hidden text-center text-[#f3eadb]" style={{ height: 112, fontFamily: activeScript.font, fontStyle: activeScript.italic ? 'italic' : 'normal', fontSize: 'clamp(38px, 8vw, 76px)' }}>
              {typedName || 'Your name'}
            </div>
            <input
              value={typedName}
              maxLength={160}
              onChange={event => {
                setTypedName(event.target.value);
                emitTyped(event.target.value, activeScript);
              }}
              placeholder="Type your legal name"
              className="absolute inset-x-8 bottom-4 border-0 border-b border-[#c9a15e]/65 bg-transparent px-2 py-2 text-center font-display text-lg text-[#f3eadb] outline-none placeholder:text-[#8a806e]"
            />
          </div>
        )}

        {mode === 'saved' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-5">
            {savedSignatures.map(saved => (
              <button
                key={saved.id}
                type="button"
                onClick={() => onChange?.({ method: 'saved', savedSignatureId: saved.id, previewUrl: saved.url })}
                className={`flex w-full max-w-xl items-center gap-4 rounded-md border px-4 py-3 text-left transition ${
                  value?.savedSignatureId === saved.id
                    ? 'border-[#65b685] bg-[#1f3a2e]/40'
                    : 'border-[#a17d40]/45 bg-[#171008] hover:border-[#c9a15e]'
                }`}
              >
                <img src={saved.url} alt="Saved signature" className="h-14 min-w-0 flex-1 object-contain [filter:invert(92%)_sepia(15%)_saturate(312%)]" />
                <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#a17d40]/65 text-[#c9a15e]">
                  {value?.savedSignatureId === saved.id ? <Check size={16} /> : <span className="text-[10px] font-bold uppercase">Use</span>}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {mode === 'typed' && (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Signature style">
          {SCRIPT_STYLES.map(style => (
            <button
              key={style.id}
              type="button"
              onClick={() => {
                setScriptStyle(style.id);
                emitTyped(typedName, style);
              }}
              className={`border px-3 py-2 text-xs transition ${scriptStyle === style.id ? 'border-[#c9a15e] text-[#f3eadb]' : 'border-[#a17d40]/35 text-[#8a806e] hover:text-[#e7dcc9]'}`}
            >
              {style.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
