export type UserRole = 'driver' | 'department_head' | 'dispatcher' | 'accountant' | 'fleet' | 'director' | 'admin'

export type VehicleStatus = 'available' | 'in_use' | 'maintenance' | 'out_of_service'
export type TripStatus = 'pending_fleet' | 'pending_director' | 'assigned' | 'accepted' | 'ready' | 'active' | 'completed' | 'cancelled'
export type TripApprovalMode = 'director_required' | 'fleet_only' | 'driver_adhoc'
export type AdhocReportStatus = 'pending_review' | 'acknowledged' | 'flagged'
export type ExpenseStatus = 'pending_director' | 'pending_accountant' | 'approved' | 'rejected' | 'paid'
export type ExpenseReviewAction = 'director_approve' | 'accountant_approve' | 'reject' | 'mark_paid'
export type IncidentStatus = 'pending_director' | 'reported' | 'handling' | 'resolved' | 'rejected'
export type MaintenanceStatus = 'pending_director' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'rejected'
export type Severity = 'low' | 'medium' | 'high' | 'critical'
export type VehicleRequestStatus = 'pending_fleet' | 'fleet_approved' | 'rejected' | 'converted'

export type TripPurpose =
  | 'patient_pickup'
  | 'patient_return'
  | 'community_exam'
  | 'board_business'
  | 'staff_transport'
  | 'medicine_supply'
  | 'marketing_care'
  | 'administrative'
  | 'personal_other'

export type ExpenseType = 'fuel' | 'toll' | 'parking' | 'washing' | 'repair' | 'other'
export type IncidentType = 'breakdown' | 'collision' | 'flat_tire' | 'dashboard_warning' | 'abnormal_noise' | 'other'

export interface Profile {
  id: string
  full_name: string
  phone: string
  role: UserRole
  active: boolean
  deleted_at?: string | null
  avatar_url?: string | null
  avatar_path?: string | null
  employee_code?: string | null
  department?: string | null
  job_title?: string | null
  notes?: string | null
  created_at: string
  updated_at?: string | null
}

export interface Vehicle {
  id: string
  plate_number: string
  vehicle_name: string
  vehicle_type: string
  seats: number
  status: VehicleStatus
  odometer: number
  image_url?: string | null
  regular_driver_id?: string | null
  registration_expiry?: string | null
  insurance_expiry?: string | null
  road_fee_expiry?: string | null
  last_oil_change_date?: string | null
  last_oil_change_odometer?: number | null
  next_oil_change_date?: string | null
  next_oil_change_odometer?: number | null
  next_maintenance_date?: string | null
  next_maintenance_odometer?: number | null
  fuel_norm_l_per_100km?: number | null
  navicom_enabled?: boolean
  navicom_device_id?: string | null
  navicom_channel_count?: number | null
  navicom_notes?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
}


export type DriverVehicleTrackingUpdate = Pick<Vehicle,
  | 'registration_expiry'
  | 'insurance_expiry'
  | 'road_fee_expiry'
  | 'last_oil_change_date'
  | 'last_oil_change_odometer'
  | 'next_oil_change_date'
  | 'next_oil_change_odometer'
  | 'next_maintenance_date'
  | 'next_maintenance_odometer'
>


export interface PlanAttachment {
  path: string
  url?: string | null
  name: string
  mime_type?: string | null
  size_bytes?: number | null
}

export interface VehicleRequest {
  id: string
  requester_id: string
  department?: string | null
  purpose: TripPurpose
  pickup: string
  destination: string
  contact_name?: string | null
  contact_phone?: string | null
  passenger_count?: number | null
  scheduled_start: string
  expected_end?: string | null
  notes?: string | null
  plan_document_url?: string | null
  plan_document_path?: string | null
  plan_attachments?: PlanAttachment[]
  status: VehicleRequestStatus
  fleet_reviewer_id?: string | null
  fleet_reviewed_at?: string | null
  rejection_reason?: string | null
  created_trip_id?: string | null
  created_at: string
  updated_at: string
}

