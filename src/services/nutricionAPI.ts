const USDA_API_KEY = import.meta.env.VITE_USDA_API_KEY || '';
const BASE_URL = 'https://api.nal.usda.gov/fdc/v1';

console.log('🔑 Clave API:', USDA_API_KEY ? '✅ Configurada' : '⚠️ Falta clave API');

import type { Nutrientes } from '../types';

// IDs de nutrientes en la API USDA
const NUTRIENT_IDS: Record<number, keyof Nutrientes> = {
  1003: 'proteina',
  1004: 'grasas',
  1005: 'carbohidratos',
  1079: 'fibra',
  1008: 'calorias',
  1089: 'hierro',
  1087: 'calcio',
  1092: 'potasio',
  1090: 'magnesio',
  1162: 'vitaminaC',
  1104: 'vitaminaA',
};

export const desglosarAlimentos = (texto: string) => {
  const partes = texto.split(/\s+y\s+|,|\sy\s/i).map(p => p.trim()).filter(p => p.length > 0);
  const resultado: { texto: string; nombre: string; gramos: number }[] = [];

  for (const parte of partes) {
    const match = parte.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|gramos|gramo)\s+(.+)/i);
    if (match) {
      const gramos = parseFloat(match[1].replace(',', '.'));
      const nombre = match[3].trim();
      resultado.push({ texto: parte, nombre, gramos });
    } else {
      const gramosPorDefecto = 100;
      resultado.push({ texto: parte, nombre: parte.trim(), gramos: gramosPorDefecto });
    }
  }
  return resultado;
};

export const obtenerNutrientes = async (nombre: string, gramos: number): Promise<Nutrientes> => {
  const vacio: Nutrientes = {
    proteina: 0, grasas: 0, carbohidratos: 0, fibra: 0, calorias: 0,
    hierro: 0, calcio: 0, potasio: 0, magnesio: 0, vitaminaC: 0, vitaminaA: 0,
  };

  if (!USDA_API_KEY) {
    console.warn('⚠️ Falta clave API USDA en .env');
    return vacio;
  }

  try {
    const busqueda = nombre.trim();
    console.log(`🔍 Buscando: ${busqueda} (${gramos}g)`);

    const res = await fetch(
      `${BASE_URL}/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(busqueda)}&pageSize=5&dataType=Foundation,SR Legacy`
    );
    if (!res.ok) return vacio;
    const datos = await res.json();
    if (!datos.foods || datos.foods.length === 0) return vacio;

    const alimento = datos.foods[0];
    console.log(`🍖 Encontrado: ${alimento.description}`);

    const nutrientes: Nutrientes = { ...vacio };
    const porcion = alimento.servingSize || 100;

    if (alimento.foodNutrients) {
      for (const nut of alimento.foodNutrients) {
        const clave = NUTRIENT_IDS[nut.nutrientId];
        if (clave) {
          const valorPor100g = nut.value;
          nutrientes[clave] = Number(((valorPor100g * gramos) / porcion).toFixed(1));
        }
      }
    }
    console.log(`✅ ${nombre}: ${nutrientes.calorias} kcal, ${nutrientes.proteina}g proteína`);
    return nutrientes;

  } catch (err) {
    console.error('❌ Error API:', err);
    return vacio;
  }
};

export const sumarNutrientes = (lista: Nutrientes[]): Nutrientes => {
  const inicial: Nutrientes = {
    proteina: 0, grasas: 0, carbohidratos: 0, fibra: 0, calorias: 0,
    hierro: 0, calcio: 0, potasio: 0, magnesio: 0, vitaminaC: 0, vitaminaA: 0,
  };
  return lista.reduce((total, n) => ({
    proteina: total.proteina + n.proteina,
    grasas: total.grasas + n.grasas,
    carbohidratos: total.carbohidratos + n.carbohidratos,
    fibra: total.fibra + n.fibra,
    calorias: total.calorias + n.calorias,
    hierro: total.hierro + n.hierro,
    calcio: total.calcio + n.calcio,
    potasio: total.potasio + n.potasio,
    magnesio: total.magnesio + n.magnesio,
    vitaminaC: total.vitaminaC + n.vitaminaC,
    vitaminaA: total.vitaminaA + n.vitaminaA,
  }), inicial);
};

