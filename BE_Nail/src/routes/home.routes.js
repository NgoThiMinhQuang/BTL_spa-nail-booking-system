import { Router } from 'express';
import { getHome, listDesigns, listRecentReviews } from '../controllers/home.controller.js';

const router = Router();
router.get('/', getHome);
router.get('/reviews/recent', listRecentReviews);
router.get('/designs', listDesigns);
export default router;
