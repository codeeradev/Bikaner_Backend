# Bikaner Biscuit API Documentation

## App User APIs (Mobile/Web App)

Base URL: `/api`

### Authentication APIs

#### 1. Register New User
```
POST /api/auth/register
```

**Request Body:**
```json
{
  "name": "John Doe",
  "mobile": "9876543210",
  "email": "john@example.com",  // Optional
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful",
  "token": "jwt_token_here",
  "refreshToken": "refresh_token_here",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "mobile": "9876543210",
    "role": "User",
    "constRoleId": 1,
    "status": "active"
  }
}
```

#### 2. Login
```
POST /api/auth/login
```

**Request Body:**
```json
{
  "mobile": "9876543210",  // OR "email": "john@example.com"
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "jwt_token_here",
  "refreshToken": "refresh_token_here",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "mobile": "9876543210",
    "role": "User",
    "constRoleId": 1,
    "cityId": "city_id",
    "lat": 28.6139,
    "lng": 77.2090,
    "status": "active"
  }
}
```

#### 3. Refresh Token
```
POST /api/auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "refresh_token_here"
}
```

**Response:**
```json
{
  "success": true,
  "token": "new_jwt_token",
  "refreshToken": "new_refresh_token"
}
```

#### 4. Get Profile
```
GET /api/auth/profile
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "mobile": "9876543210",
    "role": {
      "name": "User"
    },
    "constRoleId": 1,
    "cityId": {
      "name": "New Delhi"
    },
    "lat": 28.6139,
    "lng": 77.2090,
    "status": "active"
  }
}
```

#### 5. Update Profile
```
PUT /api/auth/profile
Authorization: Bearer {token}
Content-Type: multipart/form-data (if uploading image)
```

**Request Body:**
```json
{
  "name": "John Doe Updated",
  "email": "newemail@example.com",
  "currentPassword": "oldpass123",  // Required if changing password
  "newPassword": "newpass456",       // Optional
  "lat": 28.6139,
  "lng": 77.2090
}
```

### Product APIs

#### 6. Get All Products
```
GET /api/products?page=1&limit=10&search=biscuit&isFeatured=true&categoryId=category_id
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Products fetched successfully",
  "total": 100,
  "page": 1,
  "limit": 10,
  "data": [
    {
      "id": "product_id",
      "name": "Premium Biscuits",
      "image": "/assets/products/image.jpg",
      "sku": "BIS001",
      "mrp": 100,
      "sellingPrice": 80,
      "bulkPrice": 70,
      "displayPrice": 80,         // User sees sellingPrice
      "priceType": "selling",     // "selling" or "bulk"
      "minBulkQty": 10,
      "stock": 500,
      "isFeatured": true,
      "categoryId": {
        "name": "Premium Biscuits"
      }
    }
  ]
}
```

**Note:** `displayPrice` depends on user's `constRoleId`:
- User (constRoleId: 1) → sees `sellingPrice`
- Seller (constRoleId: 3) → sees `bulkPrice` (if quantity >= minBulkQty)

#### 7. Get Products by Category
```
GET /api/products/category/:categoryId
Authorization: Bearer {token}
```

#### 8. Get Single Product
```
GET /api/products/:productId
Authorization: Bearer {token}
```

### Cart APIs

#### 9. Get Cart
```
GET /api/cart
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cart_id",
    "userId": "user_id",
    "items": [
      {
        "productId": {
          "id": "product_id",
          "name": "Premium Biscuits",
          "image": "/assets/products/image.jpg",
          "sellingPrice": 80,
          "bulkPrice": 70
        },
        "quantity": 5,
        "price": 80,
        "priceType": "selling"
      }
    ],
    "totalAmount": 400,
    "totalItems": 5
  }
}
```

#### 10. Add to Cart
```
POST /api/cart
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "productId": "product_id",
  "quantity": 5
}
```

**Note:** Price is automatically determined based on user's `constRoleId` and quantity.

#### 11. Update Cart Item
```
PUT /api/cart
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "productId": "product_id",
  "quantity": 10  // Set to 0 or negative to remove item
}
```

#### 12. Remove from Cart
```
DELETE /api/cart/:productId
Authorization: Bearer {token}
```

