export interface TourStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function dashboardTourStorageKey(userId: string) {
  return `hasSeenDashboardTour:${encodeURIComponent(userId)}`
}

export function hasSeenDashboardTour(userId: string, storage: TourStorage) {
  return storage.getItem(dashboardTourStorageKey(userId)) === 'true'
}

export function markDashboardTourSeen(userId: string, storage: TourStorage) {
  storage.setItem(dashboardTourStorageKey(userId), 'true')
}
