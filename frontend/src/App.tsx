import { useEffect, useState, type FormEvent } from 'react';

import './App.css';

import { useAuth } from './auth/useAuth';

import { commerceApi, type Order } from './auth/api';

import { ProtectedRoute } from './auth/ProtectedRoute';

import { AdminCatalogPage, ProductDetailsPage, ProductsPage } from './catalog/CatalogPages';

import { AdminOrdersPage, CartPage, OrderDetailsPage, OrdersPage } from './commerce/OrderPages';

type AuthMode = 'login' | 'register';

function AuthScreen() {

  const { error, login, register } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');

  const [name, setName] = useState('');

  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {

    event.preventDefault();

    setSubmitting(true);

    try {

      if (mode === 'login') await login(email, password);

      else await register(name, email, password);

    } catch {

      // The auth context exposes a safe, user-facing error.

    } finally {

      setSubmitting(false);

    }

  };

  return (

    <main className="auth-shell">

      <section className="auth-panel">

        <div className="brand">

          <span className="brand-mark">C</span>

          <span>CloudCart</span>

        </div>

        <p className="eyebrow">Commerce operations</p>

        <h1>{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h1>

        <p className="auth-copy">

          {mode === 'login'

            ? 'Sign in to keep your storefront moving.'

            : 'Join the CloudCart workspace as a customer.'}

        </p>

        <form onSubmit={submit} className="auth-form">

          {mode === 'register' && (

            <label>

              Full name

              <input

                value={name}

                onChange={(event) => setName(event.target.value)}

                required

                minLength={2}

                autoComplete="name"

              />

            </label>

          )}

          <label>

            Email

            <input

              type="email"

              value={email}

              onChange={(event) => setEmail(event.target.value)}

              required

              autoComplete="email"

            />

          </label>

          <label>

            Password

            <input

              type="password"

              value={password}

              onChange={(event) => setPassword(event.target.value)}

              required

              minLength={8}

              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}

            />

          </label>

          {error && (

            <p className="auth-error" role="alert">

              {error}

            </p>

          )}

          <button className="primary-action auth-submit" disabled={submitting} type="submit">

            {submitting ? 'Working...' : mode === 'login' ? 'Sign in' : 'Create account'}

          </button>

        </form>

        <button

          className="switch-auth"

          type="button"

          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}

        >

          {mode === 'login' ? 'Need an account? Create one' : 'Already have an account? Sign in'}

        </button>

      </section>

    </main>

  );

}

