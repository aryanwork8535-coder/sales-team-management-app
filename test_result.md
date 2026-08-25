#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
## Iteration 2 — Phases A-D (Admin Web Panel, Attendance & Expenses, Complaints, Offline Mode)

backend:
  - task: "Attendance API (start/end/today/list with GPS)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    needs_retesting: true
  - task: "Expenses API (create with bill photo, list, admin review approve/reject)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    needs_retesting: true
  - task: "Complaints API (create with photo, list, admin review Open/In Progress/Resolved)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    needs_retesting: true
  - task: "Admin overview API (/api/admin/overview with range filters)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    needs_retesting: true
  - task: "Admin products CRUD (/api/admin/products GET/POST/PUT, sku unique, active toggle)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    needs_retesting: true
  - task: "Admin users CRUD (/api/admin/users GET/POST/PUT, password hash, role validation)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    needs_retesting: true
  - task: "Offline sync idempotency (client_id on orders and visits, client_time honored)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    needs_retesting: true

frontend:
  - task: "Role-based routing: admin/manager -> /admin web panel, salesperson -> tabs"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/index.tsx, /app/frontend/app/admin/_layout.tsx"
    needs_retesting: true
  - task: "Admin dashboard with KPIs, range filter, salesperson/brand tables"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/admin/index.tsx"
    needs_retesting: true
  - task: "Admin products/users management with add/edit modals"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/admin/products.tsx, /app/frontend/app/admin/users.tsx"
    needs_retesting: true
  - task: "Admin expense approvals and complaint resolution"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/admin/expenses.tsx, /app/frontend/app/admin/complaints.tsx"
    needs_retesting: true
  - task: "Mobile Attendance screen (Start Day / End Day GPS)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/attendance.tsx"
    needs_retesting: true
  - task: "Mobile Expenses list + new expense with bill photo"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/expenses.tsx, /app/frontend/app/expense/new.tsx"
    needs_retesting: true
  - task: "Mobile Complaints list + new complaint with retailer picker"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/complaints.tsx, /app/frontend/app/complaint/new.tsx"
    needs_retesting: true
  - task: "Mobile Collections list screen + More tab routing"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/collections.tsx, /app/frontend/app/(tabs)/more.tsx"
    needs_retesting: true
  - task: "Offline queue (orders/visits saved offline, home banner, auto-sync via NetInfo)"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/offline.ts, /app/frontend/app/order/new.tsx, /app/frontend/app/retailer/[id].tsx"
    needs_retesting: true

agent_communication:
  - agent: "main"
    message: "Iteration 2 complete. Added Admin Web Panel (role-based routing on login: EMP001/EMP002 land on /admin desktop layout), Attendance (start/end day GPS), Expenses with bill photo upload + admin approval, Complaints with photos + admin resolution, Offline queue for orders/visits with client_id idempotency. Smoke tested: admin dashboard renders at 1440px, mobile attendance screen works. Iteration 1 tests (16/16 backend, 5/5 frontend) previously passed — regression check core salesperson flow briefly."

## Iteration 3 — Targets, Performance, Distributor View, Attendance Report

backend:
  - task: "Admin targets (GET /api/admin/targets, POST /api/admin/targets upsert daily/monthly)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    needs_retesting: true
  - task: "Salesperson performance API (GET /api/performance: rank, leaderboard, 6-month trend, target achievement)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    needs_retesting: true
  - task: "Distributor endpoints (GET /api/distributor/dashboard, GET /api/scheme-claims, PUT /api/scheme-claims/{id}/fulfil, PUT /api/orders/{id}/status)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    needs_retesting: true
  - task: "Admin attendance report (GET /api/admin/attendance-report?month=YYYY-MM)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    needs_retesting: true

frontend:
  - task: "Admin Targets page (edit daily/monthly targets per salesperson)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/admin/targets.tsx"
    needs_retesting: true
  - task: "Admin Attendance Report grid (month nav, day cells, GPS detail modal)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/admin/attendance.tsx"
    needs_retesting: true
  - task: "Mobile Performance screen (rank hero, leaderboard, progress bars, trend chart) via More tab"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/performance.tsx"
    needs_retesting: true
  - task: "Distributor view (login EMP004 -> /distributor, KPIs, orders dispatch/deliver, claims fulfil)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/distributor/index.tsx"
    needs_retesting: true

agent_communication:
  - agent: "main"
    message: "Iteration 3 complete. Added Target Management (admin), Performance screen (mobile), Distributor view (role-based route /distributor), Attendance Report grid (admin). Smoke tested: attendance grid renders with green cell for EMP003, distributor view shows 5 pending orders + 4 claims with action buttons. Cleaned leftover test users/products from DB."

## Iteration 4 — Security Hardening (post security audit)