export const generarConsejos = (n: Nutrientes): string[] => {
  const consejos: string[] = [];
  if (n.proteina < 30) consejos.push('🥩 Proteína baja — intenta agregar pollo, huevo, pescado o legumbres');
  if (n.fibra < 15) consejos.push('🌾 Poca fibra — agrega verduras, frutas o cereales integrales');
  if (n.calorias < 1200) consejos.push('🔥 Calorías muy bajas — cuida no comer por debajo de tus necesidades');
  if (n.calorias > 2500) consejos.push('🔥 Calorías altas — vigila porciones y aumenta actividad física');
  if (n.grasas > 80) consejos.push('🥑 Grasas elevadas — elige grasas saludables y reduce frituras');
  if (n.carbohidratos < 100) consejos.push('🍞 Pocos carbohidratos — tu cuerpo necesita energía de calidad');
  if (consejos.length === 0) consejos.push('✅ ¡Excelente balance! Sigue así');
  return consejos;
};

// 🎯 Calcular metas COMPLETAS según objetivo
export const calcularMetasCompletas = (objetivo: ObjetivoSemanal, pesoKg: number) => {
  switch (objetivo) {
    case 'bajar_peso':
      return {
        caloriasObjetivo: 1800,
        proteinaObjetivo: Math.round(pesoKg * 1.6),
        grasasObjetivo: 60,
        carbohidratosObjetivo: 180,
        fibraObjetivo: 25,
        recomendaciones: [
          '🔥 Consume 300-500 calorías menos de las que quemas',
          '🥩 Proteína alta para conservar músculo',
          '🌾 Prefiere integrales, verduras y mucha fibra',
          '🏃 Al menos 30 min de actividad diaria',
          '💧 Reduce azúcares y mantén buena hidratación',
        ],
      };
    case 'mantener':
      return {
        caloriasObjetivo: 2000,
        proteinaObjetivo: Math.round(pesoKg * 1.2),
        grasasObjetivo: 70,
        carbohidratosObjetivo: 250,
        fibraObjetivo: 28,
        recomendaciones: [
          '⚖️ Calorías consumidas ≈ calorías quemadas',
          '🥗 Distribución equilibrada: 50% carbohidratos, 30% grasas, 20% proteína',
          '🍎 Come variado: frutas, verduras, cereales completos',
          '😴 Duerme bien y mantén actividad habitual',
        ],
      };
    case 'subir_peso':
      return {
        caloriasObjetivo: 2400,
        proteinaObjetivo: Math.round(pesoKg * 1.5),
        grasasObjetivo: 85,
        carbohidratosObjetivo: 300,
        fibraObjetivo: 30,
        recomendaciones: [
          '📈 +300-500 calorías diarias sobre tu gasto',
          '🥜 Agrega alimentos densos: nueces, aguacate, aceite de oliva',
          '🍞 Aumenta porciones gradualmente',
          '🏋️ Combina con ejercicio para ganar masa, no solo grasa',
        ],
      };
    case 'ganar_musculo':
      return {
        caloriasObjetivo: 2300,
        proteinaObjetivo: Math.round(pesoKg * 2.0),
        grasasObjetivo: 70,
        carbohidratosObjetivo: 280,
        fibraObjetivo: 28,
        recomendaciones: [
          '💪 Proteína: ~2g por kg de peso al día',
          '🍞 Carbohidratos antes y después de entrenar',
          '🏋️ Ejercicios de resistencia y pesas prioritarios',
          '😴 El músculo se forma al descansar — duerme 7-8h',
          '🥩 Distribuye proteína en todas las comidas',
        ],
      };
    default:
      return {
        caloriasObjetivo: 2000, proteinaObjetivo: 80, grasasObjetivo: 70,
        carbohidratosObjetivo: 250, fibraObjetivo: 28,
        recomendaciones: ['Mantén alimentación variada y equilibrada'],
      };
  }
};