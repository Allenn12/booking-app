import User from '../models/User.js';
import { ERRORS } from '../utils/errors.js';

export async function verifyEmailMiddleware(req, res, next) {
  try {
    // Provjeri sesiju
    const userId = req.session.userId;
    
    if (!userId) {
      return res.redirect('/register?error=session_expired');
    }
    
    // Pronađi korisnika iz DB
    const user = await User.getByUserId(userId);
    
    if (!user) {
      req.session.destroy(()=>{
        res.clearCookie('connect.sid', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
            });
      });
      return res.redirect('/register?error=user_not_found');
    }
    
    // Ako je već verificiran → redirect /dashboard
    if (user.verification_level === 'active') {
      console.log('User je verificiran');
      //return res.redirect('/dashboard');
    }
    
    // Ako NIJE u 'pending' → greška
    if (user.verification_level !== 'email_pending') {
      return res.redirect('/register?error=invalid_status');
    }
    
    // OK - spremi u req
    req.verifyEmailData = {
      userEmail: user.email,
      userId: user.id
    };
    
    next();
    
  } catch (error) {
    next(error);
  }
}

export default verifyEmailMiddleware;
