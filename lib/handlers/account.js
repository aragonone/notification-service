import jwt from 'jsonwebtoken'
import { sendConfirmationEmail } from '../service/mail'
import { TOKEN_EXPIRATION_PERIOD } from '../constants'

/**
 * Login/Registration handler
 * Generates a short lived verification token and sends an email
 */
export function loginHandler(request, h) {
  const { email } = request.payload
  // TODO: save to DB and add userID to token
  // Two cases:
  // new user -> save to DB, generate short lived token and email it
  // returning user -> check in DB, generate short lived token and email it

  const userToken = jwt.sign({ email }, process.env.JWT_KEY, {
    algorithm: 'HS256',
    expiresIn: TOKEN_EXPIRATION_PERIOD,
  })

  sendConfirmationEmail(email, userToken)

  return h.response().code(200)
}
