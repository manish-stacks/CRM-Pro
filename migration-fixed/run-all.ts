// migration/run-all.ts
// Runs all phases in the required order. Prefer running phases individually
// the first time so you can check counts/warnings between steps.
import { execSync } from 'child_process'

const phases = [
  '01-migrate-users.ts',
  '02-migrate-clients.ts',
  '03-migrate-leads.ts',
  // '04-migrate-attendance.ts',
  '05-migrate-leaves.ts',
]

for (const phase of phases) {
  console.log(`\n=== Running ${phase} ===\n`)
  execSync(`npx tsx ${phase}`, { stdio: 'inherit', cwd: __dirname })
}

console.log('\n🎉 All phases complete.')
