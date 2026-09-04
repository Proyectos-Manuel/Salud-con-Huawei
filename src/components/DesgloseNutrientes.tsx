import React from 'react';

interface DesgloseProps {
  nutrientes: Nutrientes;
}
type Nutrientes = {
  proteina: number;
  grasas: number;
  carbohidratos: number;
  fibra: number;
  calorias: number;
  hierro: number;
  calcio: number;
  potasio: number;
  magnesio: number;
  vitaminaC: number;
  vitaminaA: number;
};
const DesgloseNutrientes: React.FC<DesgloseProps> = ({ nutrientes }) => {
  return (
    <div style={{ background: '#f8fff8', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
      <h2>📊 Aporte Nutricional</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <div style={{ padding: '10px', background: '#e6ffcc', borderRadius: '8px' }}>
          <strong>🥩 Proteínas</strong>
          <p style={{ fontSize: '18px', margin: '5px 0' }}>{nutrientes.proteina.toFixed(1)} g</p>
        </div>
        <div style={{ padding: '10px', background: '#fff3cd', borderRadius: '8px' }}>
          <strong>🍞 Carbohidratos</strong>
          <p style={{ fontSize: '18px', margin: '5px 0' }}>{nutrientes.carbohidratos.toFixed(1)} g</p>
        </div>
        <div style={{ padding: '10px', background: '#cce5ff', borderRadius: '8px' }}>
          <strong>🥑 Grasas</strong>
          <p style={{ fontSize: '18px', margin: '5px 0' }}>{nutrientes.grasas.toFixed(1)} g</p>
        </div>
        <div style={{ padding: '10px', background: '#e2e3ff', borderRadius: '8px' }}>
          <strong>🌾 Fibra</strong>
          <p style={{ fontSize: '18px', margin: '5px 0' }}>{nutrientes.fibra.toFixed(1)} g</p>
        </div>
      </div>

      <h3 style={{ marginTop: '20px', color: '#444' }}>Vitaminas y Minerales</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', fontSize: '14px' }}>
        <span>🩸 Hierro: <strong>{nutrientes.hierro.toFixed(2)} mg</strong></span>
        <span>🦴 Calcio: <strong>{nutrientes.calcio.toFixed(0)} mg</strong></span>
        <span>⚡ Potasio: <strong>{nutrientes.potasio.toFixed(0)} mg</strong></span>
        <span>💪 Magnesio: <strong>{nutrientes.magnesio.toFixed(1)} mg</strong></span>
        <span>🍊 Vitamina C: <strong>{nutrientes.vitaminaC.toFixed(1)} mg</strong></span>
        <span>👁️ Vitamina A: <strong>{nutrientes.vitaminaA.toFixed(1)} µg</strong></span>
      </div>

      <p style={{ marginTop: '15px', fontSize: '13px', color: '#888' }}>
        Calorías totales: {nutrientes.calorias.toFixed(0)} kcal
      </p>
    </div>
  );
};

export default DesgloseNutrientes;
