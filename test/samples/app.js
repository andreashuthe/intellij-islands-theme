'use strict';
const API_URL = 'https://example.com/api';

class Cart {
  #items = [];
  static count = 0;

  add(item, quantity = 1) {
    this.#items.push({ item, quantity });
    Cart.count++;
    return this;
  }
}

async function load(id) {
  const response = await fetch(`${API_URL}/orders/${id}`);
  if (!response.ok) throw new Error('failed: ' + response.status);
  const data = await response.json();
  document.getElementById('orders').textContent = data.name;
  return data.items.map(i => i.price * 2);
}

export default load;
