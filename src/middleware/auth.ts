import { Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
const JWT_SECRET = process.env.JWT_SECRET || 'cvflow-secret'
export const authenticate = (req: any, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1]
  try { const decoded: any = jwt.verify(token, JWT_SECRET); req.userId = decoded.userId; next() }
  catch { res.status(401).json({ error: 'Token invalide' }) }
}