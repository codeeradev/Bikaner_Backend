# Bikaner Biscuit - Admin Panel API Documentation

Base URL: `http://localhost:9020/api`

---

## 📦 CATEGORY ENDPOINTS

### 1. Get All Categories
**GET** `/categories`

**Query Parameters:**
- `isActive` (optional): Filter by status - `true` or `false`
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "category_id",
      "name": "Cookies",
      "image": "image_url",
      "description": "Delicious cookies",
      "sortOrder": 1,
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "totalPages": 5,
  "currentPage": 1,
  "total": 50
}
```

---

### 2. Get Single Category
**GET** `/categories/:id`

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "category_id",
    "name": "Cookies",
    "image": "image_url",
    "description": "Delicious cookies",
    "sortOrder": 1,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### 3. Create Category
**POST** `/categories`

**Request Body:**
```json
{
  "name": "Cookies",
  "image": "image_url",
  "description": "Delicious cookies",
  "sortOrder": 1,
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Category created successfully",
  "data": {
    "_id": "category_id",
    "name": "Cookies",
    "image": "image_url",
    "description": "Delicious cookies",
    "sortOrder": 1,
    "isActive": true
  }
}
```

---

### 4. Update Category
**PUT** `/categories/:id`

**Request Body:**
```json
{
  "name": "Updated Cookies",
  "image": "new_image_url",
  "description": "Updated description",
  "sortOrder": 2,
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Category updated successfully",
  "data": {
    "_id": "category_id",
    "name": "Updated Cookies",
    "image": "new_image_url",
    "description": "Updated description",
    "sortOrder": 2,
    "isActive": true
  }
}
```

---

### 5. Delete Category
**DELETE** `/categories/:id`

**Response:**
```json
{
  "success": true,
  "message": "Category deleted successfully"
}
```

---

### 6. Toggle Category Status
**PATCH** `/categories/:id/toggle-status`

**Response:**
```json
{
  "success": true,
  "message": "Category activated successfully",
  "data": {
    "_id": "category_id",
    "name": "Cookies",
    "isActive": true
  }
}
```

---

## 🏙️ CITY ENDPOINTS

### 1. Get All Cities
**GET** `/cities`

**Query Parameters:**
- `isActive` (optional): Filter by status - `true` or `false`
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "city_id",
      "name": "Jaipur",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "totalPages": 3,
  "currentPage": 1,
  "total": 25
}
```

---

### 2. Get Single City
**GET** `/cities/:id`

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "city_id",
    "name": "Jaipur",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### 3. Get City with Zones
**GET** `/cities/:id/zones`

**Response:**
```json
{
  "success": true,
  "data": {
    "city": {
      "_id": "city_id",
      "name": "Jaipur",
      "isActive": true
    },
    "zones": [
      {
        "_id": "zone_id",
        "cityId": "city_id",
        "name": "Malviya Nagar",
        "code": "JA001",
        "deliveryCharge": 50,
        "minimumOrderAmount": 200,
        "estimatedDeliveryTime": 60,
        "isActive": true
      }
    ]
  }
}
```

---

### 4. Create City
**POST** `/cities`

**Request Body:**
```json
{
  "name": "Jaipur",
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "City created successfully",
  "data": {
    "_id": "city_id",
    "name": "Jaipur",
    "isActive": true
  }
}
```

---

### 5. Update City
**PUT** `/cities/:id`

**Request Body:**
```json
{
  "name": "Updated Jaipur",
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "City updated successfully",
  "data": {
    "_id": "city_id",
    "name": "Updated Jaipur",
    "isActive": true
  }
}
```

---

### 6. Delete City
**DELETE** `/cities/:id`

**Response:**
```json
{
  "success": true,
  "message": "City deleted successfully"
}
```

**Note:** Cannot delete a city if it has zones associated with it.

---

### 7. Toggle City Status
**PATCH** `/cities/:id/toggle-status`

