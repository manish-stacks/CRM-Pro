// src/lib/letterPdf.ts
// HR Letters module — HTML *body* generators for the three official letters.
// The build*Body() functions here are passed into renderLetterPdf() from
// lib/pdfRenderer.ts, which wraps them with the company letterhead
// header/footer images and renders a real PDF via Puppeteer. Wording mirrors
// the company's existing Word templates (Offer Letter, Salary Revision
// Letter, Relieving & Experience Letter) — only the bracketed/variable
// details are filled in from what the admin enters.

function fmtINR(n: number): string {
  return Math.round(n || 0).toLocaleString('en-IN')
}

function esc(v: any): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

export interface CompanyInfo {
  companyName: string
  companyAddressLine1?: string
  companyAddressLine2?: string
  companyPhone?: string
  companyEmail?: string
  companyWebsite?: string
  companyLogoUrl?: string
}

// ---------------------------------------------------------------------------
// 1. OFFER LETTER
// ---------------------------------------------------------------------------
export interface OfferLetterData {
  candidateName: string
  relationPrefix?: string   // "S/o" | "D/o" | "W/o"
  relativeName?: string     // father's/husband's name
  address?: string
  designation: string
  department: string
  placeOfPosting: string
  monthlySalary: number
  joiningDate: string       // display string e.g. "19th December 2023"
  reportingManagerName: string
  probationMonths?: number
  noticePeriodMonths?: number
  letterDate?: string
  company: CompanyInfo
}

export function buildOfferLetterBody(d: OfferLetterData): string {
  const probation = d.probationMonths ?? 6
  const notice = d.noticePeriodMonths ?? 1
  const salutation = /\b(mrs|ms|miss)\b/i.test(d.relationPrefix || '') ? 'Dear' : 'Dear'
  const firstName = d.candidateName.replace(/^(Mr\.?|Mrs\.?|Ms\.?|Miss)\s+/i, '').split(' ')[0]

  return `
  <div class="no-justify" style="margin-bottom:16px;">${d.letterDate ? esc(d.letterDate) : ''}</div>
  <p class="no-justify">To</p>
  <p class="no-justify">
    ${esc(d.candidateName)}${d.relativeName ? ` ${esc(d.relationPrefix || 'S/o')} ${esc(d.relativeName)}` : ''}<br/>
    ${d.address ? esc(d.address) : ''}
  </p>
  <p class="no-justify"><strong>Subject: - Offer Letter</strong></p>
  <p class="no-justify">${salutation} ${esc(firstName)},</p>

  <p>With reference to your interview and subsequent discussions with us, the management is hereby pleased to appoint you in our organization w.e.f. <span class="field">${esc(d.joiningDate)}</span> on the following terms and conditions.</p>

  <p><strong>Designation:</strong><br/>
  You will be designated as a <span class="field">${esc(d.designation)}</span> in the <span class="field">${esc(d.department)}</span> department.</p>

  <p><strong>Place of positioning:</strong><br/>
  You will be posted at <span class="field">${esc(d.placeOfPosting)}</span> office according to work requirements. At any time during the period of your appointment, the company may transfer you to any other department it deems necessary.</p>

  <p><strong>Remuneration:</strong><br/>
  Your compensation shall be Rs. ${fmtINR(d.monthlySalary)}/- per month in hand. The salary will be disbursed on or before the 7th of every month.</p>

  <p><strong>Reporting:</strong><br/>
  You are required to submit your daily report to your Department Head, <span class="field">${esc(d.reportingManagerName)}</span>.</p>

  <p>You shall be on probation for a period of ${probation} months. You shall be confirmed in the organization's regular grade on successful completion of your probation period. During the Employment (Probation period and confirmation period) employee can end this agreement by serving ${notice} month notice period; if the candidate is found in any disciplinary action against the company or the performance of the candidate is poor and not up to the mark, the company can end this agreement immediately without any notice period in prior.</p>

  <p>Confirmation of your service is subject to suitable performance. Your probation cum training period is liable to be extended subject to your performance for the period deemed necessary.</p>

  <p>You will be governed by the Company rules, as amended from time to time. You will be entitled to leave and other benefits by such rules applicable from time to time. One paid leave you can take every month; this leave will not carry forward in the probation period. After the successful completion of your probation period, your paid leave can be carried forward, if not taken in any month.</p>

  <p>You are requested to submit the described documents before the date of joining:</p>
  <ul>
    <li>Proof of Highest and latest qualification</li>
    <li>Proof of Permanent Address (Any one - Telephone bill/ Electricity bill/ Bank statement/ Ration card)</li>
    <li>Identity Proof (Any One - Passport/ Permanent Driving license/ Voter ID)</li>
    <li>PAN Card – (2 copies or duly filled Application for PAN)</li>
    <li>Relieving letter/ Experience letter/ Letter of Appointment along with Resignation Letter from all previous employers</li>
    <li>Latest salary slip / Bank statement</li>
  </ul>

  <p>Your offer has been made based on the information furnished by you. However, if there is any discrepancy found during the antecedent check conducted by the Company or in the copies of the documents/certificates given by you as proof in support of the above, the company reserves the right to revoke the offer &amp; your appointment thereafter at any time.</p>

  <p>You are requested to sign below in token of your acceptance of the terms and conditions of this letter of intent and return the duplicate copy duly signed by you to us.</p>

  <p>Should you have any queries please feel free to write to us at ${esc(d.company.companyEmail || 'info@hovermedia.in')}.</p>

  <p>We are very excited about you joining us &amp; we look forward to having you with ${esc(d.company.companyName)}.</p>

  <div class="sig-block">
    <p class="no-justify">Sincerely Yours,</p>
    <p class="no-justify"><strong>${esc(d.company.companyName)}</strong></p>
  </div>
  `
}

