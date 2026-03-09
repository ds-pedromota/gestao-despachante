// [IMPORTANTE] Substitua o IP abaixo pelo IP Público da sua VM Oracle
// Se o seu site na HostGator for HTTPS, idealmente sua API também deveria ser.
// Mas para testar, use o HTTP.
export const API_BASE_URL = "http://localhost:3000"; 
export const FRONTEND_URL = "http://localhost:5173";

export const getAuthHeaders = () => {
  const token = localStorage.getItem("authToken");
  return token ? { "Authorization": `Bearer ${token}` } : {};
};