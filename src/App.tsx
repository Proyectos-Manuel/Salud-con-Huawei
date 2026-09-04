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

      <div style={{ background: '#e6f7ff', padding: '15px', borderRadius: '12px', marginBottom: '20px' }}>
        <h2>⌚ Tus datos del día</h2>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>Anota tus datos del reloj:</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
          <div><label>👣 Pasos</label><input type="number" value={datosSalud.pasos || ''} onChange={e => setDatosSalud({...datosSalud, pasos: Number(e.target.value)})} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #ccc' }} /></div>
          <div><label>🔥 Calorías</label><input type="number" value={datosSalud.caloriasQuemadas || ''} onChange={e => setDatosSalud({...datosSalud, caloriasQuemadas: Number(e.target.value)})} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #ccc' }} /></div>
          <div><label>😴 Horas sueño</label><input type="number" value={datosSalud.horasSueno || ''} onChange={e => setDatosSalud({...datosSalud, horasSueno: Number(e.target.value)})} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #ccc' }} /></div>
          <div><label>💓 Pulso</label><input type="number" value={datosSalud.frecuenciaCardiaca || ''} onChange={e => setDatosSalud({...datosSalud, frecuenciaCardiaca: Number(e.target.value)})} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #ccc' }} /></div>
          <div><label>🧘 Estrés %</label><input type="number" value={datosSalud.nivelEstres || ''} onChange={e => setDatosSalud({...datosSalud, nivelEstres: Number(e.target.value)})} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #ccc' }} /></div>
        </div>
        <h3 style={{ marginTop: '15px' }}>💡 Recomendaciones personalizadas</h3>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>{consejosSalud.map((c, i) => <li key={i}>{c}</li>)}</ul>
      </div>

      <EntradaVoz onTextoObtenido={alRecibirTexto} />

      {cargando && <p style={{ textAlign: 'center', fontSize: '18px' }}>🔎 Analizando alimentos...</p>}

      {nutrientes && (
        <><p style={{ fontStyle: 'italic', color: '#555' }}>Analizado: "{textoComida}"</p><DesgloseNutrientes nutrientes={nutrientes} /><Consejos lista={consejosNutricion} /></>
      )}
    </div>
  );
}

export default App;