package shop

import (
	"fmt"
	"strings"
)

const MaxItems = 50

// Order holds items.
type Order struct {
	ID    string
	Items []Item
}

type Item interface {
	Price() float64
}

// Total sums up all items.
func (o *Order) Total(discount float64) float64 {
	sum := 0.0
	for _, item := range o.Items {
		sum += item.Price()
	}
	fmt.Printf("total %s: %.2f\n", strings.ToUpper(o.ID), sum)
	if len(o.Items) > MaxItems {
		return sum / 2
	}
	return sum - discount
}
