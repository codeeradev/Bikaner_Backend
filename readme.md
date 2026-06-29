Implement a complete **dynamic Role-Based Access Control (RBAC)** system for both the **Admin Panel** and **Backend**.

### General Requirements

* Roles are **dynamic**. The admin can create, edit, and delete roles in the future.
* Permissions are assigned **only to roles**, never directly to users.
* admin role is not editable it is disbaled and also not
* The system must be scalable so new roles and permissions work automatically without code changes.
* For now, keep these default roles in mind:

  * Admin
  * Franchise
* More roles will be created later by the admin.

### Admin Panel

* **Admin** has full access to everything.
* **Franchise** can only access the menus, pages, APIs, and actions that the assigned role permissions allow.
* Permissions must be dynamic (not hardcoded).
* Support permissions such as:

  * View
  * Add
  * Edit
  * Delete
* **View** permission controls whether a sidebar menu and page are visible.
* **Add/Edit/Delete** permissions control both:

  * Backend authorization
  * Frontend UI (hide/show Add, Edit, Delete buttons accordingly).
* Protect routes on both frontend and backend. Users should never be able to bypass permissions by calling APIs directly.

### User App

Only two roles exist here:

* User

* Seller

* **User** behaves as a normal customer.

* **Seller** can:

  * View products that are available for sellers.
  * View seller pricing.
  * Create bulk product requests.

* No dynamic roles are required in the User App.

### Backend

* Create reusable RBAC middleware.
* Every protected API must validate role permissions before executing.
* Never rely only on frontend checks.
* Keep the implementation modular, reusable, and easy to extend with future roles and permissions.

Use the existing project structure where possible and avoid hardcoded role names or permission checks except for the default Admin full-access behavior.