#### 13. Clear Cart
```
DELETE /api/cart
Authorization: Bearer {token}
```

### Order APIs

#### 14. Create Order
```
POST /api/orders
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "deliveryAddress": {
    "name": "John Doe",
    "mobile": "9876543210",
    "address": "123 Main St, Sector 15",
    "cityId": "city_id",
    "zoneId": "zone_id",     // Optional, for delivery charge calculation
    "lat": 28.6139,
    "lng": 77.2090
  },
  "notes": "Please deliver before 5 PM"  // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "id": "order_id",
    "orderNumber": "ORD2401151234",
    "userId": "user_id",
    "items": [...],
    "totalAmount": 1000,
    "deliveryCharge": 50,
    "grandTotal": 1050,
    "orderType": "normal",      // "normal" or "bulk"
    "paymentStatus": "pending",
    "orderStatus": "pending",
    "deliveryAddress": {...},
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

#### 15. Get Orders
```
GET /api/orders?page=1&limit=10&orderType=bulk&orderStatus=pending&paymentStatus=paid
Authorization: Bearer {token}
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `orderType`: Filter by "normal" or "bulk"
- `orderStatus`: Filter by status (pending, confirmed, processing, packed, shipped, delivered, cancelled)
- `paymentStatus`: Filter by payment status (pending, paid, failed, refunded)

#### 16. Get Order Details
```
GET /api/orders/:orderId
Authorization: Bearer {token}
```

#### 17. Cancel Order
```
PUT /api/orders/:orderId/cancel
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "cancelReason": "Changed my mind"  // Optional
}
```

### Seller APIs

#### 18. Become a Seller
```
POST /api/seller/become
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "name": "ABC Trading Company",
  "mobile": "9876543210",
  "email": "abc@example.com",
  "gst": "22AAAAA0000A1Z5",    // Optional
  "address": "123 Business Park, Sector 18",
  "cityId": "city_id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "You are now a seller! You can now place bulk orders.",
  "data": {
    "id": "user_id",
    "name": "ABC Trading Company",
    "email": "abc@example.com",
    "mobile": "9876543210",
    "role": {
      "name": "Seller"
    },
    "constRoleId": 3,
    "cityId": {
      "name": "New Delhi"
    }
  }
}
```

**Note:** This upgrades a User (constRoleId: 1) to Seller (constRoleId: 3). After becoming a seller, user can:
- See bulk prices on products
- Place bulk orders
- Access bulk order history

#### 19. Get Bulk Orders (Seller Only)
```
GET /api/seller/bulk-orders?page=1&limit=10&status=pending
Authorization: Bearer {token}
```

### Public APIs (No Authentication Required)

#### 20. Get Active Banners
```
GET /api/banners
```

#### 21. Get Active Categories
```
GET /api/categories
```

#### 22. Get Active Zones
```
GET /api/zones
```

## User Role System

### Role Constants (constRoleId)

1. **User** (constRoleId: 1)
   - Regular app users
   - Can browse products, add to cart, place normal orders
   - See `sellingPrice` on products

2. **Seller** (constRoleId: 3)
   - Bulk buyers / B2B customers
   - Can place bulk orders
   - See `bulkPrice` on products (when quantity >= minBulkQty)
   - Users can become sellers via `/api/seller/become` endpoint

3. **Admin** (constRoleId: 4)
   - Admin panel users only
   - Cannot access app APIs

## Order Type Determination

- **Normal Order**: All items in cart use `sellingPrice`
- **Bulk Order**: At least one item in cart uses `bulkPrice`

Bulk pricing applies when:
- User is Seller (constRoleId: 3) AND
- Quantity >= product's `minBulkQty`

## Error Responses

All APIs follow consistent error response format:

```json
{
  "success": false,
  "message": "Error message here",
  "error": "Detailed error (in development)"
}
```

**Common HTTP Status Codes:**
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized (missing/invalid token)
- 403: Forbidden (insufficient permissions)
- 404: Not Found
- 500: Internal Server Error

## Authentication

All protected endpoints require JWT token in Authorization header:

```
Authorization: Bearer {your_jwt_token}
```

Token expires in 24 hours by default. Use refresh token to get new token without re-login.
