import React from 'react';
import { Trash2 } from 'lucide-react';

interface Props {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmDialog({ name, onConfirm, onCancel }: Props) {
  return (
    <>
      <div
        onClick={onCancel}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 2000 }}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 2001, width: 300,
        background: '#fff', borderRadius: 14,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        padding: '20px 22px',
        fontFamily: 'Outfit, sans-serif',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Trash2 size={17} color="#DC2626" />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111827' }}>Apagar agendamento</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{name}</p>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
          Esta ação remove o agendamento permanentemente e não pode ser desfeita.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: '9px', background: '#F1F5F9', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#374151', cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            style={{ flex: 1, padding: '9px', background: '#DC2626', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
            Apagar
          </button>
        </div>
      </div>
    </>
  );
}
