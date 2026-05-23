// Mock service layer — swap bodies with real axios calls when backend is ready
const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));
export const authService    = { login: async () => delay(400), logout: async () => delay(100) };
export const taskService    = { getAll: async () => delay(), create: async () => delay(), update: async () => delay(), delete: async () => delay() };
export const todoService    = { getAll: async () => delay(), create: async () => delay(), update: async () => delay(), delete: async () => delay() };
export const clientService  = { getAll: async () => delay(), create: async () => delay(), update: async () => delay(), delete: async () => delay() };
export const meetingService = { getAll: async () => delay(), create: async () => delay(), update: async () => delay(), delete: async () => delay() };
export default {};
