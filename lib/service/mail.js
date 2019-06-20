'use strict'

import { ARAGON_FROM_ADDRESS } from '../constants'
const postmark = require('postmark')

const client = new postmark.ServerClient(process.env.POSTMARK_SERVER_API_TOKEN)

// console.log(POSTMARK_SERVER_API_TOKEN)
export async function sendConfirmationEmail(email, token) {
  const emailOptions = {
    From: ARAGON_FROM_ADDRESS,
    To: email,
    Subject: `Confirm ${email} on Aragon Notifications Service`,
    HtmlBody: `
    We just need you to verify that this is your email account.
    Visit http://localhost:4000/verify?token=${token}`,
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('Testing mode email options', emailOptions)
    return
  }
  try {
    const response = await client.sendEmail(emailOptions)
    console.log('sent email', response)
  } catch (e) {
    console.log(e)
  }
}
