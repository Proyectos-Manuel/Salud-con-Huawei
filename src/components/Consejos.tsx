import React from 'react';
// Si la línea es así: import type { ... } ...
// Déjala igual, no tiene tipos que importar
interface ConsejosProps {
  lista: string[];
}

const Consejos: React.FC<ConsejosProps> = ({ lista }) => {
  return (
    <div style={{ background: '#fff3e0', padding: '20px', borderRadius: '12px' }}>
      <h2>💡 Recomendaciones</h2>
      <ul style={{ fontSize: '16px', lineHeight: '1.8' }}>
        {lista.map((consejo, i) => (
          <li key={i}>{consejo}</li>
        ))}
      </ul>
    </div>
  );
};

export default Consejos;
