import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 120000,
});

/** Collapse axios/server error shapes into one readable message. */
function toError(error) {
  const data = error.response?.data;
  const message =
    data?.error ||
    data?.message ||
    (error.code === 'ECONNABORTED' ? 'The request timed out.' : error.message) ||
    'Request failed';

  const wrapped = new Error(message);
  wrapped.status = error.response?.status;
  wrapped.details = data?.details;
  return wrapped;
}

client.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(toError(error)),
);

const get = (url, config) => client.get(url, config).then((r) => r.data);
const post = (url, body, config) => client.post(url, body, config).then((r) => r.data);
const put = (url, body) => client.put(url, body).then((r) => r.data);
const del = (url) => client.delete(url).then((r) => r.data);

export const api = {
  dashboard: {
    stats: () => get('/dashboard/stats'),
    timeseries: (days = 14) => get('/dashboard/timeseries', { params: { days } }),
    breakdown: () => get('/dashboard/breakdown'),
    campaignPerformance: (limit = 6) => get('/dashboard/campaign-performance', { params: { limit } }),
    recent: () => get('/dashboard/recent'),
    health: () => get('/dashboard/health'),
  },

  lists: {
    all: () => get('/lists'),
    one: (id, params) => get(`/lists/${id}`, { params }),
    emails: (id) => get(`/lists/${id}/emails`),
    remove: (id) => del(`/lists/${id}`),
    upload: (file, { name, emailColumn, onProgress } = {}) => {
      const form = new FormData();
      form.append('file', file);
      if (name) form.append('name', name);
      if (emailColumn) form.append('emailColumn', emailColumn);
      return post('/lists/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (onProgress && event.total) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        },
      });
    },
  },

  templates: {
    all: () => get('/templates'),
    one: (id) => get(`/templates/${id}`),
    create: (body) => post('/templates', body),
    update: (id, body) => put(`/templates/${id}`, body),
    remove: (id) => del(`/templates/${id}`),
    placeholders: (body) => post('/templates/placeholders', body),
    preview: (body) => post('/templates/preview', body),
    analyze: (body) => post('/templates/analyze', body),
  },

  campaigns: {
    all: (params) => get('/campaigns', { params }),
    one: (id) => get(`/campaigns/${id}`),
    logs: (id, params) => get(`/campaigns/${id}/logs`, { params }),
    send: (body) => post('/campaigns/send', body),
    test: (body) => post('/campaigns/test', body),
    pause: (id) => post(`/campaigns/${id}/pause`),
    resume: (id) => post(`/campaigns/${id}/resume`),
    cancel: (id) => post(`/campaigns/${id}/cancel`),
    retryFailed: (id) => post(`/campaigns/${id}/retry-failed`),
    remove: (id) => del(`/campaigns/${id}`),
  },

  system: {
    config: () => get('/system/config'),
    smtpCheck: () => get('/system/smtp-check'),
    health: () => get('/system/health'),
  },
};

export default api;
