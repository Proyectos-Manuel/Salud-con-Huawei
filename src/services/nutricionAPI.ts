import type { Nutrientes } from '../types';

const API_KEY = import.meta.env.VITE_USDA_API_KEY || '';

// Traducciones español → inglés
const traducciones: Record<string, string> = {
  huevo: 'egg', huevos: 'egg',
  pollo: 'chicken breast', pechuga: 'chicken breast',
  quinoa: 'quinoa', arroz: 'rice', frijol: 'beans', frijoles: 'beans',
  longaniza: 'sausage', chorizo: 'sausage', salchicha: 'sausage',
  pan: 'bread', leche: 'milk', queso: 'cheese',
  tortilla: 'corn tortilla', papa: 'potato',
  pescado: 'fish', atun: 'tuna', carne: 'beef',
  tomate: 'tomato', cebolla: 'onion', ajo: 'garlic',
  zanahoria: 'carrot', espinaca: 'spinach', lechuga: 'lettuce',
  platano: 'banana', manzana: 'apple', naranja: 'orange',
  aceite: 'olive oil', azucar: 'sugar',
  aguacate: 'avocado', limon: 'lemon',
  avena: 'oats', yogurt: 'yogurt', pasta: 'pasta',
};

const traducir = (nombre: string): string => {
  const limpio = nombre.toLowerCase().trim();
  for (const [es, en] of Object.entries(traducciones)) {
    if (limpio.includes(es)) return en;
  }
  return limpio;
};

// Valor cero cuando no se encuentra el alimento
export const nutrientesCero = (): Nutrientes => ({
  proteina: 0, grasas: 0, carbohidratos: 0, fibra: 0, calorias: 0,
  hierro: 0, calcio: 0, potasio: 0, magnesio: 0, vitaminaC: 0, vitaminaA: 0,
});

// 🔍 Desglosa el texto en alimentos por separado
export const desglosarAlimentos = (textoCompleto: string) => {
  const partes = textoCompleto.split(/\s+(y|con|,|y con|mas|\+)\s+/i);
  const resultados: { texto: string; nombre: string; gramos: number }[] = [];

  for (const parte of partes) {
    if (!parte || /^(y|con|,|mas|\+)$/i.test(parte.trim())) continue;

    const coincidencia = parte.match(/(\d+)\s*(g|gr|gramos|gms|gramo)\s+(.+)/i);
    if (coincidencia) {
      resultados.push({
        gramos: parseInt(coincidencia[1]),
        nombre: coincidencia[3].trim(),
        texto: parte.trim(),
      });
    } else {
      // Si no dice cantidad → asumimos 100g
      resultados.push({
        gramos: 100,
        nombre: parte.trim(),
        texto: parte.trim(),
      });
    }
  }
  return resultados;
};

// Busca un nutriente por su ID en la lista de la API
const buscarNutriente = (lista: any[], id: number): number => {
  if (!lista) return 0;
  const encontrado = lista.find(n => n.nutrientId === id);
  return encontrado?.value || 0;
};

// 📊 Obtiene nutrientes de un alimento
export const obtenerNutrientes = async (
  nombreAlimento: string,
  gramos: number = 100
): Promise<Nutrientes> => {
  if (!API_KEY) {
    console.log('⚠️ Falta clave API de USDA');
    return nutrientesCero();
  }

  const nombreEn = traducir(nombreAlimento);
  console.log(`🔍 Buscando: ${nombreEn} (${gramos}g)`);

  try {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${API_KEY}&query=${encodeURIComponent(nombreEn)}&pageSize=3`;
    const res = await fetch(url);
    const datos = await res.json();

    if (!datos.foods || !datos.foods[0]) {
      console.log(`❌ No encontrado: ${nombreEn}`);
      return nutrientesCero();
    }

    const alimento = datos.foods[0];
    const nutrientes = alimento.foodNutrients || [];
    const porcion = alimento.servingSize || 100;
    const factor = gramos / porcion;

    const calorias = buscarNutriente(nutrientes, 1008);
    const proteina = buscarNutriente(nutrientes, 1003);
    const grasas = buscarNutriente(nutrientes, 1004);
    const carbohidratos = buscarNutriente(nutrientes, 1005);
    const fibra = buscarNutriente(nutrientes, 1079);
    const calcio = buscarNutriente(nutrientes, 1087);
    const hierro = buscarNutriente(nutrientes, 1089);
    const vitaminaC = buscarNutriente(nutrientes, 1162);
    const vitaminaA = buscarNutriente(nutrientes, 1104);
    const potasio = buscarNutriente(nutrientes, 1092);
    const magnesio = buscarNutriente(nutrientes, 1090);

    const resultado = {
      calorias: calorias * factor,
      proteina: proteina * factor,
      grasas: grasas * factor,
      carbohidratos: carbohidratos * factor,
      fibra: fibra * factor,
      calcio: calcio * factor,
      hierro: hierro * factor,
      vitaminaC: vitaminaC * factor,
      vitaminaA: vitaminaA * factor,
      potasio: potasio * factor,
      magnesio: magnesio * factor,
    };

    console.log(`✅ ${nombreAlimento}: ${Math.round(resultado.calorias)} kcal, ${Math.round(resultado.proteina)}g proteína`);
    return resultado;
  } catch (err) {
    console.error(`❌ Error buscando ${nombreAlimento}:`, err);
    return nutrientesCero();
  }
};

// ➕ Suma todos los nutrientes de una lista
export const sumarNutrientes = (lista: Nutrientes[]): Nutrientes => {
  return lista.reduce(
    (total, n) => ({
      calorias: total.calorias + n.calorias,
      proteina: total.proteina + n.proteina,
      grasas: total.grasas + n.grasas,
      carbohidratos: total.carbohidratos + n.carbohidratos,
      fibra: total.fibra + n.fibra,
      calcio: total.calcio + n.calcio,
      hierro: total.hierro + n.hierro,
      vitaminaC: total.vitaminaC + n.vitaminaC,
      vitaminaA: total.vitaminaA + n.vitaminaA,
      potasio: total.potasio + n.potasio,
      magnesio: total.magnesio + n.magnesio,
    }),
    nutrientesCero()
  );
};

// 💡 Genera recomendaciones basadas en el total
export const generarConsejos = (total: Nutrientes): string[] => {
  const consejos: string[] = [];

  if (total.proteina >= 25) consejos.push('✅ Excelente aporte de proteínas. ¡Muy bien!');
  else if (total.proteina >= 15) consejos.push('🥩 Buen aporte de proteínas.');
  else if (total.proteina > 0) consejos.push('⚠️ Aporte bajo de proteínas. Intenta agregar más.');

  if (total.carbohidratos > 80) consejos.push('🍞 Carbohidratos altos. Cuida las porciones.');
  if (total.fibra >= 6) consejos.push('🌾 Excelente cantidad de fibra.');
  else if (total.fibra > 0) consejos.push('🌾 Poca fibra. Agrega verduras o frutas.');

  if (total.calorias < 200 && total.calorias > 0) consejos.push('⚠️ Pocas calorías. ¿Es una comida completa?');
  else if (total.calorias > 700) consejos.push('🔥 Comida abundante. Cuida las porciones.');

  if (consejos.length === 0) consejos.push('✅ Alimento registrado correctamente.');
  return consejos;
};