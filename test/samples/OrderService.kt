package com.example.shop

import java.time.Instant

const val MAX_ITEMS = 50

/**
 * Calculates totals for orders.
 * @param repository where orders are stored
 */
class OrderService(private val repository: OrderRepository) {

    private val cache = mutableMapOf<String, Order>()
    var lastUpdate: Instant? = null

    fun total(orderId: String): Long {
        val order = cache.getOrPut(orderId) { repository.find(orderId) }
        var sum = 0L
        for (item in order.items) {
            sum += item.price * item.quantity
        }
        lastUpdate = Instant.now()
        return if (order.items.size > MAX_ITEMS) sum / 2 else sum
    }

    @Deprecated("use total()")
    fun legacyTotal(id: String) = total(id)
}

data class Order(val id: String, val items: List<Item>)

enum class Status { NEW, PAID }
