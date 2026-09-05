// src/lib/profileCompletion.ts
// Employee must fill personal/contact/ID/bank details before they're
// allowed to check in for the day. Used by both web + mobile check-in.

export const PROFILE_COMPLETION_THRESHOLD = 90 // percent

// Fields that count toward "profile complete". Kept in one place so the
// check-in gate and any "% complete" UI stay in sync.
const REQUIRED_FIELDS = [
  'position',
  'joiningDate',
  'dateOfBirth',
  'gender',
  'fatherName',
  'maritalStatus',
  'address',
  'city',
  'state',
  'pincode',
  'emergencyContact',
  'emergencyPhone',
  'idProofType',
  'idProofNumber',
  'panNumber',
  'aadharNumber',
  'aadharFrontUrl',
  'aadharBackUrl',
  'bankName',
  'accountNumber',
  'ifscCode',
  'accountHolderName',
] as const

export const FIELD_LABELS: Record<string, string> = {
  avatar: 'Profile Photo',
  position: 'Position',
  joiningDate: 'Joining Date',
  dateOfBirth: 'Date of Birth',
  gender: 'Gender',
  fatherName: "Father's Name",
  maritalStatus: 'Marital Status',
  address: 'Address',
  city: 'City',
  state: 'State',
  pincode: 'Pincode',
  emergencyContact: 'Emergency Contact Name',
  emergencyPhone: 'Emergency Contact Phone',
  idProofType: 'ID Proof Type',
  idProofNumber: 'ID Proof Number',
  panNumber: 'PAN Number',
  aadharNumber: 'Aadhar Number',
  aadharFrontUrl: 'Aadhar Front Photo',
  aadharBackUrl: 'Aadhar Back Photo',
  bankName: 'Bank Name',
  accountNumber: 'Bank Account Number',
  ifscCode: 'IFSC Code',
  accountHolderName: 'Account Holder Name',
}

export function getProfileCompletion(employee: Record<string, any>, avatarUrl?: string | null): {
  percent: number
  missingFields: string[]
} {
  const missingFields: string[] = REQUIRED_FIELDS.filter(f => {
    const v = employee?.[f]
    return v === null || v === undefined || v === ''
  })
  // Profile photo lives on the User model, not Employee — passed in
  // separately by the caller (e.g. employee.user?.avatar). Mandatory for
  // every employee, same as the other required fields.
  if (!avatarUrl) missingFields.push('avatar')

  const totalFields = REQUIRED_FIELDS.length + 1
  const filled = totalFields - missingFields.length
  const percent = Math.round((filled / totalFields) * 100)
  return { percent, missingFields }
}

export function isProfileCompleteEnough(employee: Record<string, any>, avatarUrl?: string | null): boolean {
  return getProfileCompletion(employee, avatarUrl).percent >= PROFILE_COMPLETION_THRESHOLD
}
