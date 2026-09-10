import React, { useState, useEffect, useMemo, useRef } from 'react';
import EntradaVoz from './components/EntradaVoz';
import DesgloseNutrientes from './components/DesgloseNutrientes';
import Consejos from './components/Consejos';
import { desglosarAlimentos, obtenerNutrientes, sumarNutrientes, calcularMetasCompletas } from './services/nutricionAPI';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement, Filler } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import type { AlimentoDesglosado, Comida, DatosSaludDiarios, MetaSemanal, Nutrientes, ObjetivoSemanal, ResumenSemanal } from './types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement, Filler);

type TipoComida = 'desayuno' | 'comida' | 'cena' | 'merienda';
type TipoGrafica = 'semanal' | 'mensual' | 'anual';

// ✅ Días en orden correcto: Lunes primero
const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// ✅ Obtener lunes de cualquier fecha dada
const obtenerLunes = (fecha: Date = new Date()): string => {
  const d = new Date(fecha);
  const dia = d.getDay();
  const diff = d.getDate() - dia + (dia === 0 ? -6 : 1);
  const lunes = new Date(d.getFullYear(), d.getMonth(), diff);
  return lunes.toISOString().split('T')[0];
};

const porcentaje = (valor: number, meta: number): number => {
  if (!meta || meta <= 0) return 0;
  return Math.min(Math.round((valor / meta) * 100), 150);
};

