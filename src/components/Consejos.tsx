import React from 'react';

interface Props {
  consejos: string[] | undefined | null;
}

const Consejos: React.FC<Props> = ({ consejos }) => {
  // ✅ Si no hay consejos o está vacío → no muestra nada
  if (!consejos || !Array.isArray(consejos) || consejos.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: '15px' }}>
      <h4>💡 Recomendaciones:</h4>
      <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
        {consejos.map((consejo, idx) => (
          <li key={idx} style={{ margin: '4px 0' }}>
            {consejo}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Consejos;