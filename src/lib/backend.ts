import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'

import type {
  AdhocReportStatus,
  AppData,
  AuthUser,
  Checklist,
  CreateAdhocTripInput,
  CreateTripInput,
  CreateVehicleRequestInput,
  DriverVehicleTrackingUpdate,
  CreateUserInput,
  Expense,
  ExpenseReviewAction,
  Incident,
  Maintenance,
  PlanAttachment,
  Profile,
  Trip,
  UpdateUserInput,
  UserPresence,
  UserRole,
  Vehicle,
  VehicleRequest,
} from '../types/models'
import { addPending, listPending, pendingCount, removePending, updatePending, type PendingAction } from './offline'
import { supabase } from './supabase'
import { getErrorMessage, normalizePhone, uid } from './utils'
import { optimizeCapturedImage } from './image'

const LIVE_CACHE_KEY = 'msg-car-live-cache-v1'

export interface MediaPayload {
  file?: File | null
  secondFile?: File | null
}

export interface BackendApi {
  mode: 'supabase'
  login(phone: string, password: string): Promise<AuthUser>
  logout(): Promise<void>
  session(): Promise<AuthUser | null>
  loadData(): Promise<AppData>
  createUser(input: CreateUserInput, avatarFile?: File | null): Promise<Profile>
  updateUser(input: UpdateUserInput, avatarFile?: File | null): Promise<Profile>
  deleteUser(id: string): Promise<void>
  changeOwnPassword(password: string): Promise<void>
  updateProfile(id: string, changes: Partial<Profile>): Promise<Profile>
  subscribe(onChange: () => void): () => void
  createVehicleRequest(input: CreateVehicleRequestInput, requesterId: string, planFiles?: File[]): Promise<VehicleRequest>
  updateVehicleRequest(id: string, changes: Partial<VehicleRequest>): Promise<VehicleRequest>
  createTrip(input: CreateTripInput, creatorId: string, planFiles?: File[]): Promise<Trip>
  createAdhocTrip(input: CreateAdhocTripInput, driverId: string): Promise<Trip>
  reviewAdhocTrip(id: string, status: Exclude<AdhocReportStatus, 'pending_review'>, note?: string): Promise<Trip>
  updateTrip(id: string, changes: Partial<Trip>): Promise<Trip>
  chainTrip(fromTripId: string, toTripId: string): Promise<Trip>
  updateTripLocation(id: string, lat: number, lng: number): Promise<Trip>
  deleteTrip(id: string): Promise<void>
  createChecklist(input: Omit<Checklist, 'id' | 'created_at'>): Promise<Checklist>
  submitOdometer(trip: Trip, phase: 'start' | 'end', odometer: number, file?: File | null): Promise<Trip>
  createExpense(input: Omit<Expense, 'id' | 'created_at' | 'updated_at' | 'receipt_url'>, file?: File | null): Promise<Expense>
  reviewExpense(id: string, action: ExpenseReviewAction, reviewerId: string, reviewerRole: UserRole, reason?: string): Promise<Expense>
  createIncident(input: Omit<Incident, 'id' | 'created_at' | 'image_url' | 'audio_url'>, media?: MediaPayload): Promise<Incident>
  updateIncident(id: string, changes: Partial<Incident>): Promise<Incident>
  createVehicle(input: Omit<Vehicle, 'id' | 'created_at' | 'updated_at'>): Promise<Vehicle>
  updateVehicle(id: string, changes: Partial<Vehicle>): Promise<Vehicle>
  updateDriverVehicleTracking(id: string, changes: DriverVehicleTrackingUpdate): Promise<Vehicle>
  createMaintenance(input: Omit<Maintenance, 'id' | 'created_at' | 'updated_at'>): Promise<Maintenance>
  updateMaintenance(id: string, changes: Partial<Maintenance>): Promise<Maintenance>
  syncPending(): Promise<number>
  getPendingCount(): Promise<number>
  touchPresence(platform?: string): Promise<void>
  loadPresence(): Promise<UserPresence[]>
}


function readLiveCache(): AppData | null {
  const raw = localStorage.getItem(LIVE_CACHE_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as AppData } catch { return null }
}

function writeLiveCache(data: AppData) {
  try { localStorage.setItem(LIVE_CACHE_KEY, JSON.stringify(data)) } catch {
    // Local storage may be full if the browser has a very small quota.
  }
}


