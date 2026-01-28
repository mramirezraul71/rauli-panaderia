import { db } from "./dataService";

const INVITES_KEY = "worker_invites";
const ENROLLMENTS_KEY = "hr_enrollments";

const readJSON = (value) => {
  try {
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
};

export const getInvites = async () => {
  const stored = await db.settings?.get(INVITES_KEY);
  return readJSON(stored?.value);
};

export const saveInvites = async (invites) => {
  await db.settings?.put({ key: INVITES_KEY, value: JSON.stringify(invites || []) });
};

export const addInvite = async (invite) => {
  const invites = await getInvites();
  const updated = [...invites, invite];
  await saveInvites(updated);
  return updated;
};

export const updateInvite = async (code, changes) => {
  const invites = await getInvites();
  const updated = invites.map((invite) =>
    invite.code === code ? { ...invite, ...changes } : invite
  );
  await saveInvites(updated);
  return updated;
};

export const deleteInvite = async (code) => {
  const invites = await getInvites();
  const updated = invites.filter((invite) => invite.code !== code);
  await saveInvites(updated);
  return updated;
};

export const markInviteUsed = async (code, username) => {
  return updateInvite(code, {
    status: "used",
    used_by: username,
    used_at: new Date().toISOString()
  });
};

export const getEnrollments = async () => {
  const stored = await db.settings?.get(ENROLLMENTS_KEY);
  return readJSON(stored?.value);
};

export const addEnrollment = async (enrollment) => {
  const current = await getEnrollments();
  const updated = [...current, enrollment];
  await db.settings?.put({ key: ENROLLMENTS_KEY, value: JSON.stringify(updated) });
  return updated;
};
