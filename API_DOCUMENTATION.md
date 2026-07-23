# Offer Management System - API Documentation

## Overview

The Offer Management System provides a unified approach to promotions, discounts, and special deals. **Coupons are now part of the offer system** - they are simply offers that require a coupon code.

### System Design Principles
- ✅ **Unified System**: One model for all promotions
- ✅ **Flexible Configuration**: Coupons, auto-apply offers, BOGO deals
- ✅ **Simplified**: Only 3 offer types (flat, percentage, BOGO)
- ✅ **Product-Specific**: Target specific products or entire cart
- ✅ **Permission-Based**: View and manage permissions

---

## 🎯 Supported Offer Types

### 1. Flat Discount
Fixed amount off the cart or specific products.
```json
{
  "offerType": "flat_discount",
  "discountValue": 100
}
```

### 2. Percentage Discount
Percentage off with optional maximum discount cap.
```json
{
  "offerType": "percentage_discount",
  "discountValue": 10,
  "maxDiscountAmount": 500
}
```

### 3. Buy One Get One (BOGO)
Classic BOGO promotion.
```json
{
  "offerType": "bogo",
  "bogoConfig": {
    "buyQuantity": 1,
    "getQuantity": 1,
    "applyOn": "same_product"
  }
}
```

---

## 🔑 Key Concepts

### Coupon vs Auto-Apply
- **Coupon Offer**: `requiresCoupon: true` + `couponCode: "SAVE10"`
- **Auto-Apply Offer**: `requiresCoupon: false` + `autoApply: true`

### Applicability
- **Cart-wide**: `applicableOn: "cart"` - Applies to entire cart
- **Product-specific**: `applicableOn: "specific_products"` + `specificProducts: [...]`

### Conditions
- `minCartValue`: Minimum cart value required
- `startDate` / `endDate`: Validity period
- `maxUsagePerUser`: Usage limit per user
- `totalUsageLimit`: Total usage limit
- `priority`: Evaluation priority (higher = first)

---

## 📡 API Endpoints

### Admin Panel Endpoints

#### Get All Offers
```http
GET /offers
Authorization: Bearer {token}
Permission: offers:view
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "Summer Sale",
      "offerType": "percentage_discount",
      "requiresCoupon": false,
      "discountValue": 15,
      "applicableOn": "cart",
      "isActive": true,
      "startDate": "2024-06-01",
      "endDate": "2024-08-31"
    }
  ]
}
```

#### Get Single Offer
```http
GET /offers/:id
Authorization: Bearer {token}
Permission: offers:view
```

#### Create Offer
```http
POST /offers
Authorization: Bearer {token}
Permission: offers:manage
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "New Year Special",
  "description": "Get 20% off on all products",
  "offerType": "percentage_discount",
  "requiresCoupon": true,
  "couponCode": "NEWYEAR2024",
  "discountValue": 20,
  "maxDiscountAmount": 1000,
  "applicableOn": "cart",
  "minCartValue": 500,
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "priority": 10,
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Offer created successfully",
  "data": { /* offer object */ }
}
```

#### Update Offer
```http
PUT /offers/:id
Authorization: Bearer {token}
Permission: offers:manage
Content-Type: application/json
```

**Request Body:** Same as create (partial updates supported)

#### Delete Offer
```http
DELETE /offers/:id
Authorization: Bearer {token}
Permission: offers:manage
```

**Response:**
```json
{
  "success": true,
  "message": "Offer deleted successfully"
}
```

### Product Selection Endpoint

#### Get Products for Selection
```http
GET /products/selection
Authorization: Bearer {token}
Permission: products:view
Query Parameters:
  - search: string (optional) - Search by product name
  - limit: number (default: 50) - Max results
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "product_id",
      "name": "Premium Biscuit Pack",
      "image": "/assets/uploads/product.jpg",
      "price": 250
    }
  ]
}
```

---

### Mobile App Endpoints

#### Get Active Offers
```http
GET /app/offers
```

