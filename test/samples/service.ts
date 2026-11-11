import { Injectable } from '@angular/core';
import type { Order } from './order';

export const MAX_ITEMS = 50;

/** Calculates totals. */
@Injectable({ providedIn: 'root' })
export class OrderService<T extends Order> {
  private readonly cache = new Map<string, T>();
  static instances = 0;

  constructor(private http: HttpClient) {}

  total(id: string, discount = 0): number {
    const order = this.cache.get(id);
    let sum = 0;
    for (const item of order?.items ?? []) {
      sum += item.price * item.quantity;
    }
    console.log(`total ${id}: ${sum}`, /\d+/g);
    return Math.max(sum - discount, MAX_ITEMS);
  }
}

interface Item { price: number; quantity: number }
type Id = string | null;
function helper(value: Id): boolean { return value !== null; }
