
function authMiddleware(req, res, next) {
  try {
    console.log('🔐 authMiddleware pozvan za:', req.url);
    console.log('📦 SESSION U MIDDLEWARE:', {
      id: req.sessionID,
      data: req.session,
    });

    if (!req.session || !req.session.userId || !req.session.authenticated) {
      console.log('❌ Nema validne sesije');

      if (req.originalUrl.startsWith('/api/')) {
        console.log('→ API route, vrati JSON 401');
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
          code: 'AUTH_REQUIRED'
        });
      } else {
        console.log('→ Browser route, redirect na /login');
        return res.redirect('/login?error=not_authenticated');
      }
    }

    req.user = {
      id: req.session.userId,
      email: req.session.userEmail,
    };

    console.log('✅ Sesija validna, userId:', req.session.userId);
    next();
  } catch (error) {
    console.error('❌ authMiddleware error:', error);
    next(error);
  }
}

export default authMiddleware;