function expenseReviewTransition(expense: Expense, action: ExpenseReviewAction, reviewerId: string, reviewerRole: UserRole, reason?: string) {
  const now = new Date().toISOString()
  const isAdmin = reviewerRole === 'admin'

  if (action === 'director_approve') {
    if (!isAdmin && reviewerRole !== 'director') throw new Error('Chỉ Ban Giám đốc được duyệt bước đầu.')
    if (expense.status !== 'pending_director') throw new Error('Chi phí không còn ở bước chờ Ban Giám đốc duyệt.')
    return {
      expectedStatus: 'pending_director' as const,
      changes: {
        status: 'pending_accountant' as const,
        director_reviewer_id: reviewerId,
        director_reviewed_at: now,
        reviewer_id: reviewerId,
        reviewed_at: now,
        rejection_reason: null,
        updated_at: now,
      },
    }
  }

  if (action === 'accountant_approve') {
    if (!isAdmin && reviewerRole !== 'accountant') throw new Error('Chỉ Kế toán được duyệt bước thanh toán.')
    if (expense.status !== 'pending_accountant') throw new Error('Chi phí chưa được Ban Giám đốc duyệt hoặc đã được xử lý.')
    return {
      expectedStatus: 'pending_accountant' as const,
      changes: {
        status: 'approved' as const,
        accountant_reviewer_id: reviewerId,
        accountant_reviewed_at: now,
        reviewer_id: reviewerId,
        reviewed_at: now,
        rejection_reason: null,
        updated_at: now,
      },
    }
  }

  if (action === 'mark_paid') {
    if (!isAdmin && reviewerRole !== 'accountant') throw new Error('Chỉ Kế toán được xác nhận chi trả.')
    if (expense.status !== 'approved') throw new Error('Chi phí chưa hoàn tất hai bước duyệt.')
    return {
      expectedStatus: 'approved' as const,
      changes: {
        status: 'paid' as const,
        paid_by: reviewerId,
        paid_at: now,
        reviewer_id: reviewerId,
        reviewed_at: now,
        updated_at: now,
      },
    }
  }

  if (!reason?.trim()) throw new Error('Cần nhập lý do từ chối.')
  const canReject = isAdmin
    || (reviewerRole === 'director' && expense.status === 'pending_director')
    || (reviewerRole === 'accountant' && expense.status === 'pending_accountant')
  if (!canReject) throw new Error('Bạn không có quyền từ chối chi phí ở bước hiện tại.')

  return {
    expectedStatus: expense.status,
    changes: {
      status: 'rejected' as const,
      reviewer_id: reviewerId,
      reviewed_at: now,
      rejection_reason: reason.trim(),
      updated_at: now,
    },
  }
}

function applyOptimisticToLiveCache(operation: string, optimistic: unknown) {
  const cache = readLiveCache()
  if (!cache || !optimistic || typeof optimistic !== 'object') return
  const tableMap: Record<string, keyof AppData> = {
    'expense.create': 'expenses',
    'incident.create': 'incidents',
    'odometer.update': 'trips',
  }
  const tableName = operation.split('.')[0]
  const key = tableMap[operation] ?? (tableName in cache ? tableName as keyof AppData : null)
  if (!key) return
  const record = optimistic as { id?: string }
  if (!record.id) return
  const items = cache[key] as unknown as Array<Record<string, unknown>>
  const index = items.findIndex((item) => item.id === record.id)
  if (index >= 0) items[index] = { ...items[index], ...record }
  else items.unshift(record as Record<string, unknown>)
  writeLiveCache(cache)
}

function phoneToE164(phone: string) {
  const digits = normalizePhone(phone).replace(/\D/g, '')
  if (digits.startsWith('84')) return `+${digits}`
  if (digits.startsWith('0')) return `+84${digits.slice(1)}`
  return `+84${digits}`
}

function phoneToInternalEmail(phone: string) {
  const e164 = phoneToE164(phone)
  return `${e164.slice(1)}@auth.bvmsgtv.internal`
}

function friendlyLoginError(message: string) {
  if (/invalid login credentials/i.test(message)) return 'Số điện thoại hoặc mật khẩu không đúng.'
  if (/email logins are disabled/i.test(message)) return 'Supabase chưa bật đăng nhập Email. Hãy bật Authentication → Providers → Email.'
  return message
}

async function friendlyFunctionError(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.clone().json() as { error?: string; message?: string }
      return payload.error ?? payload.message ?? `Edge Function trả lỗi HTTP ${error.context.status}.`
    } catch {
      return `Edge Function trả lỗi HTTP ${error.context.status}. Hãy xem Supabase → Edge Functions → manage-user → Logs.`
    }
  }
  if (error instanceof FunctionsFetchError) {
    return 'Không kết nối được Edge Function manage-user. Hãy deploy lại Edge Function manage-user và kiểm tra đúng Supabase Project.'
  }
  if (error instanceof FunctionsRelayError) {
    return `Supabase Edge Relay gặp lỗi: ${error.message}`
  }
  return error instanceof Error ? error.message : String(error)
}

function friendlyTripError(error: unknown, fallback: string) {
  const message = getErrorMessage(error, fallback)
  if (/trips_vehicle_time_no_overlap/i.test(message)) return 'Xe đã có chuyến khác trùng khoảng thời gian này. Vui lòng chọn xe khác hoặc đổi giờ.'
  if (/trips_driver_time_no_overlap/i.test(message)) return 'Tài xế đã có chuyến khác trùng khoảng thời gian này.'
  if (/trip_time_order/i.test(message)) return 'Thời gian dự kiến về phải sau giờ xuất phát.'
  if (/Chuyển trạng thái Hành chính duyệt không hợp lệ|không ở bước chờ Hành chính duyệt|approval_mode|director_required/i.test(message)) {
    return 'Cơ sở dữ liệu đang dùng flow điều xe cũ. Hãy chạy migration v2.11.1 để Hành chính duyệt và giao thẳng cho tài xế.'
  }
  return message
}

async function requireSupabase() {
  if (!supabase) throw new Error('Supabase chưa được cấu hình.')
  return supabase
}

