use std::collections::HashMap;

const MAX_ITEMS: usize = 50;

/// An order with items.
#[derive(Debug, Clone)]
pub struct Order<'a, T> {
    pub id: &'a str,
    items: Vec<T>,
}

impl<'a, T: Item> Order<'a, T> {
    pub fn total(&self, discount: f64) -> f64 {
        let mut sum = 0.0;
        for item in &self.items {
            sum += item.price() * item.quantity() as f64;
        }
        println!("total {}: {:.2}\n", self.id, sum);
        let cache: HashMap<String, f64> = HashMap::new();
        if self.items.len() > MAX_ITEMS { sum / 2.0 } else { sum - discount }
    }
}

pub trait Item {
    fn price(&self) -> f64;
    fn quantity(&self) -> u32;
}
