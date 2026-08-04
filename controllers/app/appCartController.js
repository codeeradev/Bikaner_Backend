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

    const [user, settings] = await Promise.all([
      User.findById(userId).select("zoneId constRoleId"),
      require("../../models/settings")
        .findById("site-settings")
        .select("enableRazorpayForSellers enableRazorpayForUser codLimit"),
    ]);

    const cartType = user.constRoleId === 3 ? "bulk" : "selling";

    let cart = await Cart.findOne({
      userId,
      cartType,
    }).populate({
      path: "items.productId",
      select: "name image sku sellingPrice bulkPrice isActive",
    });

    if (!cart) {
      cart = new Cart({
        userId,
        cartType,
        items: [],
      });

      await cart.save();
    }

    // Calculate totals with stored offer ID (if any) - NO auto-apply here
    let totals;
    try {
      totals = await calculateOrderTotals({
        subtotal: cart.totalAmount || 0,
        user,
        offerId: cart.offerId || null, // Pass stored offerId
        cartItems: cart.items,
      });
    } catch (error) {
      // If offer is invalid, clear it and recalculate without offer
      if (error.statusCode === 400) {
        // Restore original quantities if BOGO was applied
        const currentOffer = cart.offerId ? await require("../models/offers").findById(cart.offerId) : null;
        if (currentOffer && currentOffer.offerType === "bogo") {
          for (const cartItem of cart.items) {
            if (cartItem.originalQuantity) {
              cartItem.quantity = cartItem.originalQuantity;
              cartItem.originalQuantity = undefined;
            }
          }
        }

        cart.offerId = null;
        cart.couponId = null;
        await cart.save();

        totals = await calculateOrderTotals({
          subtotal: cart.totalAmount || 0,
          user,
          offerId: null,
          cartItems: cart.items,
        });
      } else {
        throw error;
      }
    }

    // Transform cart and add fees
    const cartData = transformCart(cart);
    cartData.deliveryCharge = totals.deliveryCharge;
    cartData.platformFee = totals.platformFee;
    cartData.taxPercentage = totals.taxPercentage;
    cartData.taxAmount = totals.taxAmount;
    cartData.discountAmount = totals.discountAmount;
    cartData.freeProducts = totals.freeProducts || [];
    cartData.subtotal = totals.totalAmount;
    cartData.grandTotal = totals.grandTotal;

    // Add applied offer information
    if (totals.offer) {
      cartData.appliedOffer = {
        id: totals.offer._id,
        name: totals.offer.name,
        offerType: totals.offer.offerType,
        autoApply: totals.offer.autoApply,
      };
      cartData.offerApplied = true;
    } else {
      cartData.appliedOffer = null;
      cartData.offerApplied = false;
    }

    // Add Razorpay settings based on user role
    if (user.constRoleId === 3) {
      // Seller
      cartData.razorpayForSellers = settings?.enableRazorpayForSellers || false;
    } else if (user.constRoleId === 1) {
      // Regular user
      cartData.razorpayForSellers = settings?.enableRazorpayForUser || false;
    } else {
      cartData.razorpayForSellers = false;
    }

    // Add COD limit for normal users
    if (user.constRoleId === 1) {
      cartData.codLimit = settings?.codLimit || 10000;
    }

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

    const cartType = user.constRoleId === 3 ? "bulk" : "selling";

    // Find or create cart
    let cart = await Cart.findOne({ userId, cartType });
    if (!cart) {
      cart = new Cart({ userId, cartType, items: [] });
    }

    // Check max quantity limit for normal users (constRoleId 1)
    if (user.constRoleId === 1) {
      // Get product maxQuantity if set
      const productMaxQty = product.maxQuantity;
      
      if (productMaxQty && productMaxQty > 0) {
        // Calculate total quantity for this specific product
        const existingItem = cart.items.find(item => item.productId.toString() === productId);
        const existingQuantity = existingItem ? (existingItem.originalQuantity || existingItem.quantity) : 0;
        const newQuantityForProduct = existingQuantity + Number(quantity);

        if (newQuantityForProduct > productMaxQty) {
          return res.status(400).json({
            success: false,
            message: `Cannot add ${quantity} items. Maximum ${productMaxQty} items allowed for this product. Current quantity: ${existingQuantity}.`,
          });
        }
      }
    }

    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId,
    );

    if (existingItemIndex > -1) {
      // Item exists in cart
      const existingItem = cart.items[existingItemIndex];
      
      // Check if BOGO is applied on this item
      const hasBOGO = existingItem.originalQuantity !== null && existingItem.originalQuantity !== undefined;
      
      let finalQuantity;
      if (hasBOGO) {
        // If BOGO is applied, add to originalQuantity
        finalQuantity = Number(existingItem.originalQuantity) + Number(quantity);
        existingItem.originalQuantity = finalQuantity;
        
        // Recalculate actual quantity with free items if BOGO offer exists
        if (cart.offerId) {
          const offer = await require("../../models/offers").findById(cart.offerId);
          if (offer && offer.offerType === "bogo") {
            const buyQty = offer.bogoConfig?.buyQuantity || 1;
            const getQty = offer.bogoConfig?.getQuantity || 1;
            
            if (finalQuantity >= buyQty) {
              existingItem.quantity = finalQuantity + getQty;
            } else {
              existingItem.quantity = finalQuantity;
              existingItem.originalQuantity = undefined;
            }
          }
        }
      } else {
        // No BOGO applied, normal quantity update
        finalQuantity = Number(existingItem.quantity) + Number(quantity);
        existingItem.quantity = finalQuantity;
      }

      // Recalculate price based on final quantity (use originalQuantity if BOGO)
      let price = Number(product.sellingPrice);
      let priceType = "selling";

      if (user.constRoleId === 3) {
        const quantityForPricing = hasBOGO ? Number(existingItem.originalQuantity) : finalQuantity;
        const bulkTier = product.bulkPrice?.find(
          (tier) =>
            quantityForPricing >= Number(tier.minQty) &&
            quantityForPricing <= Number(tier.maxQty),
        );

        if (bulkTier) {
          price = Number(bulkTier.price);
          priceType = "bulk";
        }
      }

      existingItem.price = price;
      existingItem.priceType = priceType;
    } else {
      // Add new item
      let price = Number(product.sellingPrice);
      let priceType = "selling";

      if (user.constRoleId === 3) {
        const bulkTier = product.bulkPrice?.find(
          (tier) =>
            Number(quantity) >= Number(tier.minQty) &&
            Number(quantity) <= Number(tier.maxQty),
        );

        if (bulkTier) {
          price = Number(bulkTier.price);
          priceType = "bulk";
        }
      }

      cart.items.push({
        productId,
        quantity,
        price,
        priceType,
      });
    }

    await cart.save();

    // Auto-apply best offer after cart update
    const populatedCart = await Cart.findById(cart._id).populate({
      path: "items.productId",
      select: "name image sku sellingPrice bulkPrice isActive",
    });

    const {
      calculateOrderTotals,
      findBestAutoApplyOffer,
    } = require("../../utils/orderTotals");

    // Only auto-apply if no manual offer ID is stored
    if (!cart.offerId) {
      try {
        // Find best auto-apply offer
        const bestOffer = await findBestAutoApplyOffer(
          populatedCart.totalAmount,
          populatedCart.items,
        );

        if (bestOffer) {
          cart.offerId = bestOffer._id;
          await cart.save();
        }
      } catch (error) {
        // Don't fail if offer calculation fails
        console.error("Error auto-applying offer:", error);
      }
    }

    // Return final cart with populated products
    const finalCart = await Cart.findById(cart._id).populate({
      path: "items.productId",
      select: "name image sku sellingPrice bulkPrice isActive",
    });

    res.json({
      success: true,
      message: "Item added to cart",
      data: finalCart,
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
    const user = await User.findById(userId).select("constRoleId");
    const cartType = user.constRoleId === 3 ? "bulk" : "selling";

    let cart = await Cart.findOne({
      userId,
      cartType,
    }).populate("offerId");

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
      // Check max quantity limit for normal users (constRoleId 1)
      if (user.constRoleId === 1) {
        // Get product maxQuantity if set
        const product = await Product.findById(productId).select("maxQuantity");
        const productMaxQty = product?.maxQuantity;
        
        if (productMaxQty && productMaxQty > 0) {
          if (Number(quantity) > productMaxQty) {
            return res.status(400).json({
              success: false,
              message: `Cannot update quantity. Maximum ${productMaxQty} items allowed for this product.`,
            });
          }
        }
      }

      const cartItem = cart.items[itemIndex];
      
      // Check if BOGO offer is applied on this item
      const hasBOGO = cartItem.originalQuantity !== null && cartItem.originalQuantity !== undefined;
      
      if (hasBOGO && cart.offerId) {
        // If BOGO is applied, update originalQuantity instead of actual quantity
        // This is the user's genuine change
        cartItem.originalQuantity = quantity;
        
        // Recalculate free items based on new originalQuantity
        const offer = cart.offerId;
        if (offer && offer.offerType === "bogo") {
          const buyQty = offer.bogoConfig?.buyQuantity || 1;
          const getQty = offer.bogoConfig?.getQuantity || 1;
          
          // Check if still eligible for BOGO
          if (quantity >= buyQty) {
            // Still eligible - add free items
            cartItem.quantity = quantity + getQty;
          } else {
            // Not eligible anymore - remove free items and clear originalQuantity
            cartItem.quantity = quantity;
            cartItem.originalQuantity = undefined;
          }
        }
      } else {
        // No BOGO applied, normal update
        cartItem.quantity = quantity;
      }

      // Recalculate price if needed
      const product = await Product.findById(productId);

      if (product && user) {
        let price = Number(product.sellingPrice);
        let priceType = "selling";

        if (user.constRoleId === 3) {
          const finalQuantity = Number(cartItem.originalQuantity || cartItem.quantity);

          const bulkTier = product.bulkPrice?.find(
            (tier) =>
              finalQuantity >= Number(tier.minQty) &&
              finalQuantity <= Number(tier.maxQty),
          );

          if (bulkTier) {
            price = Number(bulkTier.price);
            priceType = "bulk";
          }
        }

        cartItem.price = price;
        cartItem.priceType = priceType;
      }
    }

    await cart.save();

    // Return final cart with populated products
    const finalCart = await Cart.findById(cart._id).populate({
      path: "items.productId",
      select: "name image sku sellingPrice bulkPrice isActive",
    });

    res.json({
      success: true,
      message: "Cart updated",
      data: finalCart,
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
    const user = await User.findById(userId).select("constRoleId");

    const cartType = user.constRoleId === 3 ? "bulk" : "selling";

    let cart = await Cart.findOne({
      userId,
      cartType,
    });

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

    // Auto-apply best offer after cart update
    const populatedCart = await Cart.findById(cart._id).populate({
      path: "items.productId",
      select: "name image sku sellingPrice bulkPrice isActive",
    });

    const {
      calculateOrderTotals,
      findBestAutoApplyOffer,
    } = require("../../utils/orderTotals");

    // Only auto-apply if no manual offer ID is stored and cart has items
    if (!cart.offerId && cart.items.length > 0) {
      try {
        const user = await User.findById(userId).select("zoneId");

        // Find best auto-apply offer
        const bestOffer = await findBestAutoApplyOffer(
          populatedCart.totalAmount,
          populatedCart.items,
        );

        if (bestOffer) {
          cart.offerId = bestOffer._id;
          await cart.save();
        } else {
          // Clear offer if no longer applicable
          cart.offerId = null;
          await cart.save();
        }
      } catch (error) {
        // Don't fail if offer calculation fails
        console.error("Error auto-applying offer:", error);
      }
    } else if (cart.items.length === 0) {
      // Clear offers if cart is empty
      cart.offerId = null;
      await cart.save();
    }

    // Return final cart with populated products
    const finalCart = await Cart.findById(cart._id).populate({
      path: "items.productId",
      select: "name image sku sellingPrice bulkPrice isActive",
    });

    res.json({
      success: true,
      message: "Item removed from cart",
      data: finalCart,
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

    const user = await User.findById(userId).select("constRoleId");

    const cartType = user.constRoleId === 3 ? "bulk" : "selling";

    let cart = await Cart.findOne({
      userId,
      cartType,
    });

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
