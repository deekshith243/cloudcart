import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, catalogApi, commerceApi, type Category, type Product } from '../auth/api';
import { useAuth } from '../auth/useAuth';
import { ProductImage } from './ProductImage';

const money = (value: number | string) =>
  `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void catalogApi
      .listCategories()
      .then((response) => setCategories(response.data))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: '9',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    if (search) params.set('search', search);
    if (categoryId) params.set('categoryId', categoryId);
    void catalogApi
      .listProducts(params.toString())
      .then((response) => {
        setProducts(response.data.items);
        setTotalPages(response.data.pagination.totalPages);
        setError(null);
      })
      .catch((requestError: unknown) =>
        setError(
          requestError instanceof ApiError ? requestError.message : 'Unable to load products',
        ),
      )
      .finally(() => setLoading(false));
  }, [page, search, categoryId]);

  return (
    <main className="catalog-page">
      <header className="catalog-header">
        <div>
          <a className="back-link" href="/">
            ← CloudCart
          </a>
          <p className="eyebrow">Public catalog</p>
          <h1>Find your next favorite.</h1>
          <p>Considered goods for focused work, travel, and home.</p>
        </div>
        <a className="catalog-account" href="/">
          Sign in
        </a>
      </header>
      <div className="catalog-toolbar">
        <input
          aria-label="Search products"
          placeholder="Search products"
          value={search}
          onChange={(event) => {
            setPage(1);
            setSearch(event.target.value);
          }}
        />
        <select
          aria-label="Filter by category"
          value={categoryId}
          onChange={(event) => {
            setPage(1);
            setCategoryId(event.target.value);
          }}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      {loading && <p className="catalog-state">Loading products...</p>}
      {error && <p className="catalog-state error-state">{error}</p>}
      {!loading && !error && products.length === 0 && (
        <p className="catalog-state">No products match your search.</p>
      )}
      <div className="product-grid">
        {products.map((product) => (
          <a className="product-card" href={`/products/${product.id}`} key={product.id}>
            <div className="product-image">
              <ProductImage
                productId={product.id}
                imageReference={product.imageUrl}
                alt=""
                fallback={<span>{product.name.charAt(0)}</span>}
              />
            </div>
            <span className="product-category">{product.category.name}</span>
            <h2>{product.name}</h2>
            <p>{product.description}</p>
            <strong>{money(product.price)}</strong>
            <small className={product.stock > 0 ? 'in-stock' : 'out-stock'}>
              {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
            </small>
          </a>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
            ←
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>
            →
          </button>
        </div>
      )}
    </main>
  );
}

export function ProductDetailsPage({ id }: { id: string }) {
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  useEffect(() => {
    void catalogApi
      .getProduct(id)
      .then((response) => setProduct(response.data))
      .catch((requestError: unknown) =>
        setError(requestError instanceof ApiError ? requestError.message : 'Product unavailable'),
      );
  }, [id]);
  if (error)
    return (
      <main className="catalog-state error-state">
        {error}
        <br />
        <a href="/products">Return to catalog</a>
      </main>
    );
  if (!product) return <p className="catalog-state">Loading product...</p>;
  const addToCart = async () => {
    await commerceApi.addToCart(product.id, 1);
    setAdded(true);
  };
  return (
    <main className="detail-page">
      <a className="back-link" href="/products">
        ← Back to catalog
      </a>
      <section className="detail-layout">
        <div className="detail-image">
          <ProductImage
            productId={product.id}
            imageReference={product.imageUrl}
            alt={product.name}
            fallback={<span>{product.name.charAt(0)}</span>}
          />
        </div>
        <div className="detail-copy">
          <span className="product-category">{product.category.name}</span>
          <h1>{product.name}</h1>
          <p>{product.description}</p>
          <strong className="detail-price">{money(product.price)}</strong>
          <span className={product.stock > 0 ? 'in-stock' : 'out-stock'}>
            {product.stock > 0 ? `${product.stock} available` : 'Currently unavailable'}
          </span>
          {product.stock > 0 &&
            (user ? (
              <button
                className="primary-action detail-cart-action"
                onClick={() => void addToCart()}
              >
                {added ? 'Added to cart' : 'Add to cart'}
              </button>
            ) : (
              <a className="primary-action detail-cart-action" href="/">
                Sign in to buy
              </a>
            ))}
        </div>
      </section>
    </main>
  );
}

export function AdminCatalogPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productStock, setProductStock] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const load = () =>
    Promise.all([catalogApi.listCategories(), catalogApi.listProducts('limit=100')]).then(
      ([categoryResponse, productResponse]) => {
        setCategories(categoryResponse.data);
        setProducts(productResponse.data.items);
      },
    );
  useEffect(() => {
    void load();
  }, []);
  if (user?.role !== 'ADMIN')
    return (
      <main className="catalog-state error-state">
        Admin access required.
        <br />
        <a href="/">Return home</a>
      </main>
    );

  const createCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (editingCategoryId)
      await catalogApi.updateCategory(editingCategoryId, { name: categoryName });
    else await catalogApi.createCategory({ name: categoryName });
    setCategoryName('');
    setEditingCategoryId(null);
    setMessage(editingCategoryId ? 'Category updated.' : 'Category created.');
    await load();
  };
  const createProduct = async (event: FormEvent) => {
    event.preventDefault();
    const input = {
      name: productName,
      description: productDescription,
      price: Number(productPrice),
      stock: Number(productStock),
      categoryId: productCategory,
    };
    if (editingProductId) await catalogApi.updateProduct(editingProductId, input);
    else await catalogApi.createProduct(input);
    setProductName('');
    setProductDescription('');
    setProductPrice('');
    setProductStock('');
    setProductCategory('');
    setEditingProductId(null);
    setMessage(editingProductId ? 'Product updated.' : 'Product created.');
    await load();
  };
  const editCategory = (category: Category) => {
    setEditingCategoryId(category.id);
    setCategoryName(category.name);
  };
  const editProduct = (product: Product) => {
    setEditingProductId(product.id);
    setProductName(product.name);
    setProductDescription(product.description);
    setProductPrice(String(product.price));
    setProductStock(String(product.stock));
    setProductCategory(product.categoryId);
  };
  const deleteProduct = async (id: string) => {
    await catalogApi.deleteProduct(id);
    setMessage('Product deleted.');
    await load();
  };
  const deleteCategory = async (id: string) => {
    await catalogApi.deleteCategory(id);
    setMessage('Category deleted.');
    await load();
  };

  return (
    <main className="admin-page">
      <a className="back-link" href="/">
        ← Dashboard
      </a>
      <p className="eyebrow">Admin workspace</p>
      <h1>Catalog management</h1>
      {message && <p className="success-state">{message}</p>}
      <div className="admin-columns">
        <section className="admin-panel">
          <h2>{editingCategoryId ? 'Edit category' : 'New category'}</h2>
          <form onSubmit={createCategory}>
            <input
              placeholder="Category name"
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              required
            />
            <button className="primary-action">
              {editingCategoryId ? 'Update category' : 'Create category'}
            </button>
          </form>
          <ul className="admin-list">
            {categories.map((category) => (
              <li key={category.id}>
                <span>{category.name}</span>
                <span>
                  <button onClick={() => editCategory(category)}>Edit</button>
                  <button onClick={() => void deleteCategory(category.id)}>Delete</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="admin-panel">
          <h2>{editingProductId ? 'Edit product' : 'New product'}</h2>
          <form onSubmit={createProduct}>
            <input
              placeholder="Product name"
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
              required
            />
            <textarea
              placeholder="Description"
              value={productDescription}
              onChange={(event) => setProductDescription(event.target.value)}
              required
            />
            <div className="form-row">
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Price"
                value={productPrice}
                onChange={(event) => setProductPrice(event.target.value)}
                required
              />
              <input
                type="number"
                min="0"
                placeholder="Stock"
                value={productStock}
                onChange={(event) => setProductStock(event.target.value)}
                required
              />
            </div>
            <select
              value={productCategory}
              onChange={(event) => setProductCategory(event.target.value)}
              required
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <button className="primary-action">
              {editingProductId ? 'Update product' : 'Create product'}
            </button>
          </form>
          <ul className="admin-list">
            {products.map((product) => (
              <li key={product.id}>
                <span>{product.name}</span>
                <span>
                  <button onClick={() => editProduct(product)}>Edit</button>
                  <button onClick={() => void deleteProduct(product.id)}>Delete</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
