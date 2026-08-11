import { BotGuardClient } from 'bgutils-js/botguard'
import { buildURL, GOOG_API_KEY, parseLooseJSON } from 'bgutils-js/utils'
import { WebPoMinter } from 'bgutils-js/webpo'

// This script has it's own webpack config, as it gets passed as a string to Electron's evaluateJavaScript function
// in src/main/poTokenGenerator.js

/**
 * Gets the attestation challenge from a YouTube page, along with the `yt.config_`
 * it belongs to.
 *
 * YouTube is rolling out an experiment that binds the challenge to the `EVENT_ID`
 * in the same page's `yt.config_`. Sessions in that experiment reject a token minted
 * from a standalone `/att/get` challenge and answer SABR requests with
 * `StreamProtectionStatus` 2 — YouTube serves a small cold-start allowance and then
 * stops sending media, which stalls playback partway through a video.
 *
 * Approach taken from FreeTube PR #9584 (closed unmerged) and BgUtils PR #44.
 * @returns {Promise<object>} the `bgChallenge`-bearing challenge data
 */
async function getPageBoundChallenge() {
  const pageResponse = await fetch('https://www.youtube.com/', {
    headers: {
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.7'
    }
  })

  if (!pageResponse.ok) {
    throw new Error(`Request to ${pageResponse.url} failed with status ${pageResponse.status}`)
  }

  const pageHtml = await pageResponse.text()
  const ytConfigText = pageHtml.match(/ytcfg\.set\(({.+?})\);/s)?.[1]
  const initialAttestationText = pageHtml.match(/window\.ytAtN\(\s*({[\s\S]*?})\s*\)/)?.[1]

  if (!ytConfigText || !initialAttestationText) {
    throw new Error('Could not find the page-bound attestation data')
  }

  window.yt = { config_: JSON.parse(ytConfigText) }

  return parseLooseJSON(initialAttestationText).R
}

/**
 * Gets an attestation challenge from the standalone `/att/get` endpoint.
 *
 * Kept as a fallback: the page-bound path above scrapes YouTube's homepage markup,
 * so a layout change there would otherwise stop tokens being minted at all and break
 * playback outright. Falling back to this degrades to the previous behaviour (working
 * playback, except in sessions caught by the page-binding experiment) instead.
 * @param {import('youtubei.js').Session['context']} context
 * @returns {Promise<object>} the `bgChallenge`-bearing challenge data
 */
async function getStandaloneChallenge(context) {
  const challengeResponse = await fetch(
    'https://www.youtube.com/youtubei/v1/att/get?prettyPrint=false&alt=json',
    {
      method: 'POST',
      headers: {
        Accept: '*/*',
        'Content-Type': 'application/json',
        'X-Goog-Visitor-Id': context.client.visitorData,
        'X-Youtube-Client-Version': context.client.clientVersion,
        'X-Youtube-Client-Name': '1'
      },
      body: JSON.stringify({
        engagementType: 'ENGAGEMENT_TYPE_UNBOUND',
        context
      }),
    }
  )

  if (!challengeResponse.ok) {
    throw new Error(`Request to ${challengeResponse.url} failed with status ${challengeResponse.status}\n${await challengeResponse.text()}`)
  }

  return await challengeResponse.json()
}

/**
 * Based on: https://github.com/LuanRT/BgUtils/blob/main/examples/node/innertube-challenge-fetcher-example.ts
 * @param {string} videoId
 * @param {import('youtubei.js').Session['context']} context
 */
export default async function (videoId, context) {
  const requestKey = 'O43z0dpjhgX20SCx4KAo'

  let challengeData

  try {
    challengeData = await getPageBoundChallenge()
  } catch (error) {
    console.warn('Page-bound attestation failed, falling back to /att/get', error)
    challengeData = await getStandaloneChallenge(context)
  }

  if (!challengeData?.bgChallenge) {
    throw new Error('Failed to get BotGuard challenge')
  }

  let interpreterUrl = challengeData.bgChallenge.interpreterUrl.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue

  if (interpreterUrl.startsWith('//')) {
    interpreterUrl = `https:${interpreterUrl}`
  }

  const bgScriptResponse = await fetch(interpreterUrl)
  const interpreterJavascript = await bgScriptResponse.text()

  if (interpreterJavascript) {
    // eslint-disable-next-line no-new-func
    new Function(interpreterJavascript)()
  } else {
    throw new Error('Could not load VM.')
  }

  const botGuard = await BotGuardClient.create({
    program: challengeData.bgChallenge.program,
    globalName: challengeData.bgChallenge.globalName,
    globalObject: window
  })

  const webPoSignalOutput = []
  const botGuardResponse = await botGuard.snapshot({ webPoSignalOutput }, 10_000)

  const integrityTokenResponse = await fetch(buildURL('GenerateIT', true), {
    method: 'POST',
    headers: {
      'content-type': 'application/json+protobuf',
      'x-goog-api-key': GOOG_API_KEY,
      'x-user-agent': 'grpc-web-javascript/0.1',
    },
    body: JSON.stringify([requestKey, botGuardResponse])
  })

  const response = await integrityTokenResponse.json()

  if (typeof response[0] !== 'string') {
    throw new Error('Could not get integrity token')
  }

  const integrityTokenBasedMinter = await WebPoMinter.create({ integrityToken: response[0] }, webPoSignalOutput)

  return await integrityTokenBasedMinter.mintAsWebsafeString(videoId)
}
