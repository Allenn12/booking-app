export default function publicMiddleware(req, res, next) {
  console.log('🌍 Public guard - provjera sesije za:', req.url);

  if (req.session && req.session.userId && req.session.authenticated) {
    console.log('✅ Logiran korisnik na public ruti, redirect na /dashboard');
    return res.redirect('/dashboard');
  }

  console.log('ℹ️ Nema sesije, nastavi na public rutu');
  next(); // Nastavi na /login, /register, /
}