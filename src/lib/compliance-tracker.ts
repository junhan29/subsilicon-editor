import type {
  IncomeRecord, IncomeTracking, ComplianceStatus, ComplianceWarning
} from './work-monetization'
import { COMPLIANCE_THRESHOLDS, COMPLIANCE_ADVICE } from './work-monetization'

const INCOME_STORAGE_KEY = 'subsilicon_income_tracking'

export function loadIncomeTracking(): IncomeTracking {
  try {
    const data = localStorage.getItem(INCOME_STORAGE_KEY)
    if (data) {
      return JSON.parse(data)
    }
  } catch {}
  return { records: [], lastUpdated: Date.now() }
}

export function saveIncomeTracking(tracking: IncomeTracking): void {
  tracking.lastUpdated = Date.now()
  localStorage.setItem(INCOME_STORAGE_KEY, JSON.stringify(tracking))
}

export function addIncomeRecord(record: Omit<IncomeRecord, 'id'>): IncomeRecord {
  const tracking = loadIncomeTracking()
  const newRecord: IncomeRecord = {
    ...record,
    id: `income_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  }
  tracking.records.push(newRecord)
  const currentYear = new Date().getFullYear()
  tracking.records = tracking.records.filter(r =>
    new Date(r.date).getFullYear() >= currentYear - 1
  )
  saveIncomeTracking(tracking)
  return newRecord
}

export function getCurrentYearIncome(): number {
  const tracking = loadIncomeTracking()
  const currentYear = new Date().getFullYear()
  return tracking.records
    .filter(r => new Date(r.date).getFullYear() === currentYear)
    .reduce((sum, r) => sum + r.amount, 0)
}

export function getMonthlyAverage(): number {
  const tracking = loadIncomeTracking()
  const now = Date.now()
  const threeMonthsAgo = now - 90 * 24 * 60 * 60 * 1000
  const recentRecords = tracking.records.filter(r => r.date >= threeMonthsAgo)
  const total = recentRecords.reduce((sum, r) => sum + r.amount, 0)
  return total / 3
}

export function getComplianceStatus(): ComplianceStatus {
  const currentYearIncome = getCurrentYearIncome()
  const monthlyAverage = getMonthlyAverage()
  const warnings: ComplianceWarning[] = []
  let maxLevel: 'safe' | 'notice' | 'warning' | 'critical' = 'safe'

  const earlyRatio = COMPLIANCE_THRESHOLDS.EARLY_WARNING_RATIO

  if (currentYearIncome >= COMPLIANCE_THRESHOLDS.YEAR_INCOME_TAX_NOTICE * earlyRatio) {
    const advice = COMPLIANCE_ADVICE.tax_notice
    warnings.push({
      level: 'notice',
      title: advice.title,
      message: advice.message,
      action: advice.action,
      threshold: COMPLIANCE_THRESHOLDS.YEAR_INCOME_TAX_NOTICE,
      current: currentYearIncome,
    })
    if (maxLevel === 'safe') maxLevel = 'notice'
  }

  if (currentYearIncome >= COMPLIANCE_THRESHOLDS.YEAR_INCOME_INDIVIDUAL_WARNING * earlyRatio) {
    const advice = COMPLIANCE_ADVICE.individual_warning
    warnings.push({
      level: 'warning',
      title: advice.title,
      message: advice.message,
      action: advice.action,
      threshold: COMPLIANCE_THRESHOLDS.YEAR_INCOME_INDIVIDUAL_WARNING,
      current: currentYearIncome,
    })
    if (maxLevel === 'safe' || maxLevel === 'notice') maxLevel = 'warning'
  }

  if (currentYearIncome >= COMPLIANCE_THRESHOLDS.YEAR_INCOME_INDIVIDUAL_CRITICAL) {
    const advice = COMPLIANCE_ADVICE.individual_critical
    warnings.push({
      level: 'critical',
      title: advice.title,
      message: advice.message,
      action: advice.action,
      threshold: COMPLIANCE_THRESHOLDS.YEAR_INCOME_INDIVIDUAL_CRITICAL,
      current: currentYearIncome,
    })
    maxLevel = 'critical'
  }

  if (monthlyAverage >= COMPLIANCE_THRESHOLDS.MONTHLY_AVERAGE_WARNING * earlyRatio) {
    const advice = COMPLIANCE_ADVICE.monthly_warning
    warnings.push({
      level: 'warning',
      title: advice.title,
      message: advice.message,
      action: advice.action,
      threshold: COMPLIANCE_THRESHOLDS.MONTHLY_AVERAGE_WARNING,
      current: monthlyAverage,
    })
    if (maxLevel === 'safe' || maxLevel === 'notice') maxLevel = 'warning'
  }

  return {
    currentYearIncome,
    monthlyAverage,
    warningLevel: maxLevel,
    warnings,
  }
}

export function deleteIncomeRecord(id: string): void {
  const tracking = loadIncomeTracking()
  tracking.records = tracking.records.filter(r => r.id !== id)
  saveIncomeTracking(tracking)
}

export function clearIncomeRecords(): void {
  saveIncomeTracking({ records: [], lastUpdated: Date.now() })
}