**Response:**
```json
{
  "success": true,
  "message": "City activated successfully",
  "data": {
    "_id": "city_id",
    "name": "Jaipur",
    "isActive": true
  }
}
```

---

## 📍 ZONE ENDPOINTS

### 1. Get All Zones
**GET** `/zones`

**Query Parameters:**
- `cityId` (optional): Filter by city ID
- `isActive` (optional): Filter by status - `true` or `false`
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "zone_id",
      "cityId": {
        "_id": "city_id",
        "name": "Jaipur"
      },
      "name": "Malviya Nagar",
      "code": "JA001",
      "deliveryCharge": 50,
      "minimumOrderAmount": 200,
      "estimatedDeliveryTime": 60,
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "totalPages": 4,
  "currentPage": 1,
  "total": 35
}
```

---

### 2. Get Zones by City
**GET** `/zones/city/:cityId`

**Query Parameters:**
- `isActive` (optional): Filter by status - `true` or `false`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "zone_id",
      "cityId": {
        "_id": "city_id",
        "name": "Jaipur"
      },
      "name": "Malviya Nagar",
      "code": "JA001",
      "deliveryCharge": 50,
      "minimumOrderAmount": 200,
      "estimatedDeliveryTime": 60,
      "isActive": true
    }
  ],
  "total": 5
}
```

---

### 3. Get Single Zone
**GET** `/zones/:id`

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "zone_id",
    "cityId": {
      "_id": "city_id",
      "name": "Jaipur"
    },
    "name": "Malviya Nagar",
    "code": "JA001",
    "deliveryCharge": 50,
    "minimumOrderAmount": 200,
    "estimatedDeliveryTime": 60,
    "isActive": true
  }
}
```

---

### 4. Create Zone
**POST** `/zones`

**Request Body:**
```json
{
  "cityId": "city_id",
  "name": "Malviya Nagar",
  "code": "JA001",
  "deliveryCharge": 50,
  "minimumOrderAmount": 200,
  "estimatedDeliveryTime": 60,
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Zone created successfully",
  "data": {
    "_id": "zone_id",
    "cityId": {
      "_id": "city_id",
      "name": "Jaipur"
    },
    "name": "Malviya Nagar",
    "code": "JA001",
    "deliveryCharge": 50,
    "minimumOrderAmount": 200,
    "estimatedDeliveryTime": 60,
    "isActive": true
  }
}
```

---

### 5. Update Zone
**PUT** `/zones/:id`

**Request Body:**
```json
{
  "name": "Updated Malviya Nagar",
  "code": "JA001A",
  "deliveryCharge": 60,
  "minimumOrderAmount": 250,
  "estimatedDeliveryTime": 45,
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Zone updated successfully",
  "data": {
    "_id": "zone_id",
    "cityId": {
      "_id": "city_id",
      "name": "Jaipur"
    },
    "name": "Updated Malviya Nagar",
    "code": "JA001A",
    "deliveryCharge": 60,
    "minimumOrderAmount": 250,
    "estimatedDeliveryTime": 45,
    "isActive": true
  }
}
```

---

### 6. Delete Zone
**DELETE** `/zones/:id`

**Response:**
```json
{
  "success": true,
  "message": "Zone deleted successfully"
}
```

---

### 7. Toggle Zone Status
**PATCH** `/zones/:id/toggle-status`

**Response:**
```json
{
  "success": true,
  "message": "Zone activated successfully",
  "data": {
    "_id": "zone_id",
    "name": "Malviya Nagar",
    "isActive": true
  }
}
```

---

## 🔒 Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation error message"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error description"
}
```

---

## 📝 Notes

1. All timestamps are in ISO 8601 format
2. Pagination is available on list endpoints
3. All IDs are MongoDB ObjectIds
4. Zone names must be unique within a city
5. City names must be unique globally
6. Cannot delete a city that has zones associated with it
7. The `sortOrder` field in categories determines display order (lower numbers first)
8. `estimatedDeliveryTime` is in minutes
9. `deliveryCharge` and `minimumOrderAmount` are in your currency units
