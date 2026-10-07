# Harbor CRM

Internal customer, sourcing, transport, and payment operations app. In authenticated staff workflows, a customer belongs to the staff member who created it. Local demo-created customers appear as Administrator-owned. Orders and ledger entries inherit the customer’s access scope.

See [PRODUCT.md](PRODUCT.md) for the product and UX specification: roles, screens, visual design, fields, validation, workflows, business rules, API capabilities, operational requirements, and open decisions.

## Core records

- Customers are individuals or businesses.
- Buy orders use `mh-DDMMYYYY-N`; transport orders use `kg-DDMMYYYY-N`. The daily sequence is shared across both order types. Each order also has an internal UUID.
- Code 128 labels encode the printable order number. Payments and costs are recorded as ledger entries linked to customer orders.

## Local development

Prerequisites: Docker Desktop with Docker Compose enabled.

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Open the web app at <http://localhost:5173>. The API is at <http://localhost:3000/api> and PostgreSQL is bound to `127.0.0.1:5432`. Local development starts in a demo administrator session; this mode is only enabled for the Compose development environment. Source folders are mounted into the containers for live reload. PostgreSQL data persists in the `postgres_data` volume.

## LAN-only password sign-in

For a local network without Firebase or internet access, set `AUTH_MODE=local` in `.env`, then set `LAN_ADMIN_PASSWORD` to a strong password with at least 12 characters. Docker Compose uses this same setting for the web app and API. The API creates the administrator from `ADMIN_EMAIL` at startup and asks for a new password on first sign-in. The bootstrap password is only applied when the account has no local password, so restarting does not reset it.

For `local` or `firebase` auth, also set `JWT_SECRET` to a unique random value of at least 32 characters in `.env`. Generate one with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and keep it out of source control. The known development fallback is rejected outside demo mode. After setting a local admin password for the first time, `LAN_ADMIN_PASSWORD` can be cleared from `.env`; startup only requires it while provisioning that account.

Administrators add staff from Staff Access and provide a unique temporary password of at least 12 characters. Give that password to the staff member through a trusted channel; Harbor requires them to change it at first sign-in. Passwords are stored as bcrypt hashes. Local password sessions use an API JWT held in browser session storage and do not call Firebase.

To allow other devices on the LAN to connect, set `APP_BIND_ADDRESS=0.0.0.0`. Set `VITE_API_URL=http://<server-lan-ip>:3000/api` and `WEB_ORIGIN=http://<server-lan-ip>:5173` using the server’s LAN IP, then restart Compose. Open `http://<server-lan-ip>:5173` on client devices. The database port remains loopback-only. Restrict access with the machine firewall to the trusted LAN; do not forward these development ports to the public internet.

Stop the app with `docker compose down`. To also remove the local database, run `docker compose down -v`.

Run the repository checks from the root with `npm ci`, `npm run lint`, and `npm test`. The unit tests do not require Docker or a database.

## Firebase sign-in

To use Firebase Authentication instead of the local demo session:

1. Create a Firebase project and enable Email/Password sign-in.
2. Add the Firebase web config to the `VITE_FIREBASE_*` values in `.env`.
3. Set `AUTH_MODE=firebase`.
4. Set `JWT_SECRET` to a unique random value of at least 32 characters; the command in the LAN setup section generates one.
5. Set `FIREBASE_SERVICE_ACCOUNT_JSON` to the compact service-account JSON and choose a verified `ADMIN_EMAIL`.
6. Create and verify that admin account in Firebase, then restart the stack.

The first verified sign-in for `ADMIN_EMAIL` receives the administrator role. Administrators can create teams, pre-authorize staff emails, assign an operational role, and optionally mark a team lead in Staff Access. Staff then sign in with their verified Firebase accounts. The API verifies Firebase ID tokens and issues an app JWT for API access. Choose either Firebase (`firebase`) or LAN password (`local`) mode in both auth-mode environment variables.

Regular staff can view and manage their own customers, orders, and ledger entries. Team leads can view their own team’s records. Administrators can view and manage all records. Operational roles still control which actions staff can perform; team-lead access does not grant edit access to another staff member’s records. Operations and administrators can assign shipments to warehouse staff. Warehouse accounts see only the shipment fields needed for their assigned tasks; team leads can see their team’s tasks, while only the assignee can update a task. Warehouse staff cannot open customer, order-detail, or payment screens.

The Warehouse workspace manages shared inventory across named locations. Order numbers are encoded as Code 128 package labels that can be printed from order details. Warehouse staff scan with a keyboard-wedge barcode reader (configured to send Enter) or type the order number into the Warehouse lookup. Lookup is limited to assigned work (team leads can view their team’s tasks) and exposes only shipment fields and inventory activity. From a scanned task, staff can receive against buy orders, pick stock for ready transport orders, and dispatch picks. The final dispatched pick moves the shipment to In transit; stock balances and movement history update with each operation.

## Workspace

- `web`: React, TypeScript, Redux Toolkit with persisted preferences, Ant Design, Bootstrap, and Firebase client auth.
- `api`: NestJS REST API with JWT sessions, Firebase Admin token verification, TypeORM, and PostgreSQL.
- `docker-compose.yml`: local app and database services, using the development Dockerfiles.

## Production deployment

Production containers use separate multi-stage Dockerfiles: the API builds NestJS and runs as the unprivileged Node user; the web image serves the compiled SPA through unprivileged NGINX. The API requires `NODE_ENV=production`, an explicit HTTPS `WEB_ORIGIN`, a non-demo auth mode, a strong `JWT_SECRET`, and either `DATABASE_URL` or Cloud SQL connection settings. Database migrations run explicitly through `node dist/run-migrations.js` before API rollout; production replicas do not run migrations during startup.

For Cloud Run deployment, image builds, Cloud SQL, service accounts, secrets, migrations, probes, and rollout steps, see [deploy/gcp/README.md](deploy/gcp/README.md). Use Firebase authentication for public production access, store server credentials in Secret Manager, and configure Cloud SQL backups and recovery before onboarding staff. Do not publish the development Compose ports to the internet.
