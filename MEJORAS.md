# Mejoras del Dashboard

## 1. UX y Primeros Pasos

- **Empty states más claros**: Cuando no hay token seleccionado o no hay wallet, mostrar una guía corta ("Añade un token en Settings", "Introduce una wallet para empezar") en lugar de mensajes genéricos.
- **Onboarding contextual**: Un pequeño tour o tooltips la primera vez que se usa (pestañas, Token Supply, Analytics).
- **Sincronizar búsqueda entre pestañas**: Si busco una wallet en Tokens, que Vestings y Analytics muestren directamente algo relacionado con esa wallet o con el token activo.

---

## 2. Estructura y Navegación

- **Muchos sub-tabs en Tokens**: Balance, Transferencias, Vesting, Resumen Vesting, Airdrops pueden saturar. Propuesta:
  - Agrupar: p.ej. "Wallet" (Balance + Transferencias) y "Vesting" (Información + Resumen).
  - O usar acordeones en lugar de 5 tabs.
- **Menú lateral**: Para Tokens, Vestings, Analytics (en lugar de tabs horizontales) da más espacio y escala mejor si añades más secciones.
- **Rutas separadas**: `/dashboard/tokens`, `/dashboard/vestings`, `/dashboard/analytics` para poder compartir enlaces directos.

---

## 3. Contenido y Funcionalidad

- **Resumen principal (Overview)**: Una vista con:
  - KPIs del token activo (supply, holders, volumen 24h).
  - Últimas transferencias grandes.
  - Estado de vesting (liberado vs bloqueado).
- **Búsqueda rápida global**: Un único campo que busque wallets, contratos o hashes desde cualquier pestaña.
- **Favoritos / historial de wallets**: Guardar wallets consultadas para acceso rápido.
- **Exportar**: CSV/Excel de transferencias, balances o datos de vesting.

---

## 4. Tab Vestings

- **Integrar VestingSummary en el flujo**: Que al hacer clic en un contrato de VestingContractList se muestre el detalle sin desplazarse y sin duplicar controles.
- **Indicador de token activo**: Mostrar explícitamente qué token está seleccionado al consultar vestings.
- **Quitar logs de depuración**: Hay `console.log` de debug en el render (líneas 441-447) que deberían eliminarse en producción.

---

## 5. Diseño y Consistencia

- **Dark mode**: La landing usa dark; el dashboard usa light. Unificarlo.
- **Sistema de diseño**: Crear componentes reutilizables para tabs, cards y botones (ya usas Tailwind) para que todo se vea coherente.
- **Responsive**: Revisar que en móvil los tabs y formularios se vean bien y sean usables.
- **Skeleton loading**: Sustituir spinners genéricos por skeletons que reflejen la estructura real del contenido.

---

## 6. Performance

- **Persistir búsquedas recientes**: Guardar la última wallet consultada en `localStorage` y restaurarla al volver.
- **Caché y refresco**: Indicar cuándo los datos son de caché y cuándo se está actualizando.
- **Debounce en el filtro de tokens**: Evitar llamadas a API en cada tecla si el filtro dispara búsquedas.

---

## 7. Prioridad Sugerida

| Prioridad | Mejora | Esfuerzo |
|-----------|--------|----------|
| Alta | Quitar console.logs de debug | Bajo |
| Alta | Empty states más claros | Medio |
| Alta | Vista Overview con KPIs del token | Medio |
| Media | Agrupar sub-tabs de Tokens | Medio |
| Media | Rutas `/dashboard/tokens`, etc. | Medio |
| Media | Persistir wallet en localStorage | Bajo |
| Baja | Dark mode | Alto |
| Baja | Exportar CSV | Medio |
