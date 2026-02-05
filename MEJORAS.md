# Mejoras y Roadmap de Producto

**Estado:** 🚧 En Progreso | Última actualización: 2025-02-04
**Alcance:** UX del Dashboard + Features de producto (unificado desde IMPROVEMENTS.md)

## 1. UX y Primeros Pasos

- ✅ **Empty states más claros**: ~~Cuando no hay token seleccionado o no hay wallet, mostrar una guía corta ("Añade un token en Settings", "Introduce una wallet para empezar") en lugar de mensajes genéricos.~~ **COMPLETADO** - Implementado con emojis y CTAs en dashboard y TokenBalance
- **Onboarding contextual**: Un pequeño tour o tooltips la primera vez que se usa (pestañas, Token Supply, Analytics).
- **Sincronizar búsqueda entre pestañas**: Si busco una wallet en Tokens, que Vestings y Analytics muestren directamente algo relacionado con esa wallet o con el token activo.

---

## 2. Estructura y Navegación

- ✅ **Muchos sub-tabs en Tokens**: ~~Balance, Transferencias, Vesting, Resumen Vesting, Airdrops pueden saturar.~~ **COMPLETADO** - Agrupados en 3 tabs: 👛 Wallet (Balance+Transferencias), 🔒 Vesting (Info+Resumen), 🎁 Airdrops
- **Menú lateral**: Para Tokens, Vestings, Analytics (en lugar de tabs horizontales) da más espacio y escala mejor si añades más secciones.
- ✅ **Rutas separadas**: ~~`/dashboard/tokens`, `/dashboard/vestings`, `/dashboard/analytics` para poder compartir enlaces directos.~~ **COMPLETADO** - Implementado con sincronización bidireccional URL ↔ Tab activo

---

## 3. Contenido y Funcionalidad

- ✅ **Resumen principal (Overview)**: ~~Una vista con KPIs del token activo (supply, holders, volumen 24h), últimas transferencias grandes, y estado de vesting (liberado vs bloqueado).~~ **COMPLETADO** - Componente TokenOverview creado con 3 KPI cards, sección de whales y vesting status
- ✅ **Búsqueda rápida global**: ~~Un único campo que busque wallets, contratos o hashes desde cualquier pestaña.~~ **COMPLETADO** - GlobalSearch integrado en Navbar con Cmd/Ctrl+K, navega al dashboard con tabs
- ✅ **Favoritos / historial de wallets**: ~~Guardar wallets consultadas para acceso rápido.~~ **COMPLETADO** - localStorage guarda última wallet consultada
- **Exportar**: CSV/Excel de transferencias, balances o datos de vesting.

---

## 4. Tab Vestings

- **Integrar VestingSummary en el flujo**: Que al hacer clic en un contrato de VestingContractList se muestre el detalle sin desplazarse y sin duplicar controles.
- **Indicador de token activo**: Mostrar explícitamente qué token está seleccionado al consultar vestings.
- ✅ **Quitar logs de depuración**: ~~Hay `console.log` de debug en el render (líneas 441-447) que deberían eliminarse en producción.~~ **COMPLETADO** - Eliminados console.logs de debug en dashboard

---

## 5. Diseño y Consistencia

- ✅ **Dark mode**: ~~La landing usa dark; el dashboard usa light. Unificarlo.~~ **COMPLETADO** - Implementado dark mode completo con ThemeProvider, ThemeToggle, variantes dark en todos los componentes, charts adaptativos, y persistencia en localStorage
- **Sistema de diseño**: Crear componentes reutilizables para tabs, cards y botones (ya usas Tailwind) para que todo se vea coherente.
- **Responsive**: Revisar que en móvil los tabs y formularios se vean bien y sean usables.
- **Skeleton loading**: Sustituir spinners genéricos por skeletons que reflejen la estructura real del contenido.

---

## 6. Performance

- ✅ **Persistir búsquedas recientes**: ~~Guardar la última wallet consultada en `localStorage` y restaurarla al volver.~~ **COMPLETADO** - Implementado: restaura al cargar y guarda después de búsquedas exitosas
- **Caché y refresco**: Indicar cuándo los datos son de caché y cuándo se está actualizando.
- **Debounce en el filtro de tokens**: Evitar llamadas a API en cada tecla si el filtro dispara búsquedas.

---

## 7. Features de Producto (Futuro)

*Ítems consolidados desde el antiguo IMPROVEMENTS.md*

### Sistema de Alertas
- Notificaciones automáticas de eventos on-chain (ballenas, cambios de precio, flujo a CEX)
- Canales: Telegram, Email, Webhooks
- UI para configurar alertas por token
- Background worker para evaluación periódica

### API Pública
- Endpoints REST para terceros (bots, integraciones, otras apps)
- Sistema de API Keys con rate limiting
- Planes Pro/Enterprise con límites de llamadas

### PWA
- Instalable en móvil/desktop
- Offline básico para datos cacheados
- Push notifications (opcional)

### AI/ML (Exploración)
- Clasificación de addresses (whale vs retail)
- Predicción de comportamiento
- Requiere dataset histórico significativo

---

## 8. Prioridad Sugerida

| Prioridad | Mejora | Esfuerzo | Estado |
|-----------|--------|----------|--------|
| Alta | ~~Quitar console.logs de debug~~ | Bajo | ✅ Completado |
| Alta | ~~Empty states más claros~~ | Medio | ✅ Completado |
| Alta | ~~Vista Overview con KPIs del token~~ | Medio | ✅ Completado |
| Alta | ~~Persistir wallet en localStorage~~ | Bajo | ✅ Completado |
| Media | ~~Agrupar sub-tabs de Tokens~~ | Medio | ✅ Completado |
| Media | ~~Rutas `/dashboard/tokens`, etc.~~ | Medio | ✅ Completado |
| Media | ~~Búsqueda rápida global~~ | Medio | ✅ Completado |
| Baja | ~~Dark mode~~ | Alto | ✅ Completado |
| Baja | Exportar CSV | Medio | ⏳ Pendiente |
| Baja | Sistema de Alertas | Alto | ⏳ Futuro |
| Baja | API Pública | Alto | ⏳ Futuro |
| Baja | PWA | Medio | ⏳ Futuro |
| Baja | AI/ML | Muy Alto | ⏳ Exploración |

---

## 📊 Progreso General

**Completadas:** 8/9 mejoras de dashboard (89%) 🎉
**Pendientes:** 1 mejora de prioridad baja (Exportar CSV) + 4 features de producto (Alertas, API, PWA, AI)
**Tiempo invertido:** ~8h
**Impacto:** 🚀 Transformación completa de UX - Dashboard profesional y moderno con dark mode completo



Sergi: Foto del token personalizado, y logos de las redes