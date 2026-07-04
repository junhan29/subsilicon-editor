import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return `¥${amount.toFixed(2)}`
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function maskIdCard(idCard: string): string {
  if (!idCard || idCard.length < 8) return idCard
  return idCard.slice(0, 4) + '********' + idCard.slice(-4)
}

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 11) return phone
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

export function shallowEqual(objA: any, objB: any): boolean {
  if (objA === objB) return true
  if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null) {
    return false
  }
  const keysA = Object.keys(objA)
  const keysB = Object.keys(objB)
  if (keysA.length !== keysB.length) return false
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, key) || objA[key] !== objB[key]) {
      return false
    }
  }
  return true
}

interface NodePropsLike {
  id?: string
  selected?: boolean
  data?: any
}

export function areNodesEqual(prevProps: NodePropsLike, nextProps: NodePropsLike): boolean {
  if (prevProps.id !== nextProps.id) return false
  if (prevProps.selected !== nextProps.selected) return false
  if (prevProps.data === nextProps.data) return true
  if (!prevProps.data || !nextProps.data) return false
  return shallowEqual(prevProps.data, nextProps.data)
}
