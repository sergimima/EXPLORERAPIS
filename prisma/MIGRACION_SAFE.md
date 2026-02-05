# Migración segura a SaaS (preservar datos Vottun)

**Objetivo:** Subir los cambios del schema SaaS a la BD sin perder los datos existentes (transfers, vesting, holders, known addresses, etc.).

---

## Regla de oro: NO usar `prisma migrate reset`

- `prisma migrate reset` **borra toda la BD** y la recrea. Perderías todo.
- En producción: **nunca** usar `reset`.

---

## Pasos seguros

### 1. Backup antes de tocar nada

```bash
# PostgreSQL: exportar toda la BD
pg_dump $DATABASE_URL > backup_antes_migracion_$(date +%Y%m%d).sql

# O si usas una URL específica:
pg_dump "postgresql://user:pass@host:5432/dbname" -F c -f backup.dump
```

### 2. Comprobar estado de migraciones

```bash
npx prisma migrate status
```

- Si todo está aplicado: no hay migraciones pendientes.
- Si hay pendientes: se aplicarán con el siguiente paso.

### 3. Aplicar migraciones (sin borrar datos)

```bash
# En producción/desarrollo con datos que quieres conservar:
npx prisma migrate deploy
```

`migrate deploy`:
- Solo aplica migraciones pendientes
- No borra datos existentes
- Añade tablas/columnas según el SQL de cada migración

### 4. Ejecutar el script de migración Vottun

Este script enlaza los datos legacy (con `tokenId` null) a la org y token de Vottun:

```bash
npm run db:migrate-vottun
```

**Requisito previo:** Debe existir al menos un usuario en la BD. El script usa como `ownerId` de la org Vottun (por orden): `OWNER_ID` de env, el primer `SUPER_ADMIN`, el primer `ADMIN`, o el primer usuario. Si no hay usuarios, fallará; crea uno antes (ej. `npx tsx prisma/seed-superadmin.ts` si existe).

### 5. Verificar

```bash
npx tsx prisma/check-data.ts
```

Comprueba que los conteos de KnownAddress, TransferCache, VestingCache, etc. son los esperados.

---

## Si la BD ya tiene schema SaaS (orgs, tokens, users)

- Si ya existen `Organization` y `Token` para Vottun, el script usa `upsert` y no duplica.
- Si los datos de caché ya tienen `tokenId` asignado, el `updateMany` con `where: { tokenId: null }` no modificará nada (0 filas actualizadas).
- El script es seguro para ejecutarlo más de una vez.

---

## Cambios que sí borrarían datos

Evitar migraciones que hagan:

- `DROP TABLE`
- `DROP COLUMN`
- `ALTER TABLE ... DROP ...`

Las migraciones actuales en `prisma/migrations/` son mayormente aditivas (nuevas tablas, nuevas columnas, índices). Revisa el SQL de cualquier migración nueva antes de aplicarla.

---

## Resumen rápido

| Acción | Comando | ¿Borra datos? |
|--------|---------|----------------|
| Backup | `pg_dump $DATABASE_URL > backup.sql` | No |
| Aplicar migraciones | `npx prisma migrate deploy` | No |
| Migrar datos Vottun | `npm run db:migrate-vottun` | No |
| **EVITAR** | `npx prisma migrate reset` | **Sí, todo** |

## Script npm

El script está en `package.json`:

```bash
npm run db:migrate-vottun
```
