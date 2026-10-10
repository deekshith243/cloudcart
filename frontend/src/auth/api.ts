const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'cloudcart_access_token';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: 'CUSTOMER' | 'ADMIN';
};

type AuthResponse = { success: true; data: { user: AuthUser; token: string } };
type MeResponse = { success: true; data: AuthUser };

export type Category = { id: string; name: string; description: string | null };
export type Product = {
  id: string;
  name: string;
  description: string;
  price: number | string;
  stock: number;
  imageUrl: string | null;
  categoryId: string;
  category: Category;
  createdAt: string;
  updatedAt: string;
};
export type Cart = {
  id: string;
  items: Array<{
    id: string;
    product: Pick<Product, 'id' | 'name' | 'price' | 'stock' | 'imageUrl'>;
    quantity: number;
    subtotal: number;
  }>;
  totalItems: number;
  totalAmount: number;
};
export type Order = {
  id: string;
  userId: string;
  status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name: string; email: string };
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    priceAtPurchase: number;
    product: Pick<Product, 'id' | 'name' | 'imageUrl'>;
  }>;
};
type ProductListResponse = {
  success: true;
  data: {
    items: Product[];
    pagination: { page: number; limit: number; totalItems: number; totalPages: number };
  };
};
type CategoryListResponse = { success: true; data: Category[] };
type ProductResponse = { success: true; data: Product };
type ProductImageUrlResponse = { success: true; data: { url: string | null } };
type CartResponse = { success: true; data: Cart };
type OrderResponse = { success: true; data: Order };
type OrderListResponse = {
  success: true;
  data: {
    items: Order[];
    pagination: { page: number; limit: number; totalItems: number; totalPages: number };
  };
};
export type DashboardStats = {
  totalProducts: number;
  totalCategories: number;
  productsInStock: number;
  productsOutOfStock: number;
  grossVolume: number;
  ordersToday: number;
  openFulfillment: number;
  revenue: Array<{ date: string; revenue: number }>;
};
type DashboardResponse = { success: true; data: DashboardStats };

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const body = (await response.json()) as { error?: string; details?: Array<{ message: string }> };
  if (!response.ok) {
    const detail = body.details?.map((item) => item.message).join(', ');
    throw new ApiError(detail ?? body.error ?? 'Request failed', response.status);
  }
  return body as T;
};

const saveAuth = (result: AuthResponse) => {
  sessionStorage.setItem(TOKEN_KEY, result.data.token);
  return result.data.user;
};

export const authApi = {
  async login(email: string, password: string): Promise<AuthUser> {
    return saveAuth(
      await request<AuthResponse>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    );
  },
  async register(name: string, email: string, password: string): Promise<AuthUser> {
    return saveAuth(
      await request<AuthResponse>('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      }),
    );
  },
  me: () => request<MeResponse>('/api/v1/auth/me').then((response) => response.data),
  logout: () => sessionStorage.removeItem(TOKEN_KEY),
  hasToken: () => Boolean(sessionStorage.getItem(TOKEN_KEY)),
};

export const catalogApi = {
  listProducts: (query = '') =>
    request<ProductListResponse>(`/api/v1/products${query ? `?${query}` : ''}`),
  getProduct: (id: string) => request<ProductResponse>(`/api/v1/products/${id}`),
  getProductImageUrl: (id: string, signal?: AbortSignal) =>
    request<ProductImageUrlResponse>(`/api/v1/products/${id}/image-url`, { signal }),
  listCategories: () => request<CategoryListResponse>('/api/v1/categories'),
  createProduct: (input: object) =>
    request<ProductResponse>('/api/v1/products', { method: 'POST', body: JSON.stringify(input) }),
  updateProduct: (id: string, input: object) =>
    request<ProductResponse>(`/api/v1/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  deleteProduct: (id: string) => request<void>(`/api/v1/products/${id}`, { method: 'DELETE' }),
  createCategory: (input: object) =>
    request<{ success: true; data: Category }>('/api/v1/categories', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateCategory: (id: string, input: object) =>
    request<{ success: true; data: Category }>(`/api/v1/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  deleteCategory: (id: string) => request<void>(`/api/v1/categories/${id}`, { method: 'DELETE' }),
};

export const commerceApi = {
  getCart: () => request<CartResponse>('/api/v1/cart'),
  addToCart: (productId: string, quantity: number) =>
    request<CartResponse>('/api/v1/cart/items', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity }),
    }),
  updateCartItem: (itemId: string, quantity: number) =>
    request<CartResponse>(`/api/v1/cart/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity }),
    }),
  removeCartItem: (itemId: string) =>
    request<void>(`/api/v1/cart/items/${itemId}`, { method: 'DELETE' }),
  clearCart: () => request<void>('/api/v1/cart', { method: 'DELETE' }),
  createOrder: () => request<OrderResponse>('/api/v1/orders', { method: 'POST', body: '{}' }),
  listOrders: (query = '') =>
    request<OrderListResponse>(`/api/v1/orders${query ? `?${query}` : ''}`),
  getOrder: (id: string) => request<OrderResponse>(`/api/v1/orders/${id}`),
  listAdminOrders: (query = '') =>
    request<OrderListResponse>(`/api/v1/admin/orders${query ? `?${query}` : ''}`),
  getAdminOrder: (id: string) => request<OrderResponse>(`/api/v1/admin/orders/${id}`),
  updateOrderStatus: (id: string, status: Order['status']) =>
    request<OrderResponse>(`/api/v1/admin/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  getAdminDashboard: () => request<DashboardResponse>('/api/v1/admin/dashboard'),
};
