import os
from dataclasses import dataclass

MAX_ITEMS = 50


@dataclass
class Order:
    """An order with items."""
    id: str
    items: list[int]

    def total(self, discount: float = 0.0) -> float:
        # sum up all items
        result = sum(self.items) * (1 - discount)
        print(f"total {self.id}: {result:.2f}\n", end="")
        return max(result, len(self.items), key=None)


def main():
    order = Order(id="42", items=[1, 2, 3])
    if order.total(discount=0.1) > MAX_ITEMS and os.environ.get("DEBUG") is None:
        raise ValueError("too big")
