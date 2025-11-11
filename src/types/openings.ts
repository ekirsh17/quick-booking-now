export interface Opening {
  id: string;
  merchant_id: string;
  staff_id: string | null;
  start_time: string; // ISO 8601
  end_time: string;
  duration_minutes: number;
  appointment_name: string | null;
  status: 'open' | 'booked' | 'pending_confirmation';
  booked_by_name: string | null;
  consumer_phone: string | null;
  booked_by_consumer_id: string | null;
  held_until: string | null;
  created_at: string;
  updated_at: string;
  created_via?: 'dashboard' | 'sms' | 'api';
  deleted_at?: string | null;
}

export interface Staff {
  id: string;
  merchant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  color: string;
  is_primary: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkingHours {
  [key: string]: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export interface CreateOpeningInput {
  start_time: string;
  end_time: string;
  duration_minutes: number;
  appointment_name?: string;
  staff_id?: string;
}

export interface UpdateOpeningInput {
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  appointment_name?: string;
  staff_id?: string;
}

export interface ConflictCheckParams {
  merchant_id: string;
  staff_id: string | null;
  start_time: string;
  end_time: string;
  slot_id?: string;
}
