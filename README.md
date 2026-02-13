# Tutor Marketplace – Auth Notes

## Environment
Create a `.env.local` (or reuse `.env`) with:
```
NODE_ENV=development
PORT=3000
DATABASE_URL=mysql://user:password@localhost:3306/tutor_marketplace_1
JWT_SECRET=change_me_access
JWT_REFRESH_SECRET=change_me_refresh
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY_DAYS=7
BCRYPT_ROUNDS=12
CORS_ORIGIN=http://localhost:5173
COOKIE_SECURE=false
COOKIE_DOMAIN=
VITE_API_URL=http://localhost:3000
```
Set `COOKIE_SECURE=true` and `COOKIE_DOMAIN=yourdomain.com` in production. `CORS_ORIGIN` should match your frontend origin.

## Running locally
- Backend: `pnpm dev` (starts Express + Vite proxy on port 3000)
- Frontend: `pnpm --filter client dev` if you run client separately; otherwise Vite dev middleware is used when `NODE_ENV=development`.
- Build: `pnpm build` then `pnpm start` (serves bundled server from `dist/`).

## Auth flow (JWT cookies)
- `POST /api/auth/signup` → creates user, sets httpOnly cookies `tc_access` (15m) and `tc_refresh` (7d, path `/api/auth/refresh-token`).
- `POST /api/auth/login` → validates password, sets the same cookies.
- `POST /api/auth/logout` → revokes refresh token and clears cookies.
- `POST /api/auth/refresh-token` → requires `tc_refresh`, rotates refresh token (stored hashed in DB) and sets new cookies.
- `GET /api/users/profile` → returns current user when `tc_access` is valid.

Cookies are httpOnly; CORS uses `credentials=true` with `origin=CORS_ORIGIN`. Access token is read by the server from cookies; frontend never stores tokens.

## Database
New columns on `users`: `email` (unique), `passwordHash`, `firstName`, `lastName`, `userType`, plus existing `role`. New table `refresh_tokens` stores hashed refresh tokens with expiry/revocation.

## Frontend
- AuthProvider fetches `/api/users/profile` on load and wraps the app.
- Login/Signup pages use email/password; protected pages redirect to `/login` when unauthenticated.
- API base is `VITE_API_URL` (defaults to same origin). Cookies are sent with `credentials: include`.
