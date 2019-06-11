import db from './database'
import { AUTH_SCOPES } from '../constants'
import Joi from '@hapi/joi'

const magicLinkTokenSchema = {
  email: Joi.string()
    .email()
    .required(),
  scope: Joi.string()
    .valid(AUTH_SCOPES.MAGICLINK)
    .required(),
  iat: Joi.any(),
  exp: Joi.any(),
}

const apiTokenSchema = {
  email: Joi.string()
    .email()
    .required(),
  scope: Joi.string()
    .valid(AUTH_SCOPES.API)
    .required(),
  iat: Joi.any(),
  exp: Joi.any(),
}

export async function validateMagiclink(decoded, request, h) {
  const { email } = decoded
  const { error } = Joi.validate(decoded, magicLinkTokenSchema)

  if (error) {
    request.log(['error', 'auth'], `Magiclink token error: ${error.message}`)
    return { isValid: false }
  }

  const users = await db('users')
    .select('email')
    .where({ email })

  if (users.length === 1) {
    return { isValid: true }
  }

  return { isValid: false }
}

export async function validateAPIToken(decoded, request, h) {
  const { email } = decoded
  const { error } = Joi.validate(decoded, apiTokenSchema)

  if (error) {
    request.log(['error', 'auth'], `Magiclink token error: ${error.message}`)
    return { isValid: false }
  }

  const users = await db('users')
    .select('email', 'user_id')
    // ensure that the user is verified
    .where({ email, verified: true })

  if (users.length === 1) {
    const [{ user_id: userId }] = users
    // Add user_id from DB to credentials object accessbile in route handlers
    return {
      isValid: true,
      credentials: {
        ...decoded,
        userId,
      },
    }
  }

  return { isValid: false, errorMessage: 'User not found' }
}
