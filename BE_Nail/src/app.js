import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import homeRoutes from './routes/home.routes.js';
import serviceRoutes from './routes/service.routes.js';

export const app = express();
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.resolve(currentDirectory, '../public/uploads')));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'nailhouse-api' }));
app.use('/api/home', homeRoutes);
app.use('/api/services', serviceRoutes);

app.use((_req, res) => res.status(404).json({ message: 'API endpoint không tồn tại' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'Máy chủ đang gặp lỗi', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
});
