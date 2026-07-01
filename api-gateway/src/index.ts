import express from 'express';
import cors from 'cors';
import httpProxy from 'http-proxy';
import jwt from 'jsonwebtoken';

const app = express();
const proxy = httpProxy.createProxyServer();

const AUTH_URL = process.env.AUTH_URL || 'http://auth-service:3001';
const USER_URL = process.env.USER_URL || 'http://user-service:3002';
const EXAM_URL = process.env.EXAM_URL || 'http://exam-service:3003';
const SUBMISSION_URL = process.env.SUBMISSION_URL || 'http://submission-service:3004';
const RESULT_URL = process.env.RESULT_URL || 'http://result-service:3005';

const SECRET_KEY = process.env.JWT_SECRET || 'khanh_secret_key_2026';

// 👇 FIX LỖI CORS: Đảm bảo mọi request OPTIONS đều được thông chốt mượt mà
app.use(cors());
app.options('*', cors()); 

// --- 🛡️ CƠ CHẾ TRUYỀN TIN (HEADER PROPAGATION) ---
proxy.on('proxyReq', (proxyReq, req: any, res, options) => {
    if (req.user) {
        proxyReq.setHeader('x-user-id', req.user.id || '');
        proxyReq.setHeader('x-user-roles', (req.user.roles || []).join(','));
    }
    proxyReq.setHeader('x-service-token', process.env.SERVICE_TOKEN || 'service_token');
});

proxy.on('error', (err, req, res: any) => {
    console.error('[GATEWAY ERROR]:', err.message);
    if (!res.headersSent) {
        res.status(502).json({ error: 'Dịch vụ nội bộ đang bận hoặc bảo trì' });
    }
});

// --- 🔐 MIDDLEWARES XÁC THỰC ---
const verifyJwt = (req: any, res: any, next: any) => {
    // 👇 FIX BỔ SUNG: Bỏ qua hoàn toàn việc check JWT nếu là request OPTIONS
    if (req.method === 'OPTIONS') return next();

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: "Vui lòng đăng nhập" });

    jwt.verify(token, SECRET_KEY, (err: any, decoded: any) => {
        if (err) return res.status(403).json({ error: "Phiên làm việc hết hạn" });
        req.user = decoded; 
        next();
    });
};

const requireRole = (...allowedRoles: string[]) => {
    return (req: any, res: any, next: any) => {
        if (req.method === 'OPTIONS') return next();
        
        const roles = req.user?.roles || [];
        const hasRole = allowedRoles.some((r: string) => roles.includes(r));
        if (!hasRole) return res.status(403).json({ error: "Bạn không có quyền thực hiện" });
        next();
    };
};

const proxyTo = (target: string) => (req: any, res: any) => {
    console.log(`[PROXY] ${req.method} ${req.originalUrl} -> ${target}${req.url}`);
    proxy.web(req, res, { target, changeOrigin: true });
};

// --- 🚀 ROUTING ---

app.use("/auth", (req: any, res: any) => {
    req.url = req.url.replace(/^\/auth/, "");
    proxyTo(AUTH_URL)(req, res);
});

app.use("/exams", (req: any, res: any, next) => {
    if (req.originalUrl.includes("/banks/")) {
        return verifyJwt(req, res, () => {
            requireRole("teacher", "admin")(req, res, () => proxyTo(EXAM_URL)(req, res));
        });
    }

    if (req.method === "GET" && !req.originalUrl.includes("/internal/")) {
        return proxyTo(EXAM_URL)(req, res);
    }
    
    verifyJwt(req, res, () => {
        requireRole("teacher", "admin")(req, res, () => proxyTo(EXAM_URL)(req, res));
    });
});

app.use("/submissions", verifyJwt, (req: any, res: any, next) => {
    if (req.path.includes("/regrade/")) {
        return requireRole("teacher", "admin")(req, res, () => proxyTo(SUBMISSION_URL)(req, res));
    }
    proxyTo(SUBMISSION_URL)(req, res);
});

app.use("/results", verifyJwt, (req: any, res: any, next) => {
    if (req.path.startsWith("/exam/")) {
        return requireRole("teacher", "admin")(req, res, () => proxyTo(RESULT_URL)(req, res));
    }
    proxyTo(RESULT_URL)(req, res);
});

app.use("/users", verifyJwt, proxyTo(USER_URL));

app.get("/", (req, res) => res.json({ status: "Gateway is Online", time: new Date() }));

const PORT = 4000;
app.listen(PORT, () => console.log(`🚀 API GATEWAY READY (Anti-Pending & Role-Aware)`));