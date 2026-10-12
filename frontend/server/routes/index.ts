import { Router, Request, Response } from 'express';
import http from 'http';

const router = Router();

// Django 后端地址（前后端分离：Express 对外 5000，Django DRF 监听 8001）
const DJANGO_HOST = process.env.DJANGO_HOST || '127.0.0.1';
const DJANGO_PORT = parseInt(process.env.DJANGO_PORT || '8001', 10);

/**
 * `/api/**` 反向代理到 Django REST Framework 后端。
 * 前端 Vite/构建产物(SFC)与后端 Django 分离部署，通过本代理完成同源访问。
 */
router.use('/api', (req: Request, res: Response) => {
  const targetPath = req.originalUrl || req.url;

  const headers: Record<string, string | string[] | undefined> = {
    ...req.headers,
    host: `${DJANGO_HOST}:${DJANGO_PORT}`,
  };

  const proxyReq = http.request(
    {
      host: DJANGO_HOST,
      port: DJANGO_PORT,
      method: req.method,
      path: targetPath,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers as any);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (err: Error) => {
    console.error(`[proxy /api] Django backend error: ${err.message}`);
    if (!res.headersSent) {
      res.status(502).json({ error: `Django backend unavailable: ${err.message}` });
    } else {
      res.end();
    }
  });

  req.pipe(proxyReq);
});

export default router;