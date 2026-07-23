# Bizyro Platform Upgrade (Backend + Admin Panel Only)

You are working on an existing production-ready MERN project.

This project already contains:

* Backend APIs
* Admin Panel
* Authentication
* Role based login
* Permissions
* Existing User module
* Existing Plans module
* Existing Billing module

Do NOT rewrite the existing architecture.

Do NOT replace existing authentication.

Do NOT create a new project.

Do NOT remove any existing APIs.

Only extend and improve the current codebase while keeping backward compatibility.

---

# Project Goal

Bizyro is becoming the central SaaS Platform.

Future products will include:

* FlyBiz
* AI Growth
* Google Business Profile (GMB)
* Billing
* Inventory
* HRMS
* Hospital
* School ERP
* and many more.

Every future product must plug into the same platform without changing the architecture.

Design everything to be scalable.

---

# Current Products

FlyBiz is already a separate application.

* Separate Backend
* Separate Database
* Separate Authentication
* Separate Users Collection

Do NOT modify FlyBiz.

Only prepare Bizyro to integrate with FlyBiz and future products.

---

# Panels

There will be only two web panels.

## Admin Panel

admin.bizyrotech.com

Current task:

Complete Backend APIs

Complete Admin Frontend

---

## Client Panel

client.bizyrotech.com

Do NOT create frontend.

Only prepare backend APIs for future use.

The APIs should already support this panel.

---

# Authentication

Current authentication already exists.

Update it instead of replacing it.

Current roles exist.

Keep them.

Current roles:

* admin
* user

Architecture must support future roles like:

* reseller
* sub reseller
* manager

without changing existing database structure.

---

# Login Rules

Admin can login into:

* Admin Panel
* Client Panel

Normal User can login only into:

* Client Panel

Normal User must never access Admin Panel.

Create middleware accordingly.

Example:

Admin Middleware

Client Middleware

Permission Middleware

Product Middleware

Do not duplicate authentication logic.

Reuse existing JWT.

---

# User Architecture

Keep two separate collections.

users

Stores platform users.

product_users

Stores product specific mapping.

Suggested structure:

Platform User

* basic profile
* login
* email
* phone
* role
* status

Product User

* platformUserId
* productId
* externalUserId
* subscription
* enabledFeatures
* permissions
* status
* metadata

Do not tightly couple products.

Future products must only create one mapping record.

---

# Products Module

Create complete CRUD.

Add Product

Edit Product

Delete Product

Get Products

Get Product Details

Status Toggle

Each product should support:

Name

Slug

Logo/Icon

Description

Short Description

Version

Status

Sort Order

Category

Is Featured

Feature List

Created At

Updated At

Products should be dynamic.

Nothing should be hardcoded.

---

# Product Features

Each product should support dynamic features.

Initially simple text-based feature management is acceptable.

Example:

AI Enabled

GMB Enabled

WhatsApp Enabled

Review Management

Analytics

Website Builder

Etc.

The structure should allow converting features into a separate module in future without breaking existing APIs.

---

# Plans

Plans already exist.

Update them.

Each Plan belongs to a Product.

Support:

Monthly

Quarterly

Yearly

Lifetime

Price

Offer Price

Limits

Features

Status

---

# Product Users

Create complete Product User management.

Assign Product

Remove Product

Suspend Product

Activate Product

Subscription Status

Plan

Expiry

Enabled Features

Permission Overrides

This collection should only map Platform User with Product User.

Do not duplicate product data.

---

# FlyBiz Integration

FlyBiz remains an independent application.

Registration happens inside FlyBiz.

After successful registration:

Sync user with Bizyro.

If Platform User exists

Reuse it.

Else create Platform User.

Create Product User mapping.

Do not copy unnecessary data.

Store only required references.

---

# Client APIs

Do not create frontend.

Only backend.

Create APIs for:

Current User

Purchased Products

Available Products

Subscriptions

Plans

Enabled Features

Permissions

Profile

Dashboard Summary

These APIs should be ready for future Client Panel.

---

# Admin Panel

Update existing Admin Panel.

Do not redesign everything.

Add new modules:

Products

Product Users

Product Features

Product Permissions

Subscriptions

Product Analytics (basic structure only)

Use existing UI architecture.

Use existing API calling pattern.

Reuse existing components whenever possible.

---

# Permissions

Permissions must work Product-wise.

Example:

FlyBiz

* View
* Assign
* Suspend

AI Growth

* View
* Assign
* Suspend

GMB

* View
* Assign
* Suspend

Permissions should be dynamic.

Never hardcode module names.

---

# API Design

Keep REST APIs consistent with existing project.

Reuse controllers.

Reuse services.

Reuse middleware.

Follow existing response format.

Do not introduce a different coding style.

---

# Database

Use existing MongoDB structure.

Create only required collections.

Avoid duplicate data.

Reference documents wherever possible.

Indexes should be added where required.

---

# Code Quality

Follow current folder structure.

Follow current naming convention.

Do not change existing APIs unless required.

Keep everything backward compatible.

Write production-ready code.

Avoid code duplication.

Keep services reusable.

Keep future products plug-and-play.

The entire architecture should support unlimited future SaaS products without requiring structural changes.