Returns all currently active offers (auto-apply and coupon-based).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "Summer Sale",
      "description": "Get 15% off on all products",
      "offerType": "percentage_discount",
      "requiresCoupon": false,
      "discountValue": 15,
      "minCartValue": 0,
      "endDate": "2024-08-31"
    }
  ]
}
```

#### Apply Offer to Cart
```http
POST /app/offers/apply
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "couponCode": "SAVE10"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Offer applied successfully",
  "data": {
    "offerId": "...",
    "offerCode": "SAVE10",
    "discountAmount": 50,
    "cartSummary": {
      "subtotal": 500,
      "discount": 50,
      "deliveryCharge": 40,
      "total": 490
    }
  }
}
```

#### Validate Coupon Code
```http
GET /app/offers/validate/:code
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "valid": true,
  "offer": {
    "id": "...",
    "name": "Save 10%",
    "discountValue": 10,
    "minCartValue": 200
  }
}
```

#### Remove Offer from Cart
```http
PUT /app/offers/remove
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Offer removed successfully"
}
```

---

## 🔐 Permissions

### New Permission Structure

**Simplified to 2 permissions:**

| Permission | Description |
|-----------|-------------|
| `offers:view` | View offers list and details |
| `offers:manage` | Create, edit, delete offers |

**Removed permissions:**
- ❌ `offers:create` (now part of manage)
- ❌ `offers:edit` (now part of manage)
- ❌ `offers:delete` (now part of manage)
- ❌ `settings:*` (Settings module removed)

---

## 🗑️ Removed/Deprecated

### Coupon System (Completely Removed)
- ❌ `/coupons` endpoints
- ❌ `CouponController`
- ❌ `Coupon` model
- ❌ `couponService` (frontend)
- ❌ `CouponManagementPage` (frontend)

**Migration:** Use offers with `requiresCoupon: true`

### Settings System (Completely Removed)
- ❌ `/settings` endpoints (admin panel)
- ❌ `SettingsPage` (frontend)
- ❌ `settingsService` (frontend)

---

## 📝 Data Model

### Offer Schema

```javascript
{
  name: String (required),
  description: String,
  offerType: Enum ["flat_discount", "percentage_discount", "bogo"],
  
  // Coupon Configuration
  requiresCoupon: Boolean (default: false),
  couponCode: String (uppercase, unique when set),
  
  // Discount Configuration
  discountValue: Number,
  maxDiscountAmount: Number,
  
  // BOGO Configuration
  bogoConfig: {
    buyQuantity: Number,
    getQuantity: Number,
    applyOn: Enum ["same_product", "cheapest", "free_product"],
    freeProductId: ObjectId (ref: products)
  },
  
  // Applicability
  applicableOn: Enum ["cart", "specific_products", "category"],
  specificProducts: [ObjectId] (ref: products),
  specificCategories: [ObjectId] (ref: categories),
  
  // Conditions
  minCartValue: Number (default: 0),
  maxUsagePerUser: Number,
  totalUsageLimit: Number,
  currentUsageCount: Number (default: 0),
  
  // Validity
  startDate: Date (required),
  endDate: Date,
  
  // Behavior
  priority: Number (default: 0),
  isStackable: Boolean (default: false),
  autoApply: Boolean (default: false),
  isActive: Boolean (default: true),
  
  timestamps: true
}
```

### Field Changes from Previous Version
- ❌ Removed: `minQuantity`
- ❌ Removed: `buy_x_get_y`, `combo`, `free_product` offer types
- ✅ Kept: All other fields

---

## 🧪 Example Use Cases

### Use Case 1: Flat ₹100 Off Coupon
```json
{
  "name": "Flat 100 Off",
  "offerType": "flat_discount",
  "requiresCoupon": true,
  "couponCode": "FLAT100",
  "discountValue": 100,
  "applicableOn": "cart",
  "minCartValue": 500,
  "startDate": "2024-01-01",
  "isActive": true
}
```

### Use Case 2: Auto-Apply 10% Off
```json
{
  "name": "Welcome 10%",
  "offerType": "percentage_discount",
  "requiresCoupon": false,
  "autoApply": true,
  "discountValue": 10,
  "maxDiscountAmount": 200,
  "applicableOn": "cart",
  "minCartValue": 1000,
  "startDate": "2024-01-01",
  "isActive": true
}
```

### Use Case 3: Product-Specific BOGO
```json
{
  "name": "BOGO on Premium Pack",
  "offerType": "bogo",
  "requiresCoupon": false,
  "autoApply": true,
  "applicableOn": "specific_products",
  "specificProducts": ["product_id_123"],
  "bogoConfig": {
    "buyQuantity": 1,
    "getQuantity": 1,
    "applyOn": "same_product"
  },
  "startDate": "2024-01-01",
  "isActive": true
}
```

---

## 🚀 Migration from Old System

### If You Had Coupons Before

**Old Coupon:**
```json
{
  "code": "SAVE10",
  "type": "percentage",
  "value": 10,
  "minOrderAmount": 500
}
```

**New Offer Equivalent:**
```json
{
  "name": "Save 10%",
  "offerType": "percentage_discount",
  "requiresCoupon": true,
  "couponCode": "SAVE10",
  "discountValue": 10,
  "applicableOn": "cart",
  "minCartValue": 500,
  "startDate": "2024-01-01",
  "isActive": true
}
```

---

## ✅ Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (no token) |
| 403 | Forbidden (no permission) |
| 404 | Not Found |
| 500 | Server Error |

---

## 📚 Related Documentation

- Frontend implementation: See `OfferManagementPage.tsx`
- Permission system: See `constants/permissions.js`
- Complete changes: See `FILE_CHANGES_SUMMARY.md`

---

**Last Updated:** After Refactoring - Coupons Removed, Settings Removed, Offer Types Simplified