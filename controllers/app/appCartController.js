const Cart = require("../../models/cart");
const Product = require("../../models/products");
const User = require("../../models/users");
const { calculateOrderTotals } = require("../../utils/orderTotals");

/**
 * Get user's cart
 */

const transformCart = (cart) => {
  const cartObj = cart.toObject();

  cartObj.items = cartObj.items.map((item) => {
    if (item.productId) {
      item.productId.displayPrice = item.price;
      item.productId.priceType = item.priceType;

      delete item.productId.sellingPrice;
      delete item.productId.bulkPrice;
    }

    return item;
  });

  return cartObj;
};

exports.getCart = async (req, res) => {
  try {
    const userId = req.userId;

    let cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      select: "name image sku sellingPrice bulkPrice minBulkQty isActive",
    });

    if (!cart) {
      // Create empty cart if doesn't exist
      cart = new Cart({ userId, items: [] });
      await cart.save();
    }

    const user = await User.findById(userId).select("zoneId");
    const totals = await calculateOrderTotals({
      subtotal: cart.totalAmount || 0,
      user,
    });

    // Transform cart and add fees
    const cartData = transformCart(cart);
    cartData.deliveryCharge = totals.deliveryCharge;
    cartData.platformFee = totals.platformFee;
    cartData.taxPercentage = totals.taxPercentage;
    cartData.taxAmount = totals.taxAmount;
    cartData.discountAmount = totals.discountAmount;
    cartData.subtotal = totals.totalAmount;
    cartData.grandTotal = totals.grandTotal;

    res.json({
      success: true,
      data: cartData,
    });
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cart",
      error: error.message,
    });
  }
};

/**
 * Add item to cart
 */
exports.addToCart = async (req, res) => {
  try {
    const userId = req.userId;
    const { productId, quantity } = req.body;

    // Validation
    if (!productId || !quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Product ID and valid quantity are required",
      });
    }

    // Find product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (!product.isActive) {
      return res.status(400).json({
        success: false,
        message: "Product is not available",
      });
    }

    // Get user to determine price type
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Determine price based on user type and quantity
    let price = product.sellingPrice;
    let priceType = "selling";

    // If user is seller (constRoleId: 3) or buying bulk quantity
    if (
      user.constRoleId === 3 &&
      quantity >= product.minBulkQty &&
      product.minBulkQty > 0
    ) {
      price = product.bulkPrice;
      priceType = "bulk";
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId,
    );

    if (existingItemIndex > -1) {
      // Update quantity and price
      cart.items[existingItemIndex].quantity += quantity;
      cart.items[existingItemIndex].price = price;
      cart.items[existingItemIndex].priceType = priceType;
    } else {
      // Add new item
      cart.items.push({
        productId,
        quantity,
        price,
        priceType,
      });
    }

    await cart.save();

    // Populate and return cart
    cart = await Cart.findById(cart._id).populate({
      path: "items.productId",
      select: "name image sku sellingPrice bulkPrice minBulkQty isActive",
    });

    res.json({
      success: true,
      message: "Item added to cart",
      data: cart,
    });
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add item to cart",
      error: error.message,
    });
  }
};

/**
 * Update cart item quantity
 */
exports.updateCartItem = async (req, res) => {
  try {
    const userId = req.userId;
    const { productId, quantity } = req.body;

    // Validation
    if (!productId || quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: "Product ID and quantity are required",
      });
    }

    // Find cart
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Find item in cart
    const itemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId,
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart",
      });
    }

    if (quantity <= 0) {
      // Remove item if quantity is 0 or negative
      cart.items.splice(itemIndex, 1);
    } else {
      // Update quantity
      cart.items[itemIndex].quantity = quantity;

      // Recalculate price if needed
      const product = await Product.findById(productId);
      const user = await User.findById(userId);

      if (product && user) {
        let price = product.sellingPrice;
        let priceType = "selling";

        if (
          user.constRoleId === 3 &&
          quantity >= product.minBulkQty &&
          product.minBulkQty > 0
        ) {
          price = product.bulkPrice;
          priceType = "bulk";
        }

        cart.items[itemIndex].price = price;
        cart.items[itemIndex].priceType = priceType;
      }
    }

    await cart.save();

    // Populate and return cart
    cart = await Cart.findById(cart._id).populate({
      path: "items.productId",
      select: "name image sku sellingPrice bulkPrice minBulkQty isActive",
    });

    res.json({
      success: true,
      message: "Cart updated",
      data: cart,
    });
  } catch (error) {
    console.error("Error updating cart:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update cart",
      error: error.message,
    });
  }
};

/**
 * Remove item from cart
 */
exports.removeFromCart = async (req, res) => {
  try {
    const userId = req.userId;
    const { productId } = req.params;

    // Find cart
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Remove item
    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== productId,
    );

    await cart.save();

    // Populate and return cart
    cart = await Cart.findById(cart._id).populate({
      path: "items.productId",
      select: "name image sku sellingPrice bulkPrice minBulkQty isActive",
    });

    res.json({
      success: true,
      message: "Item removed from cart",
      data: cart,
    });
  } catch (error) {
    console.error("Error removing from cart:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove item from cart",
      error: error.message,
    });
  }
};

/**
 * Clear cart
 */
exports.clearCart = async (req, res) => {
  try {
    const userId = req.userId;

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    cart.items = [];
    await cart.save();

    res.json({
      success: true,
      message: "Cart cleared",
      data: cart,
    });
  } catch (error) {
    console.error("Error clearing cart:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear cart",
      error: error.message,
    });
  }
};
