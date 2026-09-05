import React, { useState, useRef } from 'react';

interface Props {
  alRecibirTexto: (texto: string) => void;
}

const EntradaVoz: React.FC<Props> = ({ alRecibirTexto }) => {
  const [escuchando, setEscuchando] = useState(false);
  const [texto, setTexto] = useState('');
  const reconocimientoRef = useRef<any>(null);

  const iniciar = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Usa Chrome o Edge para el micrófono');
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = 'es-MX';
    rec.interimResults = true;
    rec.continuous = true;

    rec.onstart = () => {
      setEscuchando(true);
      console.log('🎤 Escuchando...');
    };

    rec.onresult = (e: any) => {
      let t = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        t += e.results[i][0].transcript;
      }
      setTexto(t); // ✅ Se ve en pantalla mientras hablas
    };

    rec.onerror = (err: any) => {
      console.error('❌ Voz:', err);
      setEscuchando(false);
    };

    rec.onend = () => {
      setEscuchando(false);
    };

    reconocimientoRef.current = rec;
    rec.start();
  };

  const detener = () => {
    if (reconocimientoRef.current) reconocimientoRef.current.stop();
  };

  // ✅ Envía manualmente cuando des clic
  const enviarTexto = () => {
    if (texto.trim()) {
      console.log('📤 Enviando:', texto.trim());
      alRecibirTexto(texto.trim());
    }
  };

  return (
    <div style={{ textAlign: 'center', margin: '25px 0' }}>
      {/* Botón micrófono */}
      <button
        onMouseDown={iniciar}
        onMouseUp={detener}
        onMouseLeave={() => escuchando && detener()}
        onTouchStart={(e) => { e.preventDefault(); iniciar(); }}
        onTouchEnd={(e) => { e.preventDefault(); detener(); }}
        style={{
          width: '120px', height: '120px', borderRadius: '50%', border: 'none', fontSize: '45px',
          cursor: 'pointer', transition: 'all 0.2s',
          background: escuchando ? '#ef4444' : '#10b981', color: 'white',
        }}
      >
        🎤
      </button>

      <p style={{ margin: '10px 0', fontSize: '15px' }}>
        {escuchando ? '🔴 Escuchando...' : 'Mantén presionado y habla'}
      </p>

      {/* ✅ Aquí se ve lo que dices */}
      {texto && (
        <div style={{
          margin: '15px auto', padding: '12px', maxWidth: '500px',
          background: '#f0fdf4', borderRadius: '8px', fontSize: '16px',
        }}>
          🗣️ Dijiste: <strong>{texto}</strong>
          
          {/* ✅ BOTÓN PARA ENVIAR MANUALMENTE */}
          <button
            onClick={enviarTexto}
            style={{
              marginLeft: '10px', padding: '6px 15px', fontSize: '15px',
              background: '#10b981', color: 'white', border: 'none',
              borderRadius: '6px', cursor: 'pointer',
            }}
          >
            ✅ Usar este texto
          </button>
        </div>
      )}
    </div>
  );
};

export default EntradaVoz;