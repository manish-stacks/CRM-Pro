// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const DEPARTMENTS = [
  { name: 'Sales Consultant',   slug: 'sales-consultant',   color: 'blue',    icon: 'Briefcase' },
  { name: 'Web Developer',      slug: 'web-developer',      color: 'indigo',  icon: 'Code2' },
  { name: 'Marketing',          slug: 'marketing',          color: 'pink',    icon: 'Megaphone' },
  { name: 'Website SEO',        slug: 'website-seo',        color: 'green',   icon: 'Search' },
  { name: 'GMB SEO',            slug: 'gmb-seo',            color: 'emerald', icon: 'MapPin' },
  { name: 'Ads',                slug: 'ads',                color: 'orange',  icon: 'Target' },
  { name: 'GMB Optimization',   slug: 'gmb-optimization',   color: 'teal',    icon: 'TrendingUp' },
  { name: 'SMO',                slug: 'smo',                color: 'purple',  icon: 'Share2' },
  { name: 'Graphics Designer',  slug: 'graphics-designer',  color: 'rose',    icon: 'Palette' },
  { name: 'Sales Person',       slug: 'sales-person',       color: 'cyan',    icon: 'Users' },
]

const SERVICES = [
  { slug: 'website-dev',      name: 'Website Development',   category: 'DEVELOPMENT', deptSlug: 'web-developer',     basePrice: 25000, billing: 'ONE_TIME' },
  { slug: 'domain',           name: 'Domain Registration',   category: 'MAINTENANCE', deptSlug: 'web-developer',     basePrice: 999,   billing: 'YEARLY'   },
  { slug: 'hosting',          name: 'Web Hosting',           category: 'MAINTENANCE', deptSlug: 'web-developer',     basePrice: 3600,  billing: 'YEARLY'   },
  { slug: 'website-seo',      name: 'Website SEO',           category: 'SEO',         deptSlug: 'website-seo',       basePrice: 8000,  billing: 'MONTHLY'  },
  { slug: 'gmb-seo',          name: 'GMB SEO',               category: 'SEO',         deptSlug: 'gmb-seo',           basePrice: 5000,  billing: 'MONTHLY'  },
  { slug: 'gmb-optimization', name: 'GMB Optimization',      category: 'SEO',         deptSlug: 'gmb-optimization',  basePrice: 3000,  billing: 'MONTHLY'  },
  { slug: 'smo',              name: 'Social Media (SMO)',    category: 'MARKETING',   deptSlug: 'smo',               basePrice: 6000,  billing: 'MONTHLY'  },
  { slug: 'google-ads',       name: 'Google Ads Management', category: 'MARKETING',   deptSlug: 'ads',               basePrice: 10000, billing: 'MONTHLY'  },
  { slug: 'meta-ads',         name: 'Meta Ads Management',   category: 'MARKETING',   deptSlug: 'ads',               basePrice: 10000, billing: 'MONTHLY'  },
  { slug: 'graphics-design',  name: 'Graphics Design',       category: 'DESIGN',      deptSlug: 'graphics-designer', basePrice: 2000,  billing: 'ONE_TIME' },
  { slug: 'logo-design',      name: 'Logo Design',           category: 'DESIGN',      deptSlug: 'graphics-designer', basePrice: 3500,  billing: 'ONE_TIME' },
  { slug: 'seo-audit',        name: 'SEO Audit',             category: 'SEO',         deptSlug: 'website-seo',       basePrice: 4000,  billing: 'ONE_TIME' },
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
  { key: 'weekly_off_days', value: JSON.stringify([0, 6]),              category: 'general' }, // Sun, Sat
  { key: 'office_start_time', value: '10:00',                           category: 'general' },
  { key: 'office_end_time',   value: '19:00',                           category: 'general' },
  { key: 'half_day_threshold_hours', value: '4',                        category: 'general' },
]

