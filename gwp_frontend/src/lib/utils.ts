

export function getCurrentMonth(): string {
  return new Date().toLocaleString('en-US', { month: 'long' })
}

