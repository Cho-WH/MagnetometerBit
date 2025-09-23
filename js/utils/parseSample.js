const isFiniteNumber = (value) => Number.isFinite(value)

export const parseSample = (raw) => {
  if (typeof raw !== 'string') {
    return null
  }

  const segments = raw.split(',').map((part) => part.trim())
  if (segments.length !== 4) {
    return null
  }

  const [xStr, yStr, zStr, strengthStr] = segments
  const x = Number.parseFloat(xStr)
  const y = Number.parseFloat(yStr)
  const z = Number.parseFloat(zStr)
  const strength = Number.parseFloat(strengthStr)

  if (![x, y, z, strength].every(isFiniteNumber)) {
    return null
  }

  return {
    timestamp: Date.now(),
    x,
    y,
    z,
    strength,
  }
}
