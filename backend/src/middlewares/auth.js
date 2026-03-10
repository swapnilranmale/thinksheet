import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "secret";
const TENANT_ID = process.env.TENANT_ID || "thinkitive_inc";

export const authenticate = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const token = header.split(" ")[1];
    req.user = jwt.verify(token, JWT_SECRET);
    req.tenantIdString = req.user.tenant_id || TENANT_ID;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

export const checkActive = (req, res, next) => {
  if (req.user && req.user.is_active === false) {
    return res.status(403).json({ error: "Account is inactive" });
  }
  next();
};

export const authorize = (roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      error: "Access denied",
      message: `Required role: ${roles.join(" or ")}. Your role: ${req.user.role}`
    });
  }
  next();
};