async function uploadMedia(file: Blob, folder: string, fileKey?: string) {
  const client = await requireSupabase()
  const mime = file.type.split(';')[0] || 'application/octet-stream'
  const rawExt = mime.split('/')[1] || 'bin'
  const ext = rawExt.replace('jpeg', 'jpg').replace('mpeg', 'mp3').replace('mp4', 'm4a')
  const basename = fileKey ?? `${Date.now()}-${uid('media')}`
  const path = `${folder}/${basename}.${ext}`
  const { error } = await client.storage.from('vehicle-media').upload(path, file, { contentType: mime, upsert: Boolean(fileKey) })
  if (error) {
    const message = error.message || String(error)
    if (/bucket.*not found|not found.*bucket/i.test(message)) throw new Error('Chưa có kho ảnh vehicle-media. Quản trị cần chạy lại supabase/schema.sql.')
    if (/row-level security|policy|not authorized|permission/i.test(message)) throw new Error('Tài khoản không có quyền tải tệp. Kiểm tra Storage Policy và quyền người dùng.')
    if (/too large|maximum|payload|size/i.test(message)) throw new Error('Tệp vượt dung lượng cho phép 10 MB. Vui lòng chọn tệp nhỏ hơn.')
    throw new Error(`Không tải được tệp: ${message}`)
  }
  return path
}

const MAX_PLAN_FILES = 10
const MAX_PLAN_FILE_SIZE = 10 * 1024 * 1024
const MAX_PLAN_TOTAL_SIZE = 50 * 1024 * 1024

function validatePlanFiles(files: File[]) {
  if (files.length > MAX_PLAN_FILES) throw new Error(`Chỉ được đính kèm tối đa ${MAX_PLAN_FILES} tệp.`)
  const total = files.reduce((sum, file) => sum + file.size, 0)
  if (total > MAX_PLAN_TOTAL_SIZE) throw new Error('Tổng dung lượng tệp đính kèm không được vượt quá 50 MB.')
  const tooLarge = files.find((file) => file.size > MAX_PLAN_FILE_SIZE)
  if (tooLarge) throw new Error(`Tệp “${tooLarge.name}” vượt quá 10 MB.`)
}

async function uploadPlanFiles(files: File[], ownerId: string, recordType: 'request' | 'trip', recordId: string): Promise<PlanAttachment[]> {
  validatePlanFiles(files)
  const uploaded: PlanAttachment[] = []
  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      const path = await uploadMedia(file, `${ownerId}/trip-plans`, `${recordType}-${recordId}-${index + 1}`)
      uploaded.push({ path, name: file.name || `Tệp ${index + 1}`, mime_type: file.type || 'application/octet-stream', size_bytes: file.size })
    }
    return uploaded
  } catch (error) {
    await Promise.all(uploaded.map((item) => removeStoredMedia(item.path)))
    throw error
  }
}

async function hydratePlanAttachments(items?: PlanAttachment[] | null, fallbackPath?: string | null): Promise<PlanAttachment[]> {
  const source = items?.length ? items : fallbackPath ? [{ path: fallbackPath, name: 'Văn bản kế hoạch', mime_type: null, size_bytes: null }] : []
  return await Promise.all(source.map(async (item) => ({ ...item, url: await signMedia(item.path) })))
}

async function uploadAccountAvatar(file: File, targetUserId: string) {
  const optimized = await optimizeCapturedImage(file, { maxDimension: 720, quality: 0.82, maxBytes: 650_000 })
  return await uploadMedia(optimized, `${targetUserId}/avatars`, 'profile')
}

async function removeStoredMedia(path?: string | null) {
  if (!path || path.startsWith('data:') || path.startsWith('http')) return
  const client = await requireSupabase()
  await client.storage.from('vehicle-media').remove([path])
}

async function signMedia(path?: string | null) {
  if (!path || path.startsWith('data:') || path.startsWith('http')) return path
  const client = await requireSupabase()
  const { data } = await client.storage.from('vehicle-media').createSignedUrl(path, 60 * 60)
  return data?.signedUrl ?? path
}

async function hydrateProfile(profile: Profile): Promise<Profile> {
  const avatarPath = profile.avatar_path ?? profile.avatar_url ?? null
  return {
    ...profile,
    avatar_path: avatarPath,
    avatar_url: await signMedia(avatarPath),
  }
}

async function hydrateData(data: AppData): Promise<AppData> {
  const profiles = await Promise.all(data.profiles.map(hydrateProfile))
  const vehicleRequests = await Promise.all(data.vehicleRequests.map(async (request) => {
    const planPath = request.plan_document_path ?? request.plan_document_url ?? null
    return {
      ...request,
      plan_document_path: planPath,
      plan_document_url: await signMedia(planPath),
      plan_attachments: await hydratePlanAttachments(request.plan_attachments, planPath),
    }
  }))
  const trips = await Promise.all(data.trips.map(async (trip) => {
    const planPath = trip.plan_document_path ?? trip.plan_document_url ?? null
    return {
      ...trip,
      plan_document_path: planPath,
      plan_document_url: await signMedia(planPath),
      plan_attachments: await hydratePlanAttachments(trip.plan_attachments, planPath),
      start_odometer_image_url: await signMedia(trip.start_odometer_image_url),
      end_odometer_image_url: await signMedia(trip.end_odometer_image_url),
    }
  }))
  const expenses = await Promise.all(data.expenses.map(async (expense) => ({ ...expense, receipt_url: await signMedia(expense.receipt_url) })))
  const incidents = await Promise.all(data.incidents.map(async (incident) => ({
    ...incident,
    image_url: await signMedia(incident.image_url),
    audio_url: await signMedia(incident.audio_url),
  })))
  return { ...data, profiles, vehicleRequests, trips, expenses, incidents }
}

