export async function validate(decoded, request, h) {
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
