# HBS CRM Migration — Fixed Setup

Pehle wale zip me ye problems thi (isliye kuch chal nahi raha tha):

1. `lib/db.ts`, `lib/idmap.ts`, `lib/maps.ts` flatten ho gaye the lekin scripts
   `./lib/db` se import kar rahe the → import resolve nahi hota.
2. Sirf `mysql2` installed tha — `typescript`, `tsx`, `prisma`,
   `@prisma/client` missing the.
3. `prisma/schema.prisma` folder me tha hi nahi.
4. `.env` me placeholder values (`user:pass@localhost...`) the, asli
   database credentials nahi.

Sab fix kar diya hai — is folder ki structure ab aisi hai:

```
.
├── package.json
├── .env.example          <- copy to .env aur apni real DB details daalo
├── prisma/
│   └── schema.prisma
├── db.ts / idmap.ts / maps.ts     <- shared helpers (flat, ./ se import)
├── 01-migrate-users.ts
├── 02-migrate-clients.ts
├── 03-migrate-leads.ts
├── 04-migrate-attendance.ts
├── 05-migrate-leaves.ts
└── run-all.ts
```

## Setup (step by step)

```bash
# 1) dependencies install karo
npm install

# 2) .env banao aur real MySQL credentials daalo
cp .env.example .env
# .env file open karke DATABASE_URL aur OLD_DATABASE_URL edit karo

# 3) purana SQL dump ek MySQL DB me import karo (agar abhi tak nahi kiya)
mysql -u root -p -e "CREATE DATABASE hbs_old"
mysql -u root -p hbs_old < u119813757_hbs_crm.sql

# 4) naye DB me schema push karo + prisma client generate karo
npx prisma db push
npx prisma generate

# 5) apna existing departments/services/settings/super-admin seed chalao
#    (seed.ts is folder me hi included hai) — Users/Clients/Leads migration
#    isi par depend karta hai (department slugs, admin@hbs.com fallback)
npm run seed

# 6) ab migration phases chalao (ISI ORDER ME — important hai)
npm run migrate:users
npm run migrate:clients
npm run migrate:leads
npm run migrate:attendance
npm run migrate:leaves

# ya sab ek saath:
npm run migrate:all
```

## Schema update note (SEO dept merge)

Naya schema update hua hai:
- `User` aur `Client` me `expoPushToken` field add hui (Firebase/Expo push ke
  liye) — old data me equivalent nahi hai, isliye migration me `null` chhoda
  gaya hai, koi dikkat nahi.
- `Employee` me `reportingToId` (team lead) add hua — optional hai, old data
  se map nahi kiya gaya (agar chahiye to `lib/maps.ts` me manually add kar
  sakte ho).
- **Departments merge**: `website-seo` + `gmb-seo` ab ek hi `seo` department
  ban gaye hain, aur `sales-person` department hata diya gaya hai. Isliye
  `maps.ts` ka `DEPARTMENT_SLUG_MAP` update kiya gaya hai — old dept id 5 aur
  6 dono ab `seo` slug pe map hote hain; old id 16 (sales-person) ab kisi bhi
  naye department se match nahi karta, unke employees ka `departmentId` null
  rahega (baad me app se manually assign kar sakte ho).



## ⚠️ "Foreign key constraint violated" error aaye to

Ye tab hota hai jab `.data/*.json` files (old-id → new-id mapping) DB ke
actual state se **out of sync** ho jaati hain — jaise agar beech me
`prisma db push` se DB reset hua ya naya/alag DB use kiya, lekin `.data`
folder purana hi reh gaya. Script ek aisi Employee/User id use karne ki
koshish karta hai jo ab DB me exist hi nahi karti.

**Fix:** jab bhi DB reset/naya banao, `.data` folder bhi delete karo, phir
saare phases dubara chalao (users se leke leaves tak):

```powershell
# Windows PowerShell:
Remove-Item -Recurse -Force .data

# phir dobara, isi order me:
npm run seed
npm run migrate:users
npm run migrate:clients
npm run migrate:leads
npm run migrate:attendance
npm run migrate:leaves
```

`.data` delete karne se duplicate nahi banega — email, employeeId,
leadNumber, clientCode jaise unique fields pe upsert/skipDuplicates already
lagा hai, sirf mapping fresh ho jaayegi.

## Agar ab bhi error aaye

Jo bhi terminal error dikhe uska **poora message copy-paste** karke bhejo —
"chal nahi raha" se pata nahi chalta exact wajah kya hai. Sabse common cases:

- `Error: connect ECONNREFUSED` → MySQL chal nahi raha, ya `.env` me host/port
  galat hai.
- `Access denied for user` → `.env` me username/password galat hai.
- `Table 'hbs_old.leads' doesn't exist` → step 3 (SQL import) nahi hua.
- `admin@hbs.com not found` → step 5 (original seed.ts) nahi chalaya, isliye
  Super Admin exist nahi karta jo leads migration fallback ke liye chahiye.