async function supabaseLoadData(): Promise<AppData> {
  const cache = readLiveCache()
  if (!navigator.onLine && cache) return cache
  try {
    const client = await requireSupabase()
    const tables = ['profiles', 'vehicles', 'vehicle_requests', 'trips', 'checklists', 'expenses', 'incidents', 'maintenances'] as const
    const results = await Promise.all(tables.map((table) => client.from(table).select('*').order('created_at', { ascending: false })))
    results.forEach((result) => { if (result.error) throw result.error })
    const hydrated = await hydrateData({
      profiles: (results[0].data ?? []) as Profile[],
      vehicles: (results[1].data ?? []) as Vehicle[],
      vehicleRequests: (results[2].data ?? []) as VehicleRequest[],
      trips: (results[3].data ?? []) as Trip[],
      checklists: (results[4].data ?? []) as Checklist[],
      expenses: (results[5].data ?? []) as Expense[],
      incidents: (results[6].data ?? []) as Incident[],
      maintenances: (results[7].data ?? []) as Maintenance[],
    })
    writeLiveCache(hydrated)
    return hydrated
  } catch (error) {
    if (cache) return cache
    throw error
  }
}

async function queue(operation: string, payload: Record<string, unknown>, file?: Blob | null, secondFile?: Blob | null) {
  const action: PendingAction = { id: uid('pending'), operation, payload, file, secondFile, createdAt: new Date().toISOString(), attempts: 0 }
  await addPending(action)
}

