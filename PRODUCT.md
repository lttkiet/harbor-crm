# Harbor CRM Product Document

- **Document status:** Current-state product and UX specification
- **Last reviewed:** 2026-10-01
- **Audience:** Product, operations, engineering, and administrators

This document describes Harbor’s current product scope and the behavior implemented in this repository. Statements marked **Decision needed** identify policy questions that the code or README does not settle. The implementation is the source for present behavior; this document does not claim that proposed measures have been collected or that unspecified capabilities exist.

## 1. Product summary

Harbor is an internal workspace for coordinating customer records, goods sourcing, transport, payment and cost entries, shipment updates, and warehouse stock. Operations staff create customer work, operations and warehouse staff coordinate fulfillment, finance users review money movement, and administrators configure access.

The current product is designed around staff ownership and team visibility. In authenticated staff workflows, the customer creator becomes its owner; orders and ledger entries follow that customer’s access scope. Local demo-created customers have no individual staff owner and appear as Administrator-owned. Administrators can see and manage all customer work. Team leads can view their team’s records, while staff actions on customer records remain restricted to the record owner or an administrator. Warehouse tasks have a separate assignee scope.

The workflow includes local development and two staff sign-in modes: LAN password authentication and Firebase Authentication. Local development uses a demo administrator session and is restricted to development mode.

## 2. Product goals

The capabilities in the repository support these intended outcomes:

- Keep customer, order, delivery, and money records linked in one workspace.
- Give staff a clear list of their work and give team leads visibility across their team.
- Make sourcing and transport status visible to operations and authorized warehouse staff.
- Track customer charges and payments alongside supplier or carrier costs and payouts.
- Track physical stock by item and warehouse location, with a history of receipts, picks, and dispatches.
- Limit each role to the customer, financial, shipment, and administrative information needed for its work.

These are product intents inferred from the shipped workflows. The repository does not include analytics or baseline measurements for them.

## 3. Users and permissions

Team-lead access is an additional visibility setting for an account. It does not grant edit rights to another staff member’s customer records.

