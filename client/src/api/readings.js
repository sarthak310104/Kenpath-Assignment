import { apiRequest } from './api';

export const readingsAPI = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/readings${query ? `?${query}` : ''}`);
  },

  create: (reading) =>
    apiRequest('/readings', {
      method: 'POST',
      body: JSON.stringify(reading),
    }),

  update: (id, reading) =>
    apiRequest(`/readings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(reading),
    }),

  delete: (id) =>
    apiRequest(`/readings/${id}`, {
      method: 'DELETE',
    }),
};