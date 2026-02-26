import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import categoryRoutes from "./routes/adminCategories.js";
import adminProducts from "./routes/adminProducts.js";
import Product from "./models/Product.js";
import Category from "./models/Category.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// --- Cloudinary + Multer config ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
});

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// --- Auth middleware (MUST be before routes) ---
const requireAuth = (req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// --- Database connection ---
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4, // Force IPv4
      ssl: true,
      retryWrites: true,
    });
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.error('💡 Make sure your IP is whitelisted in MongoDB Atlas:');
    console.error('   https://cloud.mongodb.com/ → Security → Network Access');
    // Retry after 5 seconds
    setTimeout(connectDB, 5000);
  }
};

await connectDB();

// --- Admin schema ---
const adminSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  passwordHash: String,
}, { timestamps: true });

const Admin = mongoose.model('Admin', adminSchema);

// --- Auto-seed admin on startup ---
const seedAdmin = async () => {
  try {
    const username = 'gumtreeply';
    const password = 'gumtre#001';
    const exists = await Admin.findOne({ username });
    if (!exists) {
      const passwordHash = await bcrypt.hash(password, 10);
      await Admin.create({ username, passwordHash });
      console.log('✅ Admin user created: gumtreeply / gumtre#001');
    } else {
      console.log('✅ Admin user already exists');
    }
  } catch (err) {
    console.error('Error seeding admin:', err.message);
  }
};

seedAdmin();

// --- Routes ---
app.use("/api/admin/categories", requireAuth, categoryRoutes);
app.use("/api/admin/products", requireAuth, adminProducts);

// Public category endpoint
app.get("/api/categories", async (req, res) => {
  try {
    const cats = await Category.find().sort({ createdAt: -1 });
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/products", async (req, res) => {
  const { category } = req.query;
  const q = category ? { category } : {};
  const items = await Product.find(q).sort({ createdAt: -1 });
  res.json(items);
});
const messageSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  message: String,
}, { timestamps: true });

const chatSchema = new mongoose.Schema({
  sessionId: String,
  role: { type: String, enum: ['user','bot'] },
  text: String,
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);
const ChatMessage = mongoose.model('ChatMessage', chatSchema);

app.post('/api/contact', async (req, res) => {
  const { name, email, phone, message } = req.body;
  if (!name || !message) return res.status(400).json({ error: 'Name and message are required' });
  const doc = await Message.create({ name, email, phone, message });
  res.json({ ok: true, id: doc._id });
});

// Chat (simple FAQ style)
app.post('/api/chat', async (req, res) => {
  const { sessionId, text } = req.body;
  if (!sessionId || !text) return res.status(400).json({ error: 'sessionId and text are required' });
  await ChatMessage.create({ sessionId, role: 'user', text });
  let reply = 'Thanks for reaching out! Our team will get back soon.';
  const t = text.toLowerCase();
  if (t.includes('price') || t.includes('rate')) reply = 'Pricing varies by grade and thickness. Share quantities & location to get today\'s best cash quote.';
  if (t.includes('door') || t.includes('flush')) reply = 'We manufacture Flush Doors in 25/30/32/35mm. IS:2202 compliant. Want a spec sheet?';
  if (t.includes('block')) reply = 'Our Block Boards are lightweight and stable, popular for shutters and long panels.';
  if (t.includes('ply') && (t.includes('bwr') || t.includes('bwp') || t.includes('mr'))) reply = 'We offer MR, BWR and BWP/Marine ply with multiple thickness options.';
  await ChatMessage.create({ sessionId, role: 'bot', text: reply });
  res.json({ reply });
});

app.get('/', (_req, res) => {
  res.json({ status: 'Gumtree API running' });
});

// --- Upload endpoint ---
app.post('/api/upload', requireAuth, upload.single('image'), async (req, res) => {
  try {
    console.log('Upload request headers:', req.headers);
    console.log('Upload request body:', req.body);
    console.log('Upload request file:', req.file);
    
    if (!req.file) {
      console.error('No file in request. File field:', req.file);
      return res.status(400).json({ error: 'No file provided in request' });
    }
    
    console.log('Uploading to Cloudinary:', req.file.originalname, 'Size:', req.file.size);
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'auto', folder: 'gumtree' },
        (error, result) => {
          if (error) {
            console.error('Cloudinary error:', error);
            reject(error);
          } else {
            console.log('Upload success:', result.secure_url);
            resolve(result);
          }
        }
      );
      stream.end(req.file.buffer);
    });
    res.json({ url: result.secure_url });
  } catch (err) {
    console.error('Upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- Seed admin (RUN ONCE) ---
app.post('/api/admin/seed', async (req, res) => {
  const username = 'gumtreeply';
  const password = 'gumtre#001';
  const exists = await Admin.findOne({ username });
  if (exists) return res.json({ ok: true, message: 'Admin already exists' });
  const passwordHash = await bcrypt.hash(password, 10);
  await Admin.create({ username, passwordHash });
  res.json({ ok: true });
});

// --- Login ---
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body || {};
  const a = await Admin.findOne({ username });
  if (!a) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, a.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: a._id, username }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '7d' });
  res.json({ token });
});


app.listen(process.env.PORT || 4000, () => {
  console.log('API on http://localhost:' + (process.env.PORT || 4000));
});
