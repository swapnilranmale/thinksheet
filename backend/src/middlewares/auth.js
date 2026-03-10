import jwt from "jsonwebtoken";

export const authenticate = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const token = header.split(" ")[1];
    // Accept tokens from both ThinkSheet and Streamline (same JWT_SECRET)
    req.user = jwt.verify(token, process.env.JWT_SECRET || "secret");
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
