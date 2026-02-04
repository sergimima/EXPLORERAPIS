# Dark Mode - Sistema de Diseño

## Resumen

El dark mode está implementado usando **variables CSS** que cambian automáticamente según el tema. Los componentes usan clases simples de Tailwind sin necesidad de usar `dark:` en cada lugar.

## Cómo funciona

### 1. Variables CSS (globals.css)

Todas las variables están definidas en `src/app/globals.css`:

```css
:root {
  --background: 255 255 255;     /* white */
  --foreground: 17 24 39;        /* gray-900 */
  --card: 255 255 255;           /* white */
  --border: 229 231 235;         /* gray-200 */
  /* etc */
}

.dark {
  --background: 17 24 39;        /* gray-900 */
  --foreground: 243 244 246;     /* gray-100 */
  --card: 31 41 55;              /* gray-800 */
  --border: 75 85 99;            /* gray-600 */
  /* etc */
}
```

### 2. Tailwind Config

Las variables están mapeadas a clases de Tailwind en `tailwind.config.js`:

```js
colors: {
  background: 'rgb(var(--background) / <alpha-value>)',
  foreground: 'rgb(var(--foreground) / <alpha-value>)',
  card: 'rgb(var(--card) / <alpha-value>)',
  // etc
}
```

### 3. Uso en Componentes

**ANTES (verboso y difícil de mantener):**
```tsx
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700">
  <p className="text-gray-500 dark:text-gray-400">Texto</p>
</div>
```

**AHORA (limpio y mantenible):**
```tsx
<div className="bg-card text-card-foreground border-border">
  <p className="text-muted-foreground">Texto</p>
</div>
```

## Clases Disponibles

### Backgrounds

| Clase | Uso | Light | Dark |
|-------|-----|-------|------|
| `bg-background` | Fondo principal de la app | white | gray-900 |
| `bg-card` | Tarjetas, modales, paneles | white | gray-800 |
| `bg-muted` | Fondos secundarios, inputs deshabilitados | gray-100 | gray-700 |
| `bg-accent` | Destacados, elementos activos | blue-50 | blue-900 |
| `bg-primary` | Botones principales, CTAs | blue-500 | blue-400 |
| `bg-destructive` | Acciones destructivas, errores | red-500 | red-400 |

### Textos

| Clase | Uso | Light | Dark |
|-------|-----|-------|------|
| `text-foreground` | Texto principal | gray-900 | gray-100 |
| `text-card-foreground` | Texto en tarjetas | gray-900 | gray-100 |
| `text-muted-foreground` | Texto secundario, labels | gray-500 | gray-400 |
| `text-secondary-foreground` | Texto terciario | gray-700 | gray-300 |
| `text-accent-foreground` | Texto en elementos destacados | blue-700 | blue-300 |
| `text-primary-foreground` | Texto en botones primarios | white | white |

### Bordes

| Clase | Uso | Light | Dark |
|-------|-----|-------|------|
| `border-border` | Bordes generales | gray-200 | gray-600 |
| `border-input` | Bordes de inputs | gray-300 | gray-600 |

### Hover States

Los hover states se aplican automáticamente:

```tsx
<button className="bg-card hover:bg-muted">
  {/* Funciona en ambos temas */}
</button>
```

## Ejemplos Comunes

### Tarjeta

```tsx
<div className="bg-card border-border rounded-lg shadow-md p-6">
  <h3 className="text-card-foreground font-semibold mb-2">Título</h3>
  <p className="text-muted-foreground">Descripción</p>
</div>
```

### Botón Primario

```tsx
<button className="bg-primary text-primary-foreground px-4 py-2 rounded hover:opacity-90">
  Acción Principal
</button>
```

### Input

```tsx
<input className="bg-background text-foreground border-input rounded px-3 py-2" />
```

### Navbar

```tsx
<nav className="bg-card border-b border-border">
  <a className="text-secondary-foreground hover:bg-muted px-3 py-2 rounded">
    Link
  </a>
  <a className="bg-accent text-accent-foreground px-3 py-2 rounded">
    Activo
  </a>
</nav>
```

## ThemeProvider y ThemeToggle

### ThemeProvider

Envuelve toda la app en `src/components/Providers.tsx`:

```tsx
<ThemeProvider>
  {children}
</ThemeProvider>
```

### ThemeToggle

Botón para cambiar tema en `src/components/ThemeToggle.tsx`:

```tsx
import ThemeToggle from './ThemeToggle';

<ThemeToggle />
```

### useTheme Hook

Para usar el tema en componentes:

```tsx
import { useTheme } from '@/components/ThemeProvider';

function MyComponent() {
  const { theme, toggleTheme, setTheme } = useTheme();

  return (
    <div>
      Current theme: {theme}
      <button onClick={toggleTheme}>Toggle</button>
    </div>
  );
}
```

## Personalización

### Cambiar Colores

Edita `src/app/globals.css`:

```css
:root {
  --primary: 59 130 246; /* Cambiar color primario */
}

.dark {
  --primary: 96 165 250; /* Versión dark del color primario */
}
```

### Agregar Nuevos Colores

1. Agrega la variable en `globals.css`:
```css
:root {
  --success: 34 197 94; /* green-500 */
}
.dark {
  --success: 74 222 128; /* green-400 */
}
```

2. Agrega en `tailwind.config.js`:
```js
colors: {
  success: 'rgb(var(--success) / <alpha-value>)',
}
```

3. Úsalo:
```tsx
<div className="bg-success text-white">Success!</div>
```

## Casos Especiales

### Recharts (Gráficos)

Para componentes que necesitan saber el tema actual:

```tsx
import { useTheme } from '@/components/ThemeProvider';

export default function MyChart() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <BarChart>
      <CartesianGrid stroke={isDark ? '#374151' : '#E5E7EB'} />
    </BarChart>
  );
}
```

### Colores Específicos

Si necesitas un color específico que no cambia:

```tsx
{/* Siempre rojo, sin importar el tema */}
<div className="bg-red-500 text-white">Error</div>
```

## Beneficios

✅ **Código más limpio** - Sin `dark:` por todas partes
✅ **Mantenible** - Cambios globales en un solo lugar
✅ **Consistente** - Colores semánticos (`card`, `muted`, etc.)
✅ **Fácil de personalizar** - Solo edita las variables CSS
✅ **Mejor DX** - Clases más cortas y legibles

## Migración desde el Enfoque Anterior

Si encuentras código antiguo con `dark:`, reemplázalo:

| Antes | Ahora |
|-------|-------|
| `bg-white dark:bg-gray-800` | `bg-card` |
| `text-gray-900 dark:text-gray-100` | `text-card-foreground` |
| `border-gray-200 dark:border-gray-700` | `border-border` |
| `bg-gray-100 dark:bg-gray-700` | `bg-muted` |
| `text-gray-500 dark:text-gray-400` | `text-muted-foreground` |
| `text-gray-700 dark:text-gray-300` | `text-secondary-foreground` |

## Recursos

- [Tailwind CSS Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [CSS Variables](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [shadcn/ui Design System](https://ui.shadcn.com/docs/theming) (inspiración para este sistema)
