// seed.ts
// Migration-safe seed — matches the NEW schema.prisma (merged 'seo' dept,
// 'sales-person' dept removed, expoPushToken/reportingToId fields present
// but left null here since old data doesn't have equivalents).
//
// Creates only: Departments, Service catalog, Settings, Super Admin.
// Does NOT create fake demo employees (real ones come from
// 01-migrate-users.ts and would clash with real employeeId values).
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const DEPARTMENTS = [
  { name: 'Sales Consultant',   slug: 'sales-consultant',   color: 'blue',    icon: 'Briefcase' },
  { name: 'Web Developer',      slug: 'web-developer',      color: 'indigo',  icon: 'Code2' },
  { name: 'Marketing',          slug: 'marketing',          color: 'pink',    icon: 'Megaphone' },
  { name: 'SEO',                slug: 'seo',                color: 'green',   icon: 'Search' },
  { name: 'Ads',                slug: 'ads',                color: 'orange',  icon: 'Target' },
  { name: 'GMB Optimization',   slug: 'gmb-optimization',   color: 'teal',    icon: 'TrendingUp' },
  { name: 'SMO',                slug: 'smo',                color: 'purple',  icon: 'Share2' },
  { name: 'Graphics Designer',  slug: 'graphics-designer',  color: 'rose',    icon: 'Palette' },
]

const SERVICES = [
  { slug: 'website-dev',      name: 'Website Development',   category: 'DEVELOPMENT', deptSlug: 'web-developer',     basePrice: 25000, billing: 'ONE_TIME' },
  { slug: 'domain',           name: 'Domain Registration',   category: 'MAINTENANCE', deptSlug: 'web-developer',     basePrice: 999,   billing: 'YEARLY'   },
  { slug: 'hosting',          name: 'Web Hosting',           category: 'MAINTENANCE', deptSlug: 'web-developer',     basePrice: 3600,  billing: 'YEARLY'   },
  // NOTE: both website-seo and gmb-seo now point at the merged 'seo' dept
  { slug: 'website-seo',      name: 'Website SEO',           category: 'SEO',         deptSlug: 'seo',               basePrice: 8000,  billing: 'MONTHLY'  },
  { slug: 'gmb-seo',          name: 'GMB SEO',               category: 'SEO',         deptSlug: 'seo',               basePrice: 5000,  billing: 'MONTHLY'  },
  { slug: 'gmb-optimization', name: 'GMB Optimization',      category: 'SEO',         deptSlug: 'gmb-optimization',  basePrice: 3000,  billing: 'MONTHLY'  },
  { slug: 'smo',              name: 'Social Media (SMO)',    category: 'MARKETING',   deptSlug: 'smo',               basePrice: 6000,  billing: 'MONTHLY'  },
  { slug: 'google-ads',       name: 'Google Ads Management', category: 'MARKETING',   deptSlug: 'ads',               basePrice: 10000, billing: 'MONTHLY'  },
  { slug: 'meta-ads',         name: 'Meta Ads Management',   category: 'MARKETING',   deptSlug: 'ads',               basePrice: 10000, billing: 'MONTHLY'  },
  { slug: 'graphics-design',  name: 'Graphics Design',       category: 'DESIGN',      deptSlug: 'graphics-designer', basePrice: 2000,  billing: 'ONE_TIME' },
  { slug: 'logo-design',      name: 'Logo Design',           category: 'DESIGN',      deptSlug: 'graphics-designer', basePrice: 3500,  billing: 'ONE_TIME' },
  { slug: 'seo-audit',        name: 'SEO Audit',             category: 'SEO',         deptSlug: 'seo',               basePrice: 4000,  billing: 'ONE_TIME' },
]

const SETTINGS = [
  { key: 'company_name',    value: 'Hover Business Services LLP',       category: 'company' },
  { key: 'company_short',   value: 'HBS',                               category: 'company' },
  { key: 'company_email',   value: 'info@hoverbusinessservices.com',    category: 'company' },
  { key: 'company_phone',   value: '+91 9000000000',                    category: 'company' },
  { key: 'company_address', value: 'New Delhi, India',                  category: 'company' },
  { key: 'company_gst',     value: '',                                  category: 'company' },
  { key: 'employee_id_prefix', value: 'HBS',                            category: 'general' },
  { key: 'currency',        value: 'INR',                               category: 'general' },
  { key: 'currency_symbol', value: '₹',                                 category: 'general' },
  { key: 'weekly_off_days', value: JSON.stringify([0, 6]),              category: 'general' },
  { key: 'office_start_time', value: '10:00',                           category: 'general' },
  { key: 'office_end_time',   value: '19:00',                           category: 'general' },
  { key: 'half_day_threshold_hours', value: '4',                        category: 'general' },
]

async function main() {
  console.log('🌱 Seeding (migration-safe: no fake demo employees)...\n')

  console.log('📁 Creating departments...')
  const deptMap: Record<string, string> = {}
  for (const d of DEPARTMENTS) {
    const dept = await prisma.department.upsert({
      where: { slug: d.slug },
      update: {},
      create: { name: d.name, slug: d.slug, color: d.color, icon: d.icon },
    })
    deptMap[d.slug] = dept.id
  }
  console.log(`✓ ${DEPARTMENTS.length} departments\n`)

  console.log('📦 Creating service catalog...')
  for (const s of SERVICES) {
    await prisma.serviceCatalog.upsert({
      where: { slug: s.slug },
      update: {},
      create: {
        slug: s.slug,
        name: s.name,
        category: s.category,
        departmentId: deptMap[s.deptSlug] || null,
        basePrice: s.basePrice,
        billingCycle: s.billing,
      },
    })
  }
  console.log(`✓ ${SERVICES.length} services\n`)

  console.log('👤 Creating Super Admin...')
  const hashedPassword = await bcrypt.hash('123456', 12)

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@hbs.com' },
    update: {},
    create: {
      email: 'admin@hbs.com',
      password: hashedPassword,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      phone: '+91 9999999999',
    },
  })

  // 'HBS00000' is reserved for this seed super-admin and won't collide with
  // real data since real employee_ids in the old DB start from HBS00001+
  await prisma.employee.upsert({
    where: { userId: superAdmin.id },
    update: {},
    create: {
      userId: superAdmin.id,
      employeeId: 'HBS00000',
      position: 'Super Administrator',
      salary: 100000,
      joiningDate: new Date('2024-01-01'),
    },
  })
  console.log('✓ Super Admin ready (admin@hbs.com / 123456)\n')

  console.log('⚙️  Creating settings...')
  for (const s of SETTINGS) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    })
  }
  console.log(`✓ ${SETTINGS.length} settings\n`)

  console.log('✅ Migration-safe seeding complete! Now run the migrate:* scripts.\n')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
