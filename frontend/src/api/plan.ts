import client from './client'

export interface PlanSetItemDto {
  setId: string
  title: string
  totalWords: number
  isOverdue: boolean
  graceDaysLeft: number
}

export interface PlanDayDto {
  date: string
  totalWords: number
  sets: PlanSetItemDto[]
}

export const getWeeklyPlan = (from?: string) =>
  client.get<PlanDayDto[]>('/api/plan/weekly', { params: from ? { from } : {} }).then((r) => r.data)

export const getMonthlyPlan = (from?: string) =>
  client.get<PlanDayDto[]>('/api/plan/monthly', { params: from ? { from } : {} }).then((r) => r.data)

export const rescheduleSet = (setId: string, date: string) =>
  client.patch(`/api/plan/${setId}/reschedule`, { date })
