<?php

namespace App\Service;

use App\Entity\Order;

/**
 * Calculates totals.
 */
final class OrderService
{
    private const MAX_ITEMS = 50;
    private static int $instances = 0;

    public function __construct(private readonly OrderRepository $repository)
    {
    }

    public function total(string $id, float $discount = 0.0): float
    {
        $order = $this->repository->find($id);
        $sum = 0;
        foreach ($order->getItems() as $item) {
            $sum += $item->price * $item->quantity;
        }
        echo "Total for {$id}: $sum\n";
        return max($sum - $discount, self::MAX_ITEMS);
    }
}
