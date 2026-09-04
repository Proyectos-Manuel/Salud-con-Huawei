// 📋 Definimos los tipos aquí mismo
interface Nutrientes {
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
}

interface Alimento {
  nombre: string;
  cantidad: string;
  nutrientes: Nutrientes;
}

// 🔑 Tu clave de USDA — ponla aquí
const USDA_API_KEY = 'vrW4XieDUbZa5I8UGn0Yvi9hvWARhDx4BrZX4bAx';
const BASE_URL = 'https://api.nal.usda.gov/fdc/v1';

// 📋 IDs oficiales de nutrientes en USDA
//const NUTRIENT_IDS = {
//  ENERGIA: 1008,
//  PROTEINA: 1003,
//  GRASAS: 1004,
//  CARBOHIDRATOS: 1005,
//  FIBRA: 1079,
//  HIERRO: 1089,
//  CALCIO: 1087,
//  POTASIO: 1092,
//  MAGNESIO: 1090,
//  VITAMINA_C: 1162,
//  VITAMINA_A: 1104,
//};

// Función principal
export async function analizarComida(texto: string): Promise<{
  total: Nutrientes;
  alimentos: Alimento[];
}> {
  console.log('🔍 Buscando:', texto);

  try {
    const alimentosLista = texto
      .split(/[,;]/)
      .map(s => s.trim())
      .filter(s => s.length > 1);

    const alimentos: Alimento[] = [];
    const total: Nutrientes = {
      proteina: 0, grasas: 0, carbohidratos: 0, fibra: 0, calorias: 0,
      hierro: 0, calcio: 0, potasio: 0, magnesio: 0, vitaminaC: 0, vitaminaA: 0,
    };

    for (const nombre of alimentosLista) {
      const resultado = await buscarAlimento(nombre);
      if (resultado) {
        alimentos.push(resultado);
        total.proteina += resultado.nutrientes.proteina;
        total.grasas += resultado.nutrientes.grasas;
        total.carbohidratos += resultado.nutrientes.carbohidratos;
        total.fibra += resultado.nutrientes.fibra;
        total.calorias += resultado.nutrientes.calorias;
        total.hierro += resultado.nutrientes.hierro;
        total.calcio += resultado.nutrientes.calcio;
        total.potasio += resultado.nutrientes.potasio;
        total.magnesio += resultado.nutrientes.magnesio;
        total.vitaminaC += resultado.nutrientes.vitaminaC;
        total.vitaminaA += resultado.nutrientes.vitaminaA;
      }
    }

    console.log('✅ Total calculado:', total);
    return { total, alimentos };
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Buscar alimento en USDA
async function buscarAlimento(nombre: string): Promise<Alimento | null> {
  // Extraer cantidad si dice "2 chicken"
  const match = nombre.match(/^(\d*[.,]?\d*)\s*(.+)$/);
  const porcion = match && match[1] ? parseFloat(match[1].replace(',', '.')) : 1;
  const nombreLimpio = match ? match[2].trim() : nombre;

  console.log('🔍 Buscando alimento:', nombreLimpio);

  const url = `${BASE_URL}/foods/search?api_key=${USDA_API_KEY}`;
  const respuesta = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: nombreLimpio,
      pageSize: 3,
      dataType: ['Foundation', 'SR Legacy'],
    }),
  });

  const datos = await respuesta.json();
  console.log('📦 Respuesta API:', datos);

  if (!datos.foods || datos.foods.length === 0) {
    console.log('⚠️ No se encontró:', nombreLimpio);
    return null;
  }

  const alimento = datos.foods[0];
  console.log('🍖 Alimento encontrado:', alimento.description);
  console.log('📋 Nutrientes crudos:', alimento.foodNutrients);
  
  const nutrientes100g = extraerPorIds(alimento.foodNutrients || []);
  const nutrientesAjustados = ajustarPorCantidad(nutrientes100g, porcion);

  return {
    nombre: alimento.description,
    cantidad: `~${porcion * 100}g`,
    nutrientes: nutrientesAjustados,
  };
}

// 🔑 LEER NUTRIENTES — CORREGIDO: ahora lee "amount" en lugar de "value"
function extraerPorIds(lista: any[]): Nutrientes {
  const nutrientes: Partial<Nutrientes> = {};
  
  lista.forEach(item => {
    // 🔍 La estructura REAL es: item.nutrientName, item.nutrientId, item.value
    // NO hay objeto "nutrient" anidado
    const nombre = item.nutrientName;
    const valor = item.value || 0;
    
    //console.log(nombre, '=', valor); // Descomenta para ver todos los nombres

    switch (nombre) {
      case 'Protein': nutrientes.proteina = valor; break;
      case 'Total lipid (fat)': nutrientes.grasas = valor; break;
      case 'Carbohydrate, by difference': nutrientes.carbohidratos = valor; break;
      case 'Fiber, total dietary': nutrientes.fibra = valor; break;
      case 'Energy':
      case 'Energy (kcal)':
      case 'Energy (Atwater General Factors)':
        nutrientes.calorias = valor; break;
      case 'Iron, Fe': nutrientes.hierro = valor; break;
      case 'Calcium, Ca': nutrientes.calcio = valor; break;
      case 'Potassium, K': nutrientes.potasio = valor; break;
      case 'Magnesium, Mg': nutrientes.magnesio = valor; break;
      case 'Vitamin C, total ascorbic acid': nutrientes.vitaminaC = valor; break;
      case 'Vitamin A, RAE': nutrientes.vitaminaA = valor; break;
    }
  });

  return {
    proteina: 0, grasas: 0, carbohidratos: 0, fibra: 0, calorias: 0,
    hierro: 0, calcio: 0, potasio: 0, magnesio: 0, vitaminaC: 0, vitaminaA: 0,
    ...nutrientes,
  };
}

// Ajustar por cantidad (USDA da valores por cada 100g)
function ajustarPorCantidad(nutrientes: Nutrientes, factor: number): Nutrientes {
  const porc = factor / 100;
  return {
    proteina: nutrientes.proteina * porc,
    grasas: nutrientes.grasas * porc,
    carbohidratos: nutrientes.carbohidratos * porc,
    fibra: nutrientes.fibra * porc,
    calorias: nutrientes.calorias * porc,
    hierro: nutrientes.hierro * porc,
    calcio: nutrientes.calcio * porc,
    potasio: nutrientes.potasio * porc,
    magnesio: nutrientes.magnesio * porc,
    vitaminaC: nutrientes.vitaminaC * porc,
    vitaminaA: nutrientes.vitaminaA * porc,
  };
}

// Consejos de salud
export function generarConsejos(nutrientes: Nutrientes): string[] {
  const consejos: string[] = [];

  if (nutrientes.proteina < 8) consejos.push("🥩 Proteína baja. Agrega pollo, huevo, frijoles o pescado.");
  else consejos.push("✅ Buen aporte de proteínas. ¡Bien!");

  if (nutrientes.fibra < 3) consejos.push("🌾 Poca fibra. Agrega verduras, frutas o cereales integrales.");
  else consejos.push("✅ Buena cantidad de fibra.");

  if (nutrientes.hierro < 1) consejos.push("🥬 Hierro bajo. Espinaca, lentejas o carnes ayudarán.");
  if (nutrientes.vitaminaC < 5) consejos.push("🍊 Vitamina C baja. Una naranja ayuda a absorber el hierro.");
  if (nutrientes.calcio < 50) consejos.push("🥛 Calcio bajo. Considera leche, queso o almendras.");

  if (consejos.length === 0) consejos.push("🎉 ¡Excelente balance nutricional! Sigue así.");
  return consejos;
}