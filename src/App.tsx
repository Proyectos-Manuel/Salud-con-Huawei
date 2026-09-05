import React, { useState, useEffect } from 'react';
import EntradaVoz from './components/EntradaVoz';
import DesgloseNutrientes from './components/DesgloseNutrientes';
import Consejos from './components/Consejos';
import { desglosarAlimentos, obtenerNutrientes, sumarNutrientes, generarConsejos } from './services/nutricionAPI';
import type { AlimentoDesglosado, Comida, DatosSaludDiarios, MetasUsuario } from './types';

type TipoComida = 'desayuno' | 'comida' | 'cena' | 'merienda';

const App: React.FC = () => {
  const [textoDictado, setTextoDictado] = useState('');
  const [cargando, setCargando] = useState(false);
  const [listaAlimentos, setListaAlimentos] = useState<AlimentoDesglosado[]>([]);
  const [, setComidaGuardada] = useState<Comida | null>(null);
  const [tipoComida, setTipoComida] = useState<TipoComida>('comida');
  const [historial, setHistorial] = useState<Comida[]>([]);
  const [mensaje, setMensaje] = useState('');

  // 📅 Calendario y fecha seleccionada
  const hoy = new Date().toISOString().split('T')[0];
  const [fechaSeleccionada, setFechaSeleccionada] = useState(hoy);
  const [mesCalendario, setMesCalendario] = useState(new Date());

  // 📋 Datos de salud del día
  const [datosSalud, setDatosSalud] = useState<DatosSaludDiarios>({
    fecha: hoy,
    pasos: 0,
    caloriasQuemadas: 0,
    horasSueno: 0,
    pesoKg: 0,
    masaMagraKg: 0,
  });

  // 🎯 Metas del usuario
  const [metas, setMetas] = useState<MetasUsuario>({
    caloriasDiarias: 2000,
    proteinaGramos: 80,
    caloriasQuemadas: 500,
    pasos: 8000,
  });

  // 📊 Pestañas
  const [pestana, setPestana] = useState<'comidas' | 'salud' | 'calendario' | 'metas' | 'resumen'>('comidas');

  // ✅ Cargar datos guardados
  useEffect(() => {
    try {
      const guardado = localStorage.getItem('historialComidas');
      if (guardado) setHistorial(JSON.parse(guardado));
    } catch (e) { console.log('Sin historial'); }

    try {
      const saludGuardada = localStorage.getItem('datosSalud');
      if (saludGuardada) setDatosSalud(JSON.parse(saludGuardada));
    } catch (e) {}

    try {
      const metasGuardadas = localStorage.getItem('metasUsuario');
      if (metasGuardadas) setMetas(JSON.parse(metasGuardadas));
    } catch (e) {}
  }, []);

  // ✅ Cambiar fecha → cargar datos de ese día
  useEffect(() => {
    const guardado = localStorage.getItem('datosSalud');
    if (guardado) {
      const todos = JSON.parse(guardado);
      if (todos[fechaSeleccionada]) {
        setDatosSalud({ ...todos[fechaSeleccionada], fecha: fechaSeleccionada });
      } else {
        setDatosSalud({ fecha: fechaSeleccionada, pasos: 0, caloriasQuemadas: 0, horasSueno: 0, pesoKg: 0, masaMagraKg: 0 });
      }
    }
  }, [fechaSeleccionada]);

  const alRecibirTexto = (texto: string) => {
    setMensaje('');
    setComidaGuardada(null);
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
        lista.push({
          id: crypto.randomUUID(),
          textoOriginal: parte.texto,
          nombre: parte.nombre,
          gramos: parte.gramos,
          nutrientes,
          confirmado: true,
        });
      }

      if (lista.length === 0) {
        setMensaje('❌ No hay datos. Revisa tu clave API en .env');
      } else {
        setMensaje(`✅ ¡Listo! ${lista.length} alimentos analizados`);
        setListaAlimentos(lista);
      }
    } catch (err) {
      console.error(err);
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

  // 💾 Guardar comida con fecha
  const guardarComida = () => {
    if (listaAlimentos.length === 0) {
      setMensaje('⚠️ No hay alimentos para guardar');
      return;
    }
    const total = sumarNutrientes(listaAlimentos.map(a => a.nutrientes));
    const comida: Comida = {
      id: crypto.randomUUID(),
      tipo: tipoComida,
      alimentos: listaAlimentos,
      fecha: new Date(fechaSeleccionada),
      total,
    };
    const nuevoHistorial = [comida, ...historial];
    localStorage.setItem('historialComidas', JSON.stringify(nuevoHistorial));
    setHistorial(nuevoHistorial);
    setComidaGuardada(comida);
    setListaAlimentos([]);
    setTextoDictado('');
  };

  // 💾 Guardar datos de salud
  const guardarDatosSalud = () => {
    const todos = JSON.parse(localStorage.getItem('datosSalud') || '{}');
    todos[fechaSeleccionada] = datosSalud;
    localStorage.setItem('datosSalud', JSON.stringify(todos));
    setMensaje('✅ Datos de salud guardados');
  };

  // 💾 Guardar metas
  const guardarMetas = () => {
    localStorage.setItem('metasUsuario', JSON.stringify(metas));
    setMensaje('✅ Metas guardadas');
  };

  // 📤 Exportar todo
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
    a.download = `Salud_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMensaje('✅ Archivo descargado');
  };

  // 📅 Generar días del mes para calendario
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

  // 📊 Comidas de la fecha seleccionada
  const comidasDelDia = historial.filter(c => {
    const fechaComida = new Date(c.fecha).toISOString().split('T')[0];
    return fechaComida === fechaSeleccionada;
  });

  const totalDelDia = sumarNutrientes(comidasDelDia.map(c => c.total));

  // 🎯 Recomendación según balance
  const recomendacionSalud = () => {
    const saldoCalorias = totalDelDia.calorias - datosSalud.caloriasQuemadas;
    if (saldoCalorias < -300) return { texto: '🔽 Estás quemando más calorías de las que consumes → ideal para bajar de peso', color: '#dbeafe' };
    if (saldoCalorias > 300) return { texto: '🔼 Consumes más de lo que quemas → cuida las porciones para mantener peso', color: '#fef3c7' };
    return { texto: '✅ Balance excelente → mantienes tu peso ideal', color: '#d1fae5' };
  };

  const consejos = generarConsejos(totalDelDia);

  return (
    <div style={{ maxWidth: '750px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>💚 Salud con Huawei</h1>

      {/* 📅 Selector de fecha */}
      <div style={{ margin: '15px 0', textAlign: 'center' }}>
        <label style={{ fontWeight: 'bold', marginRight: '10px' }}>📅 Fecha:</label>
        <input
          type="date"
          value={fechaSeleccionada}
          onChange={(e) => setFechaSeleccionada(e.target.value)}
          style={{ padding: '6px 10px', fontSize: '16px', borderRadius: '6px', border: '1px solid #ccc' }}
        />
      </div>

      {/* 🔘 Pestañas */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '15px 0' }}>
        {[
          { id: 'comidas', etiqueta: '🍽️ Comidas' },
          { id: 'salud', etiqueta: '📋 Datos Salud' },
          { id: 'calendario', etiqueta: '📅 Calendario' },
          { id: 'metas', etiqueta: '🎯 Metas' },
          { id: 'resumen', etiqueta: '📊 Resumen' },
        ].map(p => (
          <button
            key={p.id}
            onClick={() => setPestana(p.id as any)}
            style={{
              padding: '8px 12px',
              fontSize: '14px',
              background: pestana === p.id ? '#10b981' : '#e5e7eb',
              color: pestana === p.id ? 'white' : 'black',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {/* ⚠️ Mensajes */}
      {mensaje && (
        <div style={{ margin: '10px 0', padding: '10px', background: '#fef9c3', borderRadius: '6px' }}>
          {mensaje}
        </div>
      )}

      {/* ────────────────────────────── */}
      {/* 🍽️ PESTANA: COMIDAS */}
      {/* ────────────────────────────── */}
      {pestana === 'comidas' && (
        <div>
          <h3>¿Qué vas a registrar hoy?</h3>
          {(['desayuno', 'comida', 'cena', 'merienda'] as TipoComida[]).map(tipo => (
            <button
              key={tipo}
              onClick={() => setTipoComida(tipo)}
              style={{
                padding: '8px 12px',
                margin: '4px',
                fontSize: '15px',
                background: tipoComida === tipo ? '#10b981' : '#e5e7eb',
                color: tipoComida === tipo ? 'white' : 'black',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
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
              type="text"
              value={textoDictado}
              onChange={(e) => setTextoDictado(e.target.value)}
              placeholder="Ej: 200g de pollo y 50g de quinoa"
              style={{ width: '100%', padding: '8px', fontSize: '16px', borderRadius: '6px', border: '1px solid #ccc' }}
            />
          </div>

          {textoDictado && textoDictado.trim().length > 0 && (
            <div style={{ margin: '15px 0', padding: '12px', background: '#f0fdf4', borderRadius: '8px' }}>
              🗣️ Dijiste: <strong>{textoDictado}</strong>
              <button
                onClick={analizarComida}
                disabled={cargando}
                style={{
                  marginTop: '10px',
                  padding: '10px 20px',
                  fontSize: '16px',
                  background: cargando ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: cargando ? 'not-allowed' : 'pointer',
                  width: '100%',
                }}
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
                      <button onClick={() => {
                        const nuevos = prompt('Nueva cantidad:', alimento.gramos.toString());
                        if (nuevos && parseInt(nuevos) >= 10) cambiarGramos(alimento.id, parseInt(nuevos));
                      }} style={{ margin: '0 4px', padding: '2px 6px', border: 'none', background: '#e5e7eb', borderRadius: '4px', cursor: 'pointer' }}>✏️</button>
                      <button onClick={() => quitarAlimento(alimento.id)} style={{ margin: '0 4px', padding: '2px 6px', border: 'none', background: '#fee2e2', borderRadius: '4px', cursor: 'pointer', color: 'red' }}>❌</button>
                    </div>
                  </div>
                  <DesgloseNutrientes nutrientes={alimento.nutrientes} />
                </div>
              ))}

              <div style={{ marginTop: '15px', padding: '12px', background: '#ecfdf5', borderRadius: '6px', border: '2px solid #10b981' }}>
                <h4>📊 SUMA TOTAL:</h4>
                <DesgloseNutrientes nutrientes={sumarNutrientes(listaAlimentos.map(a => a.nutrientes))} />
              </div>

              <button
                onClick={guardarComida}
                style={{ marginTop: '15px', padding: '10px 20px', fontSize: '16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', width: '100%' }}
              >
                💾 Guardar esta comida
              </button>
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
      {/* 📋 PESTANA: DATOS DE SALUD */}
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
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>😴 Horas de sueño</label>
              <input type="number" step="0.1" value={datosSalud.horasSueno || ''} onChange={(e) => setDatosSalud({ ...datosSalud, horasSueno: Number(e.target.value) })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>⚖️ Peso (kg)</label>
              <input type="number" step="0.1" value={datosSalud.pesoKg || ''} onChange={(e) => setDatosSalud({ ...datosSalud, pesoKg: Number(e.target.value) })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>💪 Masa magra (kg)</label>
              <input type="number" step="0.1" value={datosSalud.masaMagraKg || ''} onChange={(e) => setDatosSalud({ ...datosSalud, masaMagraKg: Number(e.target.value) })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>
          </div>

          <button onClick={guardarDatosSalud} style={{ padding: '10px 20px', fontSize: '16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', width: '100%' }}>
            💾 Guardar datos de salud
          </button>

          {/* 🎯 Recomendación inteligente */}
          {comidasDelDia.length > 0 && datosSalud.caloriasQuemadas > 0 && (
            <div style={{ marginTop: '25px', padding: '15px', borderRadius: '8px', background: recomendacionSalud().color }}>
              <h3>🎯 Balance del día</h3>
              <p><strong>Calorías consumidas:</strong> {Math.round(totalDelDia.calorias)} kcal</p>
              <p><strong>Calorías quemadas:</strong> {datosSalud.caloriasQuemadas} kcal</p>
              <p><strong>Saldo:</strong> {Math.round(totalDelDia.calorias - datosSalud.caloriasQuemadas)} kcal</p>
              <p style={{ marginTop: '10px', fontWeight: 'bold' }}>{recomendacionSalud().texto}</p>
              {consejos && consejos.length > 0 && <Consejos consejos={consejos} />}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────── */}
      {/* 📅 PESTANA: CALENDARIO */}
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
              const tieneDatos = historial.some(c => new Date(c.fecha).toISOString().split('T')[0] === fechaDia);
              const esHoy = fechaDia === hoy;
              const seleccionado = fechaDia === fechaSeleccionada;
              return (
                <button
                  key={i}
                  onClick={() => setFechaSeleccionada(fechaDia)}
                  style={{
                    padding: '8px 4px',
                    fontSize: '14px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: seleccionado ? '#10b981' : tieneDatos ? '#bbf7d0' : esHoy ? '#e5e7eb' : 'transparent',
                    color: seleccionado ? 'white' : 'black',
                    fontWeight: esHoy ? 'bold' : 'normal',
                  }}
                >
                  {dia}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: '20px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
            <h3>📋 Datos de: {fechaSeleccionada}</h3>
            {comidasDelDia.length === 0 ? <p>Sin comidas registradas</p> : (
              <div>
                {comidasDelDia.map(c => (
                  <div key={c.id} style={{ margin: '4px 0' }}>
                    <strong>{c.tipo.charAt(0).toUpperCase() + c.tipo.slice(1)}</strong> — {Math.round(c.total.calorias)} kcal
                  </div>
                ))}
                <hr style={{ margin: '8px 0' }} />
                <strong>Total: {Math.round(totalDelDia.calorias)} kcal | {Math.round(totalDelDia.proteina)}g proteína</strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────── */}
      {/* 🎯 PESTANA: METAS */}
      {/* ────────────────────────────── */}
      {pestana === 'metas' && (
        <div>
          <h2>🎯 Tus metas diarias</h2>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>Pon tus objetivos y la app te compara cada día</p>

          <div style={{ display: 'grid', gap: '12px', margin: '15px 0' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>🔥 Calorías objetivo</label>
              <input type="number" value={metas.caloriasDiarias} onChange={(e) => setMetas({...metas, caloriasDiarias: Number(e.target.value)})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>🥩 Proteína (gramos)</label>
              <input type="number" value={metas.proteinaGramos} onChange={(e) => setMetas({...metas, proteinaGramos: Number(e.target.value)})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>🔥 Calorías a quemar</label>
              <input type="number" value={metas.caloriasQuemadas} onChange={(e) => setMetas({...metas, caloriasQuemadas: Number(e.target.value)})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>👣 Pasos mínimos</label>
              <input type="number" value={metas.pasos} onChange={(e) => setMetas({...metas, pasos: Number(e.target.value)})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>
          </div>

          <button onClick={guardarMetas} style={{ padding: '10px 20px', fontSize: '16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', width: '100%' }}>
            💾 Guardar mis metas
          </button>
        </div>
      )}

      {/* ────────────────────────────── */}
      {/* 📊 PESTANA: RESUMEN + EXPORTAR */}
      {/* ────────────────────────────── */}
      {pestana === 'resumen' && (
        <div>
          <h2>📊 Resumen y respaldo</h2>

          <button onClick={exportarTodo} style={{ padding: '12px 24px', fontSize: '16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', width: '100%', marginBottom: '20px' }}>
            📤 Exportar todas mis comidas (.csv para Excel)
          </button>

          <h3>Últimos 7 días</h3>
          {(() => {
            const ultimos7: Comida[][] = [];
            const fechas = new Set(historial.map(c => new Date(c.fecha).toISOString().split('T')[0]));
            Array.from(fechas).sort().reverse().slice(0,7).forEach(f => {
              const comidas = historial.filter(c => new Date(c.fecha).toISOString().split('T')[0] === f);
              const total = sumarNutrientes(comidas.map(c => c.total));
              ultimos7.push([{ fecha: f, total }] as any);
            });
            return ultimos7.length === 0 ? <p>Sin datos aún</p> : ultimos7.map((d: any[], i) => (
              <div key={i} style={{ padding: '8px 10px', margin: '4px 0', background: '#f3f4f6', borderRadius: '6px' }}>
                <strong>{new Date(d[0].fecha).toLocaleDateString('es-MX')}</strong> — 🔥 {Math.round(d[0].total.calorias)} kcal | 🥩 {Math.round(d[0].total.proteina)}g proteína
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
};

export default App;