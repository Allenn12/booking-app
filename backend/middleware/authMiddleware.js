
function authMiddleware(req, res, next) {
  try {
    if (process.env.NODE_ENV === 'development') {
        console.log('🔐 authMiddleware pozvan za:', req.url);
    }

    if (!req.session || !req.session.userId || !req.session.authenticated) {
      if (process.env.NODE_ENV === 'development') {
          console.log('❌ Nema validne sesije');
      }

      if (req.originalUrl.startsWith('/api/')) {
        if (process.env.NODE_ENV === 'development') {
            console.log('→ API route, vrati JSON 401');
        }
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
          code: 'AUTH_REQUIRED'
        });
      } else {
        if (process.env.NODE_ENV === 'development') {
            console.log('→ Browser route, redirect na /login');
        }
        return res.redirect('/login?error=not_authenticated');
      }
    }

    req.user = {
      id: req.session.userId,
      email: req.session.userEmail,
    };


    next();
  } catch (error) {
    console.error('❌ authMiddleware error:', error);
    next(error);
  }
}

export default authMiddleware;
