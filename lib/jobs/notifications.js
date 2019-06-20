import db from '../service/database'
import { sendNotificationEmail } from '../service/mail'
import web3, { getLatestBlock } from '../service/web3'

export default async function notificationsTask() {
  console.log('--- notificationsTask | Start')
  // select count(contract_address),min(from_block), contract_address, event_name from subscriptions group by contract_address, event_name
  // select contract_address,min(from_block), contract_address, event_name from subscriptions group by contract_address, event_name
  // eslint-disable-next-line no-unused-vars
  const fiveMinsAgo = new Date(Date.now() - 1000 * 60 * 5)

  const subscriptionsPromise = db('subscriptions')
    .select(
      'subscriptions.app_name as appName',
      'subscriptions.contract_address as contractAddress',
      'subscriptions.abi',
      'subscriptions.event_name as eventName',
      'subscriptions.user_id as userId',
      'subscriptions.from_block as fromBlock',
      'subscriptions.subscription_id as subscriptionId',
      'users.email as email'
    )
    .whereNull('last_poll')
    .orWhere('last_poll', '<=', fiveMinsAgo.toISOString())
    .join('users', 'users.user_id', '=', 'subscriptions.user_id')
    .orderBy('subscriptions.last_poll')

  const latestBlockPromise = getLatestBlock()

  const [subscriptions, latestBlock] = await Promise.all([
    subscriptionsPromise,
    latestBlockPromise,
  ])

  const eventPromises = subscriptions.map(subscription => {
    const {
      abi,
      contractAddress,
      eventName,
      fromBlock,
      subscriptionId,
      email,
    } = subscription
    // console.log('WOOT', email)

    const contract = new web3.eth.Contract(abi, contractAddress)

    return contract
      .getPastEvents(eventName, { fromBlock, toBlock: latestBlock })
      .then(events => {
        // console.log(`${contractAddress} -> ${eventName}`, events)

        if (events.length > 0) {
          sendNotificationEmail(email, events)
        }

        return db('subscriptions')
          .where({ subscription_id: subscriptionId })
          .update({
            last_poll: new Date().toISOString(),
            from_block: latestBlock,
          })
      })
  })

  await Promise.all(eventPromises)
  console.log('--- notificationsTask | End')
}
