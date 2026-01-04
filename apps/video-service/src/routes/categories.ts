import { Router, Request, Response } from "express";
import { prisma } from "@repo/database";

const router = Router();

/**
 * GET /categories
 * Fetch all video categories
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        iconUrl: true
      }
    });

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch categories" },
    });
  }
});

export default router;
