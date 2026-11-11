#include <vector>
#include "order.h"

#define MAX_ITEMS 50

namespace shop {

/// Calculates totals.
template <typename T>
class OrderService : public Service {
public:
    explicit OrderService(Repository& repository) : repository_(repository) {}

    double total(const std::string& id, double discount = 0.0) const {
        auto order = repository_.find(id);
        double sum = 0;
        for (const auto& item : order.items) {
            sum += item.price * item.quantity;
        }
        std::printf("total %s: %f\n", id.c_str(), sum);
        return std::max(sum - discount, static_cast<double>(MAX_ITEMS));
    }

private:
    Repository& repository_;
    static int instances_;
};

}  // namespace shop
