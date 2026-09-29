// Tabla de precios de repisas.
//
// Fuente: repisas-tabla-precios.xlsx entregada por el cliente (Felipe), hoja "Tabla de precios".
// Costos base, margen de 130% y redondeo a $10.000 estan en la hoja "Supuestos" de ese archivo.
//
// alto  : alto total de la repisa en cm (200 -> 4 niveles, 250 -> 5, 300 -> 6).
// prof  : fondo UTIL en cm, o sea el ancho del terciado. La profundidad total que usa el
//         configurador 3D y esta pantalla es este valor + 8 cm (un pilar 2x2 de 4 cm por lado):
//         28 -> 20, 38 -> 30, 48 -> 40, 68 -> 60.
// desde / hasta : rango de largo en cm, inclusivo por ambos extremos.
// precio: valor neto en CLP de UNA repisa de ese rango.
//
// Esta copia es solo el respaldo: la tabla viva la sirve /.netlify/functions/get-precios desde
// la planilla del cliente. Si esa llamada falla, la cotizacion sigue funcionando con estos
// valores (snapshot del 17-09-2026) en vez de quedarse sin precios.
export const TABLA_PRECIOS = [
  { alto: 200, prof: 20, desde: 50, hasta: 88, precio: 40000 },
  { alto: 200, prof: 20, desde: 89, hasta: 121, precio: 50000 },
  { alto: 200, prof: 20, desde: 122, hasta: 133, precio: 60000 },
  { alto: 200, prof: 20, desde: 134, hasta: 193, precio: 70000 },
  { alto: 200, prof: 20, desde: 194, hasta: 243, precio: 80000 },
  { alto: 200, prof: 30, desde: 50, hasta: 102, precio: 50000 },
  { alto: 200, prof: 30, desde: 103, hasta: 121, precio: 60000 },
  { alto: 200, prof: 30, desde: 122, hasta: 127, precio: 70000 },
  { alto: 200, prof: 30, desde: 128, hasta: 181, precio: 80000 },
  { alto: 200, prof: 30, desde: 182, hasta: 193, precio: 90000 },
  { alto: 200, prof: 30, desde: 194, hasta: 243, precio: 100000 },
  { alto: 200, prof: 40, desde: 50, hasta: 70, precio: 50000 },
  { alto: 200, prof: 40, desde: 71, hasta: 110, precio: 60000 },
  { alto: 200, prof: 40, desde: 111, hasta: 121, precio: 70000 },
  { alto: 200, prof: 40, desde: 122, hasta: 125, precio: 80000 },
  { alto: 200, prof: 40, desde: 126, hasta: 165, precio: 90000 },
  { alto: 200, prof: 40, desde: 166, hasta: 193, precio: 100000 },
  { alto: 200, prof: 40, desde: 194, hasta: 243, precio: 110000 },
  { alto: 200, prof: 60, desde: 50, hasta: 63, precio: 60000 },
  { alto: 200, prof: 60, desde: 64, hasta: 90, precio: 70000 },
  { alto: 200, prof: 60, desde: 91, hasta: 117, precio: 80000 },
  { alto: 200, prof: 60, desde: 118, hasta: 121, precio: 90000 },
  { alto: 200, prof: 60, desde: 122, hasta: 122, precio: 100000 },
  { alto: 200, prof: 60, desde: 123, hasta: 149, precio: 110000 },
  { alto: 200, prof: 60, desde: 150, hasta: 175, precio: 120000 },
  { alto: 200, prof: 60, desde: 176, hasta: 193, precio: 130000 },
  { alto: 200, prof: 60, desde: 194, hasta: 243, precio: 150000 },
  { alto: 250, prof: 20, desde: 50, hasta: 96, precio: 50000 },
  { alto: 250, prof: 20, desde: 97, hasta: 121, precio: 60000 },
  { alto: 250, prof: 20, desde: 122, hasta: 176, precio: 80000 },
  { alto: 250, prof: 20, desde: 177, hasta: 193, precio: 90000 },
  { alto: 250, prof: 20, desde: 194, hasta: 243, precio: 100000 },
  { alto: 250, prof: 30, desde: 50, hasta: 54, precio: 50000 },
  { alto: 250, prof: 30, desde: 55, hasta: 97, precio: 60000 },
  { alto: 250, prof: 30, desde: 98, hasta: 121, precio: 70000 },
  { alto: 250, prof: 30, desde: 122, hasta: 145, precio: 90000 },
  { alto: 250, prof: 30, desde: 146, hasta: 188, precio: 100000 },
  { alto: 250, prof: 30, desde: 189, hasta: 193, precio: 110000 },
  { alto: 250, prof: 30, desde: 194, hasta: 243, precio: 120000 },
  { alto: 250, prof: 40, desde: 50, hasta: 65, precio: 60000 },
  { alto: 250, prof: 40, desde: 66, hasta: 97, precio: 70000 },
  { alto: 250, prof: 40, desde: 98, hasta: 121, precio: 80000 },
  { alto: 250, prof: 40, desde: 122, hasta: 130, precio: 100000 },
  { alto: 250, prof: 40, desde: 131, hasta: 162, precio: 110000 },
  { alto: 250, prof: 40, desde: 163, hasta: 193, precio: 120000 },
  { alto: 250, prof: 40, desde: 194, hasta: 243, precio: 140000 },
  { alto: 250, prof: 60, desde: 50, hasta: 55, precio: 70000 },
  { alto: 250, prof: 60, desde: 56, hasta: 76, precio: 80000 },
  { alto: 250, prof: 60, desde: 77, hasta: 98, precio: 90000 },
  { alto: 250, prof: 60, desde: 99, hasta: 119, precio: 100000 },
  { alto: 250, prof: 60, desde: 120, hasta: 121, precio: 110000 },
  { alto: 250, prof: 60, desde: 122, hasta: 136, precio: 130000 },
  { alto: 250, prof: 60, desde: 137, hasta: 158, precio: 140000 },
  { alto: 250, prof: 60, desde: 159, hasta: 179, precio: 150000 },
  { alto: 250, prof: 60, desde: 180, hasta: 193, precio: 160000 },
  { alto: 250, prof: 60, desde: 194, hasta: 243, precio: 180000 },
  { alto: 300, prof: 20, desde: 50, hasta: 101, precio: 60000 },
  { alto: 300, prof: 20, desde: 102, hasta: 121, precio: 70000 },
  { alto: 300, prof: 20, desde: 122, hasta: 151, precio: 90000 },
  { alto: 300, prof: 20, desde: 152, hasta: 193, precio: 100000 },
  { alto: 300, prof: 20, desde: 194, hasta: 243, precio: 110000 },
  { alto: 300, prof: 30, desde: 50, hasta: 57, precio: 60000 },
  { alto: 300, prof: 30, desde: 58, hasta: 93, precio: 70000 },
  { alto: 300, prof: 30, desde: 94, hasta: 121, precio: 80000 },
  { alto: 300, prof: 30, desde: 122, hasta: 122, precio: 100000 },
  { alto: 300, prof: 30, desde: 123, hasta: 157, precio: 110000 },
  { alto: 300, prof: 30, desde: 158, hasta: 193, precio: 120000 },
  { alto: 300, prof: 30, desde: 194, hasta: 243, precio: 140000 },
  { alto: 300, prof: 40, desde: 50, hasta: 62, precio: 70000 },
  { alto: 300, prof: 40, desde: 63, hasta: 89, precio: 80000 },
  { alto: 300, prof: 40, desde: 90, hasta: 116, precio: 90000 },
  { alto: 300, prof: 40, desde: 117, hasta: 121, precio: 100000 },
  { alto: 300, prof: 40, desde: 122, hasta: 134, precio: 120000 },
  { alto: 300, prof: 40, desde: 135, hasta: 160, precio: 130000 },
  { alto: 300, prof: 40, desde: 161, hasta: 187, precio: 140000 },
  { alto: 300, prof: 40, desde: 188, hasta: 193, precio: 150000 },
  { alto: 300, prof: 40, desde: 194, hasta: 243, precio: 170000 },
  { alto: 300, prof: 60, desde: 50, hasta: 50, precio: 80000 },
  { alto: 300, prof: 60, desde: 51, hasta: 67, precio: 90000 },
  { alto: 300, prof: 60, desde: 68, hasta: 85, precio: 100000 },
  { alto: 300, prof: 60, desde: 86, hasta: 103, precio: 110000 },
  { alto: 300, prof: 60, desde: 104, hasta: 121, precio: 120000 },
  { alto: 300, prof: 60, desde: 122, hasta: 128, precio: 150000 },
  { alto: 300, prof: 60, desde: 129, hasta: 146, precio: 160000 },
  { alto: 300, prof: 60, desde: 147, hasta: 164, precio: 170000 },
  { alto: 300, prof: 60, desde: 165, hasta: 181, precio: 180000 },
  { alto: 300, prof: 60, desde: 182, hasta: 193, precio: 190000 },
  { alto: 300, prof: 60, desde: 194, hasta: 243, precio: 220000 },
]

