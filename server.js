/*
 * autohook.js
 * Copyright (C) 2019 zuzak <zuzak@saraneth>
 *
 * Distributed under terms of the MIT license.
 */
const { Autohook } = require('twitter-autohook')
const c = require('irc-colors')
const chalk = require('chalk')
c.verified = c.cyan
c.unverified = c.teal

let COUNTER = 1

const dgram = require('dgram')

const config = {
  block: true,
  create: true,
  follow: true,
  like: true,
  reply: true,
  retweet: true
}

const cache = {
  favourite: {},
  follow: {},
  create: {}
}

let no = 0
const output = (type, str) => {
  no++
  if (config[type]) {
    COUNTER = 0
    sendUdp(str)
    process.stdout.write({
      create: chalk.blue('[create]' + no),
      follow: chalk.yellow('[follow]' + no),
      like: chalk.red('[ like ]' + no),
      reply: chalk.magenta('[reply ]' + no),
      retweet: chalk.cyan('[  RT  ]' + no)
    }[type])
  }
}

const PORT = process.env.UDP_PORT
const HOST = process.env.UDP_HOST
const sendUdp = (str) => {
  const message = Buffer.from(str)
  const client = dgram.createSocket('udp4')
  client.send(message, 0, message.length, PORT, HOST, function (err, bytes) {
    if (err) throw err
    // console.log('UDP message sent to ' + HOST + ':' + PORT)
    client.close()
  })
}

const ƛ = async () => {
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
        if (cache.favourite[data.id]) return console.log('duplicate favourite')
        cache.favourite[data.id] = data.id
        output('like', [
          data.user.verified ? c.verified(`@${data.user.screen_name}`) : c.unverified(`@${data.user.screen_name}`),
          c.white(data.user.name),
          c.underline.cyan('liked'),
          c.gray(`https://twitter.com/${data.favorited_status.user.screen_name}/status/${data.favorited_status.id_str}`),
          c.red(`❤ ${data.favorited_status.favorite_count.toLocaleString('en-GB')}`)
        ].join(' '))
      })
    } else if (event.follow_events) {
      event.follow_events.forEach((data) => {
        if (cache.follow[data.id]) return console.log('duplicate follow')
        cache.follow[data.id] = data.id
        output('follow', [
          data.source.verified ? c.verified(`@${data.source.screen_name}`) : c.unverified(`@${data.source.screen_name}`),
          c.white(data.source.name),
          data.source.verified ? c.cyan.bgblue('verified') : `(${data.source.followers_count.toLocaleString('en-GB')} followers)`,
          c.underline.pink(`followed ${data.target.screen_name}`),
          c.gray(`https://twitter.com/${data.source.screen_name}`),
          c.blue(`👥 ${data.target.followers_count.toLocaleString('en-GB')}`),
          data.target.followers_count % 1000 === 0 ? '⭐'.repeat(Math.floor(data.target.followers_count / 1000)) : null
        ].filter((n) => n !== null).join(' '))
      })
    } else {
      if (event.tweet_create_events) {
        event.tweet_create_events.forEach((data) => {
          if (cache.create[data.id]) return console.log('duplicate create')
          cache.create[data.id] = data.id
          let type = 'create'
          if (data.retweeted_status) type = 'retweet'
          if (data.in_reply_to_screen_name) type = 'reply'
          output(type, [
            data.user.verified ? c.verified(`@${data.user.screen_name}`) : c.unverified(`@${data.user.screen_name}`),
            data.user.verified ? c.cyan.bgblue.white(data.user.name) : c.white(data.user.name),
            data.is_quote_status ? c.underline.lime('quoted') : null, // c.underline.lime('retweeted'),
            data.text.replace(/\n|\r/g, ' ').replace('RT @BBCBweaking:', c.underline.lime('RT @BBCBweaking:')),
            data.quoted_status ? c.silver(`RT ${data.quoted_status.text}`) : null,
            data.retweeted_status ? c.green(`↺ ${data.retweeted_status.retweet_count.toLocaleString('en-GB')}`) : null
          ].filter((n) => n !== null).join(' '))
        })
      } else if (event.block_events) {
          event.block_events.forEach((data) => {
            output('block', [
              c.teal('@' + data.source.screen_name),
              c.white(data.source.name),
              c.red(data.type + 'ed'),
              c.brown('@' + data.target.screen_name),
              c.white(data.target.name),
            ].filter((n) => n !== null).join(' '))
          })
      } else {
        console.log(event)
      }
    }
  })

  // Starts a server and adds a new webhook
  await webhook.start()

  // Subscribes to a user's activity
  await webhook.subscribe({ oauth_token: process.env.OAUTH_TOKEN, oauth_token_secret: process.env.OAUTH_TOKEN_SECRET })
}

const incrementCounter = () => {
  COUNTER++
  process.stdout.write(chalk.gray(String(COUNTER).padStart(2, '0')))
  if (COUNTER > 70) process.exit()
}
setInterval(incrementCounter, 1000)
ƛ()