async function executeAction(action: PendingAction) {
  const client = await requireSupabase()
  const payload = { ...action.payload }
  if (action.operation === 'expense.create') {
    const recordId = String(payload.id)
    if (action.file) payload.receipt_url = await uploadMedia(action.file, `${payload.driver_id}/receipts`, `expense-${recordId}`)
    const { error } = await client.from('expenses').upsert(payload, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw error
    return
  }
  if (action.operation === 'incident.create') {
    const recordId = String(payload.id)
    if (action.file) payload.image_url = await uploadMedia(action.file, `${payload.driver_id}/incidents`, `incident-${recordId}`)
    if (action.secondFile) payload.audio_url = await uploadMedia(action.secondFile, `${payload.driver_id}/incident-audio`, `incident-audio-${recordId}`)
    const { error } = await client.from('incidents').upsert(payload, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw error
    return
  }
  if (action.operation === 'odometer.update') {
    const phase = String(payload.phase)
    const field = phase === 'start' ? 'start_odometer_image_url' : 'end_odometer_image_url'
    const tripId = String(payload.trip_id)
    if (action.file) payload[field] = await uploadMedia(action.file, `${payload.driver_id}/odometer`, `${tripId}-${phase}`)
    delete payload.phase
    delete payload.driver_id
    delete payload.trip_id
    const { error } = await client.from('trips').update(payload).eq('id', tripId)
    if (error) throw error
    return
  }
  const [table, method] = action.operation.split('.')
  const id = payload.id ? String(payload.id) : null
  if (method === 'insert') {
    const { error } = await client.from(table).upsert(payload, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw error
  } else if (method === 'update' && id) {
    delete payload.id
    const { error } = await client.from(table).update(payload).eq('id', id)
    if (error) throw error
  }
}

async function performOrQueue<T>(operation: string, payload: Record<string, unknown>, work: () => Promise<T>, optimistic: T, file?: Blob | null, secondFile?: Blob | null) {
  if (!navigator.onLine) {
    await queue(operation, payload, file, secondFile)
    applyOptimisticToLiveCache(operation, optimistic)
    return optimistic
  }
  try {
    return await work()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/fetch|network|offline|failed to fetch/i.test(message)) {
      await queue(operation, payload, file, secondFile)
      applyOptimisticToLiveCache(operation, optimistic)
      return optimistic
    }
    throw error
  }
}

const supabaseBackend: BackendApi = {
  mode: 'supabase',
  async login(phone, password) {
    const client = await requireSupabase()
    const email = phoneToInternalEmail(phone)
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error) throw new Error(friendlyLoginError(error.message))
    if (!data.user) throw new Error('Không đăng nhập được.')
    const { data: profile, error: profileError } = await client.from('profiles').select('*').eq('id', data.user.id).single()
    if (profileError) throw profileError
    if (!profile.active) { await client.auth.signOut(); throw new Error('Tài khoản đã bị khóa.') }
    return { id: data.user.id, profile: await hydrateProfile(profile as Profile) }
  },
  async logout() {
    const client = await requireSupabase()
    await client.auth.signOut()
  },
  async session() {
    const client = await requireSupabase()
    const { data } = await client.auth.getSession()
    if (!data.session?.user) return null
    const { data: profile } = await client.from('profiles').select('*').eq('id', data.session.user.id).maybeSingle()
    if (!profile || !profile.active) { await client.auth.signOut(); return null }
    return { id: data.session.user.id, profile: await hydrateProfile(profile as Profile) }
  },
  async changeOwnPassword(password) {
    const client = await requireSupabase()
    const nextPassword = String(password ?? '').trim()
    if (nextPassword.length < 6) throw new Error('Mật khẩu mới cần ít nhất 6 ký tự.')

    const { data: userData, error: userError } = await client.auth.getUser()
    if (userError || !userData.user) throw new Error('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại trước khi đổi mật khẩu.')

    const { error } = await client.auth.updateUser({ password: nextPassword })
    if (error) throw new Error(`Không đổi được mật khẩu: ${error.message}`)
  },
  loadData: supabaseLoadData,
  async createUser(input, avatarFile) {
    const client = await requireSupabase()
    const { data, error } = await client.functions.invoke('manage-user', {
      body: { action: 'create', ...input, avatar_url: null },
    })
    if (error) throw new Error(await friendlyFunctionError(error))
    if (data?.error) throw new Error(data.error)
    if (!data?.profile) throw new Error('Edge Function không trả về hồ sơ tài khoản mới.')

    let profile = data.profile as Profile
    if (avatarFile) {
      const avatarPath = await uploadAccountAvatar(avatarFile, profile.id)
      const updateResult = await client.functions.invoke('manage-user', {
        body: {
          action: 'update',
          id: profile.id,
          full_name: input.full_name,
          phone: input.phone,
          role: input.role,
          active: true,
          employee_code: input.employee_code,
          department: input.department,
          job_title: input.job_title,
          notes: input.notes,
          avatar_url: avatarPath,
        },
      })
      if (updateResult.error) {
        await removeStoredMedia(avatarPath)
        throw new Error(await friendlyFunctionError(updateResult.error))
      }
      if (updateResult.data?.error) {
        await removeStoredMedia(avatarPath)
        throw new Error(updateResult.data.error)
      }
      if (updateResult.data?.profile) profile = updateResult.data.profile as Profile
    }
    return await hydrateProfile(profile)
  },
  async updateUser(input, avatarFile) {
    const client = await requireSupabase()
    const oldAvatarPath = input.previous_avatar_url ?? null
    const avatarPath = avatarFile
      ? await uploadAccountAvatar(avatarFile, input.id)
      : input.avatar_url === null
        ? null
        : input.avatar_url ?? oldAvatarPath
    const { data, error } = await client.functions.invoke('manage-user', {
      body: { action: 'update', ...input, avatar_url: avatarPath },
    })
    if (error) {
      if (avatarFile) await removeStoredMedia(avatarPath)
      throw new Error(await friendlyFunctionError(error))
    }
    if (data?.error) {
      if (avatarFile) await removeStoredMedia(avatarPath)
      throw new Error(data.error)
    }
    if (!data?.profile) throw new Error('Edge Function không trả về hồ sơ đã cập nhật.')
    if (oldAvatarPath && oldAvatarPath !== avatarPath) await removeStoredMedia(oldAvatarPath)
    return await hydrateProfile(data.profile as Profile)
  },
  async deleteUser(id) {
    if (!navigator.onLine) throw new Error('Cần kết nối mạng để xóa tài khoản.')
    const client = await requireSupabase()
    const { data, error } = await client.functions.invoke('manage-user', { body: { action: 'delete', id } })
    if (error) throw new Error(await friendlyFunctionError(error))
    if (data?.error) throw new Error(data.error)
  },
  async updateProfile(id, changes) {
    const client = await requireSupabase()
    const { data, error } = await client.from('profiles').update(changes).eq('id', id).select().single()
    if (error) throw error
    return data as Profile
  },
  subscribe(onChange) {
    const client = supabase
    if (!client) return () => undefined

    const channel = client.channel('msg-car-changes')
    for (const table of ['profiles', 'vehicle_requests', 'trips', 'vehicles', 'expenses', 'incidents', 'maintenances', 'checklists']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
    }
    channel.subscribe()

    return () => {
      void client.removeChannel(channel)
    }
  },
  async createVehicleRequest(input, requesterId, planFiles = []) {
    if (!navigator.onLine) throw new Error('Cần kết nối mạng để gửi đề nghị điều xe và văn bản kế hoạch.')
    const client = await requireSupabase()
    const id = uid('vehicle-request')
    const now = new Date().toISOString()
    const attachments = await uploadPlanFiles(planFiles, requesterId, 'request', id)
    const planPath = attachments[0]?.path ?? null
    const payload = {
      ...input,
      id,
      requester_id: requesterId,
      plan_document_url: planPath,
      plan_attachments: attachments,
      status: 'pending_fleet',
    }
    const { data, error } = await client.from('vehicle_requests').insert(payload).select().single()
    if (error) {
      await Promise.all(attachments.map((item) => removeStoredMedia(item.path)))
      throw new Error(getErrorMessage(error, 'Không thể tạo đề nghị điều hành xe.'))
    }
    const record = data as VehicleRequest
    return {
      ...record,
      plan_document_path: planPath,
      plan_document_url: await signMedia(planPath),
      plan_attachments: await hydratePlanAttachments(record.plan_attachments, planPath),
      created_at: record.created_at ?? now,
    }
  },
  async updateVehicleRequest(id, changes) {
    if (!navigator.onLine) throw new Error('Cần kết nối mạng để duyệt đề nghị điều xe.')
    const client = await requireSupabase()
    const payload = { ...changes, updated_at: new Date().toISOString() }
    const { data, error } = await client.from('vehicle_requests').update(payload).eq('id', id).select().single()
    if (error) throw error
    const record = data as VehicleRequest
    const planPath = record.plan_document_url ?? null
    return {
      ...record,
      plan_document_path: planPath,
      plan_document_url: await signMedia(planPath),
      plan_attachments: await hydratePlanAttachments(record.plan_attachments, planPath),
    }
  },
  async createTrip(input, creatorId, planFiles = []) {
    const client = await requireSupabase()
    const now = new Date().toISOString()
    const id = uid('trip')
    const { existing_plan_path, ...tripInput } = input

    type ApprovedVehicleRequest = {
      status: string
      plan_document_url?: string | null
      plan_attachments?: PlanAttachment[] | null
      fleet_reviewer_id?: string | null
      fleet_reviewed_at?: string | null
    }

    let approvedRequest: ApprovedVehicleRequest | null = null
    if (input.vehicle_request_id) {
      const { data: requestData, error: requestError } = await client
        .from('vehicle_requests')
        .select('status, plan_document_url, plan_attachments, fleet_reviewer_id, fleet_reviewed_at')
        .eq('id', input.vehicle_request_id)
        .single()
      if (requestError) throw requestError
      if (!requestData || requestData.status !== 'fleet_approved') {
        throw new Error('Đề nghị điều xe chưa được Hành chính duyệt hoặc đã được tạo thành chuyến.')
      }
      approvedRequest = requestData as ApprovedVehicleRequest
    }

    const inheritedAttachments = approvedRequest?.plan_attachments?.length
      ? approvedRequest.plan_attachments
      : (existing_plan_path ?? approvedRequest?.plan_document_url)
        ? [{ path: (existing_plan_path ?? approvedRequest?.plan_document_url)!, name: 'Văn bản kế hoạch', mime_type: null, size_bytes: null }]
        : []
    const uploadedAttachments = await uploadPlanFiles(planFiles, creatorId, 'trip', id)
    const attachments = [...(inheritedAttachments ?? []), ...uploadedAttachments]
    const planPath = attachments[0]?.path ?? existing_plan_path ?? approvedRequest?.plan_document_url ?? null
    const fromApprovedDepartmentRequest = Boolean(input.vehicle_request_id && approvedRequest)
    const approvedPlan = Boolean(planPath || attachments.length)
    const payload = {
      ...tripInput,
      id,
      created_by: creatorId,
      status: fromApprovedDepartmentRequest ? 'assigned' : 'pending_fleet',
      // v2.9.0: mọi chuyến chỉ cần Hành chính điều phối duyệt; BGĐ không duyệt chuyến.
      approval_mode: 'fleet_only',
      approved_plan: approvedPlan,
      plan_document_url: planPath,
      plan_attachments: attachments.map(({ url: _url, ...item }) => item),
      fleet_reviewer_id: fromApprovedDepartmentRequest ? approvedRequest?.fleet_reviewer_id ?? null : null,
      fleet_reviewed_at: fromApprovedDepartmentRequest ? approvedRequest?.fleet_reviewed_at ?? null : null,
      checklist_completed: false,
    }
    const optimistic: Trip = { ...payload, plan_document_path: planPath, created_at: now, updated_at: now } as Trip
    try {
      const { data, error } = await client.from('trips').insert(payload).select().single()
      if (error) throw new Error(friendlyTripError(error, 'Không thể tạo chuyến đi.'))
      const record = data as Trip
      return {
        ...record,
        plan_document_path: planPath,
        plan_document_url: await signMedia(planPath),
        plan_attachments: await hydratePlanAttachments(record.plan_attachments, planPath),
      }
    } catch (error) {
      await Promise.all(uploadedAttachments.map((item) => removeStoredMedia(item.path)))
      throw error
    }
  },
  async createAdhocTrip(input, driverId) {
    if (!navigator.onLine) throw new Error('Cần kết nối mạng để tạo chuyến đột xuất (hệ thống phải kiểm tra trùng lịch xe).')
    const client = await requireSupabase()
    const reason = input.adhoc_reason.trim()
    if (!reason) throw new Error('Cần nhập lý do phát sinh chuyến đột xuất.')
    const payload = {
      ...input,
      adhoc_reason: reason,
      id: uid('trip'),
      driver_id: driverId,
      created_by: driverId,
      is_adhoc: true,
      status: 'accepted',
      approval_mode: 'driver_adhoc',
      approved_plan: false,
      plan_attachments: [],
      checklist_completed: false,
      adhoc_report_status: 'pending_review',
    }
    const { data, error } = await client.from('trips').insert(payload).select().single()
    if (error) throw new Error(friendlyTripError(error, 'Không thể tạo chuyến đột xuất.'))
    return data as Trip
  },
  async reviewAdhocTrip(id, status, note) {
    if (!navigator.onLine) throw new Error('Cần kết nối mạng để xác nhận báo cáo chuyến đột xuất.')
    const client = await requireSupabase()
    const trimmed = note?.trim() ?? ''
    if (status === 'flagged' && !trimmed) throw new Error('Cần ghi rõ nội dung cần tài xế giải trình.')
    const { data, error } = await client
      .from('trips')
      .update({ adhoc_report_status: status, adhoc_review_note: trimmed || null })
      .eq('id', id)
      .eq('is_adhoc', true)
      .eq('adhoc_report_status', 'pending_review')
      .select()
      .single()
    if (error) throw new Error(getErrorMessage(error, 'Không thể xác nhận báo cáo chuyến đột xuất.'))
    return data as Trip
  },
  async updateTrip(id, changes) {
    const client = await requireSupabase()
    const payload = { ...changes, updated_at: new Date().toISOString() }
    const optimistic = { id, ...payload } as Trip
    return await performOrQueue('trips.update', { id, ...payload }, async () => {
      const { data, error } = await client.from('trips').update(payload).eq('id', id).select().single()
      if (error) throw new Error(friendlyTripError(error, 'Không thể cập nhật chuyến đi.'))
      return data as Trip
    }, optimistic)
  },
  async chainTrip(fromTripId, toTripId) {
    if (!navigator.onLine) throw new Error('Cần kết nối mạng để nối chuyến (hệ thống phải kiểm tra KM và lịch xe).')
    const client = await requireSupabase()
    const { data, error } = await client.rpc('chain_trip', { p_from_trip: fromTripId, p_to_trip: toTripId })
    if (error) {
      if (/function .*chain_trip|could not find the function/i.test(error.message ?? '')) {
        throw new Error('Máy chủ chưa hỗ trợ nối chuyến. Quản trị cần chạy supabase/migrate-v3.0.0-trip-chaining.sql.')
      }
      throw new Error(friendlyTripError(error, 'Không thể nối chuyến.'))
    }
    return data as Trip
  },
  async updateTripLocation(id, lat, lng) {
    const client = await requireSupabase()
    const payload = {
      current_lat: lat,
      current_lng: lng,
      location_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await client
      .from('trips')
      .update(payload)
      .eq('id', id)
      .eq('status', 'active')
      .select()
      .single()
    if (error) throw error
    return data as Trip
  },
  async deleteTrip(id) {
    if (!navigator.onLine) throw new Error('Cần kết nối mạng để xóa chuyến đi.')
    const client = await requireSupabase()
    const { error } = await client.from('trips').delete().eq('id', id)
    if (error) throw error
  },
  async createChecklist(input) {
    const client = await requireSupabase()
    const id = uid('checklist')
    const payload = { ...input, id }
    const record: Checklist = { ...input, id, created_at: new Date().toISOString() }
    const result = await performOrQueue('checklists.insert', payload, async () => {
      const { data, error } = await client.from('checklists').insert(payload).select().single()
      if (error) throw error
      return data as Checklist
    }, record)
    const allOk = input.fuel_ok && input.tires_ok && input.lights_horn_ok && input.vehicle_clean && input.documents_ok
    await this.updateTrip(input.trip_id, { checklist_completed: true, status: allOk ? 'ready' : 'accepted' })
    return result
  },
  async submitOdometer(trip, phase, odometer, file) {
    const client = await requireSupabase()
    const changes: Record<string, unknown> = phase === 'start'
      ? { start_odometer: odometer }
      : { end_odometer: odometer }
    const optimistic = { ...trip, ...changes, updated_at: new Date().toISOString() } as Trip
    const queuePayload = { trip_id: trip.id, driver_id: trip.driver_id, phase, ...changes }
    return await performOrQueue('odometer.update', queuePayload, async () => {
      if (file) changes[phase === 'start' ? 'start_odometer_image_url' : 'end_odometer_image_url'] = await uploadMedia(file, `${trip.driver_id}/odometer`, `${trip.id}-${phase}`)
      const { data, error } = await client.from('trips').update(changes).eq('id', trip.id).select().single()
      if (error) throw error
      return data as Trip
    }, optimistic, file)
  },
  async createExpense(input, file) {
    const client = await requireSupabase()
    const now = new Date().toISOString()
    const id = uid('local-expense')
    const optimistic: Expense = { ...input, id, receipt_url: null, created_at: now, updated_at: now }
    const payload: Record<string, unknown> = { ...input, id }
    return await performOrQueue('expense.create', payload, async () => {
      if (file) payload.receipt_url = await uploadMedia(file, `${input.driver_id}/receipts`, `expense-${id}`)
      const { data, error } = await client.from('expenses').insert(payload).select().single()
      if (error) throw error
      return data as Expense
    }, optimistic, file)
  },
  async reviewExpense(id, action, reviewerId, reviewerRole, reason) {
    const client = await requireSupabase()
    let current = readLiveCache()?.expenses.find((expense) => expense.id === id) ?? null
    if (navigator.onLine) {
      const { data, error } = await client.from('expenses').select('*').eq('id', id).single()
      if (error) throw error
      current = data as Expense
    }
    if (!current) throw new Error('Không tìm thấy chi phí trong dữ liệu hiện tại.')

    const transition = expenseReviewTransition(current, action, reviewerId, reviewerRole, reason)
    const optimistic = { ...current, ...transition.changes } as Expense
    return await performOrQueue('expenses.update', { id, ...transition.changes }, async () => {
      const { data, error } = await client
        .from('expenses')
        .update(transition.changes)
        .eq('id', id)
        .eq('status', transition.expectedStatus)
        .select()
        .single()
      if (error) throw error
      return data as Expense
    }, optimistic)
  },
  async createIncident(input, media) {
    const client = await requireSupabase()
    const id = uid('incident')
    const payload: Record<string, unknown> = { ...input, id, status: 'pending_director', lat: input.lat ?? null, lng: input.lng ?? null }
    const now = new Date().toISOString()
    const optimistic: Incident = {
      ...input,
      status: 'pending_director',
      id,
      image_url: null,
      audio_url: null,
      lat: Number(payload.lat) || null,
      lng: Number(payload.lng) || null,
      created_at: now,
    }
    return await performOrQueue('incident.create', payload, async () => {
      if (media?.file) payload.image_url = await uploadMedia(media.file, `${input.driver_id}/incidents`, `incident-${id}`)
      if (media?.secondFile) payload.audio_url = await uploadMedia(media.secondFile, `${input.driver_id}/incident-audio`, `incident-audio-${id}`)
      const { data, error } = await client.from('incidents').insert(payload).select().single()
      if (error) throw error
      return data as Incident
    }, optimistic, media?.file, media?.secondFile)
  },
  async updateIncident(id, changes) {
    const client = await requireSupabase()
    const optimistic = { id, ...changes } as Incident
    return await performOrQueue('incidents.update', { id, ...changes }, async () => {
      const { data, error } = await client.from('incidents').update(changes).eq('id', id).select().single()
      if (error) throw error
      return data as Incident
    }, optimistic)
  },
  async createVehicle(input) {
    const client = await requireSupabase()
    const now = new Date().toISOString()
    const id = uid('vehicle')
    const payload = { ...input, id }
    const optimistic: Vehicle = { ...input, id, created_at: now, updated_at: now }
    return await performOrQueue('vehicles.insert', payload, async () => {
      const { data, error } = await client.from('vehicles').insert(payload).select().single()
      if (error) throw error
      return data as Vehicle
    }, optimistic)
  },
  async updateVehicle(id, changes) {
    const client = await requireSupabase()
    const payload = { ...changes, updated_at: new Date().toISOString() }
    const optimistic = { id, ...payload } as Vehicle
    return await performOrQueue('vehicles.update', { id, ...payload }, async () => {
      const { data, error } = await client.from('vehicles').update(payload).eq('id', id).select().single()
      if (error) throw error
      return data as Vehicle
    }, optimistic)
  },
  async updateDriverVehicleTracking(id, changes) {
    const client = await requireSupabase()
    const { data, error } = await client.rpc('driver_update_vehicle_tracking', {
      p_vehicle_id: id,
      p_registration_expiry: changes.registration_expiry ?? null,
      p_insurance_expiry: changes.insurance_expiry ?? null,
      p_road_fee_expiry: changes.road_fee_expiry ?? null,
      p_last_oil_change_date: changes.last_oil_change_date ?? null,
      p_last_oil_change_odometer: changes.last_oil_change_odometer ?? null,
      p_next_oil_change_date: changes.next_oil_change_date ?? null,
      p_next_oil_change_odometer: changes.next_oil_change_odometer ?? null,
      p_next_maintenance_date: changes.next_maintenance_date ?? null,
      p_next_maintenance_odometer: changes.next_maintenance_odometer ?? null,
    })
    if (error) throw error
    return data as Vehicle
  },
  async createMaintenance(input) {
    const client = await requireSupabase()
    const now = new Date().toISOString()
    const id = uid('maintenance')
    const payload = { ...input, id, status: 'pending_director' }
    const optimistic: Maintenance = { ...input, id, status: 'pending_director', created_at: now, updated_at: now }
    return await performOrQueue('maintenances.insert', payload, async () => {
      const { data, error } = await client.from('maintenances').insert(payload).select().single()
      if (error) throw error
      return data as Maintenance
    }, optimistic)
  },
  async updateMaintenance(id, changes) {
    const client = await requireSupabase()
    const payload = { ...changes, updated_at: new Date().toISOString() }
    const optimistic = { id, ...payload } as Maintenance
    return await performOrQueue('maintenances.update', { id, ...payload }, async () => {
      const { data, error } = await client.from('maintenances').update(payload).eq('id', id).select().single()
      if (error) throw error
      return data as Maintenance
    }, optimistic)
  },
  async syncPending() {
    if (!navigator.onLine) return await pendingCount()
    const actions = (await listPending()).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    for (const action of actions) {
      try {
        await executeAction(action)
        await removePending(action.id)
      } catch {
        await updatePending({ ...action, attempts: action.attempts + 1 })
      }
    }
    return await pendingCount()
  },
  async getPendingCount() { return await pendingCount() },
  async touchPresence(platform) {
    if (!navigator.onLine || !supabase) return
    const { error } = await supabase.rpc('touch_presence', { p_platform: platform ?? null })
    // Máy chủ chưa chạy migration v2.9.0 thì bỏ qua, không làm gián đoạn ứng dụng.
    if (error && !/touch_presence|function|schema cache/i.test(error.message)) throw error
  },
  async loadPresence() {
    if (!navigator.onLine || !supabase) return []
    const { data, error } = await supabase.from('user_presence').select('user_id, last_seen_at, last_platform, updated_at')
    if (error) return []
    return (data ?? []) as UserPresence[]
  },
}

// Production-only mode: never fall back to sample/demo data.
// If Supabase configuration is missing, requireSupabase() returns a clear configuration error.
export const backend: BackendApi = supabaseBackend
