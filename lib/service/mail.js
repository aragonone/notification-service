'use strict'

import { ARAGON_FROM_ADDRESS, EMAIL_ALIASES } from '../constants'
const postmark = require('postmark')

if (!process.env.EXTERNAL_URL) {
  throw new Error('EXTERNAL_URL env var is required')
}

const client = new postmark.ServerClient(process.env.POSTMARK_SERVER_API_TOKEN)

export async function sendMagicLink(email, token) {
  // eslint-disable-next-line node/no-unsupported-features/node-builtins
  const actionUrl = new URL(
    `${process.env.EXTERNAL_URL}/verify?token=${token}`
  ).toString()

  const emailOptions = {
    From: ARAGON_FROM_ADDRESS,
    To: email,
    TemplateAlias: EMAIL_ALIASES.MAGICLINK,
    TemplateModel: { actionUrl },
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('Testing mode email options', emailOptions)
    return
  }
  try {
    const response = await client.sendEmailWithTemplate(emailOptions)
    console.log('sent email', response)
  } catch (e) {
    console.log(e)
  }
}