backend:
  - task: "SEC-002 fix: GET /api/orders/{id} scoped (salesperson/distributor own only, admin all)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    needs_retesting: true
  - task: "SEC-003 fix: POST /api/collections validates amount>0, <=10M, retailer ownership, role restriction (distributor 403)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    needs_retesting: true
  - task: "SEC-004 fix: GET /api/files/{path} owner-or-admin only"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    needs_retesting: true
  - task: "SEC-005 fix: GET /api/collections denies distributor (403)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    needs_retesting: true
  - task: "Public POST /api/seed endpoint removed (startup auto-seed retained)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    needs_retesting: true
  - task: "Login brute-force protection: 5 failures/60s per employee-ID+IP -> 429 with Retry-After for 5 min; dummy bcrypt anti-enumeration; X-Forwarded-For aware"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    needs_retesting: true
  - task: "JWT secret rotated to 64-hex; server fails fast if secret <32 bytes; regex injection fixes (re.escape on retailer search q, validated month regex)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py, /app/backend/.env"
    needs_retesting: true

agent_communication:
  - agent: "main"
    message: "Security audit fixes applied. JWT secret rotated (all old tokens invalid — clients must re-login; frontend handles 401 by clearing token). In-memory brute-force limiter is per-process; restarting backend clears blocks. NOTE for testing: 5 failed logins for the same employee_id OR same client IP within 60s triggers a 5-minute 429 block — space out negative login tests or restart backend between them to reset. Demo credentials retained intentionally for preview (user will rotate via admin Users page before production)."

## Iteration 5 — Master Data CRUD (fully database-driven admin panel)

backend:
  - task: "Brands CRUD (/api/admin/brands GET/POST/PUT; rename cascades to products+schemes; /api/brands reads brands collection)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    needs_retesting: true
  - task: "Territories CRUD (/api/admin/territories; rename cascades to users/retailers/beats; counts included)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    needs_retesting: true
  - task: "Retailer admin edit (PUT /api/admin/retailers/{id}: full fields, mobile dup check, status validation)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    needs_retesting: true
  - task: "Beats CRUD (/api/admin/beats; duplicate sp+day prevented; active flag respected by mobile dashboard beat)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    needs_retesting: true
  - task: "Schemes CRUD (/api/admin/schemes with slabs, dates, territory, distributor; order eligibility respects active+date range+territory+distributor)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    needs_retesting: true
  - task: "Targets extended (entity_type salesperson|distributor|territory; GET returns 3 lists; legacy salesperson docs unchanged)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    needs_retesting: true
  - task: "Settings (GET /api/settings any-auth; PUT /api/admin/settings; company + 4 master lists; defaults migrated at startup)"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    needs_retesting: true
  - task: "Users extended (manager_id for salespersons, assigned_salesperson_ids for distributors); products gained image field"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    needs_retesting: true

frontend:
  - task: "Admin nav expanded to 14 items (Retailers, Brands, Schemes, Beats, Territories, Settings added)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/admin/_layout.tsx"
    needs_retesting: true
  - task: "Admin Retailers page (debounced search, status filter, full edit modal with sp/dist/territory assignment)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/admin/retailers.tsx"
    needs_retesting: true
  - task: "Admin Brands page (add/edit/logo upload/toggle with confirm)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/admin/brands.tsx"
    needs_retesting: true
  - task: "Admin Territories page (add/edit/toggle, counts)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/admin/territories.tsx"
    needs_retesting: true
  - task: "Admin Beats page (create/edit beat: sp, day, territory, route, retailer multi-select, toggle)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/admin/beats.tsx"
    needs_retesting: true
  - task: "Admin Schemes page (create/edit with slab editor, dates, territory/distributor scoping, toggle)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/admin/schemes.tsx"
    needs_retesting: true
  - task: "Admin Targets tabs (Salespersons/Distributors/Territories)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/admin/targets.tsx"
    needs_retesting: true
  - task: "Admin Settings page (company details + 4 editable master lists with add/remove chips)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/admin/settings.tsx"
    needs_retesting: true
  - task: "Products upgraded (brand/category DB-driven chips, GST field, product image upload)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/admin/products.tsx"
    needs_retesting: true
  - task: "Users upgraded (territory chips, manager select for salesperson, assigned salespersons for distributor)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/admin/users.tsx"
    needs_retesting: true
  - task: "Mobile: expense categories + complaint types + no-order reasons now loaded from /api/settings; visit completion outcome sheet with reason picker"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/expense/new.tsx, /app/frontend/app/complaint/new.tsx, /app/frontend/app/retailer/[id].tsx"
    needs_retesting: true

agent_communication:
  - agent: "main"
    message: "Iteration 5: full master-data CRUD. Startup migration seeded brands (from product brands), territories (from user/beat territory strings) and default settings WITHOUT touching existing records. All admin endpoints require_admin (salesperson gets 403). Mobile screens read categories/reasons/types from /api/settings with hardcoded fallbacks only while loading. Visit completion now uses an outcome bottom sheet (ORDER_BOOKED/NO_ORDER+reason/PAYMENT_COLLECTED/OTHER). Brute-force limiter still active: avoid 5+ failed logins per minute or restart backend."
