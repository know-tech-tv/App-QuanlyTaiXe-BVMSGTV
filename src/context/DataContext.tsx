import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  AdhocReportStatus,
  AppData,
  CreateAdhocTripInput,
  Checklist,
  CreateTripInput,
  CreateVehicleRequestInput,
  DriverVehicleTrackingUpdate,
  CreateUserInput,
  Expense,
  ExpenseReviewAction,
  Incident,
  Maintenance,
  Trip,
  UpdateUserInput,
  Vehicle,
  VehicleRequest,
} from '../types/models'
import { backend, type MediaPayload } from '../lib/backend'
import { useAuth } from './AuthContext'

interface DataContextValue {
  data: AppData
  loading: boolean
  error: string | null
  online: boolean
  pending: number
  refresh(): Promise<void>
  syncNow(): Promise<number>
  createUser(input: CreateUserInput, avatarFile?: File | null): Promise<import('../types/models').Profile>
  updateUser(input: UpdateUserInput, avatarFile?: File | null): Promise<import('../types/models').Profile>
  deleteUser(id: string): Promise<void>
  changeOwnPassword(password: string): Promise<void>
  updateProfile(id: string, changes: Partial<import('../types/models').Profile>): Promise<import('../types/models').Profile>
  createVehicleRequest(input: CreateVehicleRequestInput, planFiles?: File[]): Promise<VehicleRequest>
  updateVehicleRequest(id: string, changes: Partial<VehicleRequest>): Promise<VehicleRequest>
  createTrip(input: CreateTripInput, planFiles?: File[]): Promise<Trip>
  createAdhocTrip(input: CreateAdhocTripInput): Promise<Trip>
  reviewAdhocTrip(id: string, status: Exclude<AdhocReportStatus, 'pending_review'>, note?: string): Promise<Trip>
  updateTrip(id: string, changes: Partial<Trip>): Promise<Trip>
  chainTrip(fromTripId: string, toTripId: string): Promise<Trip>
  createChainedAdhocTrip(fromTripId: string, input: CreateAdhocTripInput): Promise<Trip>
  updateTripLocation(id: string, lat: number, lng: number): Promise<Trip>
  deleteTrip(id: string): Promise<void>
  createChecklist(input: Omit<Checklist, 'id' | 'created_at'>): Promise<Checklist>
  submitOdometer(trip: Trip, phase: 'start' | 'end', odometer: number, file?: File | null): Promise<Trip>
  createExpense(input: Omit<Expense, 'id' | 'created_at' | 'updated_at' | 'receipt_url'>, file?: File | null): Promise<Expense>
  reviewExpense(id: string, action: ExpenseReviewAction, reason?: string): Promise<Expense>
  createIncident(input: Omit<Incident, 'id' | 'created_at' | 'image_url' | 'audio_url'>, media?: MediaPayload): Promise<Incident>
  updateIncident(id: string, changes: Partial<Incident>): Promise<Incident>
  createVehicle(input: Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>): Promise<Vehicle>
  updateVehicle(id: string, changes: Partial<Vehicle>): Promise<Vehicle>
  updateDriverVehicleTracking(id: string, changes: DriverVehicleTrackingUpdate): Promise<Vehicle>
  createMaintenance(input: Omit<Maintenance, 'id' | 'created_at' | 'updated_at'>): Promise<Maintenance>
  updateMaintenance(id: string, changes: Partial<Maintenance>): Promise<Maintenance>
}

