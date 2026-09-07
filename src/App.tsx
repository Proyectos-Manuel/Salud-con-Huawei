import React, { useState, useEffect, useMemo } from 'react';
import EntradaVoz from './components/EntradaVoz';
import DesgloseNutrientes from './components/DesgloseNutrientes';
import Consejos from './components/Consejos';
import { desglosarAlimentos, obtenerNutrientes, sumarNutrientes, generarConsejos } from './services/nutricionAPI';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import type { AlimentoDesglosado, Comida, DatosSaludDiarios, MetaSemanal, ObjetivoSemanal } from './types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement);

type TipoComida = 'desayuno' | 'comida' | 'cena' | 'merienda';
type TipoGrafica = 'semanal' | 'mensual' | 'anual';

// 📅 Obtener el lunes de la semana actual
const obtenerLunes = (fecha: Date = new Date()): string => {
  const d = new Date(fecha);
  const dia = d.getDay();
  const diff = d.getDate() - dia + (dia === 0 ? -6 : 1);
  const lunes = new Date(d.getFullYear(), d.getMonth(), diff);
  return lunes.toISOString().split('T')[0];
};

// 🎯 Calcular metas según el objetivo
const calcularMetasPorObjetivo = (objetivo: ObjetivoSemanal, pesoKg: number) => {
  switch (objetivo) {
    case 'bajar_peso':
      return {
        caloriasObjetivo: 1800,
        proteinaObjetivo: Math.round(pesoKg * 1.6),
        recomendaciones: [
          '🔥 Consume 300-500 calorías menos de las que quemas',
          '🥩 Aumenta proteína para conservar músculo',
          '🏃 Haz ejercicio moderado al menos 30 min/día',
          '🌾 Prefiere carbohidratos integrales y mucha fibra',
          '💧 Bebe suficiente agua y reduce azúcares',
        ],
      };
    case 'mantener':
      return {
        caloriasObjetivo: 2000,
        proteinaObjetivo: Math.round(pesoKg * 1.2),
        recomendaciones: [
          '✅ Mantén calorías consumidas ≈ calorías quemadas',
          '🥩 Proteína moderada según tu peso',
          '⚖️ Mantén actividad física habitual',
          '🥗 Come variado y equilibrado',
        ],
      };
    case 'subir_peso':
      return {
        caloriasObjetivo: 2400,
        proteinaObjetivo: Math.round(pesoKg * 1.5),
        recomendaciones: [
          '📈 Consume 300-500 calorías extra al día',
          '🥩 Aumenta proteína y porciones gradualmente',
          '🥜 Agrega alimentos energéticos: nueces, aguacate...',
          '🏋️ Combina con ejercicio para ganar saludablemente',
        ],
      };
    case 'ganar_musculo':
      return {
        caloriasObjetivo: 2300,
        proteinaObjetivo: Math.round(pesoKg * 2.0),
        recomendaciones: [
          '💪 Proteína alta: 2g por cada kg de peso diario',
          '🏋️ Prioriza ejercicios de resistencia y pesas',
          '🍞 Come carbohidratos de calidad antes y después de entrenar',
          '😴 Duerme bien: el músculo se forma al descansar',
          '🥩 Distribuye proteína en todas tus comidas',
        ],
      };
    default:
      return { caloriasObjetivo: 2000, proteinaObjetivo: 80, recomendaciones: ['Mantén alimentación variada'] };
  }
};