function Dashboard() {

  const { user, logout } = useAuth();

  const [recentOrders, setRecentOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;

    commerceApi
      .listAdminOrders()
      .then((response) => setRecentOrders(response.data.items.slice(0, 3)))
      .catch((error: unknown) => {
        console.error('Unable to load recent orders:', error);
      });
  }, [user]);

  if (!user) return null;

  return (

    <ProtectedRoute>

      <main className="shell">

        <aside className="sidebar">

          <div className="brand">

            <span className="brand-mark">C</span>

            <span>CloudCart</span>

          </div>

          <p className="eyebrow">Operations console</p>

          <nav aria-label="Primary navigation">

            <a className="nav-item active" href="#overview">

              Overview

            </a>

            <a className="nav-item" href="#orders">

              Orders

            </a>

            <a className="nav-item" href="/admin/catalog">

              Catalog

            </a>

            <a className="nav-item" href="/products">

              Products

            </a>

            <a className="nav-item" href="/cart">

              Cart

            </a>

            <a className="nav-item" href="/orders">

              Orders

            </a>

            {user.role === 'ADMIN' && (

              <a className="nav-item" href="/admin/orders">

                Admin orders

              </a>

            )}

            {user.role === 'ADMIN' && (

              <a className="nav-item" href="/admin/catalog">

                Admin

              </a>

            )}

          </nav>

          <div className="sidebar-foot">

            <span className="status-dot" />

            All systems ready

          </div>

        </aside>

        <section className="content" id="overview">

          <header className="topbar">

            <div>

              <p className="eyebrow">Authenticated workspace</p>

              <h1>Good morning, {user.name.split(' ')[0]}.</h1>

            </div>

            <div className="account-actions">

              <span className="account-role">{user.role}</span>

              <button className="avatar" aria-label="Sign out" onClick={logout}>

                ↗

              </button>

            </div>

          </header>

          <div className="intro">

            <div>

              <h2>Commerce at a glance</h2>

              <p>Keep the day moving with one clear view of your storefront.</p>

            </div>

            {user.role === 'ADMIN' && (

              <button

                className="primary-action"

                onClick={() => {

                  window.location.href = '/admin/catalog';

                }}

              >

                + Add product

              </button>

            )}

          </div>

          <div className="metric-grid">

            <article className="metric">

              <span>Gross volume</span>

              <strong>$48,290</strong>

              <small className="positive">

                ↑ 12.8% <em>vs last month</em>

              </small>

            </article>

            <article className="metric">

              <span>Orders today</span>

              <strong>184</strong>

              <small className="positive">

                ↑ 8.2% <em>vs yesterday</em>

              </small>

            </article>

            <article className="metric">

              <span>Open fulfillment</span>

              <strong>32</strong>

              <small className="attention">Needs attention</small>

            </article>

          </div>

          <section className="lower-grid" id="orders">

            <article className="panel chart-panel">

              <div className="panel-heading">

                <div>

                  <h3>Revenue pulse</h3>

                  <p>Last 30 days</p>

                </div>

                <span className="range">30 days⌄</span>

              </div>

              <div className="chart">

                <div className="chart-line" />

                <div className="chart-labels">

                  <span>Aug 27</span>

                  <span>Sep 10</span>

                  <span>Sep 25</span>

                </div>

              </div>

            </article>

            <article className="panel">

              <div className="panel-heading">

                <div>

                  <h3>Recent orders</h3>

                  <p>Latest customer activity</p>

                </div>

                <a href="#orders" className="view-link">

                  View all

                </a>

              </div>

              <div className="orders">
                {recentOrders.length === 0 ? (
                  <p className="catalog-state">No recent orders found.</p>
                ) : (
                  recentOrders.map((order) => (
                    <div key={order.id}>
                      <span className="order-icon">#</span>
                      <span>
                        <b>#{order.id.slice(0, 8)}</b>
                        <small>{order.user?.name ?? 'Customer'}</small>
                      </span>
                      <strong>${Number(order.totalAmount).toFixed(2)}</strong>
                    </div>
                  ))
                )}
              </div>

            </article>

          </section>

        </section>

      </main>

    </ProtectedRoute>

  );

}

function App() {

  const { user, loading } = useAuth();

  if (loading) return <div className="auth-loading">Checking your session...</div>;

  const pathname = window.location.pathname;

  if (pathname === '/products') return <ProductsPage />;

  if (pathname.startsWith('/products/')) {

    return <ProductDetailsPage id={pathname.split('/')[2] ?? ''} />;

  }

  if (pathname === '/cart') return user ? <CartPage /> : <AuthScreen />;

  if (pathname === '/orders') return user ? <OrdersPage /> : <AuthScreen />;

  if (pathname.startsWith('/orders/')) {

    return user ? <OrderDetailsPage id={pathname.split('/')[2] ?? ''} /> : <AuthScreen />;

  }

  if (pathname === '/admin/orders') return user ? <AdminOrdersPage /> : <AuthScreen />;

  if (pathname.startsWith('/admin/orders/')) {

    return user ? <OrderDetailsPage id={pathname.split('/')[3] ?? ''} admin /> : <AuthScreen />;

  }

  if (pathname.startsWith('/admin/')) return user ? <AdminCatalogPage /> : <AuthScreen />;

  return user ? <Dashboard /> : <AuthScreen />;

}

export default App;