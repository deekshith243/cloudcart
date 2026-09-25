import { Prisma } from '@prisma/client';
import { AppError } from '../errors/app-error.js';
import type { CartRecord, CartRepository } from '../repositories/cart-repository.js';
import type { ProductRepository } from '../repositories/product-repository.js';
import type { CartItemInput, CartQuantityInput } from '../validation/commerce.js';

export type CartResponse = {
  id: string;
  items: Array<{
    id: string;
    product: CartRecord['items'][number]['product'];
    quantity: number;
    subtotal: number;
  }>;
  totalItems: number;
  totalAmount: number;
};

export class CartService {
  constructor(
    private readonly carts: CartRepository,
    private readonly products: ProductRepository,
  ) {}

  async get(userId: string): Promise<CartResponse> {
    return this.toResponse(await this.carts.getOrCreate(userId));
  }

  async add(userId: string, input: CartItemInput): Promise<CartResponse> {
    const product = await this.products.findById(input.productId);
    if (!product) throw new AppError(404, 'Product not found');
    const cart = await this.carts.getOrCreate(userId);
    const existing = cart.items.find((item) => item.productId === input.productId);
    const requested = (existing?.quantity ?? 0) + input.quantity;
    if (requested > product.stock)
      throw new AppError(409, `Quantity exceeds available stock for ${product.name}`);
    return this.toResponse(await this.carts.addItem(userId, input.productId, input.quantity));
  }

  async update(userId: string, itemId: string, input: CartQuantityInput): Promise<CartResponse> {
    const cart = await this.carts.getOrCreate(userId);
    const item = cart.items.find((candidate) => candidate.id === itemId);
    if (!item) throw new AppError(404, 'Cart item not found');
    if (input.quantity > item.product.stock)
      throw new AppError(409, `Quantity exceeds available stock for ${item.product.name}`);
    return this.toResponse(await this.carts.updateItem(userId, itemId, input.quantity));
  }

  async remove(userId: string, itemId: string): Promise<void> {
    const cart = await this.carts.getOrCreate(userId);
    if (!cart.items.some((item) => item.id === itemId))
      throw new AppError(404, 'Cart item not found');
    await this.carts.removeItem(userId, itemId);
  }

  async clear(userId: string): Promise<void> {
    await this.carts.clear(userId);
  }

  private toResponse(cart: CartRecord): CartResponse {
    let total = new Prisma.Decimal(0);
    const items = cart.items.map((item) => {
      const subtotal = new Prisma.Decimal(item.product.price).mul(item.quantity);
      total = total.add(subtotal);
      return {
        id: item.id,
        product: item.product,
        quantity: item.quantity,
        subtotal: subtotal.toNumber(),
      };
    });
    return {
      id: cart.id,
      items,
      totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
      totalAmount: total.toNumber(),
    };
  }
}
