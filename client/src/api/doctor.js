import { apiRequest } from './api';

// Used by patients: pick (or remove) the doctor who can see their reports.
export const usersAPI = {
  listDoctors: () => apiRequest('/users/doctors'),

  setMyDoctor: (doctorId) =>
    apiRequest('/users/me/doctor', {
      method: 'PUT',
      body: JSON.stringify({ doctor_id: doctorId }),
    }),
};

// Used by doctors: their patients and those patients' reports.
export const doctorAPI = {
  patients: () => apiRequest('/doctor/patients'),

  patientReport: (patientId, kind, date) =>
    apiRequest(`/doctor/patients/${patientId}/reports/${kind}?date=${date}`),
};