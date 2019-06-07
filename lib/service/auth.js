import db from './database'
import Joi from '@hapi/joi'

export async function validateMagiclink(decoded, request, h) {
  const { email } = decoded

  if (!email) {
    request.log(['error', 'auth'], 'Token has no email')
    return { isValid: false }
  }

  const users = await db('users')
    .select('email')
    .where({ email })

  if (users.length === 0) {
    return { isValid: false, errorMessage: 'User not found' }
  }

  return { isValid: true }
}

export async function validateUser(decoded, request, h) {
  // TODO: check for email in DB an ensure verified

  // console.log(' - - - - - - - decoded token:')
  // console.log(decoded)
  // console.log(' - - - - - - - request info:')
  // console.log(request.info)
  // console.log(' - - - - - - - user agent:')
  // console.log(request.headers['user-agent'])

  return { isValid: true }

  // // do your checks to see if the person is valid
  // if (!people[decoded.id]) {
  //   return { isValid: false };
  // }
  // else {
  // }
}
