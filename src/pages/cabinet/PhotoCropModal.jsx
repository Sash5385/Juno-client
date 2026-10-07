import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// Кадрування фото профілю: перетягнути пальцем, збільшити щипком/повзунком. Результат — dataURL (JPEG).
export default function PhotoCropModal({ file, round, outSize, title, onCancel, onDone }) {
  const BG_DEEP = 'var(--bg-deep)', SURF_HI = 'var(--surf-hi)', SURFACE = 'var(--surface)', TEXT = 'var(--text)', DIM = 'var(--dim)', FAINT = 'var(--faint)', GOLD = 'var(--gold)', BORDER = 'var(--border)';
  const [img, setImg] = useState(null);
  const [err, setErr] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const F = Math.min(340, (typeof window !== "undefined" ? window.innerWidth : 360) - 84);
  const ptrs = useRef(new Map());
  const gest = useRef(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => setImg(im);
    im.onerror = () => setErr(true);
    im.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const s0 = img ? F / Math.min(img.width, img.height) : 1; // масштаб «заповнити рамку»
  const sc = s0 * zoom;
  const dw = img ? img.width * sc : F, dh = img ? img.height * sc : F;
  const clamp = (o, z = zoom) => {
    if (!img) return o;
    const w = img.width * s0 * z, h = img.height * s0 * z;
    const mx = Math.max(0, (w - F) / 2), my = Math.max(0, (h - F) / 2);
    return { x: Math.min(mx, Math.max(-mx, o.x)), y: Math.min(my, Math.max(-my, o.y)) };
  };
  const setZ = (z) => { const nz = Math.min(4, Math.max(1, z)); setZoom(nz); setOff(o => clamp(o, nz)); };

  const onDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      gest.current = { type: "pinch", d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom };
    } else {
      gest.current = { type: "drag", x: e.clientX, y: e.clientY, o: off };
    }
  };
  const onMove = (e) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gest.current;
    if (!g) return;
    if (g.type === "pinch" && ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (g.d > 0) setZ(g.z * (d / g.d));
    } else if (g.type === "drag" && ptrs.current.size === 1) {
      setOff(clamp({ x: g.o.x + (e.clientX - g.x), y: g.o.y + (e.clientY - g.y) }));
    }
  };
  const onUp = (e) => {
    ptrs.current.delete(e.pointerId);
    gest.current = ptrs.current.size === 1
      ? { type: "drag", x: [...ptrs.current.values()][0].x, y: [...ptrs.current.values()][0].y, o: off }
      : null;
  };

  const save = () => {
    if (!img || saving) return;
    setSaving(true);
    const canvas = document.createElement("canvas");
    canvas.width = outSize; canvas.height = outSize;
    const left = F / 2 - dw / 2 + off.x, top = F / 2 - dh / 2 + off.y; // положення фото відносно рамки (px екрана)
    canvas.getContext("2d").drawImage(img, -left / sc, -top / sc, F / sc, F / sc, 0, 0, outSize, outSize);
    try { onDone(canvas.toDataURL("image/jpeg", 0.8)); } catch { setSaving(false); setErr(true); }
  };

  const circBtn = { width:48, height:48, borderRadius:14, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:24, fontWeight:800, color:TEXT, background:`linear-gradient(145deg,${SURF_HI},${SURFACE})`, display:"flex", alignItems:"center", justifyContent:"center", padding:0, flexShrink:0 };
  return createPortal(
    <div style={{ position:"fixed", inset:0, zIndex:9700, background:"rgba(0,0,0,0.88)", display:"flex", alignItems:"center", justifyContent:"center", padding:16, boxSizing:"border-box" }}>
      <div style={{ width:"100%", maxWidth:400, background:BG_DEEP, borderRadius:20, border:`1px solid ${BORDER}`, padding:"16px 16px 18px", boxSizing:"border-box", maxHeight:"96dvh", overflowY:"auto" }}>
        <div style={{ fontSize:16, fontWeight:800, color:TEXT, textAlign:"center", marginBottom:4 }}>{title}</div>
        <div style={{ fontSize:12.5, color:DIM, textAlign:"center", marginBottom:14, lineHeight:1.4 }}>Перетягніть фото і збільште двома пальцями — що в рамці, те й побачать інструктор і ви</div>
        {err ? (
          <div style={{ color:"#fca5a5", fontSize:13, textAlign:"center", padding:"30px 0" }}>Не вдалося відкрити фото. Спробуйте інший файл.</div>
        ) : (
          <div
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            onWheel={(e) => setZ(zoom * (e.deltaY < 0 ? 1.1 : 0.9))}
            style={{ width:F, height:F, margin:"0 auto 14px", position:"relative", overflow:"hidden", borderRadius: round ? "50%" : 16, background:"#000", touchAction:"none", cursor:"grab", border:`2px solid ${GOLD}`, boxSizing:"content-box", userSelect:"none" }}>
            {img && <img src={img.src} alt="" draggable={false} style={{ position:"absolute", left: F/2 - dw/2 + off.x, top: F/2 - dh/2 + off.y, width:dw, height:dh, maxWidth:"none", pointerEvents:"none", userSelect:"none" }}/>}
            {!img && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", color:FAINT, fontSize:13 }}>Завантаження…</div>}
          </div>
        )}
        {!err && (
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <button onClick={() => setZ(zoom - 0.25)} aria-label="Зменшити" style={circBtn}>−</button>
            <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZ(Number(e.target.value))} style={{ flex:1, height:32 }}/>
            <button onClick={() => setZ(zoom + 0.25)} aria-label="Збільшити" style={circBtn}>+</button>
          </div>
        )}
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onCancel} disabled={saving} style={{ flex:1, padding:"14px", borderRadius:14, border:`1px solid ${BORDER}`, background:"rgba(255,255,255,0.05)", color:TEXT, fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Скасувати</button>
          <button onClick={save} disabled={!img || saving || err} style={{ flex:2, padding:"14px", borderRadius:14, border:"none", background:GOLD, color:"#1a1a1a", fontSize:15, fontWeight:800, cursor:"pointer", fontFamily:"inherit", opacity:(!img||err)?0.5:1 }}>{saving ? "Зберігаю…" : "Зберегти"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
