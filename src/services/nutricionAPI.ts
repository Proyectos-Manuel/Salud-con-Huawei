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

const extraer = (texto: string) => {
  const coincidencia = texto.match(/(\d+)\s*(g|gr|gramos)\s+(.+)/i);
  if (coincidencia) {
    return [{ nombre: coincidencia[3].trim(), gramos: parseInt(coincidencia[1]) }];
  }
  return [{ nombre: texto, gramos: 100 }];
};

const traducir = (nombre: string): string => {
  const limpio = nombre.toLowerCase().trim();
  for (const [es, en] of Object.entries(traducciones)) {
    if (limpio.includes(es)) return en;
  }
  return limpio;
};

const API_KEY = import.meta.env.VITE_USDA_API_KEY || '';

// ✅ CORREGIDO: la API usa .value NO .amount
const buscarNutriente = (lista: any[], id: number): number => {
  if (!lista) return 0;
  const encontrado = lista.find(n => n.nutrientId === id);
  return encontrado?.value || 0; // 👈 ¡AQUÍ ESTABA EL ERROR!
};

export const obtenerNutrientes = async (textoCompleto: string): Promise<Nutrientes | null> => {
  if (!API_KEY) {
    console.log('⚠️ Falta clave API');
    return null;
  }

  const items = extraer(textoCompleto);
  let total: Nutrientes = {
    proteina: 0, grasas: 0, carbohidratos: 0, fibra: 0, calorias: 0,
    hierro: 0, calcio: 0, potasio: 0, magnesio: 0, vitaminaC: 0, vitaminaA: 0,
  };

  for (const item of items) {
    const nombreEn = traducir(item.nombre);
    console.log(`🔍 Buscando: ${nombreEn} (${item.gramos}g)`);

    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${API_KEY}&query=${encodeURIComponent(nombreEn)}&pageSize=3`;
    const res = await fetch(url);
    const datos = await res.json();

    if (!datos.foods || !datos.foods[0]) {
      console.log('❌ No encontrado:', nombreEn);
      continue;
    }

    const alimento = datos.foods[0];
    const nutrientes = alimento.foodNutrients || [];
    const porcion = alimento.servingSize || 100;
    const factor = item.gramos / porcion;

    // ✅ IDs correctos y leyendo de .value
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

    console.log(`📊 Brutos: Cal=${calorias}, Prot=${proteina}, Gras=${grasas}, Carb=${carbohidratos}`);
    console.log(`📊 Porción: ${porcion}g → Factor: x${factor.toFixed(2)}`);

    total.calorias += calorias * factor;
    total.proteina += proteina * factor;
    total.grasas += grasas * factor;
    total.carbohidratos += carbohidratos * factor;
    total.fibra += fibra * factor;
    total.calcio += calcio * factor;
    total.hierro += hierro * factor;
    total.vitaminaC += vitaminaC * factor;
    total.vitaminaA += vitaminaA * factor;
    total.potasio += potasio * factor;
    total.magnesio += magnesio * factor;
  }

  console.log('✅ ✅ TOTAL FINAL:', total);
  return total;
};

export const analizarComida = async (texto: string) => {
  const total = await obtenerNutrientes(texto);
  return { total: total, alimentos: [] };
};

export const generarConsejos = (nutri: Nutrientes | null) => {
  if (!nutri) return ["⚠️ No se pudieron calcular los nutrientes."];
  
  const consejos: string[] = [];
  if (nutri.proteina >= 20) consejos.push("✅ Excelente aporte de proteínas.");
  else if (nutri.proteina >= 10) consejos.push("🥩 Buen aporte de proteínas.");
  else if (nutri.proteina > 0) consejos.push("🥩 Aporte moderado de proteínas.");
  
  if (nutri.carbohidratos > 100) consejos.push("🍞 Carbohidratos altos. Buena energía si te mueves mucho.");
  if (nutri.fibra >= 6) consejos.push("🌾 Excelente cantidad de fibra.");
  if (nutri.calorias < 200 && nutri.calorias > 0) consejos.push("⚠️ Pocas calorías. ¿Es una comida completa?");
  if (nutri.calorias > 600) consejos.push("🔥 Comida abundante. Cuida las porciones.");
  
  if (consejos.length === 0) consejos.push("✅ Alimento registrado correctamente.");
  return consejos;
};