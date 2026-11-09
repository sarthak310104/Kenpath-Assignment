import { apiRequest } from './api';

export const reportsAPI = {
  daily: (date) =>
    apiRequest(`/reports/daily?date=${date}`),

  monthToDate: (date) =>
    apiRequest(`/reports/month-to-date?date=${date}`),

  previousMonth: (date) =>
    apiRequest(`/reports/previous-month?date=${date}`),
};