const Order = require("../models/orders");
const Product = require("../models/products");
const User = require("../models/users");
const Category = require("../models/categories");
const City = require("../models/cities");
const Zone = require("../models/zones");
const SellerApplication = require("../models/sellerApplications");

/**
 * Get dashboard statistics
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    // Total counts
    const [
      totalProducts,
      activeProducts,
      totalCategories,
      totalOrders,
      totalUsers,
      activeCities,
      activeZones,
      pendingSellerApplications,
    ] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ isActive: true }),
      Category.countDocuments({ isActive: true }),
      Order.countDocuments(),
      User.countDocuments({ constRoleId: 3 }), // 3 is customer role
      City.countDocuments({ isActive: true }),
      Zone.countDocuments({ isActive: true }),
      SellerApplication.countDocuments({ status: "pending" }),
    ]);

    // Today's sales
    const todayOrders = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: today, $lt: tomorrow },
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$grandTotal" },
          orderCount: { $sum: 1 },
        },
      },
    ]);

    const todaySales = todayOrders[0]?.totalSales || 0;
    const todayOrderCount = todayOrders[0]?.orderCount || 0;

    // Yesterday's sales for comparison
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayOrders = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: yesterday, $lt: today },
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$grandTotal" },
        },
      },
    ]);
    const yesterdaySales = yesterdayOrders[0]?.totalSales || 0;

    // Month revenue
    const monthRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth },
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$grandTotal" },
          orderCount: { $sum: 1 },
        },
      },
    ]);

    const currentMonthRevenue = monthRevenue[0]?.totalRevenue || 0;
    const currentMonthOrders = monthRevenue[0]?.orderCount || 0;

    // Last month revenue for comparison
    const lastMonthRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$grandTotal" },
        },
      },
    ]);
    const previousMonthRevenue = lastMonthRevenue[0]?.totalRevenue || 0;

    // Calculate trends
    const salesTrend =
      yesterdaySales > 0
        ? ((todaySales - yesterdaySales) / yesterdaySales) * 100
        : todaySales > 0
          ? 100
          : 0;

    const revenueTrend =
      previousMonthRevenue > 0
        ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
        : currentMonthRevenue > 0
          ? 100
          : 0;

    // Order status breakdown
    const orderStatusBreakdown = await Order.aggregate([
      {
        $group: {
          _id: "$orderStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    // Payment status breakdown
    const paymentStatusBreakdown = await Order.aggregate([
      {
        $group: {
          _id: "$paymentStatus",
          count: { $sum: 1 },
          total: { $sum: "$grandTotal" },
        },
      },
    ]);

    // Low stock products (assuming stock < 10 as low)
    const lowStockCount = await Product.countDocuments({
      stock: { $lt: 10, $gt: 0 },
      isActive: true,
    });

    const outOfStockCount = await Product.countDocuments({
      stock: 0,
      isActive: true,
    });

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalProducts,
          activeProducts,
          totalCategories,
          totalOrders,
          totalUsers,
          activeCities,
          activeZones,
          pendingSellerApplications,
          lowStockAlerts: lowStockCount + outOfStockCount,
        },
        sales: {
          today: {
            amount: todaySales,
            orders: todayOrderCount,
            trend: Math.round(salesTrend * 10) / 10,
          },
          month: {
            amount: currentMonthRevenue,
            orders: currentMonthOrders,
            trend: Math.round(revenueTrend * 10) / 10,
          },
        },
        orders: {
          statusBreakdown: orderStatusBreakdown,
          paymentBreakdown: paymentStatusBreakdown,
        },
        inventory: {
          lowStock: lowStockCount,
          outOfStock: outOfStockCount,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
      error: error.message,
    });
  }
};

/**
 * Get recent orders
 */
exports.getRecentOrders = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("userId", "name email phone")
      .populate("items.productId", "name")
      .select("-razorpaySignature -__v");

    const formattedOrders = orders.map((order) => ({
      id: order.orderNumber,
      customerName: order.userId?.name || "Unknown",
      productCount: order.items.length,
      quantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
      amount: order.grandTotal,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      date: order.createdAt,
    }));

    res.status(200).json({
      success: true,
      data: formattedOrders,
    });
  } catch (error) {
    console.error("Error fetching recent orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch recent orders",
      error: error.message,
    });
  }
};

/**
 * Get top selling products
 */