| User | Current product access |
| --- | --- |
| Administrator | All customers, orders, and financial records; shipment updates and warehouse assignment; shared warehouse catalog and inventory; staff and team setup; local temporary-password reset. |
| Operations staff | Create customers and orders; view own records; update own customers, shipment details, delivery status, and ledger entries; assign warehouse work to eligible warehouse staff. |
| Operations team lead | Operations capabilities on own records plus read-only visibility into team members’ customers, orders, and finance records. Cannot edit a teammate’s customer or order. |
| Warehouse staff | See assigned warehouse tasks and the operational shipment fields needed to fulfill them; receive stock, pick eligible work, dispatch picks, update permitted shipment statuses, and use shared inventory tools. Cannot open customer, order-detail, or finance screens. |
| Warehouse team lead | See team warehouse tasks and task details. Only the assignee can update a task. Shared inventory tools are available to warehouse accounts. |
| Finance staff | View customers, orders, and finance summaries within the account’s record scope. Finance navigation excludes logistics, warehouse, and staff administration. Current write behavior is described under [open product decisions](#9-open-product-decisions). |
| Finance team lead | Finance visibility across the team’s records, with teammate records remaining read-only under the current ownership rule. |

### Access matrix

“Own” means customer records owned by the signed-in staff member. “Team view” means read-only visibility to records owned by staff assigned to the same team.

| Capability | Admin | Operations | Warehouse | Finance |
| --- | --- | --- | --- | --- |
| View customers and customer details | All | Own; team view for team leads | No | Own/team scope, read-only |
| Create or edit customers | All | Create; edit own | No | No |
| Create orders | All | For own customers | No | No |
| View order details and ledger | All | Own; team view for team leads | No order-detail screen | Own/team scope, read-only for others’ records |
| Add ledger entries | All | Own customers’ orders | No | API/UI allow only where ownership passes; see open decision |
| Update logistics | All | Own customer orders | Assigned tasks only | No |
| Assign warehouse staff | All | Own customer orders; eligible same-team warehouse staff | No | No |
| View warehouse task data | All | Shipment list through logistics | Assigned tasks; team tasks for warehouse leads | No |
| Receive, pick, or dispatch task stock | All | No | Assigned task only | No |
| Manage shared inventory catalog and locations | All | No | Yes | No |
| Manage staff and teams | Yes | No | No | No |

## 4. Core records

### Customer

A customer is an individual or a business. Records contain a name, type, optional contact person and tax ID for businesses, email, phone, address, owner, and creation time. Email is normalized to lowercase by the API. In normal authenticated staff creation, the creator is the owner. The development demo administrator has a synthetic identity with no staff row, so demo-created records have a null owner and display Administrator in the UI. Customer deletion is not part of the current interface.

### Order

An order belongs to one customer and has an internal UUID plus a human-readable order number. Buy orders use `mh-DDMMYYYY-N`; transport orders use `kg-DDMMYYYY-N`. Both order types share a daily sequence in the `Asia/Ho_Chi_Minh` time zone.

Each order records a customer total, estimated cost, notes, origin and destination, status, and creation/update times. Buy orders may include a supplier and item details (name, quantity, and unit cost). Transport orders include a cargo description and may include carrier and tracking information. The current creation form captures one buy-order item or one transport cargo description.

Supported statuses are `new`, `sourcing`, `ready`, `in_transit`, `delivered`, and `cancelled`. A new buy order starts at `sourcing`; a new transport order starts at `new`. A delivery update stores a status, note, actor, and timestamp. Shipment fields such as carrier, tracking number, route, and warehouse assignee are updated through this workflow. When every pick for a ready order has been dispatched, the warehouse flow moves it to `in_transit` and records a delivery update.

### Ledger entry

Ledger entries are linked to an order and contain a type, amount in VND, occurrence date, and optional method, reference, and notes. Types are customer charge, customer payment, supplier cost, supplier payment, carrier cost, and carrier payment. Entries are appended through the current UI; edit and delete actions are not exposed.

The finance view summarizes billed total, customer payments received, remaining balance, recorded costs, vendor payouts, estimated margin, and margin after recorded costs. Billed total includes the order’s customer total plus customer-charge entries. Estimated margin subtracts the estimate; margin after recorded costs subtracts recorded supplier and carrier costs.

### Warehouse records

The shared warehouse catalog contains items identified by a unique SKU and named locations identified by warehouse name and location code. Stock is tracked for each item/location pair with quantity on hand and quantity picked. Available quantity is on-hand minus picked quantity; the item’s reorder level drives the replenishment indicator.

Warehouse movements record receipts, picks, and dispatches, including quantity, item, location, optional linked order, actor, note, timestamp, and source pick for a dispatch. A dispatch can only consume a pick once. Stock changes and dispatch creation run inside database transactions.

### Staff and team

Staff records use one of four roles: administrator, operations, warehouse, or finance. Staff can be assigned to a team and optionally marked as a team lead. Administrators can list staff, add staff, create teams, and set temporary LAN passwords. Staff/team editing, deactivation, and deletion are not exposed in the current product.

## 5. Primary workflows

### A. Set up the workspace

1. The administrator starts Harbor in demo, LAN password, or Firebase mode.
2. In a configured environment, the administrator creates teams and adds staff with roles and optional team-lead visibility.
3. In LAN mode, each new staff account receives a temporary password and must replace it on first sign-in. Administrators can issue a replacement temporary password.
4. In Firebase mode, administrators pre-authorize staff by email; users sign in with verified Firebase email accounts.

### B. Manage customer work

1. Operations staff add a customer as an individual or business.
2. In authenticated staff mode, the creator becomes the customer owner. The local demo administrator is shown as Administrator and has no individual owner ID.
3. The owner creates a buy order or transport order for that customer.
4. The system assigns the order number and its initial status.
5. Staff search customers and orders, filter orders by type, and open order details.
6. Team leads can view team records in read-only mode; administrators can access all records.

### C. Coordinate a shipment

1. Operations or an administrator opens a shipment in Logistics.
2. They update status and shipment details, and may assign warehouse staff. Operations can assign only warehouse staff on the order owner’s team.
3. The assigned warehouse user sees the task in Logistics and Warehouse. A warehouse team lead can view a teammate’s task, but cannot perform task actions for it.
4. Shipment updates appear in the order detail timeline.

### D. Receive, pick, and dispatch stock

1. Warehouse staff add a catalog item and storage location when needed.
2. Staff receive stock into a location, optionally linking a buy order.
3. For a ready assigned shipment, staff pick available stock. A pick reserves quantity by increasing the picked amount.
4. Dispatch consumes the picked quantity and writes a linked dispatch movement.
5. Once all picks for a ready order are dispatched, its status moves to `in_transit`.
6. Warehouse activity and stock balances show the resulting changes.

Order numbers are encoded as Code 128 labels. Staff can print a label from order details or look up an assigned task by scanning a keyboard-wedge barcode reader configured to send Enter, or by typing the order number.

### E. Review money movement

1. Operations or administrators record customer charges/payments and supplier or carrier costs/payouts on an order they can manage.
2. The order detail shows ledger entries and calculated totals.
3. The Finance workspace presents aggregated totals and one row per visible order.
4. Team leads can review team financial records without gaining edit access to another staff member’s order.

## 6. Functional requirements and acceptance criteria

The following requirements describe the current documented product scope. “Implemented” means the current repository contains the described workflow; builds and prior browser review provide implementation evidence.

| ID | Requirement | Acceptance criteria | Current status |
| --- | --- | --- | --- |
| FR-01 | Authenticate and onboard staff | Local and Firebase modes issue API sessions; local passwords are hashed; temporary passwords require change before other API use; development demo auth is development-only. | Implemented |
| FR-02 | Manage customers | Operations can create and edit own customer records; admin can manage all; team leads can view their team; individuals and businesses have the appropriate fields. | Implemented |
| FR-03 | Create and find orders | Operations/admin can create buy and transport orders; order numbering is unique per day and shared across types; list search and type filtering work within the user’s scope. | Implemented |
| FR-04 | Track shipment progress | Authorized staff can add status updates and shipment details; warehouse updates are limited to active shipment statuses; the final dispatch moves a ready shipment to in transit. | Implemented |
| FR-05 | Record and review ledger activity | Supported charge/payment/cost/payout types attach to an order; finance totals and balances are derived from ledger and order values; access follows the order’s customer scope. | Implemented; write policy needs clarification |
| FR-06 | Configure teams and staff | Admin can create teams, add role-scoped staff, set team-lead visibility, and issue LAN temporary passwords. | Implemented for create/reset; ongoing staff maintenance needs clarification |
| FR-07 | Fulfill assigned warehouse work | Warehouse users can look up authorized tasks, receive stock, pick stock, dispatch picks, and inspect movements; teammate task details are view-only. | Implemented in the UI; server-side pick type rule needs clarification |
| FR-08 | Protect sensitive data by role | Warehouse task responses omit customer and payment details; cross-team records are not visible; role checks apply at the API as well as in navigation and actions. | Implemented and reviewed |
| FR-09 | Operate on supported local infrastructure | Docker Compose starts web/API/PostgreSQL; production config uses migrations and requires a strong unique JWT secret; LAN deployment keeps database bound to loopback by default. | Implemented/configuration documented |

## 7. Quality and operational requirements

- **Authorization:** Enforce role and record ownership at the API boundary. Client-side hidden controls are not a substitute for server checks.
- **Data integrity:** Keep stock balances nonnegative; prevent duplicate dispatch of one pick; apply inventory changes and dispatch records transactionally; preserve order/customer and movement relationships.
- **Privacy:** Return only shipment fields required by warehouse work. Warehouse users must not receive customer, ledger, or order-detail data through task APIs.
- **Authentication:** Use verified Firebase identity or LAN passwords with bcrypt hashes; use short-lived API JWTs and session-version invalidation for password resets.
- **Network exposure:** Local development defaults to loopback. LAN operation requires explicit bind/origin configuration and firewall restriction. Do not publish development ports to the public internet.
- **Production operations:** Use HTTPS termination, configure a unique secret, run schema migrations, and maintain database backups. Backup/restore procedures are operational requirements; no backup job is included in this repository.
- **Locale and currency:** Display money in VND and generate order-number dates using the Vietnam time zone. The UI labels are English.
- **Responsive use:** Main pages use responsive layouts and horizontally scrollable data tables where columns exceed the viewport.
- **Failure handling:** The UI surfaces API load and save errors with retry paths for selected list loads. The API exposes a health endpoint.

## 8. Success measures to define

The repository does not currently collect product analytics. A rollout owner should set baselines and targets for:

- Time from customer creation to first order.
- Share of active shipments with a current status, carrier, and tracking reference.
- Time from receiving a warehouse task to first inventory movement.
- Inventory discrepancies found during physical counts.
- Share of orders with customer payments and actual costs recorded.
- Failed or unauthorized cross-team access attempts.
- Staff onboarding completion and password-reset frequency.

## 9. Open product decisions

These items are intentionally visible because the current docs or API/UI behavior do not define one unambiguous product policy.

1. **Finance write access.** The finance role can open ledger APIs, but service authorization only permits adding entries when the user owns the customer (or is admin). The product does not let finance users create customers or orders, so finance users normally have no owned orders to update. Decide whether Finance is a reporting-only role or can post entries for team orders under a separate approval/audit policy.
2. **Order status transitions.** The UI offers the full status list to operations/admin, and the API validates status values but not a transition graph. Define allowed transitions, cancellation behavior, reopening rules, and whether status changes should depend on order type.
3. **Warehouse pick eligibility.** The user workflow describes picking stock for ready transport shipments. The UI offers ready assigned tasks, while the API checks readiness and assignment without explicitly requiring `type === 'transport'`. Confirm the policy and align server validation.
4. **Team lead warehouse rights.** Team leads can view teammate tasks but only assignees can update them. Warehouse catalog/location management and unlinked receipts operate on shared inventory for warehouse accounts. Confirm whether all warehouse staff should have these shared-inventory write permissions.
5. **Staff lifecycle.** Admin can add and password-reset users, but cannot edit their role/team/lead setting or deactivate/delete an account from the UI. Decide the lifecycle and record-retention policy before implementing those actions.
6. **Order corrections.** Orders can be created and followed, but there is no order-edit endpoint or UI. Shipment details can be updated separately, and financial changes can be appended as ledger entries. Decide which order fields may be corrected after creation and how changes should be audited.
7. **Reporting and data exchange.** Current finance is a screen-level summary. CSV export, accounting integration, import, scheduled reports, and customer-facing access are not described in the current implementation. Confirm whether any belong in scope.

## 10. Current product boundaries

The implemented workspace covers internal customer and fulfillment operations. The repository does not define a sales-lead pipeline, marketing automation, quotation/contract approval, invoice issuance, multi-currency accounting, customer portal, notification delivery, or third-party carrier integrations. Treat these as future scope decisions, not shipped capabilities.

## 11. Implementation reference

- Web client: React, TypeScript, Vite, Ant Design, Redux Toolkit, and Firebase client authentication (`web/src`).
- API: NestJS REST API with session guard, DTO validation, role checks, TypeORM, and PostgreSQL (`api/src`).
- Data: customer/order/ledger/delivery/staff/team entities plus inventory item/location/stock/movement entities.
- Local orchestration: `docker-compose.yml`; configuration template: `.env.example`.
- Operator setup and security notes: [README.md](README.md).

## 12. Information architecture

### Navigation by role

The workspace has one Overview entry and role-filtered sections. A section is not rendered when the role is not allowed to use it, and the API applies its own role checks.

| Role | Visible navigation |
| --- | --- |
| Administrator | Overview, Customers, Orders, Logistics, Finance, Warehouse, Staff access |
| Operations | Overview, Customers, Orders, Logistics, Finance |
| Warehouse | Overview, Logistics, Warehouse |
| Finance | Overview, Customers, Orders, Finance |

The selected workspace section and order type filter are persisted in browser local storage. Preferences are scoped to the signed-in user; switching users resets them to Overview and all order types. LAN API credentials use session storage. Firebase session persistence is managed by Firebase Authentication.

### Desktop shell

- Fixed left navigation rail: 236 px wide, with Harbor brand, workspace caption, role-filtered navigation, API health status, and the Vietnam · VND locale label.
- Sticky top bar: 72 px high, with user avatar, email, role, and sign-out control.
- Main content: offset for the navigation rail, with page heading, optional primary action, metrics, and bordered/raised content cards.
- Selecting an order from Overview or Orders opens order detail in a right-side drawer. Logistics opens the same detail view for authorized non-warehouse roles.

### Responsive shell

- At widths up to 991 px, the desktop rail is replaced with a mobile Harbor header and a left navigation drawer 280 px wide. The user avatar and sign-out stay in the header.
- At widths up to 600 px, content padding and card padding contract, page headings and toolbars stack vertically, and tables scroll horizontally within their container.
- The document minimum width is 320 px. Modal width is constrained to the viewport with a 12 px side margin at the narrow breakpoint.
- Tables preserve their columns and use horizontal scrolling; the Finance table has a minimum horizontal content width of 1,020 px.

## 13. Screen-by-screen behavior

This section describes current UI structure and behavior. It is a product and implementation specification, not a claim that every screen has been usability-tested on every device.

### 13.1 Sign-in and password onboarding

**Local password mode** shows a centered card with work email and password. Email is required and validated as an email address. Password is required. API authentication errors appear as an inline error alert. The password field has a visibility toggle.

**Firebase mode** uses the Firebase email/password sign-in view and exchanges a verified Firebase identity token for Harbor’s API session. Missing Firebase client settings produce a configuration error. If an authorized Firebase account is not linked to staff, the user is denied access and the client signs the Firebase session back out.

**Development demo mode** offers a single Continue as demo admin action. No credential check is performed in this mode; the API and configuration restrict it to development on loopback.

**First sign-in** requires the staff member to enter the temporary/current password, choose a new password, and confirm it. The new password must contain at least 12 characters and no more than 72 UTF-8 bytes. A mismatched confirmation is rejected. The user may sign out instead. While the password change is required, protected API operations are denied.

**Loading:** before auth restoration completes, the page shows Loading your workspace…. The current interface does not expose a separate account-recovery flow; local users require an administrator to set a new temporary password.

### 13.2 Overview

The page title is Good morning. Operations, Finance, and Admin see four metrics: customer count, all order count, active order count, and delivered order count. Active means new, sourcing, ready, or in_transit. A recent-orders table shows up to eight latest orders with order number/type, customer, status, and customer total. Selecting a row opens the order in Orders.

Warehouse users see assigned-task count, ready-to-pick count, in-transit count, and delivered count. The warehouse overview has no customer or recent-order table. For team leads, counts include the team tasks returned by the warehouse task scope, including view-only tasks.

Metrics show loading placeholders while requests are pending. If the API fails, an error alert offers a retry. A successful empty result displays zero metrics and an empty table state.

### 13.3 Customers

The Customer Directory contains a search field for customer name, email, or phone and a table with customer identity/type, owner, phone, email, and row actions. The table displays eight rows per page and can scroll horizontally.

Operations and Admin see Add customer. Admin can edit any visible customer; Operations can edit only a customer they own. Other visible records have a View action only. Customer details open in a modal. Business records display contact person and tax ID; individual records omit those fields.

The create/edit modal fields are Customer type, name, contact person and tax ID for businesses, phone, email, and address. Changing type to Individual removes the business-only fields. Name is required; email, when supplied, must have a valid email form. Save buttons show a busy state while the API request runs. Success closes the modal, shows a confirmation message, and reloads the table. Failures show an error message while leaving the editor open.

If search returns no matches, the table shows its empty state. Load failures show a retry alert. Search is sent as the input changes; it is not currently debounced.

### 13.4 Orders

The Orders page includes a search field for order number or customer and a persistent type filter: All types, Buy orders, or Transport orders. The table has order number/type, customer, current status, and customer total. It shows eight rows per page. Selecting a row opens a right drawer no wider than 600 px or the viewport.

Admin and Operations see New order. The modal starts with Buy selected and asks for type and customer. Buy orders require an item description and positive whole-number quantity; supplier and unit cost are optional. Transport orders require a cargo description. Both types can record origin, destination, customer total, estimated cost, and notes. Monetary inputs are whole VND values. The current screen has a single buy item entry; the API data model supports an array of items.

The create modal displays a customer-load error with retry and disables customer selection while the list is unavailable. Successful creation closes the modal and reloads the table. The UI does not expose an order edit action after creation.

### 13.5 Order detail

Order detail is a drawer that contains:

1. Order number and status tag.
2. Order type, customer name, and creation date in Vietnam time.
3. Printable Code 128 package label.
4. Customer total/billed amount, customer payments received, and estimated margin cards.
5. Available order fields: supplier, items, cargo, origin, destination, carrier, tracking, and notes. Empty optional fields are omitted.
6. Delivery update timeline, newest update first.
7. Ledger table with type, occurrence date, and amount.

Admin and the customer owner can add delivery updates subject to the role policy. Operations/Finance/Admin can add a ledger entry only when the user passes the ownership rule; the Finance team-lead case is called out in the open decisions. The delivery modal asks for status and note. The ledger modal asks for entry type, positive amount, occurrence date, and optional method, reference, and notes. Saves prevent duplicate submission while pending and refresh the drawer afterward.

The drawer has no explicit order-edit, delete, or ledger-entry correction action. The print action opens the browser print dialog with the package-label print layout.

### 13.6 Logistics

Admin and Operations see Shipment tracking. Warehouse sees Assigned shipments. The page shows counts for ready-to-ship, in-transit, and delivered work, plus a search field and status selector. Cancelled is excluded from the selector’s named options, though an all-status list can still contain cancelled records.

For Admin/Operations, the table shows shipment number/type, customer, route/cargo, carrier/tracking, warehouse assignee, and status. Warehouse sees shipment number/type, route/cargo, carrier/tracking, status, and an action/view-only column; customer and warehouse-assignee columns are omitted. Team-lead rows belonging to coworkers are labeled Team task · view only. Operations team leads can open details but not update teammate records.

Authorized users can open Update shipment, which asks for status, carrier, tracking number, origin, destination, and an update note. Admin/Operations also select or clear an assignee. Warehouse can select only ready, in_transit, or delivered in this form. Operations can assign only warehouse users returned by the same-team assignee query; Admin can assign any warehouse user.

Operations/Admin search is sent to the API by order/customer name. Warehouse filtering is client-side over the assigned task list and checks order number, origin, destination, cargo, and item names. The table displays eight rows per page and scrolls horizontally when needed.

### 13.7 Finance

The Finance page shows four summary cards: customer charges, payments received, paid to suppliers/carriers, and estimated costs. A table shows up to ten rows per page, with order, customer, billed, received, balance, recorded costs, paid out, estimated margin, and margin after recorded costs. The table scrolls horizontally on narrow screens; there is no current search, date filter, export, or row drill-down action.

If finance data fails to load, an error alert offers retry. An empty result renders an empty table and zero totals. The page totals use the full returned set, not just the current visual table page.

### 13.8 Warehouse

The Warehouse page is available to Admin and Warehouse. Its header combines a barcode/order-number input with Find package, Refresh, Add location, Add item, Receive stock, and Pick for dispatch actions. The input clears and regains focus after lookup to support keyboard-wedge scanners.

When a task is found, a Package lookup card shows order number/type/status, barcode and print action, origin/destination, cargo or item names/quantities, carrier, tracking number, and linked inventory activity. An assignee can receive for a buy order or pick for a ready task, depending on task type/status. A warehouse team lead can look up a teammate’s task and inspect the activity but receives no task-specific mutation controls. Lookup errors are shown as dismissible warnings.

Three stock metrics show available units, locations/items needing replenishment, and ready shipments assigned to the current user. Tabs organize the workspace:

- **Stock on hand:** item, location, on-hand, picked, and available quantity. Eight rows per page. Available quantities at or below reorder level are marked for replenishment.
- **Warehouse activity:** movement, type, quantity, location, linked order, and eligible Dispatch action. Eight rows per page. The API caps recent movement results at 200.
- **Items and locations:** side-by-side item catalog and location lists on wide screens; stacked on narrow screens. Six rows per table page. Add actions open modals.

Add-item modal fields are SKU, item name, unit (default each), and reorder level (default zero). Add-location fields are warehouse name, location code, and optional address/description. Receive and Pick modals ask for item, location, quantity, and optional notes; receive can be linked to a buy order, while pick requires an eligible assigned shipment. A pick cannot exceed stock available at that item/location. Dispatch is offered for a pending pick available to the current assignee.

The page uses shared inventory for every warehouse account. Task lookup/actions are assignment-scoped. Exact read/write permissions for shared inventory are an open decision.

### 13.9 Staff access

Only Admin sees Staff access. The page has New team and Add staff actions, an informational banner based on auth mode, and a non-paginated staff table. Columns show email, role, team, record visibility, and authentication status. Local mode adds Set temporary password per staff member.

Add staff asks for work email, role (Operations/Warehouse/Finance; admin cannot be granted here), optional team, and team-lead access. Team-lead access requires a team. In local mode, a temporary password is required. Firebase mode shows pending vs active Firebase linkage. Demo mode explains that it stores staff records but does not provision staff sign-in.

New team asks for a name. Temporary-password reset asks for a replacement password. Successful actions reload staff/team data and show a confirmation. Duplicate email and team names are rejected. Staff, role, and team changes are not exposed after creation.

### 13.10 Search, sorting, and pagination

| List | Search/filter | Default ordering | Page size and source |
| --- | --- | --- | --- |
| Customers | Case-insensitive partial match on name, email, or phone | Newest customer first | Eight rows; API returns all matches, browser paginates |
| Orders | Case-insensitive partial match on order number or customer; type filter | Newest order first | Eight rows; API returns all matches, browser paginates |
| Recent orders | None on the dashboard | Newest order first | Up to eight rows returned by API |
| Logistics, Admin/Operations | Order number/customer search; status selector | Newest order first | Eight rows; browser paginates |
| Logistics, Warehouse | Client-side match on order number, route, cargo, item names; status selector | Recently updated task first | Eight rows; API returns authorized tasks |
| Finance | No search or filter | Newest order first | Ten rows; API returns all visible orders, browser paginates |
| Warehouse stock | No search/filter | SKU, warehouse, then location code | Eight rows; API returns all stock rows |
| Warehouse activity | No search/filter | Newest movement first | Eight visible rows; API caps the list at 200 |
| Warehouse items | No search/filter | SKU ascending | Six rows; API returns catalog |
| Warehouse locations | No search/filter | Warehouse name then location code | Six rows; API returns locations |
| Staff access | No search/filter | Newest staff record first | No pagination |
| Team options | No team directory screen; options appear in the Add staff selector | Team name ascending | Loaded as selector options |
| Warehouse assignees | Searchable email selector in shipment assignment | Staff email ascending | Loaded as assignment options |

Tables do not expose column sorting controls. Search fields issue requests as their values change unless the Warehouse task list is being filtered locally. There is no server-side pagination, export, saved filter, or bulk action in the current product.

## 14. Visual design specification

The visual implementation uses Ant Design components with application-specific CSS. Bootstrap CSS is also loaded, but the interface’s forms, layout, tables, alerts, menus, drawers, and modals are primarily Ant Design.

### Layout and type

| Element | Current specification |
| --- | --- |
| Base background | #f4f7fb; body minimum width 320 px |
| Primary text | #182333; page headings #172438 |
| Navigation rail | White, 236 px wide, 1 px #e8edf3 right border |
| Top bar | White, 72 px high, sticky, 1 px #e8edf3 bottom border |
| Desktop content | 34 px top / 36 px sides / 54 px bottom padding |
| Page title | Manrope/sans-serif stack, 28 px, weight 750; 24 px below 600 px viewport |
| Body font | Arial/sans-serif |
| Cards | White, 13 px radius, subtle #1b2a3d08 shadow; 22 px body padding, 14 px on small screens |
| Login card | Max width 420 px, 18 px radius, 36 px body padding (27 px small screens) |
| Main breakpoint | 991 px: replace rail with mobile nav drawer; remove content left margin |
| Small breakpoint | 600 px: stack headings and toolbars; reduce content and card padding |
| Modal and drawer corners | 13 px radius |

Manrope is named in CSS for brand, headings, and metric numbers but is not bundled or imported by the current repository; browsers use their sans-serif fallback unless the environment supplies it.

### Color and meaning

| Use | Color treatment |
| --- | --- |
| Brand mark | White icon over a diagonal gradient from #4467e8 to #6d4ed3; 12 px radius |
| Primary action/selection | Ant Design primary indigo; selected nav uses indigo text on #f0f2ff |
| Violet metric | #6953d6 on #f0edff |
| Blue metric | #4277dc on #eaf2ff |
| Amber metric | #cc8b1d on #fff4df |
| Green metric | #21966a on #e5f7ee |
| API health | Green #2ab87f online, red #e05252 offline, neutral gray while checking |
| Status tags | New neutral, Sourcing processing, Ready cyan, In transit blue, Delivered green, Cancelled red |
| Customer type tags | Business geekblue; Individual purple |

Tables use compact 12 px body text, uppercase 10 px headers, and soft gray header backgrounds. Positive and negative roles are conveyed by both text labels and color. Primary actions use filled Ant Design buttons; row actions are text or small ghost buttons.

### Print design

The print stylesheet creates one 100 mm × 60 mm white package label with 4 mm inner padding, HARBOR wordmark, order type, Code 128 barcode sized 88 mm × 28 mm, and printable order number. The preview barcode uses Code 128 with dark #172438 lines on white. Print CSS hides the rest of the page.

## 15. Field, validation, and formatting reference

Limits below combine current UI rules and API DTO validation. Server validation is authoritative. Monetary limits are whole numbers from 0 through 999,999,999,999 VND for order/item values and 1 through 999,999,999,999 VND for ledger entries.

| Form/record | Field | Rule |
| --- | --- | --- |
| Customer | Type | Required: business or individual. |
| Customer | Name | Required, trimmed, max 180 characters. |
| Customer | Contact person | Optional, business-only in UI, max 180 characters. |
| Customer | Tax ID | Optional, business-only in UI, max 40 characters. |
| Customer | Email | Optional; valid email if supplied; max 180 characters; API stores lowercase. |
| Customer | Phone | Optional, max 40 characters. |
| Customer | Address | Optional, max 1,000 characters. |
| Order | Type/customer | Required type (buy/transport) and valid customer UUID. |
| Buy order | Item name | Required by API, trimmed, max 180 characters. |
| Buy order | Quantity | Integer of at least 1. API permits multiple items; UI currently creates one. |
| Buy order | Supplier | Optional, max 200 characters. |
| Buy order | Unit cost | Integer VND, 0 through 999,999,999,999. |
| Transport order | Cargo | Required, trimmed, max 2,000 characters. |
| Order | Origin/destination | Optional, max 500 characters each. |
| Order | Customer total/estimated cost | Optional integer VND, 0 through 999,999,999,999; UI initializes both to 0. |
| Order | Notes | Optional, max 5,000 characters. |
| Ledger | Type | Required one of the six ledger kinds listed in Core records. |
| Ledger | Amount | Required positive integer VND, max 999,999,999,999. |
| Ledger | Date | Required date; UI displays DD/MM/YYYY and posts ISO date. |
| Ledger | Method/reference/notes | Optional; max 80 / 120 / 5,000 characters. |
| Delivery update | Status | Required supported status enum. Note max 5,000; carrier/tracking max 200; origin/destination max 500. |
| Warehouse location | Name/code | Required; max 180 / 60 characters; uniqueness is name + code; code is uppercased by API. |
| Inventory item | SKU/name/unit | Required SKU and name, max 80 / 180; optional unit max 30, default each; SKU is uppercased and unique. |
| Inventory item | Reorder level | Integer 0 through 1,000,000; UI default 0. |
| Receipt/pick | Quantity | Integer 1 through 1,000,000; receipt may link a buy order; pick requires an order. |
| Receipt/pick | Item/location/order | Valid UUIDs. Linked receipt must target a buy order; pick requires ready status and an assigned task. |
| Staff | Email/role | Required valid email max 180; role is Operations, Warehouse, or Finance. |
| Staff | Team/lead | Team optional; team lead boolean; team assignment required when lead is enabled. |
| Staff | Temporary password | Required in local mode, at least 12 characters and at most 72 UTF-8 bytes. |
| Team | Name | Required, trimmed, max 100 characters, duplicate names rejected. |

Dates shown in order details and order numbering use Asia/Ho_Chi_Minh. Finance currency formatting uses Vietnamese đồng with no displayed fractional digits. The API stores ledger/order numerics at two decimal places, while current forms accept integer VND values.

## 16. Status, money, and inventory rules

### Order status behavior

| Status | UI label | Initial or automatic behavior |
| --- | --- | --- |
| new | New | Initial status for transport orders. |
| sourcing | Sourcing | Initial status for buy orders. |
| ready | Ready to ship | A pick can be created only after the shipment reaches this status. |
| in_transit | In transit | Applied automatically after all picks for a ready order are dispatched. |
| delivered | Delivered | Can be recorded as a delivery update by allowed users. |
| cancelled | Cancelled | Can be selected by Operations/Admin; no special cancellation workflow exists. |

Status updates append a delivery event and replace the order’s current status. The API validates enum membership but currently does not enforce a transition graph. It also does not restrict Ready to transport orders. Cancellation/reopening semantics therefore remain policy decisions.

### Financial calculations

For each order:

- **Billed total** = order customer total + customer charge ledger entries.
- **Received** = sum of customer payment entries.
- **Balance** = billed total − received.
- **Recorded costs** = supplier cost + carrier cost entries.
- **Paid out** = supplier payment + carrier payment entries.
- **Estimated margin** = billed total − estimated order cost.
- **Margin after recorded costs** = billed total − recorded costs.

Customer payments and vendor payouts are cash-flow measures; they are not subtracted from margin. The product does not currently prevent payments or costs from exceeding billed or estimated amounts, reconcile a charge against an invoice, or compute tax.

### Inventory calculations

- **Available** = quantity on hand − quantity picked.
- Receipt adds to quantity on hand.
- Pick adds to quantity picked and creates a pick movement.
- Dispatch subtracts the dispatched amount from both on-hand and picked values and creates a dispatch movement linked to its pick.
- Available stock at or below the item’s reorder level is marked for replenishment.
- Database constraints prevent negative quantities and picked quantity above on-hand. A unique constraint permits at most one dispatch movement for a source pick.

## 17. API capability inventory

All application routes are under /api. Authenticated routes require a Harbor bearer token unless the development-only session guard is active. Request DTOs are transformed and unknown body fields are stripped by the global validation pipe.

| Route | Method | Purpose and role scope |
| --- | --- | --- |
| /health | GET | API health check; public. |
| /auth/session | POST | Exchange verified Firebase ID token for Harbor session. |
| /auth/local/session | POST | Sign in with local email/password when local mode is enabled. |
| /auth/me | GET | Return current session user. |
| /auth/password | POST | Change local password; allowed during forced first sign-in. |
| /dashboard | GET | Return role-scoped counts and recent work. |
| /customers | GET | Search customers; Admin, Operations, Finance. |
| /customers | POST | Create a customer; Admin, Operations. |
| /customers/:id | PATCH | Update an owned customer or any customer as Admin. |
| /orders | GET | Search/filter orders; Admin, Operations, Finance. |
| /orders | POST | Create buy/transport order; Admin, Operations. |
| /orders/:id | GET | Read scoped order details; Admin, Operations, Finance. |
| /orders/:id/delivery-updates | POST | Update shipment state/details; Admin, Operations, Warehouse with ownership/assignment scope. |
| /orders/:id/ledger | POST | Append ledger entry; Admin, Operations, Finance, with customer ownership enforcement. |
| /finance | GET | Return scoped finance rows. |
| /warehouse/assignees | GET | List warehouse staff eligible for assignment; Admin, Operations. |
| /warehouse/tasks | GET | List warehouse task view models; Admin, Warehouse. |
| /warehouse/lookup?code= | GET | Return authorized task details and movement history; Admin, Warehouse. |
| /warehouse/locations | GET/POST | List or add shared locations; Admin, Warehouse. |
| /warehouse/items | GET/POST | List or add shared inventory items; Admin, Warehouse. |
| /warehouse/stock | GET | List stock by item/location; Admin, Warehouse. |
| /warehouse/movements | GET | List recent role-scoped movement history; Admin, Warehouse. |
| /warehouse/receipts | POST | Receive stock; Admin, Warehouse. Linked non-admin receipts require access to the warehouse task. |
| /warehouse/picks | POST | Reserve available inventory for an assigned ready task; Admin, Warehouse. |
| /warehouse/movements/:id/dispatch | POST | Dispatch a pending pick; Admin or task assignee. |
| /teams | GET/POST | List/create teams; Admin. |
| /staff | GET/POST | List/create staff; Admin. |
| /staff/:id/temporary-password | POST | Set local temporary password and invalidate prior sessions; Admin in local auth mode. |

Customer and order lists return all matching records in the current API implementation; pagination is applied in the browser. Dashboard recent orders are capped at eight. Warehouse task lists are not paginated; movement history is capped at 200 and task lookup activity at 100. Large installations may need server-side filtering and pagination.

## 18. Data relationships

The conceptual relationships are:

- A Team contains many Staff records; a Staff member belongs to zero or one Team.
- A Staff member can own many Customers; each Customer has zero or one owner (Admin-created demo records may have no owner).
- A Customer has many Orders. An Order has exactly one Customer.
- An Order can have many Ledger entries and Delivery updates.
- An Order can be assigned to zero or one warehouse Staff member.
- An Inventory item and Warehouse location each participate in many Inventory stock rows; a unique item/location pair has one aggregate stock row.
- An Order can be linked to many warehouse movements. A dispatch movement references its source pick movement.
- Buy-order item lines are stored as JSON on the order rather than as a separate relational table. Inventory movements are the event history; inventory stock is the current aggregate balance for an item at a location.

## 19. Product-level states and feedback

| State | Current treatment |
| --- | --- |
| Initial app load | Centered Loading your workspace… message. |
| Authenticated but API checking | Sidebar shows Checking API; then API connected or API unavailable. |
| Table request pending | Ant Design table loading indicator; dashboard uses loading metric cards. |
| Empty list | Ant Design empty state (No Data) or screen-specific guidance in Warehouse. |
| Read failure | Inline error alert with retry on Dashboard, Customers, Orders, Logistics, Finance, Staff, and Warehouse. |
| Save success | Brief Ant Design message, modal closes, list/detail refreshes. |
| Save failure | Error message; the relevant modal/page remains available for correction/retry. |
| Barcode not found/unauthorized | Dismissible warning; lookup result cleared; scan input regains focus. |
| Unauthorized route/action | API returns role/record-scoped error; UI shows returned message where request is interactive. |

There is no global notification center, background polling for every table, or offline write queue. The health indicator polls the API every 30 seconds while a signed-in user is active and checks again when the browser window regains focus.

## 20. Product decisions and design gaps

In addition to Section 9, these design-level details should be resolved before the interface is treated as a final design system:

- **Font delivery:** CSS requests Manrope but no font file or font import is present. Decide whether to bundle it or standardize on the system sans-serif stack.
- **Table-scale behavior:** Current list APIs return unpaginated matching records and tables paginate client-side. Set expected customer/order volume and server-side pagination thresholds.
- **Search behavior:** Customer/order searches issue requests as the user types. Define debounce, minimum query length, and result limits if datasets grow.
- **No-result language:** Most tables rely on the generic No Data state; Warehouse has more specific empty guidance. Decide on consistent role-aware empty copy and next actions.
- **Access-denied feedback:** APIs scope unauthorized record reads as not found in several paths. Decide whether the product should keep indistinguishable not-found behavior or show a role-level explanation.
- **Accessibility specification:** Components use labels and selected ARIA attributes in places, but the repository has no documented keyboard, screen-reader, focus, contrast, or target-size acceptance standard.
- **Confirmation policy:** There are no delete operations in the current UI. Define confirmation and recovery behavior if staff, teams, orders, or catalog entries become editable/deletable.
- **Localization:** UI text is English while money/date conventions are Vietnam-specific. Decide whether English-only is the intended staff language or whether Vietnamese localization is required.

## 21. Source map

| Product area | Primary implementation source |
| --- | --- |
| Application shell, navigation, Overview, Customers, Orders, Logistics, order detail, Finance, Staff access | web/src/App.tsx |
| Warehouse lookup, stock, movement, item, location, receipt, pick, and dispatch screens | web/src/Warehouse.tsx |
| Brand, palette, spacing, breakpoints, responsive behavior, and print label layout | web/src/styles.css |
| Barcode generation and print content | web/src/OrderBarcode.tsx |
| Authentication modes, login restoration, Firebase exchange, and password changes | web/src/AuthContext.tsx |
| Frontend REST client and request error handling | web/src/api.ts |
| API routes and request field validation | api/src/app.controller.ts |
| Role scopes, calculations, order numbering, delivery, ledger, and warehouse transaction logic | api/src/app.service.ts |
| Session verification, database entities, and schema migrations | api/src/session.guard.ts; api/src/entities; api/src/migrations |
| Runtime settings and local services | docker-compose.yml; .env.example |
