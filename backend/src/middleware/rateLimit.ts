import rateLimit from 'express-rate-limit'

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: {
      message: 'Demasiados intentos de login. Espera unos minutos y vuelve a intentarlo.'
    }
  }
})

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: {
      message: 'Demasiadas peticiones. Intentalo de nuevo en unos segundos.'
    }
  }
})
