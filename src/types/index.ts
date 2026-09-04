// Estructura de nutrientes que recibiremos
export interface Nutrientes {
  proteina: number;
  grasas: number;
  carbohidratos: number;
  fibra: number;
  calorias: number;
  // Vitaminas y minerales
  hierro: number;
  calcio: number;
  potasio: number;
  magnesio: number;
  vitaminaC: number;
  vitaminaA: number;
}

export interface Alimento {
  nombre: string;
  cantidad: string;
  nutrientes: Nutrientes;
}

export interface Comida {
  textoCompleto: string;
  alimentos: Alimento[];
  fecha: Date;
}
