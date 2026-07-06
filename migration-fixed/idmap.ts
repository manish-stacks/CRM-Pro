// migration/lib/idmap.ts
// Persists old-numeric-id -> new-cuid mappings to disk so that:
//  1) later phases can resolve foreign keys (e.g. leads.assigned_to -> User.id)
//  2) a phase can be re-run safely without creating duplicates
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(__dirname, '.data')

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

export class IdMap {
  private file: string
  private map: Record<string, string>

  constructor(name: string) {
    this.file = path.join(DATA_DIR, `${name}.json`)
    this.map = fs.existsSync(this.file)
      ? JSON.parse(fs.readFileSync(this.file, 'utf-8'))
      : {}
  }

  get(oldId: number | string): string | undefined {
    return this.map[String(oldId)]
  }

  has(oldId: number | string): boolean {
    return String(oldId) in this.map
  }

  set(oldId: number | string, newId: string) {
    this.map[String(oldId)] = newId
    this.save()
  }

  private save() {
    fs.writeFileSync(this.file, JSON.stringify(this.map, null, 2))
  }

  all() {
    return this.map
  }
}
