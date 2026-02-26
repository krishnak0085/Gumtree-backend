import express from "express";
import Product from "../models/Product.js";

const router = express.Router();

// Get all products (admin)
router.get("/", async (req, res) => {
  const items = await Product.find().sort({ createdAt: -1 });
  res.json(items);
});

// Add product
router.post("/", async (req, res) => {
  try {
    console.log('Creating product with data:', req.body);
    const p = await Product.create(req.body);
    console.log('Product created:', p);
    res.json(p);
  } catch (err) {
    console.error('Create error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// Update product
router.put("/:id", async (req, res) => {
  try {
    // Only update fields that are provided (use $set for partial updates)
    const p = await Product.findByIdAndUpdate(
      req.params.id, 
      { $set: req.body }, 
      { new: true, runValidators: true }
    );
    if (!p) return res.status(404).json({ error: 'Product not found' });
    res.json(p);
  } catch (err) {
    console.error('Update error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// Delete product
router.delete("/:id", async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

export default router;
