# CRM + HRM System

A full-featured, production-ready CRM (Customer Relationship Management) and HRM (Human Resource Management) system built with Next.js 14, Prisma ORM, and Tailwind CSS.

---

## ✨ Features

### HRM Module
- **Employee Management** — Add, edit, view employee profiles with salary, department, work mode
- **Attendance** — Punch in/out with live timer, work mode (WFO/WFH), auto half-day detection (<4h)
- **Leave Management** — Apply leaves, manager approval/rejection with reason, auto attendance marking
- **Payroll** — Auto-generate payslips per month with attendance-based calculation, PF & TDS deductions
- **Departments** — Create and manage departments with employee count

### CRM Module
- **Lead Management** — Full pipeline (New → Follow Up → Meeting → Proposal → Converted), role-based visibility
- **Proposals** — Line-item proposals with discount, shareable client link, PDF export
- **Client Management** — Auto-created on proposal acceptance, service tracking with expiry alerts
- **Payments & Billing** — Create invoices, record payments (UPI, Cash, Bank Transfer, Cheque, Card)
- **Reports & Analytics** — Revenue trends, lead pipeline, attendance summary, conversion rates

### System Features
- **Role-Based Access Control** — 7 roles: SUPER_ADMIN, ADMIN, MANAGER, EMPLOYEE, TELECALLER, MARKETING_EXECUTIVE, CLIENT
- **Public Proposal View** — Clients accept/reject proposals via shareable token link
- **Import/Export** — Export leads, clients, payments, attendance as CSV
- **Settings** — Company info, notification preferences, password change, user management
- **Dark UI** — Fully dark design system with Tailwind CSS

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MySQL 8.0+

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your MySQL credentials and JWT secret

# 3. Run database migrations
npx prisma migrate dev --name init

# 4. Seed the database
npx prisma db seed

# 5. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Default Login

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@hbs.com | 123456 |

---
## 💡 Key Business Logic

### Attendance Auto-calculation
- Punch out after **≥ 4 hours** → `PRESENT`
- Punch out after **< 4 hours** → `HALF_DAY`
- Approved leave days → auto-marked as `LEAVE` in attendance

### Payroll Calculation
```
Basic Salary = (Monthly Salary / Working Days) × Effective Days
Allowances   = Basic × 10%
Gross        = Basic + Allowances
PF Deduction = Basic × 12%
TDS          = Gross × 5% (if Gross > ₹50,000)
Net Salary   = Gross − PF − TDS
```

### Proposal → Client Flow
1. Create proposal linked to a lead
2. Share link → client views via `/proposal/view/[token]`
3. Client accepts → Lead status becomes `CONVERTED`, Client record auto-created
4. Client rejects → Lead status reverts to `FOLLOW_UP`

### Invoice Status Auto-update
- New invoice → `PENDING`, dueAmount = totalAmount
- Payment recorded → paidAmount += payment, dueAmount recalculated
- `dueAmount === 0` → status → `PAID`
- `0 < paidAmount < totalAmount` → status → `PARTIAL`

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | MySQL 8.0 |
| ORM | Prisma |
| Auth | JWT via `jose` (httpOnly cookies) |
| Styling | Tailwind CSS |
| Charts | Recharts |
| PDF | HTML-based (browser print) |
| Excel Export | xlsx |
| UI Icons | Lucide React |
| Toast | react-hot-toast |

---
