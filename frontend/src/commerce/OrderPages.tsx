import { useEffect, useState } from 'react';
import { ApiError, commerceApi, type Cart, type Order } from '../auth/api';
import { useAuth } from '../auth/useAuth';
import { ProductImage } from '../catalog/ProductImage';

const money = (value: number) =>
  `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
const date = (value: string) => new Date(value).toLocaleDateString();

export function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const load = () =>
    commerceApi
      .getCart()
      .then((response) => setCart(response.data))
      .catch((requestError: unknown) =>
        setError(requestError instanceof ApiError ? requestError.message : 'Unable to load cart'),
      );
  useEffect(() => {
    void load();
  }, []);
  const update = async (itemId: string, quantity: number) => {
    setWorking(true);
    try {
      setCart((await commerceApi.updateCartItem(itemId, quantity)).data);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Unable to update cart');
    } finally {
      setWorking(false);
    }
  };
  const remove = async (itemId: string) => {
    await commerceApi.removeCartItem(itemId);
    await load();
  };
  const checkout = async () => {
    setWorking(true);
    try {
      const order = await commerceApi.createOrder();
      window.location.href = `/orders/${order.data.id}`;
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Unable to place order');
    } finally {
      setWorking(false);
    }
  };
  if (!cart) return <p className="catalog-state">Loading cart...</p>;
  return (
    <main className="commerce-page">
      <a className="back-link" href="/products">
        ← Continue shopping
      </a>
      <header className="commerce-header">
        <div>
          <p className="eyebrow">Your basket</p>
          <h1>Ready when you are.</h1>
        </div>
        <a className="catalog-account" href="/orders">
          Order history
        </a>
      </header>
      {error && <p className="error-state">{error}</p>}
      {cart.items.length === 0 ? (
        <section className="empty-panel">
          <h2>Your cart is empty.</h2>
          <p>Browse the catalog to find something considered.</p>
          <a className="primary-action inline-action" href="/products">
            Explore products
          </a>
        </section>
      ) : (
        <div className="cart-layout">
          <section className="cart-items">
            {cart.items.map((item) => (
              <article className="cart-item" key={item.id}>
                <div className="cart-thumb">
                  <ProductImage
                    productId={item.product.id}
                    imageReference={item.product.imageUrl}
                    alt=""
                    fallback={item.product.name.charAt(0)}
                  />
                </div>
                <div>
                  <h2>{item.product.name}</h2>
                  <p>
                    {money(Number(item.product.price))} · {item.product.stock} in stock
                  </p>
                  <div className="quantity-controls">
                    <button
                      disabled={working || item.quantity <= 1}
                      onClick={() => void update(item.id, item.quantity - 1)}
                    >
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      disabled={working || item.quantity >= item.product.stock}
                      onClick={() => void update(item.id, item.quantity + 1)}
                    >
                      +
                    </button>
                    <button className="text-action" onClick={() => void remove(item.id)}>
                      Remove
                    </button>
                  </div>
                </div>
                <strong>{money(item.subtotal)}</strong>
              </article>
            ))}
          </section>
          <aside className="summary-panel">
            <h2>Summary</h2>
            <p>
              <span>Items</span>
              <strong>{cart.totalItems}</strong>
            </p>
            <p className="summary-total">
              <span>Total</span>
              <strong>{money(cart.totalAmount)}</strong>
            </p>
            <button
              className="primary-action checkout-action"
              disabled={working}
              onClick={() => void checkout()}
            >
              {working ? 'Processing...' : 'Place order'}
            </button>
            <button
              className="text-action clear-action"
              onClick={() => void commerceApi.clearCart().then(load)}
            >
              Clear cart
            </button>
          </aside>
        </div>
      )}
    </main>
  );
}

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void commerceApi
      .listOrders()
      .then((response) => setOrders(response.data.items))
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <p className="catalog-state">Loading order history...</p>;
  return (
    <main className="commerce-page">
      <a className="back-link" href="/">
        ← Dashboard
      </a>
      <header className="commerce-header">
        <div>
          <p className="eyebrow">Customer account</p>
          <h1>Order history</h1>
        </div>
        <a className="catalog-account" href="/products">
          Shop catalog
        </a>
      </header>
      <section className="order-list">
        {orders.length === 0 ? (
          <p className="catalog-state">No orders yet.</p>
        ) : (
          orders.map((order) => (
            <a className="order-row" href={`/orders/${order.id}`} key={order.id}>
              <span>
                <b>#{order.id.slice(0, 8)}</b>
                <small>
                  {date(order.createdAt)} · {order.items.length} items
                </small>
              </span>
              <span className={`status status-${order.status.toLowerCase()}`}>{order.status}</span>
              <strong>{money(order.totalAmount)}</strong>
            </a>
          ))
        )}
      </section>
    </main>
  );
}

export function OrderDetailsPage({ id, admin = false }: { id: string; admin?: boolean }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void (admin ? commerceApi.getAdminOrder(id) : commerceApi.getOrder(id))
      .then((response) => setOrder(response.data))
      .catch((requestError: unknown) =>
        setError(requestError instanceof ApiError ? requestError.message : 'Order unavailable'),
      );
  }, [id, admin]);
  if (error)
    return (
      <main className="catalog-state error-state">
        {error}
        <br />
        <a href={admin ? '/admin/orders' : '/orders'}>Return to orders</a>
      </main>
    );
  if (!order) return <p className="catalog-state">Loading order...</p>;
  return (
    <main className="commerce-page">
      <a className="back-link" href={admin ? '/admin/orders' : '/orders'}>
        ← Order history
      </a>
      <header className="commerce-header">
        <div>
          <p className="eyebrow">Order detail</p>
          <h1>#{order.id.slice(0, 8)}</h1>
          <p>
            {date(order.createdAt)} {order.user ? `· ${order.user.name}` : ''}
          </p>
        </div>
        <span className={`status status-${order.status.toLowerCase()}`}>{order.status}</span>
      </header>
      <section className="order-detail-list">
        {order.items.map((item) => (
          <div className="order-detail-item" key={item.id}>
            <span>
              {item.product.name}
              <small>
                {item.quantity} × {money(item.priceAtPurchase)}
              </small>
            </span>
            <strong>{money(item.quantity * item.priceAtPurchase)}</strong>
          </div>
        ))}
        <div className="summary-total">
          <span>Total</span>
          <strong>{money(order.totalAmount)}</strong>
        </div>
      </section>
    </main>
  );
}

export function AdminOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = () =>
    commerceApi
      .listAdminOrders()
      .then((response) => setOrders(response.data.items))
      .catch((requestError: unknown) =>
        setError(requestError instanceof ApiError ? requestError.message : 'Unable to load orders'),
      );
  useEffect(() => {
    if (user?.role === 'ADMIN') void load();
  }, [user]);
  if (user?.role !== 'ADMIN')
    return (
      <main className="catalog-state error-state">
        Admin access required.
        <br />
        <a href="/">Return home</a>
      </main>
    );
  const update = async (id: string, status: Order['status']) => {
    await commerceApi.updateOrderStatus(id, status);
    await load();
  };
  return (
    <main className="commerce-page">
      <a className="back-link" href="/">
        ← Dashboard
      </a>
      <header className="commerce-header">
        <div>
          <p className="eyebrow">Admin workspace</p>
          <h1>Order management</h1>
        </div>
      </header>
      {error && <p className="error-state">{error}</p>}
      <section className="order-list">
        {orders.map((order) => (
          <div className="order-row" key={order.id}>
            <a href={`/admin/orders/${order.id}`}>
              <span>
                <b>#{order.id.slice(0, 8)}</b>
                <small>
                  {order.user?.name ?? 'Customer'} · {date(order.createdAt)}
                </small>
              </span>
            </a>
            <select
              value={order.status}
              onChange={(event) => void update(order.id, event.target.value as Order['status'])}
            >
              <option>PENDING</option>
              <option>PROCESSING</option>
              <option>SHIPPED</option>
              <option>DELIVERED</option>
              <option>CANCELLED</option>
            </select>
            <strong>{money(order.totalAmount)}</strong>
          </div>
        ))}
      </section>
    </main>
  );
}
