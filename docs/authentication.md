# CloudCart Authentication

## Flow

The API exposes versioned authentication routes under `/api/v1/auth`. Registration and login validate input with Zod, normalize email addresses, hash passwords with bcrypt, and return a short-lived JWT plus safe user data. `passwordHash` is never serialized in a response.

Registration always creates `CUSTOMER` users. The client cannot provide or elevate a role. Admin accounts are provisioned separately through controlled seed or administrative workflows.

## JWT

JWT access tokens contain the authenticated user id, normalized email, role, `type: access`, issuer, subject, and an expiration. `JWT_SECRET`, `JWT_EXPIRES_IN`, and `JWT_ISSUER` are read from the backend environment. The development example uses a placeholder only; no real secret belongs in source control.

`authenticate` requires `Authorization: Bearer <token>`, verifies the signature, issuer, token type, role, and expiration, then attaches `{ id, email, role }` to `request.auth`. Missing, invalid, and expired tokens return `401 Authentication required` or `401 Invalid or expired authentication token` without exposing implementation details.

## Authorization

`requireRole('ADMIN')` runs after `authenticate` and returns `403 Insufficient permissions` when a valid customer token reaches an admin-only route. The example endpoint is `GET /api/v1/admin/dashboard`. `GET /api/v1/customer/profile` demonstrates a route available to authenticated customers and admins.

Authentication answers who the caller is. Authorization answers whether that caller may perform an action.

## Endpoints

- `POST /api/v1/auth/register`: validates and creates a customer.
- `POST /api/v1/auth/login`: validates credentials and returns a JWT.
- `GET /api/v1/auth/me`: returns the current safe user and requires authentication.
- `POST /api/v1/auth/logout`: tells the client to clear its token.
- `GET /api/v1/admin/dashboard`: requires the `ADMIN` role.

## Logout and Storage

JWT access tokens are stateless. The current logout endpoint clears the frontend token from `sessionStorage`; it cannot invalidate an already-issued token. The API says this explicitly rather than pretending server-side revocation exists. A future revocation design could use short access-token lifetimes plus refresh-token rotation and a server-side denylist or token-version field.

The frontend stores only the access token in `sessionStorage`, not user passwords or password hashes. This limits persistence across browser restarts but remains exposed to JavaScript running in the page. A production browser application could instead use secure, `HttpOnly`, `SameSite` cookies with CSRF protection.

## Security Measures

- bcrypt with 12 work rounds
- Passwords require eight or more characters plus upper/lowercase, number, and special character
- Maximum password length is 72 bytes-compatible characters for bcrypt
- Email normalization and duplicate checks
- JWT expiration and issuer validation
- Role-based middleware
- Helmet, CORS, JSON body size limit, and authentication rate limiting
- Centralized sanitized errors
- No passwords, hashes, tokens, or secrets in logs or responses
