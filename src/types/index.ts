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

// ✅ Datos del reloj + salud
export interface DatosSaludDiarios {
  fecha: string;
  pasos: number;
  caloriasQuemadas: number;
  horasSueno: number;
  pesoKg: number;
  masaMagraKg: number;
  frecuenciaCardiaca: number; // 💓 NUEVO
}

// ✅ Meta semanal inteligente
export type ObjetivoSemanal = 'bajar_peso' | 'mantener' | 'subir_peso' | 'ganar_musculo';

export interface MetaSemanal {
  semanaInicio: string; // fecha del lunes de esa semana
  objetivo: ObjetivoSemanal;
  caloriasObjetivo: number;
  proteinaObjetivo: number;
  recomendaciones: string[];
  pesoInicial: number;
}