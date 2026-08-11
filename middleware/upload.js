const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../assets/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// CSV imports are intentionally kept in memory: the file is parsed once and is
// never exposed as a public asset.
const csvUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const isCsv = file.mimetype === "text/csv" || /\.csv$/i.test(file.originalname);
    cb(isCsv ? null : new Error("Only CSV files are allowed"), isCsv);
  },
  limits: { fileSize: 2 * 1024 * 1024 },
});

// Used by the CSV workflow. The original filename is kept so an admin can put
// `image1.png` directly in the CSV. Reject duplicate names rather than
// silently overwriting a previously uploaded image.
const csvImageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const filename = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_");
    if (!filename || filename === ".") return cb(new Error("Invalid image filename"));
    if (fs.existsSync(path.join(uploadDir, filename))) {
      return cb(new Error(`An image named ${filename} already exists`));
    }
    return cb(null, filename);
  },
});

const csvImageUpload = multer({
  storage: csvImageStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 50 },
});

module.exports = upload;
module.exports.csvUpload = csvUpload;
module.exports.csvImageUpload = csvImageUpload;