exports.getTopProducts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const days = parseInt(req.query.days) || 30;

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const topProducts = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: dateFrom },
          paymentStatus: "paid",
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          unitsSold: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.subtotal" },
        },
      },
      { $sort: { unitsSold: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          name: "$product.name",
          sku: "$product.sku",
          unitsSold: 1,
          revenue: 1,
          category: "$product.category",
        },
      },
    ]);

    // Calculate growth (comparing with previous period)
    const previousDateFrom = new Date(dateFrom);
    previousDateFrom.setDate(previousDateFrom.getDate() - days);

    const productsWithGrowth = await Promise.all(
      topProducts.map(async (product) => {
        const previousPeriod = await Order.aggregate([
          {
            $match: {
              createdAt: { $gte: previousDateFrom, $lt: dateFrom },
              paymentStatus: "paid",
            },
          },
          { $unwind: "$items" },
          {
            $match: {
              "items.productId": product._id,
            },
          },
          {
            $group: {
              _id: null,
              unitsSold: { $sum: "$items.quantity" },
            },
          },
        ]);

        const previousSales = previousPeriod[0]?.unitsSold || 0;
        const growth =
          previousSales > 0
            ? ((product.unitsSold - previousSales) / previousSales) * 100
            : product.unitsSold > 0
              ? 100
              : 0;

        return {
          ...product,
          growth: Math.round(growth * 10) / 10,
          region: "All India", // Can be enhanced based on address data
        };
      }),
    );

    res.status(200).json({
      success: true,
      data: productsWithGrowth,
    });
  } catch (error) {
    console.error("Error fetching top products:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch top products",
      error: error.message,
    });
  }
};

/**
 * Get inventory status
 */
exports.getInventoryStatus = async (req, res) => {
  try {
    const products = await Product.find({ isActive: true })
      .select("name sku stock categoryId")
      .populate("categoryId", "name")
      .limit(20)
      .sort({ stock: 1 });

    const inventoryData = products.map((product) => {
      let status = "healthy";
      const maxStock = product.stock * 2 || 100; // Estimate max stock
      const reorderPoint = maxStock * 0.2;

      if (product.stock === 0) {
        status = "critical";
      } else if (product.stock < reorderPoint) {
        status = "low";
      }

      return {
        product: product.name,
        sku: product.sku,
        stockLevel: product.stock,
        maxStock: maxStock,
        reorderPoint: Math.round(reorderPoint),
        status: status,
        warehouse: "Main Warehouse", // Can be enhanced with warehouse data
        expiryDate: new Date(
          Date.now() + 180 * 24 * 60 * 60 * 1000,
        ).toISOString(), // Placeholder
      };
    });

    res.status(200).json({
      success: true,
      data: inventoryData,
    });
  } catch (error) {
    console.error("Error fetching inventory status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch inventory status",
      error: error.message,
    });
  }
};

/**
 * Get revenue by region (based on cities)
 */
exports.getRevenueByRegion = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const revenueByCity = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: dateFrom },
          paymentStatus: "paid",
        },
      },
      {
        $lookup: {
          from: "addresses",
          localField: "addressId",
          foreignField: "_id",
          as: "address",
        },
      },
      { $unwind: { path: "$address", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "cities",
          localField: "address.city",
          foreignField: "_id",
          as: "city",
        },
      },
      { $unwind: { path: "$city", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            city: "$city.name",
            state: "$city.state",
          },
          revenue: { $sum: "$grandTotal" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]);

    const formattedData = revenueByCity.map((item) => ({
      region: item._id.city
        ? `${item._id.city}, ${item._id.state}`
        : "Unknown",
      revenue: Math.round(item.revenue / 100000 * 10) / 10, // Convert to lakhs
      orders: item.orders,
    }));

    res.status(200).json({
      success: true,
      data: formattedData,
    });
  } catch (error) {
    console.error("Error fetching revenue by region:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch revenue by region",
      error: error.message,
    });
  }
};

/**
 * Get monthly trends (production vs sales)
 */
exports.getMonthlyTrends = async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const trends = [];

    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date();
      monthStart.setMonth(monthStart.getMonth() - i);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);

      const monthData = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: monthStart, $lt: monthEnd },
            paymentStatus: "paid",
          },
        },
        {
          $group: {
            _id: null,
            sales: { $sum: "$grandTotal" },
            orders: { $sum: 1 },
          },
        },
      ]);

      const monthName = monthStart.toLocaleString("default", { month: "short" });
      const sales = monthData[0]?.sales || 0;

      trends.push({
        month: monthName,
        production: Math.round((sales * 1.15) / 100000 * 10) / 10, // Estimate production slightly higher
        sales: Math.round(sales / 100000 * 10) / 10, // Convert to lakhs
      });
    }

    res.status(200).json({
      success: true,
      data: trends,
    });
  } catch (error) {
    console.error("Error fetching monthly trends:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch monthly trends",
      error: error.message,
    });
  }
};

/**
 * Get pending seller applications
 */
exports.getRecentSellerApplications = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    const applications = await SellerApplication.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("-documents -__v");

    const formattedApplications = applications.map((app) => ({
      id: app._id,
      applicantName: app.businessOwnerName,
      email: app.email,
      phone: app.phone,
      address: `${app.businessAddress}, ${app.city}, ${app.state}`,
      businessName: app.businessName,
      requestDate: app.createdAt,
      status: app.status,
    }));

    res.status(200).json({
      success: true,
      data: formattedApplications,
    });
  } catch (error) {
    console.error("Error fetching seller applications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch seller applications",
      error: error.message,
    });
  }
};
