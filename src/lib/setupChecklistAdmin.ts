import { supabase } from '@/integrations/supabase/client';
import { SETUP_ITEM_IDS, type SetupCompletionMap, type SetupItemId } from '@/types/activationSetup';

export const OA_SETUP_CHECKLIST_PREVIEW_KEY = 'oa_setup_checklist_preview';
export const OA_TOUR_SEEN_KEY = 'oa_tour_seen';
export const OA_CHECKLIST_COLLAPSED_KEY = 'oa_checklist_collapsed';
export const OA_CHECKLIST_DISMISSED_KEY = 'oa_setup_checklist_dismissed';
export const OA_SETUP_MANUAL_COMPLETE_KEY = 'oa_setup_manual_complete';
export const OA_SETUP_MANUAL_INCOMPLETE_KEY = 'oa_setup_manual_incomplete';
export const OA_SETUP_CHECKLIST_PREVIEW_EVENT = 'oa-setup-checklist-preview';

export function isSetupChecklistPreviewActive(): boolean {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(OA_SETUP_CHECKLIST_PREVIEW_KEY) === 'true';
}

export function enableSetupChecklistPreview(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(OA_SETUP_CHECKLIST_PREVIEW_KEY, 'true');
  window.localStorage.removeItem(OA_TOUR_SEEN_KEY);
  window.localStorage.removeItem(OA_CHECKLIST_COLLAPSED_KEY);
  window.sessionStorage.removeItem(OA_CHECKLIST_DISMISSED_KEY);
  window.localStorage.removeItem(OA_CHECKLIST_DISMISSED_KEY);
  window.localStorage.removeItem(OA_SETUP_MANUAL_COMPLETE_KEY);
  window.localStorage.removeItem(OA_SETUP_MANUAL_INCOMPLETE_KEY);
  window.dispatchEvent(new Event(OA_SETUP_CHECKLIST_PREVIEW_EVENT));
}

export function disableSetupChecklistPreview(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(OA_SETUP_CHECKLIST_PREVIEW_KEY);
  window.dispatchEvent(new Event(OA_SETUP_CHECKLIST_PREVIEW_EVENT));
}

export function clearSetupChecklistLocalState(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(OA_TOUR_SEEN_KEY);
  window.localStorage.removeItem(OA_CHECKLIST_COLLAPSED_KEY);
  window.sessionStorage.removeItem(OA_CHECKLIST_DISMISSED_KEY);
  window.localStorage.removeItem(OA_CHECKLIST_DISMISSED_KEY);
  window.localStorage.removeItem(OA_SETUP_MANUAL_COMPLETE_KEY);
  window.localStorage.removeItem(OA_SETUP_MANUAL_INCOMPLETE_KEY);
}

export function readChecklistDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  // Legacy: migrate permanent localStorage dismiss to session-scoped storage.
  if (window.localStorage.getItem(OA_CHECKLIST_DISMISSED_KEY) === 'true') {
    window.localStorage.removeItem(OA_CHECKLIST_DISMISSED_KEY);
    window.sessionStorage.setItem(OA_CHECKLIST_DISMISSED_KEY, 'true');
  }
  return window.sessionStorage.getItem(OA_CHECKLIST_DISMISSED_KEY) === 'true';
}

export function persistChecklistDismissed(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(OA_CHECKLIST_DISMISSED_KEY, 'true');
  window.localStorage.removeItem(OA_CHECKLIST_DISMISSED_KEY);
}

export function clearChecklistDismissed(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(OA_CHECKLIST_DISMISSED_KEY);
  window.localStorage.removeItem(OA_CHECKLIST_DISMISSED_KEY);
}

function readManualItemIds(storageKey: string): SetupItemId[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is SetupItemId =>
      SETUP_ITEM_IDS.includes(id as SetupItemId)
    );
  } catch {
    return [];
  }
}

export function readManuallyCompletedItems(): SetupItemId[] {
  return readManualItemIds(OA_SETUP_MANUAL_COMPLETE_KEY);
}

export function readManuallyIncompleteItems(): SetupItemId[] {
  return readManualItemIds(OA_SETUP_MANUAL_INCOMPLETE_KEY);
}

function writeManualItemIds(storageKey: string, ids: SetupItemId[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey, JSON.stringify(ids));
}

export function addManuallyCompletedItem(itemId: SetupItemId): void {
  const next = new Set(readManuallyCompletedItems());
  next.add(itemId);
  writeManualItemIds(OA_SETUP_MANUAL_COMPLETE_KEY, [...next]);
  removeManuallyIncompleteItem(itemId);
}

export function removeManuallyCompletedItem(itemId: SetupItemId): void {
  const next = readManuallyCompletedItems().filter((id) => id !== itemId);
  writeManualItemIds(OA_SETUP_MANUAL_COMPLETE_KEY, next);
}

export function addManuallyIncompleteItem(itemId: SetupItemId): void {
  const next = new Set(readManuallyIncompleteItems());
  next.add(itemId);
  writeManualItemIds(OA_SETUP_MANUAL_INCOMPLETE_KEY, [...next]);
  removeManuallyCompletedItem(itemId);
}

export function removeManuallyIncompleteItem(itemId: SetupItemId): void {
  const next = readManuallyIncompleteItems().filter((id) => id !== itemId);
  writeManualItemIds(OA_SETUP_MANUAL_INCOMPLETE_KEY, next);
}

export function buildEmptySetupCompletion(): SetupCompletionMap {
  return Object.fromEntries(SETUP_ITEM_IDS.map((id) => [id, false])) as SetupCompletionMap;
}

export function mergeSetupCompletion(
  base: SetupCompletionMap,
  manualCompleteIds: SetupItemId[],
  manualIncompleteIds: SetupItemId[] = []
): SetupCompletionMap {
  const merged = { ...base };
  for (const id of manualCompleteIds) {
    merged[id] = true;
  }
  for (const id of manualIncompleteIds) {
    merged[id] = false;
  }
  return merged;
}

export async function resetSetupProgressInDatabase(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      setup_booking_method_confirmed_at: null,
      setup_cancellation_confirmed_at: null,
      setup_confirmation_confirmed_at: null,
      setup_qr_engaged_at: null,
      tutorial_dismissed_at: null,
      tutorial_tour_seen_at: null,
    })
    .eq('id', userId);

  if (error) {
    throw error;
  }
}
