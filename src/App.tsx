import { useState, useEffect } from 'react';
import EntradaVoz from './components/EntradaVoz';
import DesgloseNutrientes from './components/DesgloseNutrientes';
import Consejos from './components/Consejos';
import { analizarComida, generarConsejos } from './services/nutricionAPI';
import { obtenerEnlaceGoogle, leerDatosGoogleFit, obtenerTokenDesdeCodigo } from './services/googleFit';

type DatosSalud = {
  pasos: number;
  caloriasQuemadas: number;
  horasSueno: number;
  frecuenciaCardiaca: number;
  nivelEstres: number;
};

type ComidaGuardada = {
  id: string;
  tipo: 'desayuno' | 'comida' | 'cena' | 'merienda';
  fecha: string;
  hora: string;
  texto: string;
  nutrientes: {
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
};

type RegistroDiarioSalud = {
  fecha: string;
  pasos: number;
  caloriasQuemadas: number;
  horasSueno: number;
  frecuenciaCardiaca: number;
};

function generarConsejosSalud(salud: DatosSalud): string[] {
  const consejos: string[] = [];
  if (salud.pasos > 8000) consejos.push("🏃 Hoy te moviste mucho. Agrega proteínas extra y más agua.");
  else if (salud.pasos < 3000) consejos.push("🚶 Poca actividad hoy. Tus necesidades de calorías son menores.");
  else consejos.push("✅ Buen nivel de actividad hoy.");
  if (salud.horasSueno < 6) consejos.push("😴 Dormiste poco. Aumenta magnesio y vitamina B6.");
  else consejos.push("✅ Buen descanso. Tu cuerpo aprovecha bien los nutrientes.");
  if (salud.nivelEstres > 70) consejos.push("🧘 Estrés alto hoy. Agrega vitamina C y magnesio.");
  if (salud.caloriasQuemadas > 2000) consejos.push("🔥 Gasto alto hoy. Considera carbohidratos de calidad.");
  return consejos;
}

function App() {
  const [cargando, setCargando] = useState(false);
  const [nutrientes, setNutrientes] = useState<any>(null);
  const [consejosNutricion, setConsejosNutricion] = useState<string[]>([]);
  const [textoComida, setTextoComida] = useState('');
  const [datosSalud, setDatosSalud] = useState<DatosSalud>({
    pasos: 0, caloriasQuemadas: 0, horasSueno: 7, frecuenciaCardiaca: 70, nivelEstres: 50,
  });
  const [tokenGoogle, setTokenGoogle] = useState<string | null>(null);
  const [cargandoFit, setCargandoFit] = useState(false);

  // 📋 HISTORIAL DE COMIDAS
  const [comidasGuardadas, setComidasGuardadas] = useState<ComidaGuardada[]>([]);
  const [tipoComidaActiva, setTipoComidaActiva] = useState<'desayuno' | 'comida' | 'cena' | 'merienda'>('desayuno');
  const [verHistorial, setVerHistorial] = useState(false);

  // 📊 HISTORIAL DE DATOS DEL RELOJ POR DÍA
  const [historialSalud, setHistorialSalud] = useState<RegistroDiarioSalud[]>([]);

  // 📅 Obtener fecha de hoy
  const obtenerFechaHoy = () => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;
  };

  // 💾 Cargar TODO el historial al abrir la app
  useEffect(() => {
    const comidas = localStorage.getItem('historialComidas');
    const salud = localStorage.getItem('historialSalud');
    if (comidas) setComidasGuardadas(JSON.parse(comidas));
    if (salud) setHistorialSalud(JSON.parse(salud));
  }, []);

  // 💾 Guardar comidas automáticamente
  useEffect(() => {
    localStorage.setItem('historialComidas', JSON.stringify(comidasGuardadas));
  }, [comidasGuardadas]);

  // 💾 Guardar datos del reloj POR DÍA automáticamente
  useEffect(() => {
    if (datosSalud.pasos > 0 || datosSalud.caloriasQuemadas > 0) {
      const fechaHoy = obtenerFechaHoy();
      setHistorialSalud(prev => {
        const sinHoy = prev.filter(r => r.fecha !== fechaHoy);
        const registroActual: RegistroDiarioSalud = {
          fecha: fechaHoy,
          pasos: datosSalud.pasos,
          caloriasQuemadas: datosSalud.caloriasQuemadas,
          horasSueno: datosSalud.horasSueno,
          frecuenciaCardiaca: datosSalud.frecuenciaCardiaca,
        };
        const nuevo = [...sinHoy, registroActual];
        localStorage.setItem('historialSalud', JSON.stringify(nuevo));
        return nuevo;
      });
    }
  }, [datosSalud.pasos, datosSalud.caloriasQuemadas, datosSalud.horasSueno, datosSalud.frecuenciaCardiaca]);

  // 🔄 Conexión con Google Fit
  useEffect(() => {
    const url = new URL(window.location.href);
    const codigo = url.searchParams.get('code');
    if (codigo) {
      setCargandoFit(true);
      url.searchParams.delete('code');
      window.history.replaceState({}, '', url.toString());
      obtenerTokenDesdeCodigo(codigo).then(async token => {
        if (token) {
          setTokenGoogle(token);
          const datos = await leerDatosGoogleFit(token);
          if (datos) {
            setDatosSalud({
              pasos: datos.pasos, caloriasQuemadas: datos.caloriasQuemadas,
              horasSueno: datos.horasSueno, frecuenciaCardiaca: datos.frecuenciaCardiaca, nivelEstres: 50,
            });
          }
        }
        setCargandoFit(false);
      });
    }
  }, []);

  // ➕ Guardar comida
  const guardarComidaActual = () => {
    if (!nutrientes) return;
    const nuevaComida: ComidaGuardada = {
      id: Date.now().toString(),
      tipo: tipoComidaActiva,
      fecha: obtenerFechaHoy(),
      hora: new Date().toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'}),
      texto: textoComida,
      nutrientes: { ...nutrientes }
    };
    setComidasGuardadas(prev => [...prev, nuevaComida]);
    alert(`✅ ${tipoComidaActiva.toUpperCase()} guardada!`);
  };

  // 📊 Resumen del día
  const comidasDeHoy = comidasGuardadas.filter(c => c.fecha === obtenerFechaHoy());
  const resumenHoy = comidasDeHoy.reduce((total, c) => ({
    proteina: total.proteina + c.nutrientes.proteina,
    grasas: total.grasas + c.nutrientes.grasas,
    carbohidratos: total.carbohidratos + c.nutrientes.carbohidratos,
    fibra: total.fibra + c.nutrientes.fibra,
    calorias: total.calorias + c.nutrientes.calorias,
    hierro: total.hierro + c.nutrientes.hierro,
    calcio: total.calcio + c.nutrientes.calcio,
    potasio: total.potasio + c.nutrientes.potasio,
    magnesio: total.magnesio + c.nutrientes.magnesio,
    vitaminaC: total.vitaminaC + c.nutrientes.vitaminaC,
    vitaminaA: total.vitaminaA + c.nutrientes.vitaminaA,
  }), { proteina:0, grasas:0, carbohidratos:0, fibra:0, calorias:0, hierro:0, calcio:0, potasio:0, magnesio:0, vitaminaC:0, vitaminaA:0 });

  // 📈 Promedios de la última semana
  const ultimaSemana = historialSalud.slice(-7);
  const promedioPasos = ultimaSemana.length ? Math.round(ultimaSemana.reduce((s, r) => s + r.pasos, 0) / ultimaSemana.length) : 0;
  const promedioCalorias = ultimaSemana.length ? Math.round(ultimaSemana.reduce((s, r) => s + r.caloriasQuemadas, 0) / ultimaSemana.length) : 0;
  const promedioSueno = ultimaSemana.length ? (ultimaSemana.reduce((s, r) => s + r.horasSueno, 0) / ultimaSemana.length).toFixed(1) : 0;

  const alRecibirTexto = async (texto: string) => {
    setTextoComida(texto);
    setCargando(true);
    setNutrientes(null);
    setConsejosNutricion([]);
    try {
      const resultado = await analizarComida(texto);
      setNutrientes(resultado.total);
      setConsejosNutricion(generarConsejos(resultado.total));
    } catch (err) {
      alert("No pude analizar la comida.");
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  const consejosSalud = generarConsejosSalud(datosSalud);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#2d3748' }}>💚 Salud con Huawei — Alimentación</h1>
      <p style={{ textAlign: 'center', color: '#666', marginBottom: '20px' }}>Solo di qué comiste. Yo calculo los nutrientes por ti.</p>

      {!tokenGoogle && (
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <a href={obtenerEnlaceGoogle()} style={{ display: 'inline-block', background: '#4285F4', color: 'white', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold' }}>🔗 Conectar con Google Fit</a>
          <p style={{ fontSize: '13px', color: '#666', marginTop: '5px' }}>Lee automáticamente tus pasos, sueño y actividad del reloj</p>
        </div>
      )}

      {cargandoFit && <p style={{ textAlign: 'center' }}>🔄 Conectando con Google Fit...</p>}

      <div style={{ background: '#e6fffa', padding: '15px', borderRadius: '12px', marginBottom: '20px' }}>
        <h2>⌚ Tus datos del día</h2>
        <p style={{ fontSize: '13px', color: '#047857', marginBottom: '10px' }}>✅ Se guardan automáticamente día por día</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
          <div><label>👣 Pasos</label><input type="number" value={datosSalud.pasos || ''} onChange={e => setDatosSalud({...datosSalud, pasos: Number(e.target.value)})} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #ccc' }} /></div>
          <div><label>🔥 Calorías quemadas</label><input type="number" value={datosSalud.caloriasQuemadas || ''} onChange={e => setDatosSalud({...datosSalud, caloriasQuemadas: Number(e.target.value)})} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #ccc' }} /></div>
          <div><label>😴 Horas de sueño</label><input type="number" value={datosSalud.horasSueno || ''} onChange={e => setDatosSalud({...datosSalud, horasSueno: Number(e.target.value)})} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #ccc' }} /></div>
          <div><label>💓 Pulso promedio</label><input type="number" value={datosSalud.frecuenciaCardiaca || ''} onChange={e => setDatosSalud({...datosSalud, frecuenciaCardiaca: Number(e.target.value)})} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #ccc' }} /></div>
          <div><label>🧘 Estrés %</label><input type="number" value={datosSalud.nivelEstres || ''} onChange={e => setDatosSalud({...datosSalud, nivelEstres: Number(e.target.value)})} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #ccc' }} /></div>
        </div>
        <h3 style={{ marginTop: '15px' }}>💡 Recomendaciones personalizadas</h3>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>{consejosSalud.map((c, i) => <li key={i}>{c}</li>)}</ul>
      </div>

      {/* 📈 PROMEDIOS DE LA SEMANA */}
      {historialSalud.length > 0 && (
        <div style={{ background: '#fef3c7', padding: '15px', borderRadius: '12px', marginBottom: '20px' }}>
          <h2>📈 Promedios de la última semana</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
            <div>👣 Pasos promedio: <strong>{promedioPasos}</strong></div>
            <div>🔥 Calorías promedio: <strong>{promedioCalorias}</strong></div>
            <div>😴 Sueño promedio: <strong>{promedioSueno} hrs</strong></div>
          </div>
        </div>
      )}

      {/* 🍳 BOTONES: DESAYUNO / COMIDA / CENA / MERIENDA */}
      <div style={{ marginBottom: '15px' }}>
        <h3>🍳 ¿Qué vas a registrar?</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(['desayuno', 'comida', 'cena', 'merienda'] as const).map(tipo => (
            <button
              key={tipo}
              onClick={() => setTipoComidaActiva(tipo)}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: 'none',
                background: tipoComidaActiva === tipo ? '#2f855a' : '#e2e8f0',
                color: tipoComidaActiva === tipo ? 'white' : '#333',
                fontWeight: 'bold',
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {tipo === 'desayuno' && '🌅 '}
              {tipo === 'comida' && '☀️ '}
              {tipo === 'cena' && '🌙 '}
              {tipo === 'merienda' && '🍎 '}
              {tipo}
            </button>
          ))}
        </div>
      </div>

      <EntradaVoz onTextoObtenido={alRecibirTexto} />

      {cargando && <p style={{ textAlign: 'center', fontSize: '18px' }}>🔎 Analizando alimentos...</p>}

      {nutrientes && (
        <>
          <p style={{ fontStyle: 'italic', color: '#555' }}>Analizado: "{textoComida}"</p>
          <DesgloseNutrientes nutrientes={nutrientes} />
          <button
            onClick={guardarComidaActual}
            style={{
              marginTop: '15px',
              background: '#2f855a',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              width: '100%'
            }}
          >
            💾 Guardar como {tipoComidaActiva}
          </button>
          <Consejos lista={consejosNutricion} />
        </>
      )}

      {/* 📊 RESUMEN DEL DÍA + HISTORIAL */}
      {comidasDeHoy.length > 0 && (
        <div style={{ marginTop: '25px', padding: '15px', background: '#f0fff4', borderRadius: '12px', border: '2px solid #9ae6b4' }}>
          <h2>📊 Resumen del día ({comidasDeHoy.length} comidas)</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
            <div>🔥 Calorías: <strong>{Math.round(resumenHoy.calorias)}</strong> kcal</div>
            <div>🥩 Proteína: <strong>{Math.round(resumenHoy.proteina*10)/10}</strong>g</div>
            <div>🍞 Carbohidratos: <strong>{Math.round(resumenHoy.carbohidratos*10)/10}</strong>g</div>
            <div>🧈 Grasas: <strong>{Math.round(resumenHoy.grasas*10)/10}</strong>g</div>
            <div>🌾 Fibra: <strong>{Math.round(resumenHoy.fibra*10)/10}</strong>g</div>
          </div>
          <button
            onClick={() => setVerHistorial(!verHistorial)}
            style={{ marginTop: '15px', padding: '8px 16px', background: '#4299e1', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            {verHistorial ? '📕 Ocultar historial' : '📖 Ver historial completo'}
          </button>

          {verHistorial && (
            <div style={{ marginTop: '15px', textAlign: 'left' }}>
              <h3>📝 Registro por día</h3>
              {historialSalud.slice().reverse().map(r => (
                <div key={r.fecha} style={{ padding: '10px', borderBottom: '1px solid #ddd', background: '#fff' }}>
                  <strong>📅 {r.fecha}</strong>
                  <br />
                  👣 {r.pasos} pasos | 🔥 {r.caloriasQuemadas} kcal quemadas | 😴 {r.horasSueno} hrs | 💓 {r.frecuenciaCardiaca} pulso
                </div>
              ))}
              <h3 style={{ marginTop: '20px' }}>🍽️ Comidas guardadas</h3>
              {comidasGuardadas.slice().reverse().map(c => (
                <div key={c.id} style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>
                  <strong style={{ textTransform: 'capitalize' }}>{c.tipo}</strong> — {c.fecha} {c.hora}
                  <br />
                  <small>{c.texto}</small>
                  <br />
                  <small>🔥{Math.round(c.nutrientes.calorias)}kcal | 🥩{Math.round(c.nutrientes.proteina*10)/10}g</small>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;