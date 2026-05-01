# Bachejoa Web

Plataforma ciudadana de reportes urbanos para Navojoa, construida con Next.js,
Supabase y Mapbox.

## Desarrollo

```bash
npm install
npm run dev
```

Variables mínimas:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `AUTH_DUMMY_HASH`
- `RATE_LIMIT_PEPPER`

## Seguridad

- Los registros nuevos usan Supabase Auth con verificación por email.
- Las cuentas legacy se mantienen con cookies `__Host-` y hashes scrypt endurecidos.
- Las fotos se procesan en servidor con `sharp`; no se aceptan URLs externas.
- El rate limiting depende del RPC `public.rate_limit_hit` definido en
  `supabase/schema.sql`.

## Verificación

```bash
npm test
npm run build
npm audit --omit=dev
```
