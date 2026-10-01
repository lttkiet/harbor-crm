# Project progress

Updated: 2026-10-01

## Implemented

- Customer records for individuals and businesses, buy and transport orders, order-linked ledger entries, staff and team access, logistics tracking, and warehouse inventory operations.
- Customer ownership scopes related orders and payments. Administrators can access all records; team leads can view their team’s records; operational roles control changes.
- LAN password and Firebase authentication modes, temporary-password onboarding, and required password changes at first sign-in.
- Shared daily order sequence: `mh-DDMMYYYY-N` for buy orders and `kg-DDMMYYYY-N` for transport orders. The sequence is shared by both order types.
- Code 128 package labels, print action, and warehouse barcode/order-number lookup. Warehouse lookup returns operational shipment and movement data only.
- Warehouse locations, item stock, receiving, picking, and dispatch. Dispatching the final pick moves a ready shipment to in transit.

## Verification completed

- API and web production builds succeeded in the isolated Docker QA environment. Vite reported that the Ant Design vendor chunk exceeds its default size warning threshold.
- API access checks covered administrator, assigned warehouse staff, same-team warehouse lead, finance restrictions, and cross-team warehouse isolation. Warehouse lookup responses excluded customer and payment fields.
- Browser workflow covered scanning an order, receiving stock for a buy order, picking and dispatching a transport order, and confirming inventory and shipment status changes.
- The isolated QA containers, volumes, network, and temporary files were removed after verification. The developer’s regular Compose environment was not changed.

## Handoff and remaining work

- The full visual and use-case review across every application role is not yet complete; continue it on the next machine.
- Local credentials are intentionally excluded from Git. On the new machine, copy `.env.example` to `.env`, configure the required auth and database values, then start the app with `docker compose up --build`.
