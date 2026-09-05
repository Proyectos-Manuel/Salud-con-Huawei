// 🔑 Tus claves de Google — Pégalas aquí
const CLIENT_ID = '763849623295-lo9cgmfuomu3thbihvo9dsb8i2rj8tqi.apps.googleusercontent.com';
const CLIENT_SECRET = import.meta.env.PUBLIC_GOOGLE_CLIENT_SECRET || "";
const REDIRECT_URI = import.meta.env.PUBLIC_REDIRECT_URI || 'https://salud-con-huawei.vercel.app';

// Permisos que pediremos: pasos, calorías, sueño, frecuencia cardíaca
const SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.body.read',
  'https://www.googleapis.com/auth/fitness.sleep.read',
  'https://www.googleapis.com/auth/fitness.heart_rate.read',
].join(' ');

export interface DatosSaludGoogle {
  pasos: number;
  caloriasQuemadas: number;
  horasSueno: number;
  frecuenciaCardiaca: number;
}

// 🔑 Generar enlace para iniciar sesión en Google
export function obtenerEnlaceGoogle(): string {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('include_granted_scopes', 'true');
  
  return authUrl.toString();
}

// 📊 Leer datos de Google Fit
export async function leerDatosGoogleFit(tokenAcceso: string): Promise<DatosSaludGoogle | null> {
  const hoy = new Date();
  const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const startTimeMillis = inicioDia.getTime();
  const endTimeMillis = hoy.getTime();

  try {
    const respuesta = await fetch(
      `https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenAcceso}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aggregateBy: [
            { dataTypeName: 'com.google.step_count.delta' },
            { dataTypeName: 'com.google.calories.expended' },
            { dataTypeName: 'com.google.sleep.segment' },
            { dataTypeName: 'com.google.heart_rate.bpm' },
          ],
          bucketByTime: { durationMillis: 86400000 },
          startTimeMillis,
          endTimeMillis,
        }),
      }
    );

    const datos = await respuesta.json();
    console.log('⌚ Datos de Google Fit:', datos);

    // Extraer valores o usar 0 si no hay datos
    let pasos = 0, calorias = 0, sueno = 0, pulso = 0;

    if (datos.bucket && datos.bucket[0]) {
      // Pasos
      const pasosPunto = datos.bucket[0].dataset?.find((d:any) => d.dataSourceId?.includes('step_count'))?.point?.[0];
      pasos = pasosPunto?.value?.[0]?.intVal || 0;

      // Calorías
      const calPunto = datos.bucket[0].dataset?.find((d:any) => d.dataSourceId?.includes('calories'))?.point?.[0];
      calorias = Math.round(calPunto?.value?.[0]?.fpVal || 0);

      // Sueño
      const suenoPuntos = datos.bucket[0].dataset?.find((d:any) => d.dataSourceId?.includes('sleep'))?.point || [];
      sueno = suenoPuntos.reduce((total:number, p:any) => total + (p.endTimeMillis - p.startTimeMillis), 0) / 3600000;

      // Frecuencia cardíaca
      const pulsoPunto = datos.bucket[0].dataset?.find((d:any) => d.dataSourceId?.includes('heart_rate'))?.point?.[0];
      pulso = Math.round(pulsoPunto?.value?.[0]?.fpVal || 0);
    }

    return {
      pasos,
      caloriasQuemadas: calorias,
      horasSueno: Math.round(sueno * 10) / 10,
      frecuenciaCardiaca: pulso,
    };
  } catch (error) {
    console.error('❌ Error leyendo Google Fit:', error);
    return null;
  }
}

// 🔄 Intercambiar código por token de acceso
export async function obtenerTokenDesdeCodigo(codigo: string): Promise<string | null> {
  try {
    const respuesta = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: codigo,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const datos = await respuesta.json();
    return datos.access_token || null;
  } catch (error) {
    console.error('❌ Error obteniendo token:', error);
    return null;
  }
}
