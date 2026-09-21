export function resolvePriceUpdate(tabla, input) {
  const { alto, prof, desde, hasta, precioAnterior, precio } = input;
  if (![alto, prof, desde, hasta, precioAnterior, precio].every(Number.isFinite) ||
      !Number.isSafeInteger(precio) || precio <= 0 || precio > 100000000)
    throw Object.assign(new Error('Ingresa un precio entero positivo válido'), { status: 400 });
  const matches = tabla.filter(r => r.alto === alto && r.prof === prof && r.desde === desde && r.hasta === hasta);
  if (matches.length !== 1) throw Object.assign(new Error('El rango cambió o es ambiguo. Recarga la tabla.'), { status: 409 });
  if (matches[0].precio !== precioAnterior) throw Object.assign(new Error('Otro usuario cambió este precio. Recarga la tabla antes de guardar.'), { status: 409 });
  return { ...matches[0], precio };
}
