const rateLimitMap = new Map()

export function rateLimit(identifier, limit = 5, windowMs = 60000) {
  const now = Date.now()
  const windowStart = now - windowMs

  if (!rateLimitMap.has(identifier)) {
    rateLimitMap.set(identifier, [])
  }

  const timestamps = rateLimitMap.get(identifier)
  const validTimestamps = timestamps.filter(timestamp => timestamp > windowStart)
  
  if (validTimestamps.length >= limit) {
    return {
      success: false,
      remaining: 0,
      resetTime: validTimestamps[0] + windowMs
    }
  }

  validTimestamps.push(now)
  rateLimitMap.set(identifier, validTimestamps)

  return {
    success: true,
    remaining: limit - validTimestamps.length,
    resetTime: now + windowMs
  }
}