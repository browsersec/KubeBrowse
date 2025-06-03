import keycloak from '../keycloak';

export const authenticatedFetch = (url, options = {}) => {
  const token = keycloak.token;

  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
    // 'Content-Type': 'application/json', // Set Content-Type by the caller if needed, esp. for GET requests
  };

  // Only add Content-Type if there's a body, common for POST/PUT
  if (options.body) {
    headers['Content-Type'] = options.headers?.['Content-Type'] || 'application/json';
  }


  return fetch(url, { ...options, headers });
};

// Example usage (to be implemented in actual component files):
// import { authenticatedFetch } from './lib/api';
//
// const fetchSomeData = async () => {
//   try {
//     const response = await authenticatedFetch('/api/v1/some-protected-endpoint');
//     if (!response.ok) {
//       throw new Error(`HTTP error! status: ${response.status}`);
//     }
//     const data = await response.json();
//     console.log(data);
//   } catch (error) {
//     console.error("Failed to fetch data:", error);
//     if (error.response && error.response.status === 401) {
//       // Handle unauthorized, e.g., redirect to login or refresh token
//       keycloak.logout(); // Or try to update token
//     }
//   }
// };
//
// const createResource = async (payload) => {
//   try {
//     const response = await authenticatedFetch('/api/v1/create-resource', {
//       method: 'POST',
//       body: JSON.stringify(payload),
//       // Content-Type will be set to application/json by default if body is present
//     });
//     if (!response.ok) {
//       // Handle non-OK responses, e.g., validation errors from API
//       const errorData = await response.json().catch(() => ({ message: "Invalid JSON response" }));
//       throw new Error(`API error! status: ${response.status}, message: ${errorData.message || response.statusText}`);
//     }
//     const data = await response.json();
//     console.log('Resource created:', data);
//   } catch (error) {
//     console.error('Failed to create resource:', error);
//   }
// };
