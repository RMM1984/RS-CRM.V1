# RS CRM V1

Base SaaS CRM para inmobiliarias con backend Node.js, Express, TypeScript, Supabase PostgreSQL, JWT, Zod, pg y Jest.

## Arquitectura

- Multi-tenant con modelo `schema-per-tenant`.
- Cada cliente usa un schema PostgreSQL propio con formato `tenant_{slug}`.
- El JWT transporta `tenant_id`, `tenant_slug`, `schema_name`, `role` e `is_premium`.
- Las rutas protegidas aplican `SET search_path TO {schema_name}, public` por request.

## Estructura

```text
backend/
  src/
    config/
    middleware/
    routes/
    controllers/
    services/
    db/
      migrations/
    utils/
frontend/
  .gitkeep
```

El frontend visual existente puede moverse a `frontend/` cuando empiece esa fase. Por ahora la carpeta solicitada queda preparada con `.gitkeep`.

## Backend local

```bash
cd backend
npm install
npm run build
npm test
npm run dev
```

## Variables

Copia `backend/.env.example` a `backend/.env` y rellena:

```bash
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
JWT_SECRET=change-me-in-production-with-32-chars-min
JWT_EXPIRES_IN=1d
CORS_ORIGIN=http://localhost:5173
PORT=4000
```

## Migraciones

Primero aplica `backend/src/db/migrations/000_public_schema.sql` en Supabase para crear `public.tenants` y `public.users`.

Después crea o registra un tenant y ejecuta la plantilla de schema:

```bash
cd backend
npm run migrate:tenant -- tenant_acme
```

## Railway

Este repo incluye `railway.json` para desplegar el backend desde la raíz:

- Build: `cd backend && npm ci && npm run build`
- Start: `cd backend && npm start`

Configura en Railway las variables del backend, especialmente `DATABASE_URL` y `JWT_SECRET`.
