export interface Nutrientes {
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

export interface AlimentoDesglosado {
  id: string;
  textoOriginal: string;
  nombre: string;
  gramos: number;
  nutrientes: Nutrientes;
  confirmado: boolean;
}

export interface Comida {
  id: string;
  tipo: 'desayuno' | 'comida' | 'cena' | 'merienda';
  alimentos: AlimentoDesglosado[];
  total: Nutrientes;
  fecha: Date;
}

// ✅ Datos del reloj + peso
export interface DatosSaludDiarios {
  fecha: string; // formato "YYYY-MM-DD"
  pasos: number;
  caloriasQuemadas: number;
  horasSueno: number;
  pesoKg: number;
  masaMagraKg: number;
}

// ✅ Metas del usuario
export interface MetasUsuario {
  caloriasDiarias: number;
  proteinaGramos: number;
  caloriasQuemadas: number;
  pasos: number;
}