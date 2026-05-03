import { describe, expect, it } from 'vitest'
import { dateInputValue } from '../renderer/src/utils/format.js'
import { getMonthRange } from '../renderer/src/utils/periodFilter.js'

describe('period date helpers', () => {
  it('menghasilkan akhir bulan lokal tanpa bergeser karena UTC', () => {
    expect(dateInputValue(new Date(2026, 3, 30, 0, 0, 0))).toBe('2026-04-30')
    expect(getMonthRange('2026-04')).toEqual({
      startDate: '2026-04-01',
      endDate: '2026-04-30'
    })
  })
})
