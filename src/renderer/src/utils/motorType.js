export function normalizeMotorType(type) {
  const raw = String(type || '').trim().toLowerCase()
  if (raw === 'aset_pt' || raw === 'asset_pt' || raw === 'pribadi') return 'aset_pt'
  if (raw === 'milik_pemilik' || raw === 'titipan') return 'milik_pemilik'
  return 'milik_pemilik'
}

export function isAsetPt(type) {
  return normalizeMotorType(type) === 'aset_pt'
}

export function getWavyPct(type) {
  return isAsetPt(type) ? 0.2 : 0.3
}

export function getOwnerPct(type) {
  return 1 - getWavyPct(type)
}

export function getWavyPctLabel(type) {
  return isAsetPt(type) ? '20%' : '30%'
}

export function getSplitLabel(type) {
  return isAsetPt(type) ? '20/80' : '30/70'
}

export function getMotorTypeLabel(type) {
  return isAsetPt(type) ? 'Aset PT' : 'Milik Mitra'
}