const App: React.FC = () => {
  const hoy = new Date().toISOString().split('T')[0];
  const lunesSemanaActual = obtenerLunes();
  const inputImportar = useRef<HTMLInputElement>(null);

  const [textoDictado, setTextoDictado] = useState('');
  const [cargando, setCargando] = useState(false);
  const [listaAlimentos, setListaAlimentos] = useState<AlimentoDesglosado[]>([]);
  const [tipoComida, setTipoComida] = useState<TipoComida>('comida');
  const [historial, setHistorial] = useState<Comida[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [fechaSeleccionada, setFechaSeleccionada] = useState(hoy);
  const [mesCalendario, setMesCalendario] = useState(new Date());
  const [pestana, setPestana] = useState<'comidas' | 'salud' | 'calendario' | 'metas' | 'resumen' | 'historial'>('comidas');
  const [tipoGrafica, setTipoGrafica] = useState<TipoGrafica>('semanal');
  const [comidaEnEdicion, setComidaEnEdicion] = useState<Comida | null>(null);
  const [semanaResumen, setSemanaResumen] = useState(lunesSemanaActual); // ✅ Semana seleccionada

  const [datosSalud, setDatosSalud] = useState<DatosSaludDiarios>({
    fecha: hoy, pasos: 0, caloriasQuemadas: 0, horasSueno: 0,
    pesoKg: 0, masaMagraKg: 0, frecuenciaCardiaca: 0,
  });
  const [metaSemanal, setMetaSemanal] = useState<MetaSemanal | null>(null);
  const [mostrarPedirMeta, setMostrarPedirMeta] = useState(false);
  const [objetivoTemp, setObjetivoTemp] = useState<ObjetivoSemanal>('mantener');
  const [pesoTemp, setPesoTemp] = useState(0);

  // ✅ Función para obtener recomendaciones de UN DÍA ESPECÍFICO
  const obtenerRecomendacionDia = useMemo(() => (fecha: string): { texto: string; color: string } => {
    if (!metaSemanal) return { texto: 'Configura tu meta semanal para ver recomendaciones', color: '#e5e7eb' };

    const comidasDelDia = historial.filter(c => c.fecha === fecha);
    const totalDia = comidasDelDia.length > 0
      ? sumarNutrientes(comidasDelDia.map(c => c.total))
      : { calorias: 0, proteina: 0, grasas: 0, carbohidratos: 0, fibra: 0, hierro: 0, calcio: 0, potasio: 0, magnesio: 0, vitaminaC: 0, vitaminaA: 0 };

    const todosSalud = JSON.parse(localStorage.getItem('datosSalud') || '{}');
    const saludDia = todosSalud[fecha] || { pasos: 0, caloriasQuemadas: 0, horasSueno: 0 };

    const saldo = totalDia.calorias - (saludDia.caloriasQuemadas || 0);
    const recomendaciones: string[] = [];

    if (saludDia.pasos && saludDia.pasos >= 8000) recomendaciones.push('✅ ¡Excelente actividad física hoy!');
    else if (saludDia.pasos && saludDia.pasos > 0) recomendaciones.push('🚶 Buen avance, intenta caminar un poco más');
    else recomendaciones.push('👣 Registra tus pasos para ver tu actividad');

    if (totalDia.proteina >= metaSemanal.proteinaObjetivo) recomendaciones.push('✅ ¡Meta de proteína cumplida!');
    else if (totalDia.proteina > 0) recomendaciones.push(`🥩 Te faltan ${Math.max(0, metaSemanal.proteinaObjetivo - totalDia.proteina).toFixed(0)}g de proteína hoy`);
    else recomendaciones.push('🥩 Registra tus comidas para ver tu proteína');

    if (saludDia.horasSueno >= 7) recomendaciones.push('😴 ¡Excelente descanso!');
    else if (saludDia.horasSueno > 0) recomendaciones.push('😴 Intenta dormir al menos 7 horas');

    if (metaSemanal.objetivo === 'bajar_peso') {
      if (saldo < -300) recomendaciones.push('✅ Vas por buen camino para bajar de peso');
      else if (saldo > 0) recomendaciones.push('⚖️ Consume menos calorías o aumenta tu actividad');
    } else if (metaSemanal.objetivo === 'ganar_musculo') {
      if (totalDia.proteina >= metaSemanal.proteinaObjetivo && saldo > 200) recomendaciones.push('✅ ¡Perfecto para ganar músculo!');
      else recomendaciones.push('💪 Aumenta proteína y calorías saludables');
    } else if (metaSemanal.objetivo === 'subir_peso') {
      if (saldo > 300) recomendaciones.push('✅ Estás consumiendo suficiente para subir de peso');
      else recomendaciones.push('📈 Consume un poco más de calorías saludables');
    } else {
      if (Math.abs(saldo) < 200) recomendaciones.push('✅ Mantienes buen equilibrio calórico');
      else if (saldo > 300) recomendaciones.push('⚠️ Consumiste más de lo recomendado hoy');
      else recomendaciones.push('💡 Puedes consumir un poco más para mantenerte');
    }

    return {
      texto: recomendaciones.length > 0 ? recomendaciones.join(' | ') : 'No hay datos suficientes para este día',
      color: saldo < -300 ? '#dbeafe' : saldo > 300 ? '#fef3c7' : '#d1fae5'
    };
  }, [historial, metaSemanal]);

  // ✅ RESUMEN SEMANAL — ahora usa la semana seleccionada
  const resumenSemanal = useMemo((): ResumenSemanal | null => {
    if (!metaSemanal) return null;
    const diasSemana: string[] = [];
    for (let i = 0; i < 7; i++) {
      const f = new Date(semanaResumen);
      f.setDate(f.getDate() + i);
      diasSemana.push(f.toISOString().split('T')[0]);
    }

    const comidasSemana = historial.filter(c => diasSemana.includes(c.fecha));
    const todosSalud = JSON.parse(localStorage.getItem('datosSalud') || '{}');
    const saludSemana = diasSemana.map(f => todosSalud[f]).filter(Boolean);
    const diasRegistrados = diasSemana.filter(f =>
      historial.some(c => c.fecha === f) || todosSalud[f]
    ).length || 1;

    const totalCal = comidasSemana.reduce((s, c) => s + c.total.calorias, 0);
    const totalPro = comidasSemana.reduce((s, c) => s + c.total.proteina, 0);
    const totalGra = comidasSemana.reduce((s, c) => s + c.total.grasas, 0);
    const totalCar = comidasSemana.reduce((s, c) => s + c.total.carbohidratos, 0);
    const totalFib = comidasSemana.reduce((s, c) => s + c.total.fibra, 0);
    const totalPasos = saludSemana.reduce((s: number, d: any) => s + (d?.pasos || 0), 0);
    const totalSueno = saludSemana.reduce((s: number, d: any) => s + (d?.horasSueno || 0), 0);
    const pesos = saludSemana.map((d: any) => d?.pesoKg).filter(Boolean);
    const promPeso = pesos.length > 0 ? pesos.reduce((a: number, b: number) => a + b, 0) / pesos.length : 0;

    const promCal = Math.round(totalCal / diasRegistrados);
    const promPro = Math.round(totalPro / diasRegistrados);
    const promGra = Math.round(totalGra / diasRegistrados);
    const promCar = Math.round(totalCar / diasRegistrados);
    const promFib = Math.round(totalFib / diasRegistrados);
    const promPasos = Math.round(totalPasos / diasRegistrados);
    const promSueno = Number((totalSueno / diasRegistrados).toFixed(1));

    const cumPro = porcentaje(promPro, metaSemanal.proteinaObjetivo);
    const cumCal = porcentaje(promCal, metaSemanal.caloriasObjetivo);

    const recomendacionesFinales: string[] = [];
    if (cumPro >= 90) recomendacionesFinales.push('✅ ¡Excelente! Cumpliste tu meta de proteína esta semana');
    else if (cumPro >= 70) recomendacionesFinales.push('📈 Casi llegas a tu meta de proteína — ¡sube un poquito más!');
    else recomendacionesFinales.push('🥩 Proteína baja esta semana — intenta huevos, pollo, pescado o legumbres');

    if (promFib >= metaSemanal.fibraObjetivo * 0.8) recomendacionesFinales.push('✅ Buena ingesta de fibra — ¡sigue así!');
    else recomendacionesFinales.push('🌾 Poca fibra esta semana — agrega verduras, frutas y cereales integrales');

    if (promSueno >= 7) recomendacionesFinales.push('😴 ¡Excelente descanso! 7+ horas en promedio');
    else recomendacionesFinales.push('😴 Duerme un poco más — tu cuerpo se recupera al descansar');

    if (promPasos >= 8000) recomendacionesFinales.push('👋 ¡Muy buena actividad física esta semana!');
    else recomendacionesFinales.push('🚶 Intenta caminar más cada día para mejorar tu promedio');

    if (promPeso > 0) {
      recomendacionesFinales.push(`⚖️ Peso promedio: ${promPeso.toFixed(1)} kg`);
    }

    return {
      semanaInicio: semanaResumen,
      diasRegistrados,
      promedioCalorias: promCal,
      promedioProteina: promPro,
      promedioGrasas: promGra,
      promedioCarbohidratos: promCar,
      promedioFibra: promFib,
      promedioPasos: promPasos,
      promedioSueno: promSueno,
      promedioPeso: Number(promPeso.toFixed(1)),
      cumplimientoProteina: cumPro,
      cumplimientoCalorias: cumCal,
      recomendacionesFinales,
    };
  }, [historial, metaSemanal, semanaResumen]); // ✅ Ahora cambia cuando cambias de semana

  // ✅ GRÁFICA — ahora usa los días EN ORDEN CORRECTO y la SEMANA SELECCIONADA
  const datosGrafica = useMemo(() => {
    const todosSalud = JSON.parse(localStorage.getItem('datosSalud') || '{}');

    if (tipoGrafica === 'semanal') {
      // ✅ Gráfica SEMANAL: SIEMPRE en orden Lunes → Domingo
      const datosSemana: { proteina: number; calorias: number; caloriasQ: number; peso: number }[] = [];
      for (let i = 0; i < 7; i++) {
        const f = new Date(semanaResumen);
        f.setDate(f.getDate() + i);
        const fechaISO = f.toISOString().split('T')[0];

        const comidasDia = historial.filter(c => c.fecha === fechaISO);
        const saludDia = todosSalud[fechaISO] || {};
        const diasConDatos = comidasDia.length + (saludDia?.pasos ? 1 : 0) || 1;

        datosSemana.push({
          proteina: Math.round(comidasDia.reduce((s, c) => s + c.total.proteina, 0) / (diasConDatos || 1)),
          calorias: Math.round(comidasDia.reduce((s, c) => s + c.total.calorias, 0) / (diasConDatos || 1)),
          caloriasQ: Math.round((saludDia?.caloriasQuemadas || 0) / (diasConDatos || 1)),
          peso: saludDia?.pesoKg || null,
        });
      }
      return { etiquetas: DIAS_SEMANA, datos: datosSemana };
    }

    // Mensual y Anual (se mantienen igual)
    const agrupar: Record<string, { proteina: number; calorias: number; caloriasQ: number; peso: number; dias: number }> = {};
    historial.forEach(c => {
      const f = new Date(c.fecha + 'T00:00:00');
      let clave = '';
      if (tipoGrafica === 'mensual') clave = `${f.getDate()}`;
      else clave = f.toLocaleDateString('es-MX', { month: 'short' });

      if (!agrupar[clave]) agrupar[clave] = { proteina: 0, calorias: 0, caloriasQ: 0, peso: 0, dias: 1 };
      agrupar[clave].calorias += c.total.calorias;
      agrupar[clave].proteina += c.total.proteina;
      agrupar[clave].dias += 1;
    });

    Object.entries(todosSalud).forEach(([fecha, datos]: [string, any]) => {
      const f = new Date(fecha + 'T00:00:00');
      let clave = '';
      if (tipoGrafica === 'mensual') clave = `${f.getDate()}`;
      else clave = f.toLocaleDateString('es-MX', { month: 'short' });

      if (!agrupar[clave]) agrupar[clave] = { proteina: 0, calorias: 0, caloriasQ: 0, peso: 0, dias: 1 };
      if (datos?.pesoKg) agrupar[clave].peso = datos.pesoKg;
      if (datos?.caloriasQuemadas) agrupar[clave].caloriasQ = datos.caloriasQuemadas;
    });

    const etiquetas = Object.keys(agrupar);
    return {
      etiquetas,
      datos: etiquetas.map(d => ({
        proteina: Math.round(agrupar[d].proteina / (agrupar[d].dias || 1)),
        calorias: Math.round(agrupar[d].calorias / (agrupar[d].dias || 1)),
        caloriasQ: Math.round(agrupar[d].caloriasQ / (agrupar[d].dias || 1)),
        peso: agrupar[d].peso || null,
      }))
    };
  }, [historial, tipoGrafica, semanaResumen]); // ✅ Gráfica cambia al cambiar de semana

  const etiquetas = datosGrafica.etiquetas;
  const datosProteina = datosGrafica.datos.map(d => d.proteina);
  const datosCalorias = datosGrafica.datos.map(d => d.calorias);
  const datosQuemadas = datosGrafica.datos.map(d => d.caloriasQ);
  const datosPeso = datosGrafica.datos.map(d => d.peso);

  // ========== EL RESTO DE TUS FUNCIONES SIGUEN IGUAL ==========
  useEffect(() => {
    if (!metaSemanal || !resumenSemanal?.promedioPeso) return;
    const cambioPeso = Math.abs(resumenSemanal.promedioPeso - metaSemanal.pesoInicial);
    if (cambioPeso >= 1.5) {
      const nuevasMetas = calcularMetasCompletas(metaSemanal.objetivo, resumenSemanal.promedioPeso);
      const actualizada: MetaSemanal = { ...metaSemanal, pesoInicial: resumenSemanal.promedioPeso, ...nuevasMetas };
      setMetaSemanal(actualizada);
      localStorage.setItem('metaSemanal', JSON.stringify(actualizada));
      setMensaje(`⚖️ Tu peso cambió ${cambioPeso.toFixed(1)}kg → metas recalculadas automáticamente`);
    }
  }, [resumenSemanal?.promedioPeso]);

  useEffect(() => {
    try {
      const guardado = localStorage.getItem('historialComidas');
      if (guardado) setHistorial(JSON.parse(guardado));
    } catch (e) {}
    try {
      const metaGuardada = localStorage.getItem('metaSemanal');
      if (metaGuardada) {
        const m: MetaSemanal = JSON.parse(metaGuardada);
        setMetaSemanal(m);
        if (m.semanaInicio !== lunesSemanaActual) {
          setMostrarPedirMeta(true);
          setPesoTemp(m.pesoInicial);
        }
      } else {
        setMostrarPedirMeta(true);
      }
    } catch (e) { setMostrarPedirMeta(true); }
    try {
      const saludGuardada = localStorage.getItem('datosSalud');
      if (saludGuardada) {
        const todos = JSON.parse(saludGuardada);
        if (todos[hoy]) setDatosSalud({ ...todos[hoy], fecha: hoy });
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    try {
      const saludGuardada = localStorage.getItem('datosSalud');
      if (saludGuardada) {
        const todos = JSON.parse(saludGuardada);
        if (todos[fechaSeleccionada]) {
          setDatosSalud({
            fecha: fechaSeleccionada,
            pasos: todos[fechaSeleccionada].pasos || 0,
            caloriasQuemadas: todos[fechaSeleccionada].caloriasQuemadas || 0,
            horasSueno: todos[fechaSeleccionada].horasSueno || 0,
            pesoKg: todos[fechaSeleccionada].pesoKg || 0,
            masaMagraKg: todos[fechaSeleccionada].masaMagraKg || 0,
            frecuenciaCardiaca: todos[fechaSeleccionada].frecuenciaCardiaca || 0,
          });
        } else {
          setDatosSalud({
            fecha: fechaSeleccionada, pasos: 0, caloriasQuemadas: 0, horasSueno: 0,
            pesoKg: 0, masaMagraKg: 0, frecuenciaCardiaca: 0,
          });
        }
      }
    } catch (e) {}
  }, [fechaSeleccionada]);

  const guardarMetaSemanal = () => {
    const metasCalc = calcularMetasCompletas(objetivoTemp, pesoTemp);
    const nuevaMeta: MetaSemanal = {
      semanaInicio: lunesSemanaActual,
      objetivo: objetivoTemp,
      pesoInicial: pesoTemp,
      ...metasCalc,
    };
    setMetaSemanal(nuevaMeta);
    localStorage.setItem('metaSemanal', JSON.stringify(nuevaMeta));
    setMostrarPedirMeta(false);
    setMensaje('✅ Meta semanal guardada');
  };

  const alRecibirTexto = (texto: string) => {
    setMensaje('');
    setListaAlimentos([]);
    setTextoDictado(texto);
  };

  const analizarComida = async () => {
    setMensaje('');
    if (!textoDictado || textoDictado.trim().length === 0) {
      setMensaje('⚠️ Escribe o di qué comiste');
      return;
    }
    setCargando(true);
    try {
      const partes = desglosarAlimentos(textoDictado);
      if (!partes || partes.length === 0) {
        setMensaje('⚠️ No entendí. Intenta: "200g de pollo y 50g de quinoa"');
        setCargando(false);
        return;
      }
      setMensaje(`🔍 ${partes.length} alimentos... buscando datos...`);
      const lista: AlimentoDesglosado[] = [];
      for (const parte of partes) {
        const nutrientes = await obtenerNutrientes(parte.nombre, parte.gramos);
        lista.push({ id: crypto.randomUUID(), textoOriginal: parte.texto, nombre: parte.nombre, gramos: parte.gramos, nutrientes, confirmado: true });
      }
      if (lista.length === 0) {
        setMensaje('❌ No hay datos. Revisa tu clave API.');
      } else {
        setMensaje(`✅ ¡Listo! ${lista.length} alimentos analizados`);
        setListaAlimentos(lista);
      }
    } catch (err) {
      setMensaje('❌ Error al analizar. Revisa la clave API.');
    }
    setCargando(false);
  };

  const cambiarGramos = async (id: string, nuevosGramos: number) => {
    if (nuevosGramos < 1) return;
    const alimento = listaAlimentos.find(a => a.id === id);
    if (!alimento) return;
    const nutrientes = await obtenerNutrientes(alimento.nombre, nuevosGramos);
    setListaAlimentos(prev => prev.map(a => a.id === id ? { ...a, gramos: nuevosGramos, nutrientes } : a));
  };

  const actualizarCampo = (id: string, campo: 'nombre' | 'gramos', valor: string | number) => {
    setListaAlimentos(prev => prev.map(a => a.id === id ? { ...a, [campo]: valor } : a));
  };

  const actualizarNutriente = (id: string, nutriente: keyof Nutrientes, valor: number) => {
    setListaAlimentos(prev => prev.map(a => a.id === id ? { ...a, nutrientes: { ...a.nutrientes, [nutriente]: valor } } : a));
  };

  const quitarAlimento = (id: string) => {
    setListaAlimentos(prev => prev.filter(a => a.id !== id));
  };

  const guardarComida = () => {
    if (listaAlimentos.length === 0) {
      setMensaje('⚠️ No hay alimentos para guardar');
      return;
    }
    const total = sumarNutrientes(listaAlimentos.map(a => a.nutrientes));
    if (comidaEnEdicion) {
      const actualizadas = historial.map(c =>
        c.id === comidaEnEdicion.id ? { ...c, tipo: tipoComida, alimentos: listaAlimentos, total } : c
      );
      localStorage.setItem('historialComidas', JSON.stringify(actualizadas));
      setHistorial(actualizadas);
      setMensaje('✅ Comida actualizada');
    } else {
      const comida: Comida = { id: crypto.randomUUID(), tipo: tipoComida, alimentos: listaAlimentos, fecha: fechaSeleccionada, total };
      const nuevoHistorial = [comida, ...historial];
      localStorage.setItem('historialComidas', JSON.stringify(nuevoHistorial));
      setHistorial(nuevoHistorial);
      setMensaje('✅ Comida guardada');
    }
    setListaAlimentos([]);
    setTextoDictado('');
    setComidaEnEdicion(null);
  };

  const editarComida = (c: Comida) => {
    setComidaEnEdicion(c);
    setListaAlimentos([...c.alimentos]);
    setTextoDictado(c.alimentos.map(a => `${a.gramos}g de ${a.nombre}`).join(' y '));
    setTipoComida(c.tipo);
    setFechaSeleccionada(c.fecha);
    setPestana('comidas');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const borrarComida = (id: string) => {
    if (!confirm('¿Eliminar esta comida?')) return;
    const nuevo = historial.filter(c => c.id !== id);
    localStorage.setItem('historialComidas', JSON.stringify(nuevo));
    setHistorial(nuevo);
    setMensaje('🗑️ Comida eliminada');
  };

  const copiarComida = (c: Comida) => {
    const nueva: Comida = {
      id: crypto.randomUUID(), tipo: c.tipo,
      alimentos: c.alimentos.map(a => ({ ...a, id: crypto.randomUUID() })),
      fecha: fechaSeleccionada, total: c.total,
    };
    const nuevoHistorial = [nueva, ...historial];
    localStorage.setItem('historialComidas', JSON.stringify(nuevoHistorial));
    setHistorial(nuevoHistorial);
    setMensaje(`✅ Comida copiada como ${c.tipo} de hoy`);
  };

  const copiarComidasDeAyer = () => {
    const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
    const fechaAyer = ayer.toISOString().split('T')[0];
    const comidasAyer = historial.filter(c => c.fecha === fechaAyer);
    if (comidasAyer.length === 0) {
      setMensaje('⚠️ No hay comidas de ayer para copiar');
      return;
    }
    const copias = comidasAyer.map(c => ({
      ...c, id: crypto.randomUUID(), fecha: fechaSeleccionada,
      alimentos: c.alimentos.map(a => ({ ...a, id: crypto.randomUUID() })),
    }));
    const nuevoHistorial = [...copias, ...historial];
    localStorage.setItem('historialComidas', JSON.stringify(nuevoHistorial));
    setHistorial(nuevoHistorial);
    setMensaje(`✅ Se copiaron ${copias.length} comidas de ayer`);
  };

  const guardarDatosSalud = () => {
    try {
      const todosGuardados = JSON.parse(localStorage.getItem('datosSalud') || '{}');
      const { fecha, ...datosSinFecha } = datosSalud;
      todosGuardados[fechaSeleccionada] = datosSinFecha;
      localStorage.setItem('datosSalud', JSON.stringify(todosGuardados));
      setMensaje(`✅ ¡Datos guardados! Pasos: ${datosSalud.pasos} | Calorías quemadas: ${datosSalud.caloriasQuemadas}`);
    } catch (error) {
      setMensaje('❌ Error al guardar: ' + (error as Error).message);
    }
  };

  const exportarTodo = () => {
    let csv = '=== COMIDAS ===\n';
    csv += 'Tipo,Fecha,Alimento,Gramos,Calorías,Proteína,Carbohidratos,Grasas,Fibra,Hierro,Calcio,Potasio,Magnesio,Vitamina C,Vitamina A\n';
    historial.forEach(c => {
      const fecha = new Date(c.fecha + 'T00:00:00').toLocaleDateString('es-MX');
      c.alimentos.forEach(a => {
        csv += `${c.tipo},"${fecha}","${a.nombre}",${a.gramos},${a.nutrientes.calorias},${a.nutrientes.proteina},${a.nutrientes.carbohidratos},${a.nutrientes.grasas},${a.nutrientes.fibra},${a.nutrientes.hierro},${a.nutrientes.calcio},${a.nutrientes.potasio},${a.nutrientes.magnesio},${a.nutrientes.vitaminaC},${a.nutrientes.vitaminaA}\n`;
      });
    });
    csv += '\n=== DATOS DE SALUD ===\n';
    csv += 'Fecha,Pasos,Calorías Quemadas,Horas Sueño,Peso (kg),Masa Magra (kg),Frecuencia Cardíaca\n';
    const todosSalud = JSON.parse(localStorage.getItem('datosSalud') || '{}');
    Object.entries(todosSalud).forEach(([fecha, datos]: [string, any]) => {
      const fechaLegible = new Date(fecha + 'T00:00:00').toLocaleDateString('es-MX');
      csv += `"${fechaLegible}",${datos.pasos || 0},${datos.caloriasQuemadas || 0},${datos.horasSueno || 0},${datos.pesoKg || 0},${datos.masaMagraKg || 0},${datos.frecuenciaCardiaca || 0}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Salud_Completa_${hoy}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMensaje(`✅ Archivo exportado: ${historial.length} comidas + ${Object.keys(todosSalud).length} días de salud`);
  };

  const importarDatos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = (evento) => {
      const texto = evento.target?.result as string;
      const lineas = texto.split('\n').filter(l => l.trim());
      const nuevas: Comida[] = [];
      const separarColumnas = (linea: string): string[] => {
        const resultado: string[] = [];
        let actual = '';
        let entreComillas = false;
        for (const c of linea) {
          if (c === '"') { entreComillas = !entreComillas; }
          else if (c === ',' && !entreComillas) { resultado.push(actual.trim()); actual = ''; }
          else { actual += c; }
        }
        resultado.push(actual.trim());
        return resultado;
      };
      for (let i = 1; i < lineas.length; i++) {
        const celdas = separarColumnas(lineas[i]);
        const lineaActual = lineas[i].trim();
        if (lineaActual.startsWith('===')) break;
        if (!celdas || celdas.length < 7) continue;
        const tipo = (celdas[0] || 'comida').trim().toLowerCase() as TipoComida;
        const fechaTexto = (celdas[1] || hoy).trim();
        const nombre = (celdas[2] || '').trim().replace(/^"|"$/g, '');
        const gramos = parseFloat((celdas[3] || '0').replace(/^"|"$/g, '')) || 0;
        const calorias = parseFloat((celdas[4] || '0').replace(/^"|"$/g, '')) || 0;
        const proteina = parseFloat((celdas[5] || '0').replace(/^"|"$/g, '')) || 0;
        const carbohidratos = parseFloat((celdas[6] || '0').replace(/^"|"$/g, '')) || 0;
        const grasas = parseFloat((celdas[7] || '0').replace(/^"|"$/g, '')) || 0;
        const fibra = parseFloat((celdas[8] || '0').replace(/^"|"$/g, '')) || 0;
        const hierro = parseFloat((celdas[9] || '0').replace(/^"|"$/g, '')) || 0;
        const calcio = parseFloat((celdas[10] || '0').replace(/^"|"$/g, '')) || 0;
        const potasio = parseFloat((celdas[11] || '0').replace(/^"|"$/g, '')) || 0;
        const magnesio = parseFloat((celdas[12] || '0').replace(/^"|"$/g, '')) || 0;
        const vitaminaC = parseFloat((celdas[13] || '0').replace(/^"|"$/g, '')) || 0;
        const vitaminaA = parseFloat((celdas[14] || '0').replace(/^"|"$/g, '')) || 0;
        if (!nombre || gramos <= 0) continue;
        let fechaISO = hoy;
        if (fechaTexto.includes('/')) {
          const partes = fechaTexto.split('/');
          if (partes.length === 3) {
            const [dia, mes, anio] = partes;
            const año = anio.length === 2 ? `20${anio}` : anio;
            fechaISO = `${año}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
          }
        } else if (fechaTexto.includes('-')) { fechaISO = fechaTexto; }
        const alimento: AlimentoDesglosado = {
          id: crypto.randomUUID(), textoOriginal: `${gramos}g de ${nombre}`,
          nombre, gramos, confirmado: true,
          nutrientes: { proteina, grasas, carbohidratos, fibra, calorias, hierro, calcio, potasio, magnesio, vitaminaC, vitaminaA },
        };
        nuevas.push({
          id: crypto.randomUUID(), tipo: tipo as TipoComida,
          alimentos: [alimento], fecha: fechaISO,
          total: sumarNutrientes([alimento.nutrientes]),
        });
      }
      if (nuevas.length === 0) {
        setMensaje('⚠️ No se encontraron datos válidos en el archivo. Verifica el formato.');
        return;
      }
      const saludNuevos: Record<string, any> = {};
      let leyendoSalud = false;
      for (let i = 0; i < lineas.length; i++) {
        const linea = lineas[i].trim();
        if (linea.startsWith('=== DATOS DE SALUD ===')) { leyendoSalud = true; continue; }
        if (!leyendoSalud || linea.startsWith('Fecha,Pasos')) continue;
        if (!linea) continue;
        const celdasSalud: string[] = [];
        let actual = '';
        let entreComillas = false;
        for (const c of linea) {
          if (c === '"') { entreComillas = !entreComillas; }
          else if (c === ',' && !entreComillas) { celdasSalud.push(actual.trim().replace(/^"|"$/g, '')); actual = ''; }
          else { actual += c; }
        }
        celdasSalud.push(actual.trim().replace(/^"|"$/g, ''));
        if (celdasSalud.length < 1) continue;
        const fechaTexto = celdasSalud[0];
        if (!fechaTexto || fechaTexto.length < 8) continue;
        let fechaISO = fechaTexto;
        if (fechaTexto.includes('/')) {
          const partes = fechaTexto.split('/');
          if (partes.length === 3) {
            let [dia, mes, anio] = partes;
            if (anio.length === 2) anio = `20${anio}`;
            if (mes.length === 1) mes = `0${mes}`;
            if (dia.length === 1) dia = `0${dia}`;
            fechaISO = `${anio}-${mes}-${dia}`;
          }
        }
        const pasos = celdasSalud[1] ? parseFloat(celdasSalud[1].replace(',', '.')) || 0 : 0;
        const caloriasQuemadas = celdasSalud[2] ? parseFloat(celdasSalud[2].replace(',', '.')) || 0 : 0;
        const horasSueno = celdasSalud[3] ? parseFloat(celdasSalud[3].replace(',', '.')) || 0 : 0;
        const pesoKg = celdasSalud[4] ? parseFloat(celdasSalud[4].replace(',', '.')) || 0 : 0;
        const masaMagraKg = celdasSalud[5] ? parseFloat(celdasSalud[5].replace(',', '.')) || 0 : 0;
        const frecuenciaCardiaca = celdasSalud[6] ? parseFloat(celdasSalud[6].replace(',', '.')) || 0 : 0;
        saludNuevos[fechaISO] = { pasos, caloriasQuemadas, horasSueno, pesoKg, masaMagraKg, frecuenciaCardiaca };
      }
      const saludGuardada = JSON.parse(localStorage.getItem('datosSalud') || '{}');
      const saludFinal = { ...saludGuardada, ...saludNuevos };
      localStorage.setItem('datosSalud', JSON.stringify(saludFinal));
      const historialFinal = [...nuevas, ...historial];
      localStorage.setItem('historialComidas', JSON.stringify(historialFinal));
      setHistorial(historialFinal);
      setMensaje(`✅ ¡Importadas ${nuevas.length} comidas y ${Object.keys(saludNuevos).length} días de salud!`);
    };
    lector.readAsText(new Blob([archivo], { type: 'text/csv;charset=utf-8;' }));
  };

  const diasDelMes = () => {
    const año = mesCalendario.getFullYear();
    const mes = mesCalendario.getMonth();
    const primerDia = new Date(año, mes, 1).getDay();
    const ultimoDia = new Date(año, mes + 1, 0).getDate();
    const dias: (number | null)[] = [];
    for (let i = 0; i < primerDia; i++) dias.push(null);
    for (let i = 1; i <= ultimoDia; i++) dias.push(i);
    return dias;
  };

  const comidasDelDia = historial.filter(c => c.fecha === fechaSeleccionada);
  const totalDelDia = sumarNutrientes(comidasDelDia.map(c => c.total));

  const comidasAyer = historial.filter(c => {
    const ay = new Date(); ay.setDate(ay.getDate() - 1);
    return c.fecha === ay.toISOString().split('T')[0];
  });
  return (
    <div style={{ maxWidth: '780px', margin: '0 auto', padding: '16px', fontFamily: 'system-ui, -apple-system, sans-serif', background: '#fafafa', minHeight: '100vh' }}>
      <h1 style={{ textAlign: 'center', color: '#065f46', marginBottom: '16px', fontSize: '22px' }}>💚 Salud con Huawei</h1>

      <div style={{ margin: '10px 0', textAlign: 'center', padding: '8px', background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <label style={{ fontWeight: 'bold', marginRight: '10px' }}>📅 Fecha:</label>
        <input type="date" value={fechaSeleccionada} onChange={(e) => setFechaSeleccionada(e.target.value)} style={{ padding: '6px 10px', fontSize: '15px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
        {comidasAyer.length > 0 && comidasDelDia.length === 0 && (
          <button onClick={copiarComidasDeAyer} style={{ marginLeft: '10px', padding: '6px 12px', fontSize: '14px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>📋 Copiar comidas de ayer</button>
        )}
      </div>

      {metaSemanal && !mostrarPedirMeta && (
        <div style={{ margin: '12px 0', padding: '12px', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
          <strong>🎯 Meta semanal:</strong> {
            { bajar_peso: '🔽 Bajar de peso', mantener: '⚖️ Mantener peso', subir_peso: '📈 Subir de peso saludablemente', ganar_musculo: '💪 Ganar masa muscular' }[metaSemanal.objetivo]
          }
          <br />🔥 {metaSemanal.caloriasObjetivo} kcal | 🥩 {metaSemanal.proteinaObjetivo}g proteína | 🥑 {metaSemanal.grasasObjetivo}g grasas | 🍞 {metaSemanal.carbohidratosObjetivo}g carbohidratos | 🌾 {metaSemanal.fibraObjetivo}g fibra
        </div>
      )}

      {mensaje && <div style={{ margin: '10px 0', padding: '10px 14px', background: '#fef9c3', borderRadius: '6px', fontSize: '14px' }}>{mensaje}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '15px 0' }}>
        {[
          { id: 'comidas', etiqueta: '🍽️ Comidas' },
          { id: 'salud', etiqueta: '📋 Salud' },
          { id: 'calendario', etiqueta: '📅 Calendario' },
          { id: 'resumen', etiqueta: '📊 Resumen' },
          { id: 'historial', etiqueta: '📋 Historial' },
        ].map(p => (
          <button
            key={p.id}
            onClick={() => { setPestana(p.id as any); setComidaEnEdicion(null); }}
            style={{
              padding: '8px 12px', fontSize: '14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              background: pestana === p.id ? '#059669' : '#e5e7eb',
              color: pestana === p.id ? 'white' : '#1f2937',
              fontWeight: pestana === p.id ? 600 : 'normal',
            }}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {mostrarPedirMeta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', maxWidth: '420px', width: '100%' }}>
            <h2 style={{ marginTop: 0, color: '#065f46' }}>🎯 Meta para esta semana</h2>
            <p style={{ color: '#6b7280', marginBottom: '18px' }}>Semana del {new Date(lunesSemanaActual).toLocaleDateString('es-MX')}</p>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>¿Qué quieres lograr?</label>
            {[
              { v: 'bajar_peso', t: '🔽 Bajar de peso' },
              { v: 'mantener', t: '⚖️ Mantener mi peso' },
              { v: 'subir_peso', t: '📈 Subir de peso saludablemente' },
              { v: 'ganar_musculo', t: '💪 Ganar masa muscular' },
            ].map(opt => (
              <button
                key={opt.v}
                onClick={() => setObjetivoTemp(opt.v as ObjetivoSemanal)}
                style={{
                  display: 'block', width: '100%', padding: '10px 12px', margin: '4px 0', textAlign: 'left', borderRadius: '6px', border: '2px solid transparent',
                  background: objetivoTemp === opt.v ? '#ecfdf5' : '#f9fafb',
                  borderColor: objetivoTemp === opt.v ? '#10b981' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                {opt.t}
              </button>
            ))}
            <div style={{ marginTop: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Tu peso actual (kg):</label>
              <input
                type="number" step="0.1" value={pesoTemp || ''}
                onChange={(e) => setPesoTemp(parseFloat(e.target.value) || 0)}
                placeholder="Ej: 72.5"
                style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '6px', border: '1px solid #d1d5db' }}
              />
            </div>
            <button
              onClick={guardarMetaSemanal}
              disabled={!pesoTemp || pesoTemp <= 0}
              style={{
                marginTop: '20px', width: '100%', padding: '12px', fontSize: '16px', borderRadius: '8px', border: 'none',
                background: pesoTemp && pesoTemp > 0 ? '#10b981' : '#9ca3af',
                color: 'white', fontWeight: 600, cursor: 'pointer',
              }}
            >
              ✅ Calcular mi meta
            </button>
          </div>
        </div>
      )}

      {/* ============================================== */}
      {/* 🍽️ PESTANA: COMIDAS */}
      {/* ============================================== */}
      {pestana === 'comidas' && (
        <div style={{ background: 'white', padding: '16px', borderRadius: '10px' }}>
          <h3 style={{ marginTop: 0 }}>¿Qué vas a registrar?</h3>
          {(['desayuno', 'comida', 'cena', 'merienda'] as TipoComida[]).map(tipo => (
            <button
              key={tipo}
              onClick={() => setTipoComida(tipo)}
              style={{
                padding: '7px 11px', margin: '3px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: tipoComida === tipo ? '#059669' : '#f3f4f6',
                color: tipoComida === tipo ? 'white' : '#374151',
              }}
            >
              {tipo === 'desayuno' && '🌅'}
              {tipo === 'comida' && '☀️'}
              {tipo === 'cena' && '🌙'}
              {tipo === 'merienda' && '🍎'}
              {' '}{tipo.charAt(0).toUpperCase() + tipo.slice(1)}
            </button>
          ))}

          <EntradaVoz alRecibirTexto={alRecibirTexto} />

          <div style={{ margin: '14px 0', padding: '12px', background: '#fffbeb', borderRadius: '8px' }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>✍️ O escribe:</p>
            <input
              type="text" value={textoDictado} onChange={(e) => setTextoDictado(e.target.value)}
              placeholder="Ej: 200g de pollo y 50g de quinoa"
              style={{ width: '100%', padding: '9px', fontSize: '15px', borderRadius: '6px', border: '1px solid #d1d5db' }}
            />
          </div>

          {textoDictado.trim().length > 0 && (
            <div style={{ margin: '14px 0', padding: '12px', background: '#f0fdf4', borderRadius: '8px' }}>
              🗣️ Dijiste: <strong>{textoDictado}</strong>
              <button
                onClick={analizarComida} disabled={cargando}
                style={{ marginTop: '10px', padding: '10px', fontSize: '15px', width: '100%', borderRadius: '6px', border: 'none', cursor: cargando ? 'not-allowed' : 'pointer', background: cargando ? '#9ca3af' : '#10b981', color: 'white' }}
              >
                {cargando ? '🔍 Buscando...' : '📊 Analizar comida'}
              </button>
            </div>
          )}

          {listaAlimentos.length > 0 && !cargando && (
            <div style={{ margin: '18px 0' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>🍽️ Alimentos:</h4>
              {listaAlimentos.map((alimento, idx) => (
                <div key={alimento.id} style={{ padding: '12px', margin: '8px 0', background: '#f9fafb', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                      <span style={{ fontWeight: 'bold', minWidth: '20px' }}>{idx + 1}.</span>
                      <input
                        type="number"
                        value={alimento.gramos}
                        onChange={(e) => actualizarCampo(alimento.id, 'gramos', parseFloat(e.target.value) || 0)}
                        onBlur={(e) => { const v = parseFloat(e.target.value) || 0; if (v >= 1) cambiarGramos(alimento.id, v); }}
                        style={{ width: '70px', padding: '4px 6px', fontSize: '14px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                      />
                      <span>g de</span>
                      <input
                        type="text"
                        value={alimento.nombre}
                        onChange={(e) => actualizarCampo(alimento.id, 'nombre', e.target.value)}
                        style={{ flex: 1, padding: '4px 6px', fontSize: '14px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                      />
                    </div>
                    <button onClick={() => quitarAlimento(alimento.id)} style={{ margin: '0 0 0 8px', padding: '4px 8px', border: 'none', background: '#fee2e2', color: '#b91c1c', borderRadius: '4px', cursor: 'pointer' }}>❌</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '6px', marginTop: '8px' }}>
                    {([
                      { label: '🔥 Cal', key: 'calorias', unit: 'kcal', step: '1' },
                      { label: '🥩 Prot', key: 'proteina', unit: 'g', step: '0.1' },
                      { label: '🍞 Carb', key: 'carbohidratos', unit: 'g', step: '0.1' },
                      { label: '🥑 Gras', key: 'grasas', unit: 'g', step: '0.1' },
                      { label: '🌾 Fibra', key: 'fibra', unit: 'g', step: '0.1' },
                      { label: '🩸 Hierro', key: 'hierro', unit: 'mg', step: '0.01' },
                      { label: '🦴 Calcio', key: 'calcio', unit: 'mg', step: '0.1' },
                      { label: '⚡ Potasio', key: 'potasio', unit: 'mg', step: '0.1' },
                      { label: '💪 Magnesio', key: 'magnesio', unit: 'mg', step: '0.01' },
                      { label: '🍊 Vit C', key: 'vitaminaC', unit: 'mg', step: '0.1' },
                      { label: '👁️ Vit A', key: 'vitaminaA', unit: 'µg', step: '0.1' },
                    ] as { label: string; key: keyof Nutrientes; unit: string; step: string }[]).map(n => (
                      <div key={n.key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <label style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{n.label}</label>
                        <input
                          type="number"
                          step={n.step}
                          value={alimento.nutrientes[n.key]}
                          onChange={(e) => actualizarNutriente(alimento.id, n.key, parseFloat(e.target.value) || 0)}
                          style={{ width: '60px', padding: '3px 4px', fontSize: '13px', borderRadius: '4px', border: '1px solid #d1d5db' }}
                        />
                        <span style={{ fontSize: '11px', color: '#9ca3af' }}>{n.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ marginTop: '14px', padding: '12px', background: '#ecfdf5', borderRadius: '6px', border: '2px solid #10b981' }}>
                <h4 style={{ margin: '0 0 8px 0' }}>📊 SUMA TOTAL:</h4>
                <DesgloseNutrientes nutrientes={sumarNutrientes(listaAlimentos.map(a => a.nutrientes))} />
              </div>
              <button onClick={guardarComida} style={{ marginTop: '14px', padding: '11px', fontSize: '15px', width: '100%', borderRadius: '6px', border: 'none', cursor: 'pointer', background: '#059669', color: 'white', fontWeight: 600 }}>
                💾 {comidaEnEdicion ? 'Actualizar comida' : 'Guardar comida'}
              </button>
            </div>
          )}

          {comidasDelDia.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <h3>📋 Comidas del día</h3>
              {comidasDelDia.map(c => (
                <div key={c.id} style={{ padding: '10px', margin: '6px 0', background: '#f3f4f6', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{c.tipo.charAt(0).toUpperCase() + c.tipo.slice(1)}</strong>
                    <div>
                      <button onClick={() => editarComida(c)} style={{ margin: '0 4px', padding: '4px 8px', fontSize: '13px', border: 'none', background: '#dbeafe', borderRadius: '4px', cursor: 'pointer' }}>✏️ Editar</button>
                      <button onClick={() => copiarComida(c)} style={{ margin: '0 4px', padding: '4px 8px', fontSize: '13px', border: 'none', background: '#fef3c7', borderRadius: '4px', cursor: 'pointer' }}>📋 Copiar</button>
                      <button onClick={() => borrarComida(c.id)} style={{ margin: '0 4px', padding: '4px 8px', fontSize: '13px', border: 'none', background: '#fee2e2', color: '#b91c1c', borderRadius: '4px', cursor: 'pointer' }}>🗑️</button>
                    </div>
                  </div>
                  <span style={{ fontSize: '14px', color: '#4b5563' }}>🔥 {Math.round(c.total.calorias)} kcal | 🥩 {Math.round(c.total.proteina)}g proteína | {c.alimentos.length} alimento(s)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================== */}
      {/* 📋 PESTANA: SALUD */}
      {/* ============================================== */}
      {pestana === 'salud' && (
        <div style={{ background: 'white', padding: '16px', borderRadius: '10px' }}>
          <h2 style={{ marginTop: 0 }}>📋 Datos del reloj y cuerpo</h2>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: '4px 0 16px 0' }}>Fecha: {fechaSeleccionada}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', margin: '15px 0' }}>
            {[
              { label: '👣 Pasos', key: 'pasos', type: 'number' },
              { label: '🔥 Calorías quemadas', key: 'caloriasQuemadas', type: 'number' },
              { label: '💓 Frecuencia cardíaca (ppm)', key: 'frecuenciaCardiaca', type: 'number' },
              { label: '😴 Horas de sueño', key: 'horasSueno', type: 'decimal' },
              { label: '⚖️ Peso (kg)', key: 'pesoKg', type: 'decimal' },
              { label: '💪 Masa magra (kg)', key: 'masaMagraKg', type: 'decimal' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 600, fontSize: '14px' }}>{f.label}</label>
                <input
                  type="number" step={f.type === 'decimal' ? '0.1' : '1'}
                  value={(datosSalud as any)[f.key] || ''}
                  onChange={(e) => setDatosSalud(prev => ({ ...prev, [f.key]: parseFloat(e.target.value) || 0 }))}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '15px' }}
                />
              </div>
            ))}
          </div>
          <button onClick={guardarDatosSalud} style={{ padding: '10px 20px', fontSize: '15px', width: '100%', borderRadius: '6px', border: 'none', cursor: 'pointer', background: '#059669', color: 'white', fontWeight: 600, marginTop: '8px' }}>
            💾 Guardar datos de salud
          </button>
          {/* ✅ LAS RECOMENDACIONES YA NO VAN AQUÍ → SE MOSTRARÁN EN CALENDARIO */}
        </div>
      )}

      {/* ============================================== */}
      {/* 📅 PESTANA: CALENDARIO — AHORA CON RECOMENDACIONES DEL DÍA ✅ */}
      {/* ============================================== */}
      {pestana === 'calendario' && (
        <div style={{ background: 'white', padding: '16px', borderRadius: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <button onClick={() => setMesCalendario(new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() - 1))} style={{ padding: '6px 10px', border: 'none', background: '#e5e7eb', borderRadius: '4px', cursor: 'pointer' }}>◀</button>
            <strong>{mesCalendario.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</strong>
            <button onClick={() => setMesCalendario(new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() + 1))} style={{ padding: '6px 10px', border: 'none', background: '#e5e7eb', borderRadius: '4px', cursor: 'pointer' }}>▶</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', fontSize: '13px' }}>
            {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => <div key={i} style={{ fontWeight: 'bold', padding: '4px' }}>{d}</div>)}
            {diasDelMes().map((dia, i) => {
              if (!dia) return <div key={i} />;
              const fecha = `${mesCalendario.getFullYear()}-${String(mesCalendario.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
              const tiene = historial.some(c => c.fecha === fecha);
              const esHoy = fecha === hoy;
              const seleccionada = fecha === fechaSeleccionada;
              return (
                <button
                  key={i}
                  onClick={() => setFechaSeleccionada(fecha)}
                  style={{
                    fontWeight: seleccionada ? 'bold' : 'normal',
                    border: esHoy ? '2px solid #059669' : seleccionada ? '2px solid #3b82f6' : '2px solid transparent',
                    background: tiene
                      ? (seleccionada ? '#dbeafe' : '#d1fae5')
                      : (seleccionada ? '#e5e7eb' : 'transparent'),
                    borderRadius: '6px',
                    padding: '6px 4px',
                    cursor: 'pointer',
                    color: tiene ? '#065f46' : 'inherit',
                  }}
                >
                  {dia}
                  {tiene && <div style={{ fontSize: '7px', color: '#059669' }}>●</div>}
                </button>
              );
            })}
          </div>

          {/* ✅ RECOMENDACIÓN DEL DÍA SELECCIONADO — AHORA EN CALENDARIO */}
          <div style={{ marginTop: '18px', padding: '14px', borderRadius: '8px', background: obtenerRecomendacionDia(fechaSeleccionada).color }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '15px' }}>💡 Recomendación para el {new Date(fechaSeleccionada + 'T00:00:00').toLocaleDateString('es-MX')}</h3>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5' }}>{obtenerRecomendacionDia(fechaSeleccionada).texto}</p>
            {comidasDelDia.length > 0 && (
              <div style={{ marginTop: '10px' }}>
                <strong>🍽️ Resumen del día:</strong>
                <DesgloseNutrientes nutrientes={totalDelDia} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================== */}
      {/* 📊 PESTANA: RESUMEN — CORREGIDO ✅ */}
      {/* ============================================== */}
      {pestana === 'resumen' && resumenSemanal && (
        <div style={{ background: 'white', padding: '16px', borderRadius: '10px' }}>
          <h2 style={{ marginTop: 0 }}>📊 Resumen</h2>

          {/* ✅ FLECHAS DE SEMANA ARREGLADAS — ahora sí avanzan y retroceden */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', margin: '12px 0' }}>
            <button
              onClick={() => {
                const d = new Date(semanaResumen);
                d.setDate(d.getDate() - 7);
                setSemanaResumen(obtenerLunes(d));
              }}
              style={{ padding: '6px 12px', border: 'none', background: '#e5e7eb', borderRadius: '6px', cursor: 'pointer', fontSize: '16px' }}
            >◀</button>
            <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#065f46', minWidth: '200px', textAlign: 'center' }}>
              {tipoGrafica === 'semanal'
                ? `Semana del ${new Date(resumenSemanal.semanaInicio).toLocaleDateString('es-MX')}`
                : tipoGrafica === 'mensual' ? 'Vista mensual' : 'Vista anual'}
            </span>
            <button
              onClick={() => {
                const d = new Date(semanaResumen);
                d.setDate(d.getDate() + 7);
                setSemanaResumen(obtenerLunes(d));
              }}
              style={{ padding: '6px 12px', border: 'none', background: '#e5e7eb', borderRadius: '6px', cursor: 'pointer', fontSize: '16px' }}
            >▶</button>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <button
              onClick={() => setSemanaResumen(obtenerLunes())}
              style={{ padding: '4px 10px', fontSize: '13px', border: '1px solid #d1d5db', background: '#f9fafb', borderRadius: '6px', cursor: 'pointer', color: '#374151' }}
            >📍 Semana actual</button>
          </div>

          {/* Tarjetas de resumen */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', margin: '16px 0' }}>
            {[
              { etiq: '🔥 Calorías/día', valor: `${resumenSemanal.promedioCalorias} kcal` },
              { etiq: '🥩 Proteína/día', valor: `${resumenSemanal.promedioProteina} g` },
              { etiq: '⚖️ Peso prom.', valor: resumenSemanal.promedioPeso ? `${resumenSemanal.promedioPeso} kg` : '—' },
              { etiq: '👣 Pasos/día', valor: `${resumenSemanal.promedioPasos}` },
              { etiq: '😴 Sueño', valor: `${resumenSemanal.promedioSueno} h` },
              { etiq: '📅 Días reg.', valor: `${resumenSemanal.diasRegistrados}` },
            ].map((x, i) => (
              <div key={i} style={{ padding: '10px', background: '#f9fafb', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>{x.etiq}</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '4px' }}>{x.valor}</div>
              </div>
            ))}
          </div>

          {/* Selector de tipo de gráfica */}
          <div style={{ display: 'flex', gap: '8px', margin: '14px 0' }}>
            {(['semanal', 'mensual', 'anual'] as TipoGrafica[]).map(t => (
              <button
                key={t}
                onClick={() => setTipoGrafica(t)}
                style={{
                  padding: '6px 12px', fontSize: '13px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  background: tipoGrafica === t ? '#059669' : '#e5e7eb',
                  color: tipoGrafica === t ? 'white' : '#374151',
                }}
              >
                {{ semanal: '📅 Semanal', mensual: '📆 Mensual', anual: '🗓️ Anual' }[t]}
              </button>
            ))}
          </div>

          {/* ✅ GRÁFICA — ya ordenada y vinculada a la semana seleccionada */}
          <div style={{ margin: '18px 0', height: 260 }}>
            <Line
              data={{
                labels: etiquetas,
                datasets: [
                  { label: 'Proteína (g/día)', data: datosProteina, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.3, fill: true },
                  { label: 'Calorías consumidas', data: datosCalorias, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', tension: 0.3, fill: true },
                  { label: 'Calorías quemadas', data: datosQuemadas, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', tension: 0.3, fill: true },
                ],
              }}
              options={{ responsive: true, maintainAspectRatio: false }}
            />
          </div>

          {datosPeso.some(v => v !== null) && (
            <div style={{ margin: '18px 0', height: 220 }}>
              <Bar
                data={{
                  labels: etiquetas,
                  datasets: [{ label: 'Peso (kg)', data: datosPeso, backgroundColor: '#8b5cf6' }],
                }}
                options={{ responsive: true, maintainAspectRatio: false }}
              />
            </div>
          )}

          {/* ✅ RECOMENDACIONES — cambian según la semana seleccionada */}
          <div style={{ marginTop: '20px', padding: '14px', background: '#f0fdf4', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0' }}>
              💡 Recomendaciones {tipoGrafica === 'semanal' ? 'de la semana' : tipoGrafica === 'mensual' ? 'mensuales' : 'anuales'}
            </h4>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {resumenSemanal.recomendacionesFinales.map((r, i) => (
                <li key={i} style={{ margin: '4px 0', fontSize: '14px' }}>{r}</li>
              ))}
            </ul>
          </div>

          <button onClick={() => { setMostrarPedirMeta(true); setPesoTemp(resumenSemanal.promedioPeso || 0); }} style={{ marginTop: '16px', padding: '9px 14px', fontSize: '14px', border: 'none', borderRadius: '6px', background: '#e5e7eb', cursor: 'pointer' }}>
            🔄 Cambiar mi meta
          </button>
        </div>
      )}

      {/* ============================================== */}
      {/* 📋 PESTANA: HISTORIAL */}
      {/* ============================================== */}
      {pestana === 'historial' && (
        <div style={{ background: 'white', padding: '16px', borderRadius: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button onClick={exportarTodo} style={{ padding: '8px 14px', fontSize: '14px', border: 'none', borderRadius: '6px', background: '#10b981', color: 'white', cursor: 'pointer' }}>
              📤 Exportar todo (.csv)
            </button>
            <button onClick={() => inputImportar.current?.click()} style={{ padding: '8px 14px', fontSize: '14px', border: 'none', borderRadius: '6px', background: '#3b82f6', color: 'white', cursor: 'pointer' }}>
              📥 Importar
            </button>
            <input ref={inputImportar} type="file" accept=".csv" onChange={importarDatos} style={{ display: 'none' }} />
          </div>
          <h3 style={{ margin: '0 0 12px 0' }}>📋 Historial de comidas</h3>
          {historial.length === 0 ? (
            <p style={{ color: '#6b7280' }}>Aún no has guardado ninguna comida.</p>
          ) : (
            historial.slice(0, 30).map(c => (
              <div key={c.id} style={{ padding: '10px', margin: '6px 0', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>
                    {c.tipo.charAt(0).toUpperCase() + c.tipo.slice(1)} — {new Date(c.fecha + 'T00:00:00').toLocaleDateString('es-MX')}
                  </strong>
                  <div>
                    <button onClick={() => { setFechaSeleccionada(c.fecha); editarComida(c); }} style={{ margin: '0 4px', padding: '3px 6px', fontSize: '12px', border: 'none', background: '#dbeafe', borderRadius: '4px', cursor: 'pointer' }}>✏️</button>
                    <button onClick={() => borrarComida(c.id)} style={{ margin: '0 4px', padding: '3px 6px', fontSize: '12px', border: 'none', background: '#fee2e2', color: '#b91c1c', borderRadius: '4px', cursor: 'pointer' }}>🗑️</button>
                  </div>
                </div>
                <div style={{ fontSize: '13px', color: '#4b5563', marginTop: '4px' }}>
                  🔥 {Math.round(c.total.calorias)} kcal | 🥩 {Math.round(c.total.proteina)}g proteína | {c.alimentos.length} alimento(s)
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default App;