// ---------------------------------------------------------------------------
// 2. SALARY REVISION LETTER
// ---------------------------------------------------------------------------
export interface SalaryRevisionData {
  employeeName: string
  effectiveDate: string
  previousSalary: number
  revisedSalary: number
  signatoryName: string
  signatoryDesignation: string
  letterDate?: string
  company: CompanyInfo
}

export function buildSalaryRevisionBody(d: SalaryRevisionData): string {
  return `
  <div class="no-justify" style="margin-bottom:16px;">Date: ${esc(d.letterDate || new Date().toLocaleDateString('en-GB'))}</div>
  <p class="no-justify">Dear ${esc(d.employeeName)},</p>

  <p>We are pleased to inform you that, based on your consistent performance, dedication, and valuable contribution to the organization, your salary has been revised.</p>

  <p>Your revised salary will be effective from <span class="field">${esc(d.effectiveDate)}</span>. The updated compensation details are as follows:</p>

  <table class="kv">
    <tr><td class="k">Previous Salary</td><td>₹ ${fmtINR(d.previousSalary)}</td></tr>
    <tr><td class="k">Revised Salary</td><td>₹ ${fmtINR(d.revisedSalary)}</td></tr>
  </table>

  <p>This increment reflects our appreciation for your hard work and commitment. We look forward to your continued contribution and expect that you will maintain the same level of excellence in your performance.</p>

  <p>Please feel free to reach out to the HR department for any clarification regarding this revision.</p>

  <p>We congratulate you on your achievement and wish you continued success with the organization.</p>

  <div class="sig-block">
    <p class="no-justify">Warm regards,<br/>
    ${esc(d.signatoryName)}<br/>
    ${esc(d.signatoryDesignation)}<br/>
    ${esc(d.company.companyName)}</p>
  </div>
  `
}

// ---------------------------------------------------------------------------
// 3. RELIEVING & EXPERIENCE LETTER
// ---------------------------------------------------------------------------
export interface RelievingExperienceData {
  employeeName: string
  salutation?: string        // "Mr." | "Ms." | "Mrs."
  pronoun?: 'He' | 'She'
  possessivePronoun?: 'His' | 'Her'
  fromDate: string
  toDate: string
  designation: string
  department: string
  placeOfPosting: string
  fixedCTC: number
  place?: string
  letterDate?: string
  company: CompanyInfo
}

export function buildRelievingExperienceBody(d: RelievingExperienceData): string {
  const pronoun = d.pronoun || 'He'
  const possessive = d.possessivePronoun || (pronoun === 'She' ? 'Her' : 'His')
  const salutation = d.salutation || (pronoun === 'She' ? 'Ms.' : 'Mr.')
  const today = d.letterDate || new Date().toLocaleDateString('en-GB')

  return `
  <div class="no-justify" style="margin-bottom:16px;">Date: ${esc(today)}</div>
  <div class="letter-title">Relieving &amp; Experience Letter</div>

  <p>This is to certify that ${esc(salutation)} ${esc(d.employeeName)} worked with our organization from <span class="field">${esc(d.fromDate)}</span> to <span class="field">${esc(d.toDate)}</span> and successfully completed ${possessive.toLowerCase()} tenure with the company.</p>

  <p>${possessive} last-held designation was <span class="field">${esc(d.designation)}</span> in the <span class="field">${esc(d.department)}</span> department, and ${pronoun.toLowerCase()} was based at <span class="field">${esc(d.placeOfPosting)}</span>.</p>

  <p>${possessive} Fixed CTC at the time of leaving was Rs. ${fmtINR(d.fixedCTC)}/- per month.</p>

  <p>We appreciate ${pronoun === 'She' ? 'her' : 'his'} contributions and efforts during ${possessive.toLowerCase()} tenure with the organization and wish ${pronoun === 'She' ? 'her' : 'him'} success in ${possessive.toLowerCase()} future endeavors.</p>

  <div class="sig-block">
    <p class="no-justify">For ${esc(d.company.companyName)}</p>
    <p class="no-justify" style="margin-top:40px;">Director –</p>
    <p class="no-justify">Date: ${esc(today)} &nbsp;&nbsp; Place: ${esc(d.place || 'New Delhi')}</p>
  </div>
  `
}