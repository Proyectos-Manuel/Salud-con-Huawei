import React, { useState } from 'react';

interface EntradaVozProps {
  onTextoObtenido: (texto: string) => void;
}

const EntradaVoz: React.FC<EntradaVozProps> = ({ onTextoObtenido }) => {
  const [escuchando, setEscuchando] = useState(false);
  const [texto, setTexto] = useState('');

  const iniciarReconocimiento = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.");
      return;
    }

    const reconocimiento = new SpeechRecognition();
    reconocimiento.lang = 'es-MX'; // Español de México 🇲🇽
    reconocimiento.continuous = false;
    reconocimiento.interimResults = true;

    reconocimiento.onstart = () => setEscuchando(true);
    reconocimiento.onend = () => setEscuchando(false);

    reconocimiento.onresult = (event: any) => {
      const resultado = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join('');
      setTexto(resultado);
    };

    reconocimiento.start();
  };

  const enviarTexto = () => {
    if (texto.trim()) {
      onTextoObtenido(texto);
    }
  };

  return (
    <div style={{ textAlign: 'center', padding: '20px', background: '#f0f4ff', borderRadius: '12px', marginBottom: '20px' }}>
      <h2>🍽️ ¿Qué comiste hoy?</h2>
      
      <button
        onClick={iniciarReconocimiento}
        style={{
          padding: '15px 30px',
          fontSize: '18px',
          borderRadius: '50px',
          border: 'none',
          background: escuchando ? '#ff4d4d' : '#2d7dff',
          color: 'white',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          animation: escuchando ? 'pulse 1s infinite' : 'none',
        }}
      >
        {escuchando ? '🔴 Escuchando... ¡Habla!' : '🎤 Presiona y habla'}
      </button>

      {texto && (
        <div style={{ marginTop: '20px' }}>
          <p style={{ fontSize: '16px', fontStyle: 'italic' }}>"{texto}"</p>
          <button
            onClick={enviarTexto}
            style={{ padding: '10px 25px', fontSize: '16px', borderRadius: '8px', border: 'none', background: '#28a745', color: 'white', cursor: 'pointer', marginTop: '10px' }}
          >
            ✅ Analizar esta comida
          </button>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default EntradaVoz;
