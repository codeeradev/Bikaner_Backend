const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { generateSlug } = require("../utils/slugify");

/**
 * Franchise Schema
 * ------------------------------------------------------------------
 * A Franchise is a physical store, run by a Store Manager, that Admin
 * creates on the manager's behalf (no public sign-up flow exists).
 *
 * * Passwords are hashed automatically in the pre("save") hook below —
 * * controllers should NEVER hash the password themselves; just assign
 * * the plain-text value and call .save(), same contract as most
 * * password-owning models.
 * ------------------------------------------------------------------
 */
const franchiseSchema = new mongoose.Schema(
  {
    // -- Store identity -------------------------------------------------
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // URL-safe identifier used on the admin detail page instead of the
    // raw Mongo _id (e.g. /franchise/pizza-hut-mg-road). Generated once
    // from `name` in the pre("validate") hook below and never changed
    // afterwards, so existing links/bookmarks never break.
    slug: {
      type: String,
      unique: true,
      sparse: true, // legacy stores created before this field existed
      // have slug: undefined until scripts/backfillFranchiseSlugs.js runs
      trim: true,
    },

    address: {
      type: String,
      required: true,
      trim: true,
    },

    cityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "cities",
      required: true,
    },

    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "zones",
      required: true,
    },

    lat: {
      type: Number,
      required: true,
    },

    lng: {
      type: Number,
      required: true,
    },

    // -- Store-manager login ---------------------------------------------
    managerName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      select: false, // ! never return the hash by default — opt in with .select("+password")
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    // -- Lifecycle ---------------------------------------------------------
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

    // * Push token for the (future) store-manager app. Left unused until
    // * that app exists and registers a device — see franchiseNotificationController.
    fcmToken: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Fast lookups for the admin list page (status filter) and login (email).
franchiseSchema.index({ status: 1, createdAt: -1 });

/**
 * Generate a unique slug from `name` the first time a store is saved.
 * Runs on create AND whenever scripts/backfillFranchiseSlugs.js calls
 * .save() on a legacy document that has no slug yet.
 *
 * Deliberately never regenerates once a slug exists — even if the admin
 * later renames the store — so a bookmarked/shared detail-page URL
 * keeps working. pre("validate") (not "save") so a duplicate-slug
 * collision surfaces as a normal Mongoose validation error before any
 * write is attempted.
 */
franchiseSchema.pre("validate", async function generateUniqueSlug() {
  if (this.slug) return;
  if (!this.name) return; // let the `required` validator report this instead

  const baseSlug = generateSlug(this.name);
  let candidate = baseSlug;
  let suffix = 2;

  // Keep trying candidate-2, candidate-3, ... until we find one that's
  // free. Excludes this document's own _id so re-validating an existing
  // doc (e.g. during backfill) never collides with itself.
  while (
    await this.constructor.findOne({
      slug: candidate,
      _id: { $ne: this._id },
    })
  ) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  this.slug = candidate;
});

/**
 * Hash the password whenever it is set or changed.
 * Runs on create AND on `PUT /franchises/:id` password-reset updates,
 * as long as the controller loads the document and calls .save()
 * rather than using findByIdAndUpdate() directly on the password field.
 */
franchiseSchema.pre("save", async function hashPasswordBeforeSave() {
  if (!this.isModified("password")) return;

  const SALT_ROUNDS = 10;
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  // No try/catch + next(error) needed: an async pre-hook that throws
  // (or whose returned promise rejects) automatically fails the save —
  // Mongoose does NOT pass a `next` callback into async hooks, so
  // declaring one and calling it here would throw
  // "TypeError: next is not a function" on every save.
});

/**
 * Compare a plain-text candidate password against the stored hash.
 * @param {string} candidatePassword - Password submitted at login.
 * @returns {Promise<boolean>}
 */
franchiseSchema.methods.comparePassword = function comparePassword(
  candidatePassword,
) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("franchises", franchiseSchema);