export interface Trip {
  id: string
  vehicle_id: string
  driver_id: string
  purpose: TripPurpose
  pickup: string
  destination: string
  contact_name?: string | null
  contact_phone?: string | null
  passenger_count?: number | null
  scheduled_start: string
  expected_end?: string | null
  started_at?: string | null
  ended_at?: string | null
  status: TripStatus
  approval_mode?: TripApprovalMode | null
  approved_plan?: boolean
  plan_document_url?: string | null
  plan_document_path?: string | null
  plan_attachments?: PlanAttachment[]
  vehicle_request_id?: string | null
  fleet_reviewer_id?: string | null
  fleet_reviewed_at?: string | null
  director_reviewer_id?: string | null
  director_reviewed_at?: string | null
  approval_rejection_reason?: string | null
  is_adhoc?: boolean
  adhoc_reason?: string | null
  adhoc_report_status?: AdhocReportStatus | null
  adhoc_reviewer_id?: string | null
  adhoc_reviewed_at?: string | null
  adhoc_review_note?: string | null
  notes?: string | null
  checklist_completed: boolean
  start_odometer?: number | null
  end_odometer?: number | null
  start_odometer_image_url?: string | null
  end_odometer_image_url?: string | null
  start_lat?: number | null
  start_lng?: number | null
  end_lat?: number | null
  end_lng?: number | null
  current_lat?: number | null
  current_lng?: number | null
  location_updated_at?: string | null
  /** v3.0.0: chuyến được nối tiếp từ chuyến này (dùng KM cuối làm KM đầu). */
  chained_from_trip_id?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface Checklist {
  id: string
  trip_id: string
  driver_id: string
  fuel_ok: boolean
  tires_ok: boolean
  lights_horn_ok: boolean
  vehicle_clean: boolean
  documents_ok: boolean
  notes?: string | null
  created_at: string
}

export interface Expense {
  id: string
  trip_id?: string | null
  vehicle_id: string
  driver_id: string
  type: ExpenseType
  amount: number
  fuel_liters?: number | null
  fuel_unit_price?: number | null
  description?: string | null
  receipt_url?: string | null
  status: ExpenseStatus
  reviewer_id?: string | null
  reviewed_at?: string | null
  director_reviewer_id?: string | null
  director_reviewed_at?: string | null
  accountant_reviewer_id?: string | null
  accountant_reviewed_at?: string | null
  paid_by?: string | null
  paid_at?: string | null
  rejection_reason?: string | null
  expense_date: string
  created_at: string
  updated_at: string
}

export interface Incident {
  id: string
  trip_id?: string | null
  vehicle_id: string
  driver_id: string
  type: IncidentType
  severity: Severity
  description?: string | null
  image_url?: string | null
  audio_url?: string | null
  lat?: number | null
  lng?: number | null
  status: IncidentStatus
  director_reviewer_id?: string | null
  director_reviewed_at?: string | null
  rejection_reason?: string | null
  handler_id?: string | null
  resolution?: string | null
  created_at: string
  resolved_at?: string | null
}

export interface Maintenance {
  id: string
  vehicle_id: string
  type: string
  description?: string | null
  scheduled_date?: string | null
  completed_date?: string | null
  odometer?: number | null
  cost?: number | null
  vendor?: string | null
  status: MaintenanceStatus
  requested_by?: string | null
  director_reviewer_id?: string | null
  director_reviewed_at?: string | null
  rejection_reason?: string | null
  created_at: string
  updated_at: string
}

export interface AppData {
  profiles: Profile[]
  vehicles: Vehicle[]
  vehicleRequests: VehicleRequest[]
  trips: Trip[]
  checklists: Checklist[]
  expenses: Expense[]
  incidents: Incident[]
  maintenances: Maintenance[]
}

export interface AuthUser {
  id: string
  profile: Profile
}

export interface CreateUserInput {
  full_name: string
  phone: string
  password: string
  role: UserRole
  employee_code?: string
  department?: string
  job_title?: string
  notes?: string
}

export interface UpdateUserInput {
  id: string
  full_name: string
  phone: string
  role: UserRole
  active: boolean
  employee_code?: string
  department?: string
  job_title?: string
  notes?: string
  password?: string
  avatar_url?: string | null
  previous_avatar_url?: string | null
}

export interface CreateVehicleRequestInput {
  purpose: TripPurpose
  pickup: string
  destination: string
  contact_name?: string
  contact_phone?: string
  passenger_count?: number
  scheduled_start: string
  expected_end?: string
  notes?: string
  department?: string
}

export interface CreateTripInput {
  vehicle_id: string
  driver_id: string
  purpose: TripPurpose
  pickup: string
  destination: string
  contact_name?: string
  contact_phone?: string
  passenger_count?: number
  scheduled_start: string
  expected_end?: string
  notes?: string
  approved_plan?: boolean
  vehicle_request_id?: string
  existing_plan_path?: string | null
}

export interface CreateAdhocTripInput {
  vehicle_id: string
  purpose: TripPurpose
  pickup: string
  destination: string
  adhoc_reason: string
  contact_name?: string
  contact_phone?: string
  passenger_count?: number
  scheduled_start: string
  expected_end?: string
  notes?: string
}

export interface UserPresence {
  user_id: string
  last_seen_at: string
  last_platform?: string | null
  updated_at?: string | null
}
