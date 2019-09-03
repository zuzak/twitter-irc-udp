/*
 * autohook.js
 * Copyright (C) 2019 zuzak <zuzak@saraneth>
 *
 * Distributed under terms of the MIT license.
 */
const { Autohook } = require('twitter-autohook')
const c = require('irc-colors')

let dgram = require('dgram')

const output = (str) => {
  console.log(str)
  sendUdp(str)
}

const PORT = process.env.UDP_PORT
const HOST = process.env.UDP_HOST
const sendUdp = (str) => {
  let message = Buffer.from(str)
  let client = dgram.createSocket('udp4')
  client.send(message, 0, message.length, PORT, HOST, function (err, bytes) {
    if (err) throw err
    console.log('UDP message sent to ' + HOST + ':' + PORT)
    client.close()
  })
}

(async ƛ => {
  const webhook = new Autohook({
    serverUrl: process.env.SERVER_URL,
    route: '/foo',
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    token: process.env.TWITTER_ACCESS_TOKEN,
    token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    env: process.env.TWITTER_WEBHOOK_ENV,
    port: process.env.SERVER_PORT
  })

  // Removes existing webhooks
  await webhook.removeWebhooks()

  // Listens to incoming activity
  webhook.on('event', event => {
    if (event.favorite_events) {
      event.favorite_events.forEach((data) => {
        output([
          c.teal(`@${data.user.screen_name}`),
          c.white(data.user.name),
          c.underline.cyan('liked'),
          c.gray(`https://twitter.com/${data.favorited_status.user.screen_name}/status/${data.favorited_status.id_str}`),
          c.red(`❤ ${data.favorited_status.favorite_count}`)
        ].join(' '))
      })
    } else if (event.follow_events) {
      event.follow_events.forEach((data) => {
        output([
          c.teal(`@${data.source.screen_name}`),
          c.white(data.source.name),
          data.source.verified ? c.cyan.bgblue('verified') : `(${data.source.followers_count} followers)`,
          c.underline.lime('followed'),
          c.gray(`https://twitter.com/${data.target.screen_name}`),
          c.blue(`👥 ${data.target.followers_count.toLocaleString('en-GB')}`)
        ].join(' '))
      })
    } else {
      if (event.tweet_create_events) {
        event.tweet_create_events.forEach((data) => {
          if (data.retweeted_status) {
            output([
              c.teal(`@${data.user.screen_name}`),
              c.white(data.user.name),
              c.underline.pink('retweeted'),
              c.gray(`https://twitter.com/${data.retweeted_status.user.screen_name}/status/${data.retweeted_status.id_str}`),
              c.purple(`↺ ${data.retweeted_status.retweet_count}`),
              data.is_quote_status ? c.bold.black.bgyellow('has quote') : ''
            ].join(' '))
          }
        })
      }
      console.log(event)
      console.log(JSON.stringify(event))
    }
  })

  // Starts a server and adds a new webhook
  await webhook.start()

  // Subscribes to a user's activity
  await webhook.subscribe({oauth_token: process.env.OAUTH_TOKEN, oauth_token_secret: process.env.OAUTH_TOKEN_SECRET})
})()
