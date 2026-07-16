const loginView = document.getElementById('loginView')
const trackerView = document.getElementById('trackerView')
const status = document.getElementById('status')
const checkinBtn = document.getElementById('checkinBtn')
const checkoutBtn = document.getElementById('checkoutBtn')

document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('email').value
  const password = document.getElementById('password').value
  status.textContent = 'Logging in...'
  try {
    const result = await window.tracker.login(email, password)
    if (result.ok) {
      loginView.classList.add('hidden')
      trackerView.classList.remove('hidden')
    } else {
      status.textContent = result.error || 'Login failed'
    }
  } catch (err) {
    console.error('Login error:', err)
    status.textContent = 'Connection error — check server URL / internet'
  }
})

checkinBtn.addEventListener('click', async () => {
  status.textContent = 'Checking in...'
  try {
    const result = await window.tracker.checkIn()
    if (result.ok) {
      checkinBtn.classList.add('hidden')
      checkoutBtn.classList.remove('hidden')
      if (result.tracking === false) {
        const reason = result.reason === 'EMPLOYEE_EXEMPT'
          ? 'Checked in — screenshot monitoring not required for you'
          : 'Checked in — screenshot monitoring is currently off (admin)'
        status.textContent = reason
      } else {
        status.textContent = 'Checked in — tracking active'
      }
    } else {
      status.textContent = result.error || 'Check-in failed'
    }
  } catch (err) {
    console.error('Check-in error:', err)
    status.textContent = 'Connection error — check server URL / internet'
  }
})

checkoutBtn.addEventListener('click', async () => {
  status.textContent = 'Checking out...'
  try {
    const result = await window.tracker.checkOut()
    if (result.ok) {
      checkoutBtn.classList.add('hidden')
      checkinBtn.classList.remove('hidden')
      status.textContent = 'Checked out'
    }
  } catch (err) {
    console.error('Check-out error:', err)
    status.textContent = 'Connection error — check server URL / internet'
  }
})