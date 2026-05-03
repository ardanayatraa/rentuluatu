export function toLocalDateValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function currentMonthValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function currentYearValue(date = new Date()) {
  return String(date.getFullYear())
}

export function getMonthRange(monthValue = currentMonthValue()) {
  const [year, month] = String(monthValue || currentMonthValue()).split('-').map(Number)
  if (!year || !month) return { startDate: '', endDate: '' }
  return {
    startDate: `${year}-${String(month).padStart(2, '0')}-01`,
    endDate: toLocalDateValue(new Date(year, month, 0))
  }
}

export function getYearRange(yearValue = currentYearValue()) {
  const year = String(yearValue || currentYearValue())
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` }
}

export function createPeriodFilter(mode = 'month') {
  const month = currentMonthValue()
  const year = currentYearValue()
  const range = getMonthRange(month)
  return {
    mode,
    month,
    year,
    startDate: range.startDate,
    endDate: range.endDate
  }
}

export function getAvailableYears(pastYears = 10, futureYears = 2) {
  const current = new Date().getFullYear()
  const years = []
  for (let year = current + futureYears; year >= current - pastYears; year -= 1) {
    years.push(String(year))
  }
  return years
}

export function resolvePeriodRange(periodFilter) {
  const filter = periodFilter || {}
  if (filter.mode === 'all') return { startDate: '', endDate: '' }
  if (filter.mode === 'year') return getYearRange(filter.year)
  if (filter.mode === 'custom') {
    return {
      startDate: filter.startDate || '',
      endDate: filter.endDate || ''
    }
  }
  return getMonthRange(filter.month)
}

export function syncPeriodRange(periodFilter) {
  const range = resolvePeriodRange(periodFilter)
  periodFilter.startDate = range.startDate
  periodFilter.endDate = range.endDate
  return range
}

export function formatPeriodLabel(periodFilter) {
  const filter = periodFilter || {}
  if (filter.mode === 'all') return 'Semua Data'
  if (filter.mode === 'year') return `Tahun ${filter.year || currentYearValue()}`
  if (filter.mode === 'custom') {
    if (filter.startDate && filter.endDate) return `${filter.startDate} s/d ${filter.endDate}`
    return 'Rentang tanggal'
  }
  const [year, month] = String(filter.month || currentMonthValue()).split('-')
  if (!year || !month) return 'Per bulan'
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric'
  })
}

export function periodFileLabel(periodFilter) {
  const filter = periodFilter || {}
  if (filter.mode === 'all') return 'Semua_Data'
  if (filter.mode === 'year') return filter.year || currentYearValue()
  if (filter.mode === 'custom') {
    const start = filter.startDate || 'awal'
    const end = filter.endDate || 'akhir'
    return `${start}_sd_${end}`
  }
  return filter.month || currentMonthValue()
}

const RESTORE_PERIOD_STORAGE_KEY = 'wavy:last-restore-period'
const DEFAULT_RESTORE_PERIOD_MAX_AGE_MS = 30 * 60 * 1000

function getSessionStorage() {
  if (typeof sessionStorage === 'undefined') return null
  return sessionStorage
}

function datePart(value) {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : ''
}

export function rememberRestorePeriod(summary) {
  const startDate = datePart(summary?.rentalsMinDate)
  const endDate = datePart(summary?.rentalsMaxDate)
  const storage = getSessionStorage()
  if (!storage || !startDate || !endDate) return

  storage.setItem(
    RESTORE_PERIOD_STORAGE_KEY,
    JSON.stringify({
      startDate,
      endDate,
      storedAt: Date.now()
    })
  )
}

export function getRecentRestorePeriod(maxAgeMs = DEFAULT_RESTORE_PERIOD_MAX_AGE_MS) {
  const storage = getSessionStorage()
  if (!storage) return null

  try {
    const raw = storage.getItem(RESTORE_PERIOD_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const startDate = datePart(parsed?.startDate)
    const endDate = datePart(parsed?.endDate)
    const storedAt = Number(parsed?.storedAt || 0)

    if (!startDate || !endDate || !storedAt || Date.now() - storedAt > maxAgeMs) {
      storage.removeItem(RESTORE_PERIOD_STORAGE_KEY)
      return null
    }

    return {
      mode: 'custom',
      month: startDate.slice(0, 7) || currentMonthValue(),
      year: startDate.slice(0, 4) || currentYearValue(),
      startDate,
      endDate
    }
  } catch (_) {
    storage.removeItem(RESTORE_PERIOD_STORAGE_KEY)
    return null
  }
}
