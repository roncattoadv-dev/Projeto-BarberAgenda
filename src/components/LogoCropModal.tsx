import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';

interface Props {
  imageSrc: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

async function cropToBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload  = () => res(i);
    i.onerror = rej;
    i.src = imageSrc;
  });
  const canvas = document.createElement('canvas');
  const SIZE = 400;
  canvas.width  = SIZE;
  canvas.height = SIZE;
  // Square crop — o círculo é feito via CSS (overflow:hidden + border-radius)
  canvas.getContext('2d')!.drawImage(
    img,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, SIZE, SIZE,
  );
  return new Promise((res, rej) =>
    canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/jpeg', 0.92)
  );
}

export default function LogoCropModal({ imageSrc, onConfirm, onCancel }: Props) {
  const [crop, setCrop]       = useState({ x: 0, y: 0 });
  const [zoom, setZoom]       = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [loading, setLoading] = useState(false);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedArea) return;
    setLoading(true);
    try {
      const blob = await cropToBlob(imageSrc, croppedArea);
      onConfirm(blob);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20, width: '100%', maxWidth: 420,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <p style={{ fontWeight: 700, fontSize: 14, color: 'rgba(255,255,255,0.88)', margin: 0 }}>Enquadrar logo</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>Arraste e use o zoom para centralizar</p>
        </div>

        {/* Cropper área */}
        <div style={{ position: 'relative', height: 320, background: '#010d24' }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{
              containerStyle: { borderRadius: 0 },
              cropAreaStyle: { border: '2px solid rgba(255,255,255,0.6)', boxShadow: '0 0 0 9999px rgba(1,13,36,0.75)' },
            }}
          />
        </div>

        {/* Zoom slider */}
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', flexShrink: 0 }}>Zoom</span>
          <input
            type="range" min={1} max={3} step={0.05} value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#ffffff' }}
          />
        </div>

        {/* Buttons */}
        <div style={{ padding: '14px 20px', display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: '11px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, color: 'rgba(255,255,255,0.65)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            style={{ flex: 2, padding: '11px', background: '#ffffff', border: 'none', borderRadius: 10, color: '#0F172A', fontWeight: 700, fontSize: 13, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: 'Outfit, sans-serif' }}
          >
            {loading ? 'Processando…' : 'Usar este enquadramento'}
          </button>
        </div>
      </div>
    </div>
  );
}
