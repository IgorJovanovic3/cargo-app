# Public portfolio demo

The `portfolio/public-demo` branch runs the real Python/FastAPI backend and React frontend as one Render web service. The root `render.yaml` on this branch describes one **Free** service, with no paid database or disk.

## Deploy

[Deploy this demo on Render](https://render.com/deploy?repo=https://github.com/IgorJovanovic3/cargo-app/tree/portfolio/public-demo)

Review the Blueprint and ensure the compute plan remains Free. Render generates the private JWT signing key. The public demo account passwords below are intentionally separate from that key.

The deployment URL is assigned by Render after the service is created. No live URL is assumed here.

## Try the application

Open `/login` on the deployed service and choose **Try as Client** or **Try as Driver**. No registration is needed.

| Demo role | Email | Public demo password |
| --- | --- | --- |
| Client | `client@cargo.example` | `CargoDemo2026!` |
| Driver | `driver@cargo.example` | `CargoDemo2026!` |

There is no public administrator account.

Suggested walkthrough:

1. Enter as the client and inspect the six fictional shipments, map, QR code and existing chat.
2. Create a new shipment using **Use a fictional demo shipment**. Wait for the price calculation, then submit.
3. Use a separate browser/incognito session to enter as the driver, accept a pending shipment, and update its status.
4. Open the shipment chat from both sessions to exchange test messages.
5. Inspect the simulated driver movement and try delivery confirmation, ratings and the Excel export.

Use different browser sessions when testing both roles simultaneously, since one origin has one login token in local storage.

## Demo behavior

- Accounts, profiles, shipments and messages are fictitious and shared among visitors.
- The separate `cargo_demo.db` is reset to the initial dataset each time the backend starts.
- Demo reset refuses a database containing non-demo users or a non-SQLite database.
- Signup, profile changes, password resets and outgoing email are disabled in demo mode.
- Driver movement is simulated. The demo does not request the visitor's GPS position.
- Shipment and message counts are capped; chat messages must contain 1–2000 characters.
- WebSockets authenticate using JWT in an offered subprotocol, check identity/role and shipment participation, and keep rooms and browser connections separate.
- The frontend uses the same origin as the API in a hosted build.
- Automatic code-triggered deployment is disabled; a source change requires an explicit deploy.

Render Free web services can sleep after inactivity and need time to wake up on the first visit. Their local filesystem is disposable, which is suitable for this resettable demo. This mode is not intended for business records, real customer information or a production courier service.

## Checks

The backend regression suite covers login, demo reset safeguards, shipment acceptance/completion/export, WebSocket access checks, multi-socket delivery, chat delivery, and serving the actual frontend build from FastAPI. External maps, route services, camera hardware, and browser rendering require separate manual checks.

## Local use

Ordinary local development continues with `DEMO_MODE=false` and `SERVE_FRONTEND=false`, using the two terminal workflow in the main README. To run the hosted demo shape locally, build the frontend without an API URL, enable both flags, and point `DATABASE_URL` to a **separate disposable** SQLite database. Do not reuse your ordinary local database.
