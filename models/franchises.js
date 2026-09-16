const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

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
