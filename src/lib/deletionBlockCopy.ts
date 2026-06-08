export function formatUpcomingOpenings(count: number): string {
  return count === 1 ? "1 upcoming opening" : `${count} upcoming openings`;
}

function openingsActionPhrase(count: number, removeTarget: string): string {
  if (count === 1) {
    return `Manage it in Openings, or delete it and ${removeTarget}.`;
  }
  return `Manage them in Openings, or delete them and ${removeTarget}.`;
}

export function locationDeletionWarningBody(name: string, count: number): string {
  return `${name} has ${formatUpcomingOpenings(count)}. ${openingsActionPhrase(count, "remove this location below")}`;
}

export function staffDeletionWarningBody(name: string, count: number): string {
  return `${name} has ${formatUpcomingOpenings(count)}. ${openingsActionPhrase(count, "remove this staff member below")}`;
}

export function bulkDeleteLocationModalBody(name: string, count: number): string {
  const openings = formatUpcomingOpenings(count);
  return `This deletes ${openings} at ${name}, then removes the location. This can't be undone.`;
}

export function bulkDeleteStaffModalBody(name: string, count: number): string {
  const openings = formatUpcomingOpenings(count);
  return `This deletes ${openings} for ${name}, then removes them as staff. This can't be undone.`;
}

export function bulkDeleteLocationButtonLabel(count: number): string {
  return count === 1 ? "Delete opening and location" : "Delete openings and location";
}

export function bulkDeleteStaffButtonLabel(count: number): string {
  return count === 1 ? "Delete opening and remove staff" : "Delete openings and remove staff";
}

export function bulkDeleteLocationModalTitle(count: number): string {
  return count === 1 ? "Delete opening and remove location?" : "Delete openings and remove location?";
}

export function bulkDeleteStaffModalTitle(count: number): string {
  return count === 1 ? "Delete opening and remove staff?" : "Delete openings and remove staff?";
}
