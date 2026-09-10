import React from 'react';
import type { Nutrientes, MetaSemanal } from '../types';
import { generarConsejos } from '../services/nutricionAPI';

interface Props {
  nutrientes?: Nutrientes;
  meta?: MetaSemanal | null;
  consejos?: string[] | undefined | null;
}

const Consejos: React.FC<Props> = ({ nutrientes, meta, consejos }) => {
  let lista: string[] = [];

  if (consejos && Array.isArray(consejos) && consejos.length > 0) {
    lista = consejos;
  } else if (nutrientes) {
    lista = generarConsejos(nutrientes);
  }

  if (meta) {
    if (meta.objetivo === 'bajar_peso' && nutrientes && nutrientes.calorias > meta.caloriasObjetivo) {
      lista = [...lista, '⚠️ Consumiste más calorías que tu meta — reduce porciones mañana'];
    }
    if (meta.objetivo === 'ganar_musculo' && nutrientes && nutrientes.proteina < meta.proteinaObjetivo * 0.8) {
      lista = [...lista, '🥩 Te faltó proteína hoy para ganar músculo'];
    }
  }

  if (lista.length === 0) return null;

  return (
    <div style={{ marginTop: '15px' }}>
      <h4>💡 Recomendaciones:</h4>
      <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
        {lista.map((consejo, idx) => (
          <li key={idx} style={{ margin: '4px 0' }}>
            {consejo}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Consejos;
