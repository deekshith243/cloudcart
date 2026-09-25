import type { Cart, CartItem, PrismaClient, Product } from '@prisma/client';

export type CartItemRecord = Pick<CartItem, 'id' | 'cartId' | 'productId' | 'quantity'> & {
  product: Pick<Product, 'id' | 'name' | 'price' | 'stock' | 'imageUrl'>;
};

export type CartRecord = Pick<Cart, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & {
  items: CartItemRecord[];
};

export interface CartRepository {
  findByUserId(userId: string): Promise<CartRecord | null>;
  getOrCreate(userId: string): Promise<CartRecord>;
  addItem(userId: string, productId: string, quantity: number): Promise<CartRecord>;
  updateItem(userId: string, itemId: string, quantity: number): Promise<CartRecord>;
  removeItem(userId: string, itemId: string): Promise<void>;
  clear(userId: string): Promise<void>;
}

export class PrismaCartRepository implements CartRepository {
  constructor(private readonly client: PrismaClient) {}

  findByUserId(userId: string): Promise<CartRecord | null> {
    return this.client.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, price: true, stock: true, imageUrl: true } },
          },
        },
      },
    });
  }

  async getOrCreate(userId: string): Promise<CartRecord> {
    const cart = await this.client.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, price: true, stock: true, imageUrl: true } },
          },
        },
      },
    });
    return cart;
  }

  async addItem(userId: string, productId: string, quantity: number): Promise<CartRecord> {
    const cart = await this.client.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    await this.client.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      update: { quantity: { increment: quantity } },
      create: { cartId: cart.id, productId, quantity },
    });
    return this.getOrCreate(userId);
  }

  async updateItem(userId: string, itemId: string, quantity: number): Promise<CartRecord> {
    const item = await this.client.cartItem.findFirst({ where: { id: itemId, cart: { userId } } });
    if (!item) return this.getOrCreate(userId);
    await this.client.cartItem.update({ where: { id: item.id }, data: { quantity } });
    return this.getOrCreate(userId);
  }

  async removeItem(userId: string, itemId: string): Promise<void> {
    await this.client.cartItem.deleteMany({ where: { id: itemId, cart: { userId } } });
  }

  async clear(userId: string): Promise<void> {
    await this.client.cartItem.deleteMany({ where: { cart: { userId } } });
  }
}