const App: React.FC = () => {
  const hoy = new Date().toISOString().split('T')[0];
  const lunesSemana = obtenerLunes();

  const [textoDictado, setTextoDictado] = useState('');
  const [cargando, setCargando] = useState(false);
  const [listaAlimentos, setListaAlimentos] = useState<AlimentoDesglosado[]>([]);
  const [tipoComida, setTipoComida] = useState<TipoComida>('comida');
  const [historial, setHistorial] = useState<Comida[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [fechaSeleccionada, setFechaSeleccionada] = useState(hoy);
  const [mesCalendario, setMesCalendario] = useState(new Date());
  const [pestana, setPestana] = useState<'comidas' | 'salud' | 'calendario' | 'metas' | 'graficas'>('comidas');
  const [tipoGrafica, setTipoGrafica] = useState<TipoGrafica>('semanal');

  // 📋 Datos de salud (con frecuencia cardíaca)
  const [datosSalud, setDatosSalud] = useState<DatosSaludDiarios>({
    fecha: hoy, pasos: 0, caloriasQuemadas: 0, horasSueno: 0,
    pesoKg: 0, masaMagraKg: 0, frecuenciaCardiaca: 0,
  });

  // 🎯 Meta semanal inteligente
  const [metaSemanal, setMetaSemanal] = useState<MetaSemanal | null>(null);
  const [mostrarPedirMeta, setMostrarPedirMeta] = useState(false);
  const [objetivoTemp, setObjetivoTemp] = useState<ObjetivoSemanal>('mantener');
  const [pesoTemp, setPesoTemp] = useState(0);

  // ✅ Cargar datos guardados
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
        // ¿Es de esta semana? Si no → pedir nueva meta
        if (m.semanaInicio !== lunesSemana) {
          setMostrarPedirMeta(true);
          setPesoTemp(m.pesoInicial);
        }
      } else {
        setMostrarPedirMeta(true); // Primera vez
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

  // ✅ Cambiar fecha → cargar datos de ese día
  useEffect(() => {
    try {
      const saludGuardada = localStorage.getItem('datosSalud');
      if (saludGuardada) {
        const todos = JSON.parse(saludGuardada);
        if (todos[fechaSeleccionada]) {
          setDatosSalud({ ...todos[fechaSeleccionada], fecha: fechaSeleccionada });
        } else {
          setDatosSalud({ fecha: fechaSeleccionada, pasos: 0, caloriasQuemadas: 0, horasSueno: 0, pesoKg: 0, masaMagraKg: 0, frecuenciaCardiaca: 0 });
        }
      }
    } catch (e) {}
  }, [fechaSeleccionada]);

  // 💾 Guardar meta semanal
  const guardarMetaSemanal = () => {
    const metasCalc = calcularMetasPorObjetivo(objetivoTemp, pesoTemp);
    const nuevaMeta: MetaSemanal = {
      semanaInicio: lunesSemana,
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
        setMensaje('❌ No hay datos. Revisa tu clave API en .env');
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
    if (nuevosGramos < 10) return;
    const alimento = listaAlimentos.find(a => a.id === id);
    if (!alimento) return;
    const nutrientes = await obtenerNutrientes(alimento.nombre, nuevosGramos);
    setListaAlimentos(prev => prev.map(a => a.id === id ? { ...a, gramos: nuevosGramos, nutrientes } : a));
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
    const comida: Comida = { id: crypto.randomUUID(), tipo: tipoComida, alimentos: listaAlimentos, fecha: new Date(fechaSeleccionada), total };
    const nuevoHistorial = [comida, ...historial];
    localStorage.setItem('historialComidas', JSON.stringify(nuevoHistorial));
    setHistorial(nuevoHistorial);
    setListaAlimentos([]);
    setTextoDictado('');
    setMensaje('✅ Comida guardada');
  };

  const guardarDatosSalud = () => {
    const todos = JSON.parse(localStorage.getItem('datosSalud') || '{}');
    todos[fechaSeleccionada] = datosSalud;
    localStorage.setItem('datosSalud', JSON.stringify(todos));
    setMensaje('✅ Datos de salud guardados');
  };

  const exportarTodo = () => {
    let csv = 'Tipo,Fecha,Alimento,Gramos,Calorías,Proteína,Carbohidratos,Grasas,Fibra,Hierro,Calcio,Potasio,Magnesio,Vitamina C,Vitamina A\n';
    historial.forEach(c => {
      const fecha = new Date(c.fecha).toLocaleDateString();
      c.alimentos.forEach(a => {
        csv += `${c.tipo},${fecha},"${a.nombre}",${a.gramos},${a.nutrientes.calorias},${a.nutrientes.proteina},${a.nutrientes.carbohidratos},${a.nutrientes.grasas},${a.nutrientes.fibra},${a.nutrientes.hierro},${a.nutrientes.calcio},${a.nutrientes.potasio},${a.nutrientes.magnesio},${a.nutrientes.vitaminaC},${a.nutrientes.vitaminaA}\n`;
      });
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Salud_${hoy}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMensaje('✅ Archivo descargado');
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

  const comidasDelDia = historial.filter(c => new Date(c.fecha).toISOString().split('T')[0] === fechaSeleccionada);
  const totalDelDia = sumarNutrientes(comidasDelDia.map(c => c.total));

  // 📊 Preparar datos para gráficas según período
  const datosGrafica = useMemo(() => {
    const agrupar: Record<string, { peso: number; proteina: number; calorias: number; caloriasQ: number; dias: number }> = {};
    const todosSalud = JSON.parse(localStorage.getItem('datosSalud') || '{}');

    historial.forEach(c => {
      const f = new Date(c.fecha);
      let clave = '';
      if (tipoGrafica === 'semanal') clave = f.toLocaleDateString('es-MX', { weekday: 'short' });
      else if (tipoGrafica === 'mensual') clave = `${f.getDate()}`;
      else clave = f.toLocaleDateString('es-MX', { month: 'short' });

      if (!agrupar[clave]) agrupar[clave] = { peso: 0, proteina: 0, calorias: 0, caloriasQ: 0, dias: 0 };
      agrupar[clave].calorias += c.total.calorias;
      agrupar[clave].proteina += c.total.proteina;
      agrupar[clave].dias += 1;
    });

    Object.entries(todosSalud).forEach(([fecha, datos]: [string, any]) => {
      const f = new Date(fecha);
      let clave = '';
      if (tipoGrafica === 'semanal') clave = f.toLocaleDateString('es-MX', { weekday: 'short' });
      else if (tipoGrafica === 'mensual') clave = `${f.getDate()}`;
      else clave = f.toLocaleDateString('es-MX', { month: 'short' });

      if (!agrupar[clave]) agrupar[clave] = { peso: 0, proteina: 0, calorias: 0, caloriasQ: 0, dias: 1 };
      if (datos.pesoKg) agrupar[clave].peso = datos.pesoKg;
      if (datos.caloriasQuemadas) agrupar[clave].caloriasQ = datos.caloriasQuemadas;
    });

    return agrupar;
  }, [historial, tipoGrafica]);

  const etiquetas = Object.keys(datosGrafica);
  const datosPeso = etiquetas.map(d => datosGrafica[d].peso || null);
  const datosProteina = etiquetas.map(d => Math.round(datosGrafica[d].proteina / (datosGrafica[d].dias || 1)));
  const datosCalorias = etiquetas.map(d => Math.round(datosGrafica[d].calorias / (datosGrafica[d].dias || 1)));
  const datosQuemadas = etiquetas.map(d => Math.round(datosGrafica[d].caloriasQ / (datosGrafica[d].dias || 1)));

  // 🎯 Recomendación balance
  const recomendacionSalud = () => {
    if (!metaSemanal) return { texto: 'Configura tu meta semanal', color: '#e5e7eb' };
    const saldo = totalDelDia.calorias - datosSalud.caloriasQuemadas;
    if (metaSemanal.objetivo === 'bajar_peso' && saldo < -300) return { texto: '✅ Vas por buen camino para bajar de peso', color: '#dbeafe' };
    if (metaSemanal.objetivo === 'ganar_musculo' && totalDelDia.proteina >= metaSemanal.proteinaObjetivo) return { texto: '✅ ¡Excelente! Cumpliste tu meta de proteína', color: '#d1fae5' };
    if (metaSemanal.objetivo === 'subir_peso' && saldo > 300) return { texto: '✅ Estás consumiendo suficiente para subir de peso', color: '#fef3c7' };
    return { texto: '💡 Ajusta porciones o actividad para alcanzar tu meta', color: '#fef9c3' };
  };

  const consejos = generarConsejos(totalDelDia);

  return (
    <div style={{ maxWidth: '750px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>💚 Salud con Huawei</h1>

      {/* 📅 Fecha */}
      <div style={{ margin: '10px 0', textAlign: 'center' }}>
        <label style={{ fontWeight: 'bold', marginRight: '10px' }}>📅 Fecha:</label>
        <input type="date" value={fechaSeleccionada} onChange={(e) => setFechaSeleccionada(e.target.value)} style={{ padding: '6px 10px', fontSize: '16px', borderRadius: '6px', border: '1px solid #ccc' }} />
      </div>

      {/* 🎯 Modal: Pedir meta semanal cada lunes */}
      {mostrarPedirMeta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '25px', borderRadius: '12px', maxWidth: '420px', width: '100%' }}>
            <h2>🎯 Meta para esta semana</h2>
            <p style={{ color: '#6b7280', marginBottom: '15px' }}>Semana del {new Date(lunesSemana).toLocaleDateString('es-MX')}</p>

            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>¿Qué quieres lograr?</label>
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
                  display: 'block', width: '100%', padding: '10px', margin: '4px 0', textAlign: 'left',
                  background: objetivoTemp === opt.v ? '#d1fae5' : '#f3f4f6',
                  border: objetivoTemp === opt.v ? '2px solid #10b981' : '2px solid transparent',
                  borderRadius: '6px', cursor: 'pointer', fontSize: '15px',
                }}
              >
                {opt.t}
              </button>
            ))}

            <div style={{ marginTop: '15px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Tu peso actual (kg):</label>
              <input
                type="number" step="0.1" value={pesoTemp || ''}
                onChange={(e) => setPesoTemp(parseFloat(e.target.value) || 0)}
                placeholder="Ej: 72.5"
                style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '6px', border: '1px solid #ccc' }}
              />
            </div>

            <button
              onClick={guardarMetaSemanal}
              disabled={!pesoTemp}
              style={{
                marginTop: '20px', width: '100%', padding: '12px', fontSize: '16px',
                background: pesoTemp ? '#10b981' : '#9ca3af',
                color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer',
              }}
            >
              ✅ Calcular mi meta
            </button>
          </div>
        </div>
      )}

      {/* 🎯 Meta actual */}
      {metaSemanal && !mostrarPedirMeta && (
        <div style={{ margin: '12px 0', padding: '12px', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
          <strong>🎯 Meta semanal:</strong> {
            { bajar_peso: '🔽 Bajar de peso', mantener: '⚖️ Mantener peso', subir_peso: '📈 Subir de peso', ganar_musculo: '💪 Ganar masa muscular' }[metaSemanal.objetivo]
          }
          <br />🔥 Objetivo: ~{metaSemanal.caloriasObjetivo} kcal | 🥩 {metaSemanal.proteinaObjetivo}g proteína
        </div>
      )}

      {/* ⚠️ Mensajes */}
      {mensaje && <div style={{ margin: '10px 0', padding: '10px', background: '#fef9c3', borderRadius: '6px' }}>{mensaje}</div>}

      {/* 🔘 Pestañas */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '15px 0' }}>
        {[
          { id: 'comidas', etiqueta: '🍽️ Comidas' },
          { id: 'salud', etiqueta: '📋 Salud' },
          { id: 'calendario', etiqueta: '📅 Calendario' },
          { id: 'graficas', etiqueta: '📈 Gráficas' },
        ].map(p => (
          <button
            key={p.id}
            onClick={() => setPestana(p.id as any)}
            style={{
              padding: '8px 12px', fontSize: '14px',
              background: pestana === p.id ? '#10b981' : '#e5e7eb',
              color: pestana === p.id ? 'white' : 'black',
              border: 'none', borderRadius: '6px', cursor: 'pointer',
            }}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {/* ────────────────────────────── */}
      {/* 🍽️ COMIDAS */}
      {/* ────────────────────────────── */}
      {pestana === 'comidas' && (
        <div>
          <h3>¿Qué vas a registrar?</h3>
          {(['desayuno', 'comida', 'cena', 'merienda'] as TipoComida[]).map(tipo => (
            <button
              key={tipo}
              onClick={() => setTipoComida(tipo)}
              style={{
                padding: '8px 12px', margin: '4px', fontSize: '15px',
                background: tipoComida === tipo ? '#10b981' : '#e5e7eb',
                color: tipoComida === tipo ? 'white' : 'black',
                border: 'none', borderRadius: '6px', cursor: 'pointer',
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

          <div style={{ margin: '15px 0', padding: '12px', background: '#fef3c7', borderRadius: '8px' }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>✍️ O escribe:</p>
            <input
              type="text" value={textoDictado} onChange={(e) => setTextoDictado(e.target.value)}
              placeholder="Ej: 200g de pollo y 50g de quinoa"
              style={{ width: '100%', padding: '8px', fontSize: '16px', borderRadius: '6px', border: '1px solid #ccc' }}
            />
          </div>

          {textoDictado && textoDictado.trim().length > 0 && (
            <div style={{ margin: '15px 0', padding: '12px', background: '#f0fdf4', borderRadius: '8px' }}>
              🗣️ Dijiste: <strong>{textoDictado}</strong>
              <button
                onClick={analizarComida} disabled={cargando}
                style={{ marginTop: '10px', padding: '10px 20px', fontSize: '16px', background: cargando ? '#9ca3af' : '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: cargando ? 'not-allowed' : 'pointer', width: '100%' }}
              >
                {cargando ? '🔍 Buscando...' : '📊 Analizar comida'}
              </button>
            </div>
          )}

          {listaAlimentos.length > 0 && !cargando && (
            <div style={{ margin: '20px 0' }}>
              <h4>🍽️ Alimentos:</h4>
              {listaAlimentos.map((alimento, idx) => (
                <div key={alimento.id} style={{ padding: '12px', margin: '8px 0', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{idx + 1}. {alimento.gramos}g de {alimento.nombre}</strong>
                    <div>
                      <button onClick={() => { const n = prompt('Nueva cantidad:', alimento.gramos.toString()); if (n && parseInt(n) >= 10) cambiarGramos(alimento.id, parseInt(n)); }} style={{ margin: '0 4px', padding: '2px 6px' }}>✏️</button>
                      <button onClick={() => quitarAlimento(alimento.id)} style={{ margin: '0 4px', padding: '2px 6px', color: 'red' }}>❌</button>
                    </div>
                  </div>
                  <DesgloseNutrientes nutrientes={alimento.nutrientes} />
                </div>
              ))}
              <div style={{ marginTop: '15px', padding: '12px', background: '#ecfdf5', borderRadius: '6px', border: '2px solid #10b981' }}>
                <h4>📊 SUMA TOTAL:</h4>
                <DesgloseNutrientes nutrientes={sumarNutrientes(listaAlimentos.map(a => a.nutrientes))} />
              </div>
              <button onClick={guardarComida} style={{ marginTop: '15px', padding: '10px 20px', fontSize: '16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', width: '100%' }}>💾 Guardar comida</button>
            </div>
          )}

          {comidasDelDia.length > 0 && (
            <div style={{ marginTop: '30px' }}>
              <h3>📋 Comidas del día</h3>
              {comidasDelDia.map(c => (
                <div key={c.id} style={{ padding: '10px', margin: '6px 0', background: '#f3f4f6', borderRadius: '6px' }}>
                  <strong>{c.tipo.charAt(0).toUpperCase() + c.tipo.slice(1)}</strong> — {c.alimentos.length} alimento(s)
                  <br />🔥 {Math.round(c.total.calorias)} kcal | 🥩 {Math.round(c.total.proteina)}g proteína
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────── */}
      {/* 📋 DATOS DE SALUD (con frecuencia cardíaca) */}
      {/* ────────────────────────────── */}
      {pestana === 'salud' && (
        <div>
          <h2>📋 Datos del reloj y cuerpo</h2>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>Fecha: {fechaSeleccionada}</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', margin: '15px 0' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>👣 Pasos</label>
              <input type="number" value={datosSalud.pasos || ''} onChange={(e) => setDatosSalud({ ...datosSalud, pasos: Number(e.target.value) })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>🔥 Calorías quemadas</label>
              <input type="number" value={datosSalud.caloriasQuemadas || ''} onChange={(e) => setDatosSalud({ ...datosSalud, caloriasQuemadas: Number(e.target.value) })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>💓 Frecuencia cardíaca (ppm)</label>
              <input type="number" value={datosSalud.frecuenciaCardiaca || ''} onChange={(e) => setDatosSalud({ ...datosSalud, frecuenciaCardiaca: Number(e.target.value) })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>😴 Horas de sueño</label>
              <input type="number" step="0.1" value={datosSalud.horasSueno || ''} onChange={(e) => setDatosSalud({ ...datosSalud, horasSueno: Number(e.target.value) })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>⚖️ Peso (kg)</label>
              <input type="number" step="0.1" value={datosSalud.pesoKg || ''} onChange={(e) => setDatosSalud({ ...datosSalud, pesoKg: Number(e.target.value) })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>💪 Masa magra (kg)</label>
              <input type="number" step="0.1" value={datosSalud.masaMagraKg || ''} onChange={(e) => setDatosSalud({ ...datosSalud, masaMagraKg: Number(e.target.value) })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>
          </div>

          <button onClick={guardarDatosSalud} style={{ padding: '10px 20px', fontSize: '16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', width: '100%' }}>💾 Guardar datos de salud</button>

          {comidasDelDia.length > 0 && datosSalud.caloriasQuemadas > 0 && metaSemanal && (
            <div style={{ marginTop: '25px', padding: '15px', borderRadius: '8px', background: recomendacionSalud().color }}>
              <h3>🎯 Balance del día</h3>
              <p><strong>Consumidas:</strong> {Math.round(totalDelDia.calorias)} kcal | <strong>Quemadas:</strong> {datosSalud.caloriasQuemadas} kcal</p>
              <p><strong>Proteína:</strong> {Math.round(totalDelDia.proteina)}g / Meta: {metaSemanal.proteinaObjetivo}g</p>
              <p style={{ fontWeight: 'bold' }}>{recomendacionSalud().texto}</p>
              {consejos && consejos.length > 0 && <Consejos consejos={consejos} />}
              <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}>
                <strong>📋 Esta semana te recomiendo:</strong>
                <ul style={{ margin: "6px 0", paddingLeft: "20px" }}>
                  {metaSemanal.recomendaciones.map((r, i) => <li key={i} style={{ margin: '3px 0', fontSize: '14px' }}>{r}</li>)}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────── */}
      {/* 📅 CALENDARIO */}
      {/* ────────────────────────────── */}
      {pestana === 'calendario' && (
        <div>
          <h2>📅 Calendario</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '10px 0' }}>
            <button onClick={() => setMesCalendario(new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() - 1))} style={{ padding: '6px 12px' }}>◀️</button>
            <strong>{mesCalendario.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</strong>
            <button onClick={() => setMesCalendario(new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() + 1))} style={{ padding: '6px 12px' }}>▶️</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
            {['D','L','M','M','J','V','S'].map(d => <div key={d} style={{ fontWeight: 'bold', padding: '6px' }}>{d}</div>)}
            {diasDelMes().map((dia, i) => {
              if (!dia) return <div key={i} />;
              const fechaDia = `${mesCalendario.getFullYear()}-${String(mesCalendario.getMonth()+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
              const tiene = historial.some(c => new Date(c.fecha).toISOString().split('T')[0] === fechaDia);
              const esHoy = fechaDia === hoy;
              const sel = fechaDia === fechaSeleccionada;
              return (
                <button key={i} onClick={() => setFechaSeleccionada(fechaDia)} style={{
                  padding: '8px 4px', fontSize: '14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  background: sel ? '#10b981' : tiene ? '#bbf7d0' : esHoy ? '#e5e7eb' : 'transparent',
                  color: sel ? 'white' : 'black', fontWeight: esHoy ? 'bold' : 'normal',
                }}>{dia}</button>
              );
            })}
          </div>
          <div style={{ marginTop: '20px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
            <h3>📋 Datos de: {fechaSeleccionada}</h3>
            {comidasDelDia.length === 0 ? <p>Sin comidas registradas</p> : comidasDelDia.map(c => (
              <div key={c.id} style={{ margin: '4px 0' }}>
                <strong>{c.tipo.charAt(0).toUpperCase() + c.tipo.slice(1)}</strong> — {Math.round(c.total.calorias)} kcal | {Math.round(c.total.proteina)}g proteína
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ────────────────────────────── */}
      {/* 📈 GRÁFICAS */}
      {/* ────────────────────────────── */}
      {pestana === 'graficas' && (
        <div>
          <h2>📈 Seguimiento</h2>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {(['semanal', 'mensual', 'anual'] as TipoGrafica[]).map(tipo => (
              <button
                key={tipo}
                onClick={() => setTipoGrafica(tipo)}
                style={{
                  padding: '8px 16px', fontSize: '15px',
                  background: tipoGrafica === tipo ? '#10b981' : '#e5e7eb',
                  color: tipoGrafica === tipo ? 'white' : 'black',
                  border: 'none', borderRadius: '6px', cursor: 'pointer',
                }}
              >
                {tipo === 'semanal' && '📅 Semanal'}
                {tipo === 'mensual' && '📆 Mensual'}
                {tipo === 'anual' && '🗓️ Anual'}
              </button>
            ))}
          </div>

          {etiquetas.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '30px', color: '#6b7280' }}>Aún no hay suficientes datos para mostrar gráficas. Sigue registrando tus comidas y salud.</p>
          ) : (
            <>
              {/* ⚖️ Peso */}
              {datosPeso.some(p => p && p > 0) && (
                <div style={{ marginBottom: '25px', padding: '15px', background: '#f9fafb', borderRadius: '8px' }}>
                  <h3>⚖️ Evolución de peso (kg)</h3>
                  <Line data={{
                    labels: etiquetas,
                    datasets: [{ label: 'Peso kg', data: datosPeso, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', tension: 0.3, fill: true }]
                  }} options={{ responsive: true, plugins: { legend: { display: false } } }} />
                </div>
              )}

              {/* 🥩 Proteína */}
              <div style={{ marginBottom: '25px', padding: '15px', background: '#f9fafb', borderRadius: '8px' }}>
                <h3>🥩 Proteína consumida (g)</h3>
                <Bar data={{
                  labels: etiquetas,
                  datasets: [
                    { label: 'Proteína', data: datosProteina, backgroundColor: '#10b981' },
                    ...(metaSemanal ? [{ label: 'Meta', data: etiquetas.map(() => metaSemanal.proteinaObjetivo), borderColor: '#ef4444', borderWidth: 2, type: 'line' as const, fill: false }] : []),
                  ]
                }} options={{ responsive: true }} />
              </div>

              {/* 🔥 Calorías consumidas vs quemadas */}
              <div style={{ marginBottom: '25px', padding: '15px', background: '#f9fafb', borderRadius: '8px' }}>
                <h3>🔥 Calorías: Consumidas vs Quemadas</h3>
                <Bar data={{
                  labels: etiquetas,
                  datasets: [
                    { label: 'Consumidas', data: datosCalorias, backgroundColor: '#f59e0b' },
                    { label: 'Quemadas', data: datosQuemadas, backgroundColor: '#ef4444' },
                  ]
                }} options={{ responsive: true }} />
              </div>

              <button onClick={exportarTodo} style={{ marginTop: '10px', padding: '10px 20px', fontSize: '15px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', width: '100%' }}>📤 Exportar todo a Excel (.csv)</button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default App;