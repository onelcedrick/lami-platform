const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const json = await res.json();
  return json as ApiResponse<T>;
}

function qs(params?: Record<string, string | number | boolean | undefined>) {
  if (!params) return "";
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => [k, String(v)]);
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries).toString();
}

export const api = {
  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------
  register: (body: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
  }) => request("/api/v1/auth/register", { method: "POST", body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    request("/api/v1/auth/login", { method: "POST", body: JSON.stringify(body) }),

  profile: () => request("/api/v1/auth/profile"),

  refresh: (refresh_token: string) =>
    request("/api/v1/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token }),
    }),

  // -------------------------------------------------------------------------
  // Catalog
  // -------------------------------------------------------------------------
  listPopularProducts: (limit = 8) =>
    request(`/api/v1/catalog/products/popular?limit=${limit}`),

  listProducts: (params?: Record<string, string | number>) =>
    request(`/api/v1/catalog/products${qs(params)}`),

  getProduct: (id: string) => request(`/api/v1/catalog/products/${id}`),

  getProductBySlug: (slug: string) =>
    request(`/api/v1/catalog/products/slug/${encodeURIComponent(slug)}`),

  listCategories: () => request("/api/v1/catalog/categories"),

  createProduct: (body: unknown) =>
    request("/api/v1/catalog/products", { method: "POST", body: JSON.stringify(body) }),

  bulkCreateProducts: (products: unknown[]) =>
    request("/api/v1/catalog/products/bulk", {
      method: "POST",
      body: JSON.stringify({ products }),
    }),

  updateProduct: (id: string, body: unknown) =>
    request(`/api/v1/catalog/products/${id}`, { method: "PUT", body: JSON.stringify(body) }),

  deleteProduct: (id: string) =>
    request(`/api/v1/catalog/products/${id}`, { method: "DELETE" }),

  createCategory: (body: { name: string; description?: string; parent_id?: string }) =>
    request("/api/v1/catalog/categories", { method: "POST", body: JSON.stringify(body) }),

  seedCatalog: () =>
    request("/api/v1/catalog/seed", { method: "POST" }),

  // -------------------------------------------------------------------------
  // Catalog — Upload d'images produit
  // (utilise fetch direct car FormData ne doit PAS avoir de Content-Type forcé)
  // -------------------------------------------------------------------------
  uploadProductImage: async (file: File) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/api/v1/catalog/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    return (await res.json()) as ApiResponse<{
      url: string;
      key: string;
      size: number;
      content_type: string;
    }>;
  },

  uploadProductImages: async (files: File[]) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    const res = await fetch(`${API_BASE}/api/v1/catalog/upload-multiple`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    return (await res.json()) as ApiResponse<{
      uploaded: { url: string; key: string; name: string }[];
      errors: string[];
    }>;
  },

  // -------------------------------------------------------------------------
  // Discounts
  // -------------------------------------------------------------------------
  listDiscounts: () => request("/api/v1/catalog/discounts"),
  listActiveDiscounts: () => request("/api/v1/catalog/discounts/active"),
  createDiscount: (body: unknown) =>
    request("/api/v1/catalog/discounts", { method: "POST", body: JSON.stringify(body) }),
  toggleDiscount: (id: string) =>
    request(`/api/v1/catalog/discounts/${id}/toggle`, { method: "PATCH" }),
  deleteDiscount: (id: string) =>
    request(`/api/v1/catalog/discounts/${id}`, { method: "DELETE" }),

  // -------------------------------------------------------------------------
  // Orders
  // -------------------------------------------------------------------------
  createOrder: (body: unknown) =>
    request("/api/v1/orders", { method: "POST", body: JSON.stringify(body) }),

  myOrders: (params?: { page?: number; limit?: number }) =>
    request(`/api/v1/orders/me${qs(params)}`),

  getOrder: (id: string) => request(`/api/v1/orders/${id}`),

  cancelOrder: (id: string) =>
    request(`/api/v1/orders/${id}/cancel`, { method: "POST" }),

  payOrder: (id: string, body: { method: string; phone?: string }) =>
    request(`/api/v1/orders/${id}/pay`, { method: "POST", body: JSON.stringify(body) }),

  configurePC: (body: { usage: string; budget: number }) =>
    request("/api/v1/ia/configure", { method: "POST", body: JSON.stringify(body) }),

  getCartServer: () => request("/api/v1/users/me/cart"),
  saveCartServer: (items: unknown[]) =>
    request("/api/v1/users/me/cart", { method: "PUT", body: JSON.stringify({ items }) }),
  getFavoritesServer: () => request("/api/v1/users/me/favorites"),
  saveFavoritesServer: (items: unknown[]) =>
    request("/api/v1/users/me/favorites", {
      method: "PUT",
      body: JSON.stringify({ items }),
    }),

  confirmPaymentAdmin: (id: string) =>
    request(`/api/v1/orders/${id}/confirm-payment`, { method: "POST" }),

  getShopSettings: () => request("/api/v1/users/settings/shop"),
  updateShopSettings: (body: unknown) =>
    request("/api/v1/users/settings/shop", { method: "PUT", body: JSON.stringify(body) }),
  getInvoice: (id: string) => request(`/api/v1/orders/${id}/invoice`),
  getInvoicePDFUrl: (id: string) =>
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/orders/${id}/invoice.pdf`,

  getOrderStats: (days = 30) =>
    request(`/api/v1/orders/stats?days=${days}`),

  listOrders: (params?: { page?: number; limit?: number; status?: string }) =>
    request(`/api/v1/orders${qs(params)}`),

  updateOrderStatus: (id: string, body: { status: string; payment_status?: string }) =>
    request(`/api/v1/orders/${id}/status`, { method: "PATCH", body: JSON.stringify(body) }),

  // -------------------------------------------------------------------------
  // Tickets
  // -------------------------------------------------------------------------
  createTicket: (body: {
    title: string;
    description: string;
    category: string;
    priority?: string;
    related_order_id?: string;
    related_product_id?: string;
  }) => request("/api/v1/tickets", { method: "POST", body: JSON.stringify(body) }),

  myTickets: (params?: { page?: number; limit?: number }) =>
    request(`/api/v1/tickets/me${qs(params)}`),

  getTicket: (id: string) => request(`/api/v1/tickets/${id}`),

  updateTicketStatus: (id: string, body: { status: string; priority?: string; note?: string }) =>
    request(`/api/v1/tickets/${id}/status`, { method: "PATCH", body: JSON.stringify(body) }),

  addTicketMessage: (
    id: string,
    body: {
      content: string;
      is_internal?: boolean;
      attachments?: unknown[];
      author_name?: string;
    }
  ) =>
    request(`/api/v1/tickets/${id}/messages`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  uploadTicketFile: async (file: File) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/api/v1/tickets/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    return res.json();
  },

  openTickets: (params?: Record<string, string | number>) =>
    request(`/api/v1/tickets/open${qs(params)}`),

  assignedTickets: (params?: { page?: number; limit?: number }) =>
    request(`/api/v1/tickets/assigned${qs(params)}`),

  assignTicket: (id: string, technician_id: string) =>
    request(`/api/v1/tickets/${id}/assign`, {
      method: "POST",
      body: JSON.stringify({ technician_id }),
    }),

  listTickets: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    category?: string;
  }) => request(`/api/v1/tickets${qs(params)}`),

  // -------------------------------------------------------------------------
  // Notifications
  // -------------------------------------------------------------------------
  myNotifications: (params?: { page?: number; limit?: number; unread?: boolean }) =>
    request(`/api/v1/notifications/me${qs(params)}`),

  unreadCount: () => request("/api/v1/notifications/unread-count"),

  markNotificationRead: (id: string) =>
    request(`/api/v1/notifications/${id}/read`, { method: "PATCH" }),

  markAllNotificationsRead: () =>
    request("/api/v1/notifications/read-all", { method: "POST" }),

  // -------------------------------------------------------------------------
  // IA
  // -------------------------------------------------------------------------
  iaChat: (body: { message: string; conversation_id?: string; mode?: string }) =>
    request("/api/v1/ia/chat", { method: "POST", body: JSON.stringify(body) }),

  iaHealth: () => request("/api/v1/ia/health"),

  iaSearch: (query: string, top_k = 5) =>
    request("/api/v1/ia/rag/search", {
      method: "POST",
      body: JSON.stringify({ query, top_k }),
    }),

  // -------------------------------------------------------------------------
  // Users / Profile
  // -------------------------------------------------------------------------
  getProfile: () => request("/api/v1/users/me"),
  updateProfile: (body: unknown) =>
    request("/api/v1/users/me", { method: "PUT", body: JSON.stringify(body) }),
  listUsers: (params?: Record<string, string | number | undefined>) =>
    request(`/api/v1/users${qs(params as any)}`),
  userStats: () => request("/api/v1/users/stats"),
  adminUpdateUser: (id: string, body: unknown) =>
    request(`/api/v1/users/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deactivateUser: (id: string) =>
    request(`/api/v1/users/${id}/deactivate`, { method: "POST" }),
  listRegions: () => request("/api/v1/users/geo/regions"),

  // -------------------------------------------------------------------------
  // Analytics
  // -------------------------------------------------------------------------
  visitorStats: (days = 7) =>
    request(`/api/v1/analytics/visitors?days=${days}`),

  activityLogs: (params?: { page?: number; limit?: number; category?: string; actor_id?: string }) =>
    request(`/api/v1/analytics/events${qs(params as any)}`),
};
