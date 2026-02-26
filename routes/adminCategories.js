import express from "express";
import Category from "../models/Category.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const cats = await Category.find();
  res.json(cats);
});

router.post("/", async (req, res) => {
  try {
    const { name, imageUrl } = req.body;
    const slug = name.toLowerCase().replace(/\s+/g, "-");

    console.log('Creating category:', { name, slug, imageUrl });

    // Check if already exists
    const existing = await Category.findOne({ slug });
    if (existing) {
      return res.status(400).json({ message: "Category already exists" });
    }

    const cat = await Category.create({ name, slug, imageUrl });
    console.log('Category created:', cat);
    res.json(cat);

  } catch (err) {
    console.error('Create category error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  await Category.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

export default router;