// Un pilar 2x2 de 4 cm a cada lado: la profundidad total de la repisa trae 8 cm mas que el
// terciado. Mismo criterio que usefulBoardDepthCm() en el configurador 3D.
const PILAR_CM = 4

// Precio neto de UNA repisa, o null si esa combinacion no esta en la tabla.
// Medidas en metros, como las guarda la cotizacion.
export function precioRepisa({ largoM, profM, altoM }, tabla = TABLA_PRECIOS) {
  return filaPrecioRepisa({ largoM, profM, altoM }, tabla)?.precio ?? null
}

export function filaPrecioRepisa({ largoM, profM, altoM }, tabla = TABLA_PRECIOS) {
  const largo = Math.round(largoM * 100)
  const prof = Math.round(profM * 100) - PILAR_CM * 2
  const alto = Math.round(altoM * 100)
  const fila = tabla.find(f =>
    f.alto === alto && f.prof === prof && largo >= f.desde && largo <= f.hasta)
  return fila || null
}

// Trae la tabla viva desde la planilla del cliente. Si algo falla devuelve el respaldo, para
// que no se pueda quedar sin cotizar por un problema de red o de permisos en Google.
// Devuelve { tabla, respaldo }: respaldo en true avisa que la planilla no respondio y se esta
// cotizando con la copia del bundle. Que eso sea visible importa: si no, los precios quedan
// congelados en la foto del ultimo despliegue y nadie se entera.
export async function cargarTablaPrecios(apiFetch) {
  try {
    const res = await apiFetch('/.netlify/functions/get-precios')
    if (res?.ok && res.tabla?.length) return { tabla: res.tabla, respaldo: false }
    console.warn('get-precios sin datos, se usa el respaldo:', res?.error)
  } catch (e) {
    console.warn('get-precios fallo, se usa el respaldo:', e.message)
  }
  return { tabla: TABLA_PRECIOS, respaldo: true }
}
