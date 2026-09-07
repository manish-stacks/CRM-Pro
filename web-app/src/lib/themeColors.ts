// src/lib/themeColors.ts
// 10 preset color palettes for the app's "brand" color. One is auto-picked
// each day (deterministic — same color all day, everyone sees the same one)
// unless an admin locks a specific color in Settings > Appearance.
// Shades are R G B triplets (no commas) so they plug into Tailwind's
// `rgb(var(--brand-500) / <alpha-value>)` pattern in tailwind.config.js.

export type ThemePalette = { id: string; label: string; shades: Record<number, string> }

export const THEME_PALETTES: ThemePalette[] = [
  { id: 'rose',    label: 'Rose',    shades: { 50:'255 241 242',100:'255 228 230',200:'254 205 211',300:'253 164 175',400:'251 113 133',500:'244 63 94',600:'225 29 72',700:'190 18 60',800:'159 18 57',900:'136 19 55' } },
  { id: 'blue',    label: 'Blue',    shades: { 50:'239 246 255',100:'219 234 254',200:'191 219 254',300:'147 197 253',400:'96 165 250',500:'59 130 246',600:'37 99 235',700:'29 78 216',800:'30 64 175',900:'30 58 138' } },
  { id: 'emerald', label: 'Emerald', shades: { 50:'236 253 245',100:'209 250 229',200:'167 243 208',300:'110 231 183',400:'52 211 153',500:'16 185 129',600:'5 150 105',700:'4 120 87',800:'6 95 70',900:'6 78 59' } },
  { id: 'violet',  label: 'Violet',  shades: { 50:'245 243 255',100:'237 233 254',200:'221 214 254',300:'196 181 253',400:'167 139 250',500:'139 92 246',600:'124 58 237',700:'109 40 217',800:'91 33 182',900:'76 29 149' } },
  { id: 'amber',   label: 'Amber',   shades: { 50:'255 251 235',100:'254 243 199',200:'253 230 138',300:'252 211 77',400:'251 191 36',500:'245 158 11',600:'217 119 6',700:'180 83 9',800:'146 64 14',900:'120 53 15' } },
  { id: 'teal',    label: 'Teal',    shades: { 50:'240 253 250',100:'204 251 241',200:'153 246 228',300:'94 234 212',400:'45 212 191',500:'20 184 166',600:'13 148 136',700:'15 118 110',800:'17 94 89',900:'19 78 74' } },
  { id: 'pink',    label: 'Pink',    shades: { 50:'253 242 248',100:'252 231 243',200:'251 207 232',300:'249 168 212',400:'244 114 182',500:'236 72 153',600:'219 39 119',700:'190 24 93',800:'157 23 77',900:'131 24 67' } },
  { id: 'orange',  label: 'Orange',  shades: { 50:'255 247 237',100:'255 237 213',200:'254 215 170',300:'253 186 116',400:'251 146 60',500:'249 115 22',600:'234 88 12',700:'194 65 12',800:'154 52 18',900:'124 45 18' } },
  { id: 'indigo',  label: 'Indigo',  shades: { 50:'238 242 255',100:'224 231 255',200:'199 210 254',300:'165 180 252',400:'129 140 248',500:'99 102 241',600:'79 70 229',700:'67 56 202',800:'55 48 163',900:'49 46 129' } },
  { id: 'cyan',    label: 'Cyan',    shades: { 50:'236 254 255',100:'207 250 254',200:'165 243 252',300:'103 232 249',400:'34 211 238',500:'6 182 212',600:'8 145 178',700:'14 116 144',800:'21 94 117',900:'22 78 99' } },
  { id: 'lime',    label: 'Lime',    shades: { 50:'247 254 231',100:'236 252 203',200:'217 249 157',300:'190 242 100',400:'163 230 53',500:'132 204 22',600:'101 163 13',700:'77 124 15',800:'63 98 18',900:'54 83 20' } },
]

// Deterministic "color of the day" — same for every user, changes at midnight.
export function todaysPalette(date = new Date()): ThemePalette {
  const dayNumber = Math.floor(date.getTime() / 86400000) // days since epoch
  const idx = ((dayNumber % THEME_PALETTES.length) + THEME_PALETTES.length) % THEME_PALETTES.length
  return THEME_PALETTES[idx]
}

export function getPaletteById(id: string): ThemePalette | undefined {
  return THEME_PALETTES.find(p => p.id === id)
}

export function applyPalette(palette: ThemePalette) {
  const root = document.documentElement
  for (const [shade, rgb] of Object.entries(palette.shades)) {
    root.style.setProperty(`--brand-${shade}`, rgb)
  }
}