async function main() {
  console.log('🌱 Seeding HBS CRM v2.0...\n')

  // ============ Departments ============
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

  // ============ Service Catalog ============
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

  // ============ Users ============
  console.log('👥 Creating users...')
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

  const sampleUsers = [
    { email: 'manager.web@hbs.com',       name: 'Rajesh Kumar',   role: 'MANAGER',              deptSlug: 'web-developer' },
    { email: 'manager.seo@hbs.com',       name: 'Kavita Sharma',  role: 'MANAGER',              deptSlug: 'website-seo' },
    { email: 'manager.smo@hbs.com',       name: 'Deepa Verma',    role: 'MANAGER',              deptSlug: 'smo' },
    { email: 'telecaller@hbs.com',        name: 'Hitesh Singh',   role: 'TELECALLER',           deptSlug: 'sales-consultant' },
    { email: 'telecaller2@hbs.com',       name: 'Shivani Gupta',  role: 'TELECALLER',           deptSlug: 'sales-consultant' },
    { email: 'marketing@hbs.com',         name: 'Amit Patel',     role: 'MARKETING_EXECUTIVE',  deptSlug: 'marketing' },
    { email: 'developer@hbs.com',         name: 'Manish Yadav',   role: 'EMPLOYEE',             deptSlug: 'web-developer' },
    { email: 'seo@hbs.com',               name: 'Priya Nair',     role: 'EMPLOYEE',             deptSlug: 'website-seo' },
  ]

  const empCreated: any[] = []
  for (let i = 0; i < sampleUsers.length; i++) {
    const u = sampleUsers[i]
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        password: hashedPassword,
        name: u.name,
        role: u.role,
        phone: `+91 98${String(10000000 + i * 111111).slice(0, 8)}`,
      },
    })

    const emp = await prisma.employee.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        employeeId: `HBS${String(i + 1).padStart(5, '0')}`,
        departmentId: deptMap[u.deptSlug] || null,
        position: u.role.replace(/_/g, ' '),
        salary: u.role === 'MANAGER' ? 45000 : 25000 + i * 2000,
        joiningDate: new Date(`2024-${String((i % 12) + 1).padStart(2, '0')}-15`),
      },
    })
    empCreated.push({ emp, deptSlug: u.deptSlug, role: u.role })
  }
  console.log(`✓ ${sampleUsers.length + 1} users + employees\n`)

  // ============ Assign Department Managers ============
  console.log('👨‍💼 Assigning department managers...')
  const managerAssignments = [
    { deptSlug: 'web-developer',     empEmail: 'manager.web@hbs.com' },
    { deptSlug: 'website-seo',       empEmail: 'manager.seo@hbs.com' },
    { deptSlug: 'smo',               empEmail: 'manager.smo@hbs.com' },
  ]

  for (const ma of managerAssignments) {
    const user = await prisma.user.findUnique({ where: { email: ma.empEmail }, include: { employee: true } })
    if (user?.employee && deptMap[ma.deptSlug]) {
      await prisma.department.update({
        where: { id: deptMap[ma.deptSlug] },
        data: { managerId: user.employee.id },
      })
      await prisma.departmentManagerHistory.create({
        data: {
          departmentId: deptMap[ma.deptSlug],
          managerId: user.employee.id,
          assignedById: superAdmin.id,
          reason: 'Initial seed assignment',
        },
      })
    }
  }
  console.log(`✓ ${managerAssignments.length} managers assigned\n`)

  // ============ Settings ============
  console.log('⚙️  Creating settings...')
  for (const s of SETTINGS) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    })
  }
  console.log(`✓ ${SETTINGS.length} settings\n`)

  console.log('✅ Seeding complete!\n')
  console.log('==========================================')
  console.log('📧 Super Admin Login:')
  console.log('   Email:    admin@hbs.com')
  console.log('   Password: 123456')
  console.log('==========================================')
  console.log('Sample role logins (all password: 123456):')
  console.log('   MANAGER:             manager.web@hbs.com')
  console.log('   TELECALLER:          telecaller@hbs.com')
  console.log('   MARKETING_EXECUTIVE: marketing@hbs.com')
  console.log('   EMPLOYEE:            developer@hbs.com')
  console.log('==========================================\n')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
