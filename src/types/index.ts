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
  fecha: string; // ISO: YYYY-MM-DD
}

export interface DatosSaludDiarios {
  fecha: string;
  pasos: number;
  caloriasQuemadas: number;
  horasSueno: number;
  pesoKg: number;
  masaMagraKg: number;
  frecuenciaCardiaca: number;
}

export type ObjetivoSemanal = 'bajar_peso' | 'mantener' | 'subir_peso' | 'ganar_musculo';

export interface MetaSemanal {
  semanaInicio: string;
  objetivo: ObjetivoSemanal;
  caloriasObjetivo: number;
  proteinaObjetivo: number;
  grasasObjetivo: number;
  carbohidratosObjetivo: number;
  fibraObjetivo: number;
  recomendaciones: string[];
  pesoInicial: number;
}

export interface ResumenSemanal {
  semanaInicio: string;
  diasRegistrados: number;
  promedioCalorias: number;
  promedioProteina: number;
  promedioGrasas: number;
  promedioCarbohidratos: number;
  promedioFibra: number;
  promedioPasos: number;
  promedioSueno: number;
  promedioPeso: number;
  cumplimientoProteina: number; // porcentaje 0-100
  cumplimientoCalorias: number;
  recomendacionesFinales: string[];
}