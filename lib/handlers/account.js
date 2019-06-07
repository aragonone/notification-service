import jwt from 'jsonwebtoken'
import { sendConfirmationEmail } from '../service/mail'
import db from '../service/database'
import { MAGICLINK_EXPIRATION_PERIOD } from '../constants'
import Boom from '@hapi/boom'
/**
 * Login/Registration handler
 * Generates a short lived verification token and sends an email
 */
export async function loginHandler(request, h) {
  const { email } = request.payload
  try {
    const rows = await db('users')
      .select('email')
      .where({ email })

    if (rows.length === 0) {
      // user doesn't exist - persist first
      await db('users').insert({ email })
    }
    // generate token and send email
    // TODO: Perhaps magic link tokens should be stateful one use
    const userToken = getMagicLinkToken(email)
    await sendConfirmationEmail(email, userToken)
    return h.response().code(200)
  } catch (error) {
    throw Boom.badImplementation(error.message)
  }
}

function getMagicLinkToken(email) {
  return jwt.sign({ email }, process.env.JWT_KEY, {
    algorithm: 'HS256',
    expiresIn: MAGICLINK_EXPIRATION_PERIOD,
  })
}
