/**
 * API Configuration
 * Centralized configuration for API endpoints
 */

// API base URL - can be overridden via environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:7249';

// Coffee grading API endpoint
export const COFFEE_GRADING_API = {
  baseUrl: API_BASE_URL,
  predictEndpoint: `${API_BASE_URL}/predict`,
  healthEndpoint: `${API_BASE_URL}/health`,
};

// Helper function to get full API URL
export const getApiUrl = (endpoint) => {
  return `${API_BASE_URL}${endpoint}`;
};

export default {
  COFFEE_GRADING_API,
  getApiUrl,
};