const emptyData: AppData = {
  profiles: [], vehicles: [], vehicleRequests: [], trips: [], checklists: [], expenses: [], incidents: [], maintenances: [],
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [data, setData] = useState<AppData>(emptyData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [pending, setPending] = useState(0)

  const refresh = useCallback(async () => {
    if (!user) return
    try {
      setError(null)
      const [nextData, nextPending] = await Promise.all([backend.loadData(), backend.getPendingCount()])
      setData(nextData)
      setPending(nextPending)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setData(emptyData)
      setLoading(false)
      return
    }
    setLoading(true)
    void refresh()
    const unsubscribe = backend.subscribe(() => void refresh())
    return unsubscribe
  }, [refresh, user])

  useEffect(() => {
    if (!user) return
    const refreshWhenVisible = () => {
      if (!document.hidden) void refresh()
    }
    const timer = window.setInterval(refreshWhenVisible, 30_000)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    window.addEventListener('focus', refreshWhenVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.removeEventListener('focus', refreshWhenVisible)
    }
  }, [refresh, user])

  useEffect(() => {
    const onOnline = async () => {
      setOnline(true)
      setPending(await backend.syncPending())
      await refresh()
    }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [refresh])

  const run = useCallback(async <T,>(work: () => Promise<T>) => {
    const result = await work()
    await refresh()
    return result
  }, [refresh])

  const syncNow = useCallback(async () => {
    const nextPending = await backend.syncPending()
    setPending(nextPending)
    await refresh()
    return nextPending
  }, [refresh])

  const updateTripLocation = useCallback(async (id: string, lat: number, lng: number) => {
    const updated = await backend.updateTripLocation(id, lat, lng)
    setData((current) => ({
      ...current,
      trips: current.trips.map((trip) => trip.id === id ? { ...trip, ...updated } : trip),
    }))
    return updated
  }, [])

  const value = useMemo<DataContextValue>(() => ({
    data,
    loading,
    error,
    online,
    pending,
    refresh,
    syncNow,
    createUser: (input, avatarFile) => run(() => backend.createUser(input, avatarFile)),
    updateUser: (input, avatarFile) => run(() => backend.updateUser(input, avatarFile)),
    deleteUser: (id) => run(() => backend.deleteUser(id)),
    changeOwnPassword: (password) => backend.changeOwnPassword(password),
    updateProfile: (id, changes) => run(() => backend.updateProfile(id, changes)),
    createVehicleRequest: (input, planFiles) => run(() => backend.createVehicleRequest(input, user!.id, planFiles)),
    updateVehicleRequest: (id, changes) => run(() => backend.updateVehicleRequest(id, changes)),
    createTrip: (input, planFiles) => run(() => backend.createTrip(input, user!.id, planFiles)),
    createAdhocTrip: (input) => run(() => backend.createAdhocTrip(input, user!.id)),
    reviewAdhocTrip: (id, status, note) => run(() => backend.reviewAdhocTrip(id, status, note)),
    updateTrip: (id, changes) => run(() => backend.updateTrip(id, changes)),
    chainTrip: (fromTripId, toTripId) => run(() => backend.chainTrip(fromTripId, toTripId)),
    // Chuyến nối đột xuất: tạo chuyến đột xuất (đã nhận) rồi nối KM từ chuyến trước.
    createChainedAdhocTrip: (fromTripId, input) => run(async () => {
      const created = await backend.createAdhocTrip(input, user!.id)
      return await backend.chainTrip(fromTripId, created.id)
    }),
    updateTripLocation,
    deleteTrip: (id) => run(() => backend.deleteTrip(id)),
    createChecklist: (input) => run(() => backend.createChecklist(input)),
    submitOdometer: (trip, phase, odometer, file) => run(() => backend.submitOdometer(trip, phase, odometer, file)),
    createExpense: (input, file) => run(() => backend.createExpense(input, file)),
    reviewExpense: (id, action, reason) => run(() => backend.reviewExpense(id, action, user!.id, user!.profile.role, reason)),
    createIncident: (input, media) => run(() => backend.createIncident(input, media)),
    updateIncident: (id, changes) => run(() => backend.updateIncident(id, changes)),
    createVehicle: (input) => run(() => backend.createVehicle(input)),
    updateVehicle: (id, changes) => run(() => backend.updateVehicle(id, changes)),
    updateDriverVehicleTracking: (id, changes) => run(() => backend.updateDriverVehicleTracking(id, changes)),
    createMaintenance: (input) => run(() => backend.createMaintenance(input)),
    updateMaintenance: (id, changes) => run(() => backend.updateMaintenance(id, changes)),
  }), [data, error, loading, online, pending, refresh, run, syncNow, updateTripLocation, user])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const value = useContext(DataContext)
  if (!value) throw new Error('useData must be used inside DataProvider')
  return value
}
