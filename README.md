# Bikaner_Backend
Bro, you've only created the RBAC structure. It is **not actually integrated** into the application yet. I need you to **fully implement** it, not just create the models and APIs.

### Complete Integration Required

1. Integrate the **Role Management CRUD** into the Admin Panel using the backend APIs.
2. Integrate **Staff Management** so every staff member is assigned a role from the Role dropdown.
3. Integrate the **login flow** so that after login the backend returns:

   * User details
   * Assigned role
   * All permissions of that role
4. Store these permissions in the frontend after login.

### Dynamic Sidebar

The sidebar must be generated based on the logged-in user's permissions.

Example:

* `PRODUCT_VIEW` → Show Products menu.
* `CATEGORY_VIEW` → Show Categories menu.
* No `*_VIEW` permission → Don't show the menu and don't allow access to the page.

### Dynamic Action Buttons

Buttons must also depend on permissions.

Examples:

* `PRODUCT_ADD` → Show Add button.
* `PRODUCT_EDIT` → Show Edit button.
* `PRODUCT_DELETE` → Show Delete button.

If the permission doesn't exist:

* Hide the button.
* Prevent the action even if someone manually calls the API.

### Route Protection

Protect every frontend route.

If a user doesn't have the required `*_VIEW` permission:

* Redirect them to an Unauthorized page or Dashboard.
* They should never be able to access the page by typing the URL manually.

### Backend Authorization

Protect every API using the RBAC middleware.

Every API must validate the required permission before executing.

Example:

* Create Product → `PRODUCT_ADD`
* Update Product → `PRODUCT_EDIT`
* Delete Product → `PRODUCT_DELETE`
* Product List → `PRODUCT_VIEW`

Never rely only on frontend permission checks.

### Admin Role

* Admin always has full access.
* Admin role cannot be edited.
* Admin role cannot be deleted.
* Admin role cannot be assigned to staff members.

### Final Requirement

I don't want only the Role APIs or UI screens. I want the **entire project** to use the RBAC system end-to-end:

* Login
* Sidebar
* Route Guards
* Page Access
* CRUD Buttons
* API Authorization
* Staff Role Assignment

Every module in the application must automatically respect the assigned role permissions.
